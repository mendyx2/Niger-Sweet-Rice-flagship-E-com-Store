"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizeNgPhone } from "@/lib/phone";
import { deliveryFeeKobo } from "@/lib/pricing";
import { sampleAddressKey } from "@/lib/samples";
import { CheckoutError, cancelUnpaidOrder, createPendingOrder, markOrderPaid } from "@/lib/orders";
import { startPayment } from "@/lib/payment-start";
import { rateLimit } from "@/lib/rate-limit";

export type SampleState = { ok: false; error: string } | { ok: true; url: string } | null;

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(80),
  phone: z.string().max(30),
  zoneId: z.string().min(1, "Please choose your area.").max(40),
  street: z.string().trim().max(300).optional(),
  landmark: z.string().trim().max(200).optional(),
});

/** Free 1kg sample: the rice is ₦0, the customer pays delivery (pickup is free). One per account and per address. */
export async function requestSample(_prev: SampleState, formData: FormData): Promise<SampleState> {
  const user = await requireUser("/samples");
  if (!(await rateLimit(`sample:${user.id}`, 5, 10 * 60_000)).ok) return { ok: false, error: "Too many attempts. Please wait a few minutes." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const f = parsed.data;
  const phone = normalizeNgPhone(f.phone);
  if (!phone) return { ok: false, error: "Please enter a valid Nigerian mobile number." };

  const zone = await db.deliveryZone.findUnique({ where: { id: f.zoneId } });
  if (!zone || !zone.active || zone.kind === "NEARBY_TOWN") {
    return { ok: false, error: "Free samples are available for pickup or delivery within Abuja." };
  }
  const isPickup = zone.kind === "PICKUP";
  if (!isPickup && (!f.street || f.street.length < 5)) return { ok: false, error: "Please enter your delivery address." };

  const addressKey = isPickup ? `pickup:${user.id}` : sampleAddressKey(zone.id, f.street!);
  const existing = await db.sampleClaim.findFirst({ where: { OR: [{ userId: user.id }, { addressKey }] } });
  if (existing) return { ok: false, error: "A free sample has already been requested for this account or address." };

  const variant = await db.variant.findFirst({ where: { isSampleSize: true, active: true } });
  if (!variant || variant.stockQty - variant.reservedQty < 1) {
    return { ok: false, error: "Free samples are out of stock right now. Please check back soon." };
  }

  const fee = deliveryFeeKobo(zone, variant.sizeKg);
  let order;
  try {
    order = await createPendingOrder({
      type: "SAMPLE",
      userId: user.id,
      customerName: f.name,
      contactPhone: phone,
      contactEmail: user.email,
      zoneId: zone.id,
      address: isPickup ? null : { street: f.street!, landmark: f.landmark || null, zoneName: zone.name },
      note: "Free sample",
      couponId: null,
      referrerId: null,
      lines: [{ variantId: variant.id, qty: 1, unitPriceKobo: 0, sizeKg: variant.sizeKg }],
      subtotalKobo: 0,
      discountKobo: 0,
      deliveryFeeKobo: fee,
      totalKobo: fee,
    });
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, error: "Free samples are out of stock right now." };
    throw e;
  }

  try {
    await db.sampleClaim.create({ data: { userId: user.id, addressKey, orderId: order.id } });
  } catch (e) {
    await cancelUnpaidOrder(order.id, "Duplicate free sample request");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "A free sample has already been requested for this account or address." };
    }
    throw e;
  }
  if (!user.name) await db.user.update({ where: { id: user.id }, data: { name: f.name } });

  if (fee === 0) {
    await markOrderPaid(order.number, { reference: `${order.number}_free`, amountKobo: 0, currency: "NGN", source: "free-sample" });
    return { ok: true, url: `/orders/${order.number}` };
  }
  const pay = await startPayment(order);
  if (!pay.ok) {
    await cancelUnpaidOrder(order.id, "Payment could not be started");
    return { ok: false, error: pay.error };
  }
  return { ok: true, url: pay.url };
}
