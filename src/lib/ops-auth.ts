import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";

/**
 * TEMPORARY staff access for /ops: one shared passphrase (OPS_PASSWORD) and a
 * signed, httpOnly session cookie. Phase 2 replaces this with per-person
 * phone-OTP staff accounts, roles and 2FA.
 */
const COOKIE = "nsr_ops";
const MAX_AGE_SECONDS = 12 * 60 * 60;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters).");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  // Hash first so lengths always match and timing doesn't leak length.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkOpsPassword(input: string): boolean {
  const expected = process.env.OPS_PASSWORD;
  if (!expected || expected.length < 12) return false; // refuse weak/unset config
  return safeEqual(input, expected);
}

export async function startOpsSession() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = `staff.${exp}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endOpsSession() {
  (await cookies()).delete(COOKIE);
}

export async function isOpsSession(): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const i = raw.lastIndexOf(".");
  if (i < 0) return false;
  const payload = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  if (!safeEqual(sig, sign(payload))) return false;
  const exp = Number(payload.split(".")[1]);
  await connection(); // the expiry check must run per request, never during prerender/prefetch
  return Number.isFinite(exp) && exp > Date.now() / 1000;
}

/** Call at the top of every /ops page AND every ops server action. */
export async function requireOps(): Promise<string> {
  if (!(await isOpsSession())) redirect("/ops/login");
  return "staff";
}
