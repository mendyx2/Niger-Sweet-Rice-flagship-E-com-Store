import { createHmac, timingSafeEqual } from "node:crypto";

/** Paystack signs webhook bodies with HMAC-SHA512 using your secret key (header: x-paystack-signature). */
export function isValidPaystackSignature(rawBody: string, signature: string | null, secretKey: string): boolean {
  if (!signature || !secretKey) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Our payment reference is "<ORDER NUMBER>_<attempt>", e.g. NSR-7K2M9Q_x3f9. */
export function orderNumberFromReference(reference: string): string | null {
  const m = /^(NSR-[A-Z0-9]{6})_[A-Za-z0-9]{4,12}$/.exec(reference);
  return m ? m[1] : null;
}
