import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { pointsForOrder } from "./rewards";
import { notifyOrderPaid } from "./notify";

export const RESERVATION_MINUTES = 30;
const NUM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newOrderNumber(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "NSR-" + Array.from(bytes, (b) => NUM_ALPHABET[b % NUM_ALPHABET.length]).join("");
}

export function newPaymentReference(orderNumber: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `${orderNumber}_${Buffer.from(bytes).toString("hex").slice(0, 8)}`;
}

export class CheckoutError extends Error {}

type CreateOrderInput = {
  type?: "STANDARD" | "SAMPLE" | "REPLACEMENT";
  parentOrderId?: string | null;
  userId: string;
  customerName: string;
  contactPhone: string;
  contactEmail: string | null;
  zoneId: string;
  address: { street: string; landmark: string | null; zoneName: string } | null;
  note: string | null;
  couponId: string | null;
  referrerId: string | null;
  affiliateId?: string | null;
  lines: { variantId: string; qty: number; unitPriceKobo: number; sizeKg: number }[];
  subtotalKobo: number;
  discountKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
};

/**
 * Creates a PENDING_PAYMENT order and holds stock for RESERVATION_MINUTES.
 * Stock and coupon use are claimed with conditional updates, so two shoppers
 * can never buy the last bag twice.
 */
export async function createPendingOrder(input: CreateOrderInput) {
  await releaseExpiredReservations().catch(() => {});

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        for (const l of input.lines) {
          const n = await tx.$executeRaw`
            UPDATE "Variant" SET "reservedQty" = "reservedQty" + ${l.qty}
            WHERE "id" = ${l.variantId} AND "active" = true AND "stockQty" - "reservedQty" >= ${l.qty}`;
          if (n !== 1) throw new CheckoutError(`Sorry, we don't have enough ${l.sizeKg}kg bags left. Please update your cart.`);
        }
        if (input.couponId) {
          const n = await tx.$executeRaw`
            UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${input.couponId} AND "usedCount" < "maxUses"`;
          if (n !== 1) throw new CheckoutError("This coupon has already been used.");
        }
        const order = await tx.order.create({
          data: {
            number: newOrderNumber(),
            type: input.type ?? "STANDARD",
            parentOrderId: input.parentOrderId ?? null,
            userId: input.userId,
            customerName: input.customerName,
            contactPhone: input.contactPhone,
            contactEmail: input.contactEmail,
            zoneId: input.zoneId,
            addressSnapshot: input.address ?? { pickup: true },
            note: input.note,
            couponId: input.couponId,
            referrerId: input.referrerId,
            affiliateId: input.affiliateId ?? null,
            subtotalKobo: input.subtotalKobo,
            discountKobo: input.discountKobo,
            deliveryFeeKobo: input.deliveryFeeKobo,
            totalKobo: input.totalKobo,
            reservedUntil: new Date(Date.now() + RESERVATION_MINUTES * 60_000),
            items: { create: input.lines.map(({ variantId, qty, unitPriceKobo, sizeKg }) => ({ variantId, qty, unitPriceKobo, sizeKg })) },
            events: { create: { status: "PENDING_PAYMENT", note: "Order placed" } },
          },
        });
        return order;
      });
    } catch (e) {
      // Retry only on order-number collision.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Could not create order");
}

