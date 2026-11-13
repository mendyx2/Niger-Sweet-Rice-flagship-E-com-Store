import "server-only";
import { headers } from "next/headers";

/**
 * The visitor's IP, for rate limits. The first entry of X-Forwarded-For is
 * whatever the visitor's own browser or script sent, so it can't be trusted.
 * Use the header the host sets itself (Vercel), else the entry added by the
 * last proxy in front of the app.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fromHost = h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip");
  if (fromHost) return fromHost.split(",")[0].trim();
  const chain = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return chain.at(-1) ?? "unknown";
}
