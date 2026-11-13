"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizeNgPhone } from "@/lib/phone";
import { deliveryFeeKobo } from "@/lib/pricing";
import { sampleAddressKey } from "@/lib/samples";
import { CheckoutError, cancelUnpaidOrder, createPendingOrder, markOrderPaid } from "@/lib/orders";
import { offersForZone, payToSnapshot } from "@/lib/network";
import { PAYMENT_HOLD_HOURS } from "@/lib/network-rules";
import { notifyNewTransferOrder } from "@/lib/notify";
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
  if (!variant) return { ok: false, error: "Free samples aren't available right now. Please check back soon." };

  // The area's distributor sends the sample if it has one in stock; otherwise HQ does.
  const { owner, hq } = await offersForZone(zone.id);
  const hasSample = (o: typeof hq | null) => !!o?.ready && !!o.fee && (o.variants.find((v) => v.variantId === variant.id)?.available ?? 0) >= 1;
  const from = owner && !owner.isHq && hasSample(owner) ? owner : hasSample(hq) ? hq : null;
  if (!from) return { ok: false, error: "Free samples are out of stock right now. Please check back soon." };

  const distributor = await db.distributor.findUniqueOrThrow({ where: { id: from.distributorId } });
  const fee = deliveryFeeKobo({ ...zone, ...from.fee!, active: true }, variant.sizeKg);
  const payTo = payToSnapshot(distributor);
  let order;
  try {
    order = await createPendingOrder({
      type: "SAMPLE",
      distributorId: distributor.id,
      routedToHq: !!owner && !owner.isHq && from.isHq,
      paymentMethod: fee === 0 ? "NONE" : "BANK_TRANSFER",
      payTo: fee === 0 ? null : payTo,
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
    await markOrderPaid(order.number, { source: "free-sample" });
  } else {
    await notifyNewTransferOrder({ ...order, payTo }, distributor.phone, PAYMENT_HOLD_HOURS);
  }
  return { ok: true, url: `/orders/${order.number}` };
}

/** What the sample will cost to deliver to this area, and who sends it (the area's distributor or HQ). */
export async function getSampleQuote(zoneId: string): Promise<{ feeKobo: number; seller: string } | null> {
  if (!z.string().min(1).max(40).safeParse(zoneId).success) return null;
  const zone = await db.deliveryZone.findUnique({ where: { id: zoneId } });
  const variant = await db.variant.findFirst({ where: { isSampleSize: true, active: true } });
  if (!zone || !variant || zone.kind === "NEARBY_TOWN") return null;
  const { owner, hq } = await offersForZone(zone.id);
  const hasSample = (o: typeof hq | null) => !!o?.ready && !!o.fee && (o.variants.find((v) => v.variantId === variant.id)?.available ?? 0) >= 1;
  const from = owner && !owner.isHq && hasSample(owner) ? owner : hasSample(hq) ? hq : null;
  if (!from) return null;
  return { feeKobo: deliveryFeeKobo({ ...zone, ...from.fee!, active: true }, variant.sizeKg), seller: from.name };
}
