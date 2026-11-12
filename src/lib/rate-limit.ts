import "server-only";

/**
 * Fixed-window rate limiter. Uses Upstash Redis (REST API) when
 * UPSTASH_REDIS_REST_URL/TOKEN are set, so limits are shared by every server
 * instance; otherwise an in-memory window (fine for a single server or dev).
 * If Redis is unreachable it falls back to memory rather than blocking shoppers.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfterMs: b.resetAt - now };
  b.count++;
  return { ok: true, retryAfterMs: 0 };
}

async function redisLimit(url: string, token: string, key: string, limit: number, windowMs: number) {
  const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([["INCR", `rl:${key}`], ["PEXPIRE", `rl:${key}`, String(windowMs), "NX"], ["PTTL", `rl:${key}`]]),
    signal: AbortSignal.timeout(1500),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const [incr, , ttl] = (await res.json()) as { result: number }[];
  return incr.result <= limit ? { ok: true, retryAfterMs: 0 } : { ok: false, retryAfterMs: Math.max(ttl.result, 0) };
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterMs: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      return await redisLimit(url, token, key, limit, windowMs);
    } catch (e) {
      console.error("[rate-limit] redis unavailable, using memory", e);
    }
  }
  return memoryLimit(key, limit, windowMs);
}