/** Releases stock and coupon for one unpaid order. Safe to call twice. */
export async function cancelUnpaidOrder(orderId: string, note: string) {
  return db.$transaction(async (tx) => {
    const n = await tx.order.updateMany({ where: { id: orderId, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED", reservedUntil: null } });
    if (n.count !== 1) return false;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    for (const i of order.items) {
      await tx.$executeRaw`UPDATE "Variant" SET "reservedQty" = GREATEST("reservedQty" - ${i.qty}, 0) WHERE "id" = ${i.variantId}`;
    }
    if (order.couponId) await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "id" = ${order.couponId}`;
    // An unpaid free-sample request doesn't use up the customer's one sample.
    if (order.type === "SAMPLE") await tx.sampleClaim.deleteMany({ where: { orderId } });
    await tx.orderStatusEvent.create({ data: { orderId, status: "CANCELLED", note } });
    return true;
  });
}

export async function releaseExpiredReservations(): Promise<number> {
  const expired = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", reservedUntil: { lt: new Date() } },
    select: { id: true },
    take: 100,
  });
  let n = 0;
  for (const o of expired) if (await cancelUnpaidOrder(o.id, "Payment not completed in time")) n++;
  return n;
}

export type MarkPaidResult = "PAID" | "ALREADY_PAID" | "NOT_FOUND" | "AMOUNT_MISMATCH";

/**
 * Marks an order paid after Paystack confirms it (webhook or verify call).
 * Idempotent: the status change is conditional, so only the first caller wins.
 */
export async function markOrderPaid(number: string, p: { reference: string; amountKobo: number; currency: string; source: string }): Promise<MarkPaidResult> {
  const order = await db.order.findUnique({ where: { number }, include: { items: true, user: true } });
  if (!order) return "NOT_FOUND";
  if (order.paidAt) return "ALREADY_PAID";

  if (p.currency !== "NGN" || p.amountKobo !== order.totalKobo) {
    await db.auditLog.create({
      data: { actor: p.source, action: "payment.amount_mismatch", entity: "Order", entityId: order.id,
        after: { reference: p.reference, amountKobo: p.amountKobo, currency: p.currency, expected: order.totalKobo } },
    });
    return "AMOUNT_MISMATCH";
  }

  const result = await db.$transaction(async (tx) => {
    const wasCancelled = order.status === "CANCELLED";
    const n = await tx.order.updateMany({
      where: { id: order.id, paidAt: null, status: { in: ["PENDING_PAYMENT", "CANCELLED"] } },
      data: { status: "PAID", paidAt: new Date(), paymentRef: p.reference, reservedUntil: null },
    });
    if (n.count !== 1) return "ALREADY_PAID" as const;

    for (const i of order.items) {
      if (wasCancelled) {
        // Reservation had already been released; take the stock directly.
        await tx.$executeRaw`UPDATE "Variant" SET "stockQty" = "stockQty" - ${i.qty} WHERE "id" = ${i.variantId}`;
      } else {
        await tx.$executeRaw`
          UPDATE "Variant" SET "stockQty" = "stockQty" - ${i.qty}, "reservedQty" = GREATEST("reservedQty" - ${i.qty}, 0)
          WHERE "id" = ${i.variantId}`;
      }
    }
    if (wasCancelled && order.couponId) await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${order.couponId}`;

    await tx.orderStatusEvent.create({
      data: { orderId: order.id, status: "PAID", actor: p.source,
        note: wasCancelled ? "Payment arrived after the stock hold expired. Please check stock." : "Payment received" },
    });

    // Purchase/referral points, held as PENDING until 48h after delivery.
    const previousPaid = order.userId
      ? await tx.order.count({ where: { userId: order.userId, paidAt: { not: null }, NOT: { id: order.id } } })
      : 0;
    const awards = pointsForOrder({
      type: order.type,
      subtotalKobo: order.subtotalKobo,
      discountKobo: order.discountKobo,
      buyerId: order.userId,
      referrerId: order.referrerId,
      affiliateUserId: order.affiliateId,
      isBuyersFirstOrder: previousPaid === 0,
    });
    if (awards.length) {
      await tx.pointsTransaction.createMany({
        data: awards.map((a) => ({ userId: a.userId, delta: a.delta, reason: a.reason, status: "PENDING" as const, orderId: order.id })),
      });
    }
    return "PAID" as const;
  });

  if (result === "PAID") await notifyOrderPaid(order);
  return result;
}

/** Confirms PENDING points once an order is 48h past delivery with no open replacement claim. */
export async function confirmDuePoints(): Promise<number> {
  const cutoff = new Date(Date.now() - 48 * 3600_000);
  const orders = await db.order.findMany({
    where: {
      deliveredAt: { lt: cutoff },
      returnClaims: { none: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REPLACEMENT_SCHEDULED"] } } },
    },
    select: { id: true },
    take: 500,
  });
  if (!orders.length) return 0;
  const r = await db.pointsTransaction.updateMany({
    where: { status: "PENDING", orderId: { in: orders.map((o) => o.id) } },
    data: { status: "CONFIRMED" },
  });
  return r.count;
}
