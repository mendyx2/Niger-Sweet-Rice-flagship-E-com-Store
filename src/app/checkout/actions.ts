"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { requireUser, isApprovedSeller } from "@/lib/auth";
import { priceCart, couponMessage } from "@/lib/checkout-data";
import { describeIssue } from "@/lib/pricing";
import { formatNaira } from "@/lib/money";
import { normalizeNgPhone } from "@/lib/phone";
import { CheckoutError, cancelUnpaidOrder, createPendingOrder } from "@/lib/orders";
import { startPayment } from "@/lib/payment-start";
import { rateLimit } from "@/lib/rate-limit";

export type CheckoutState = { ok: false; errors: string[] } | { ok: true; url: string } | null;

const schema = z.object({
  lines: z.string().transform((s, ctx) => {
    try {
      return z.array(z.object({ variantId: z.string().max(40), qty: z.number().int().min(1).max(100) })).min(1).max(20).parse(JSON.parse(s));
    } catch {
      ctx.addIssue({ code: "custom", message: "Your cart is empty." });
      return z.NEVER;
    }
  }),
  zoneId: z.string().min(1, "Please choose your delivery area.").max(40),
  coupon: z.string().max(40).optional(),
  name: z.string().trim().min(2, "Please enter your full name.").max(80),
  phone: z.string().max(30),
  email: z.union([z.literal(""), z.email("Please enter a valid email, or leave it empty.").max(120)]),
  street: z.string().trim().max(300).optional(),
  landmark: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await requireUser("/checkout");
  if (!(await rateLimit(`checkout:${user.id}`, 10, 10 * 60_000)).ok) {
    return { ok: false, errors: ["Too many attempts. Please wait a few minutes."] };
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: [...new Set(parsed.error.issues.map((i) => i.message))] };
  const f = parsed.data;

  const phone = normalizeNgPhone(f.phone);
  if (!phone) return { ok: false, errors: ["Please enter a valid Nigerian mobile number for delivery."] };

  const priced = await priceCart({ lines: f.lines, zoneId: f.zoneId, couponCode: f.coupon, userId: user.id, wholesale: isApprovedSeller(user) });
  const q = priced.quote;
  if (!q || !priced.zone) return { ok: false, errors: ["Please choose your delivery area."] };

  const errors = q.issues.map((i) => describeIssue(i, formatNaira));
  const cMsg = couponMessage(priced.couponIssue);
  if (cMsg) errors.push(cMsg);
  const isPickup = priced.zone.kind === "PICKUP";
  if (!isPickup && (!f.street || f.street.length < 5)) errors.push("Please enter your delivery address.");
  if (errors.length) return { ok: false, errors };

  // Affiliate attribution (30-day cookie from /a/CODE). Affiliates can't earn on their own orders.
  const affCode = (await cookies()).get("nsr_aff")?.value;
  const affiliate = affCode ? await db.affiliateProfile.findUnique({ where: { code: affCode } }) : null;
  const affiliateId = affiliate?.status === "APPROVED" && affiliate.userId !== user.id ? affiliate.userId : null;

  const coupon = priced.couponCode && q.discountKobo > 0 ? await db.coupon.findUnique({ where: { code: priced.couponCode } }) : null;

  // Keep the name on the account for next time.
  if (!user.name) await db.user.update({ where: { id: user.id }, data: { name: f.name } });

  let order;
  try {
    order = await createPendingOrder({
      userId: user.id,
      customerName: f.name,
      contactPhone: phone,
      contactEmail: f.email.toLowerCase() || user.email || null,
      zoneId: priced.zone.id,
      address: isPickup ? null : { street: f.street!, landmark: f.landmark || null, zoneName: priced.zone.name },
      note: f.note || null,
      couponId: coupon?.id ?? null,
      referrerId: user.referredById,
      affiliateId,
      lines: q.lines.map((l) => ({ variantId: l.variantId, qty: l.qty, unitPriceKobo: l.unitPriceKobo, sizeKg: l.sizeKg })),
      subtotalKobo: q.subtotalKobo,
      discountKobo: q.discountKobo,
      deliveryFeeKobo: q.deliveryFeeKobo,
      totalKobo: q.totalKobo,
    });
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, errors: [e.message] };
    throw e;
  }

  const pay = await startPayment(order);
  if (!pay.ok) {
    await cancelUnpaidOrder(order.id, "Payment could not be started");
    return { ok: false, errors: [pay.error] };
  }
  return { ok: true, url: pay.url };
}

/** "Pay now" on an order whose payment was abandoned but whose stock hold hasn't expired. */
export async function retryPayment(number: string): Promise<CheckoutState> {
  const user = await requireUser();
  const order = await db.order.findUnique({ where: { number } });
  if (!order || order.userId !== user.id) return { ok: false, errors: ["Order not found."] };
  if (order.status !== "PENDING_PAYMENT" || !order.reservedUntil || order.reservedUntil < new Date()) {
    return { ok: false, errors: ["This order can no longer be paid. Please place a new order."] };
  }
  const pay = await startPayment(order);
  return pay.ok ? { ok: true, url: pay.url } : { ok: false, errors: [pay.error] };
}
