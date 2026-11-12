import "server-only";
import { db } from "./db";
import { hashIp, hmac, randomDigits, safeEqual } from "./crypto";
import { sendSms } from "./sms";
import { site } from "./site";

const CODE_TTL_MS = 10 * 60_000;
const MAX_SENDS_PER_PHONE_15M = 3;
const MAX_SENDS_PER_PHONE_DAY = 10;
const MAX_VERIFY_ATTEMPTS = 5;

const codeHash = (phone: string, code: string) => hmac(`otp:${phone}:${code}`);

export type OtpSendResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: "TOO_MANY" | "SMS_FAILED" };

export async function sendOtp(phone: string, ip: string): Promise<OtpSendResult> {
  const now = Date.now();
  const [recent, today] = await Promise.all([
    db.otpCode.count({ where: { phone, createdAt: { gte: new Date(now - 15 * 60_000) } } }),
    db.otpCode.count({ where: { phone, createdAt: { gte: new Date(now - 24 * 3600_000) } } }),
  ]);
  if (recent >= MAX_SENDS_PER_PHONE_15M || today >= MAX_SENDS_PER_PHONE_DAY) return { ok: false, error: "TOO_MANY" };

  const code = randomDigits(6);
  await db.otpCode.create({
    data: { phone, codeHash: codeHash(phone, code), expiresAt: new Date(now + CODE_TTL_MS), ipHash: hashIp(ip) },
  });
  const sent = await sendSms(phone, `${code} is your ${site.name} login code. It expires in 10 minutes. Do not share it with anyone.`);
  if (!sent.ok) return { ok: false, error: "SMS_FAILED" };

  // Shown on screen ONLY in local development without an SMS provider.
  const devCode = process.env.NODE_ENV !== "production" && !process.env.TERMII_API_KEY ? code : undefined;
  return { ok: true, devCode };
}

export type OtpVerifyResult = { ok: true } | { ok: false; error: "INVALID" | "EXPIRED" | "TOO_MANY_ATTEMPTS" };

export async function verifyOtp(phone: string, code: string): Promise<OtpVerifyResult> {
  const otp = await db.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt.getTime() < Date.now()) return { ok: false, error: "EXPIRED" };
  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) return { ok: false, error: "TOO_MANY_ATTEMPTS" };

  if (!/^\d{6}$/.test(code) || !safeEqual(otp.codeHash, codeHash(phone, code))) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: otp.attempts + 1 >= MAX_VERIFY_ATTEMPTS ? "TOO_MANY_ATTEMPTS" : "INVALID" };
  }
  // Consume atomically so a code can only be used once.
  const { count } = await db.otpCode.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } });
  return count === 1 ? { ok: true } : { ok: false, error: "EXPIRED" };
}
