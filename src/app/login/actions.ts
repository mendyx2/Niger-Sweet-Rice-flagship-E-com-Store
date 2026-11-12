"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { normalizeNgPhone } from "@/lib/phone";
import { sendOtp, verifyOtp } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { createSession, destroySession, makeReferralCode, safeNext } from "@/lib/auth";

export type OtpState =
  | { step: "phone"; error?: string; phone?: string }
  | { step: "code"; phone: string; error?: string; devCode?: string; info?: string };

export async function requestCode(_prev: OtpState, formData: FormData): Promise<OtpState> {
  const raw = String(formData.get("phone") ?? "");
  const phone = normalizeNgPhone(raw);
  if (!phone) return { step: "phone", phone: raw, error: "Enter a valid Nigerian mobile number, e.g. 0801 234 5678." };

  const ip = await clientIp();
  if (!(await rateLimit(`otp-ip:${ip}`, 10, 15 * 60_000)).ok) {
    return { step: "phone", phone: raw, error: "Too many requests. Please wait a few minutes and try again." };
  }
  const r = await sendOtp(phone, ip);
  if (!r.ok) {
    return {
      step: "phone",
      phone: raw,
      error: r.error === "TOO_MANY"
        ? "We've sent several codes to this number. Please wait 15 minutes before asking for another."
        : "We couldn't send the SMS. Please check the number and try again.",
    };
  }
  return { step: "code", phone, devCode: r.devCode, info: "We sent a 6-digit code by SMS." };
}

export async function verifyCode(_prev: OtpState | null, formData: FormData): Promise<OtpState> {
  const phone = normalizeNgPhone(String(formData.get("phone") ?? ""));
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  const next = safeNext(String(formData.get("next") ?? ""));
  if (!phone) return { step: "phone", error: "Please enter your phone number again." };

  if (!(await rateLimit(`otp-verify:${phone}`, 10, 15 * 60_000)).ok) {
    return { step: "code", phone, error: "Too many attempts. Please request a new code in a few minutes." };
  }
  const r = await verifyOtp(phone, code);
  if (!r.ok) {
    const msg = {
      INVALID: "That code isn't right. Please check the SMS and try again.",
      EXPIRED: "That code has expired. Request a new one.",
      TOO_MANY_ATTEMPTS: "Too many wrong attempts. Request a new code.",
    }[r.error];
    return { step: "code", phone, error: msg };
  }

  let user = await db.user.findUnique({ where: { phone } });
  if (!user) {
    // First sign-in creates a buyer account. Attach a referrer if they arrived via a referral link.
    const refCode = (await cookies()).get("nsr_ref")?.value?.toUpperCase();
    const referrer = refCode ? await db.user.findUnique({ where: { referralCode: refCode } }) : null;
    for (let i = 0; i < 5 && !user; i++) {
      try {
        user = await db.user.create({
          data: { phone, referralCode: makeReferralCode(null), referredById: referrer?.id ?? null },
        });
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002") throw e; // retry only on referral-code collision
        user = await db.user.findUnique({ where: { phone } }); // or a parallel sign-up won
      }
    }
    if (!user) throw new Error("Could not create account");
  }
  await createSession(user.id);
  redirect(next);
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
