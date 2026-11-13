import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * One-time-ish link codes for connecting a Telegram chat, used in
 * t.me/<bot>?start=<code>. Signed so nobody can guess a code for someone
 * else's account; valid for an hour. Telegram allows [A-Za-z0-9_-], max 64 chars.
 */
const TTL_SECONDS = 3600;

const sig = (payload: string, secret: string) => createHmac("sha256", secret).update(`tg:${payload}`).digest("hex").slice(0, 16);

export function makeLinkCode(target: { userId: string } | "hq", secret: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000 + TTL_SECONDS).toString(36);
  const payload = target === "hq" ? `hq-${exp}` : `u-${target.userId}-${exp}`;
  return `${payload}-${sig(payload, secret)}`;
}

export function readLinkCode(code: string, secret: string, now = Date.now()): { userId: string } | "hq" | null {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(code)) return null;
  const parts = code.split("-");
  const given = parts.pop()!;
  const payload = parts.join("-");
  const expected = sig(payload, secret);
  if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;
  const exp = parseInt(parts.at(-1)!, 36);
  if (!Number.isFinite(exp) || exp * 1000 < now) return null;
  if (parts[0] === "hq" && parts.length === 2) return "hq";
  if (parts[0] === "u" && parts.length === 3 && /^[a-z0-9]{10,40}$/.test(parts[1])) return { userId: parts[1] };
  return null;
}
