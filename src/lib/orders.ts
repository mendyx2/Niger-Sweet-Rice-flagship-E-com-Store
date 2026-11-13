import "server-only";
import { Prisma, type OrderType, type PaymentMethod, type StockMovementType } from "@prisma/client";
import { db } from "./db";
import { pointsForOrder, pointsToExpire } from "./rewards";
import { newCouponCode } from "./redeem";
import { sendSms } from "./sms";
import { site } from "./site";
import { alertHq, notifyOrderPaid, notifyPaymentReminder } from "./notify";
import { holdStock, moveStock } from "./stock";
import { PAYMENT_HOLD_HOURS, PAYMENT_REMINDER_HOURS } from "./network-rules";

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
  type?: OrderType;
  parentOrderId?: string | null;
  distributorId: string;
  routedToHq?: boolean;
  hqFeeKobo?: number;
  hqFundedDiscountKobo?: number;
  paymentMethod: PaymentMethod;
  payTo?: Prisma.InputJsonValue | null;
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

const SALE_TYPE: Record<OrderType, StockMovementType> = { STANDARD: "ONLINE_SALE", SAMPLE: "SAMPLE", REPLACEMENT: "REPLACEMENT" };

/**
 * Creates a PENDING_PAYMENT order and holds the fulfilling distributor's stock
 * while the customer pays by transfer (PAYMENT_HOLD_HOURS). Stock and coupon
 * use are claimed with conditional updates, so the last bag can't be sold twice.
 */
export async function createPendingOrder(input: CreateOrderInput) {
  await releaseExpiredReservations().catch(() => {});

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        for (const l of input.lines) {
          if (!(await holdStock(tx, input.distributorId, l.variantId, l.qty))) {
            throw new CheckoutError(`Sorry, there aren't enough ${l.sizeKg}kg bags left. Please update your cart.`);
          }
        }
        if (input.couponId) {
          const n = await tx.$executeRaw`
            UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${input.couponId} AND "usedCount" < "maxUses"`;
          if (n !== 1) throw new CheckoutError("This coupon has already been used.");
        }
        return tx.order.create({
          data: {
            number: newOrderNumber(),
            type: input.type ?? "STANDARD",
            parentOrderId: input.parentOrderId ?? null,
            distributorId: input.distributorId,
            routedToHq: input.routedToHq ?? false,
            hqFeeKobo: input.hqFeeKobo ?? 0,
            hqFundedDiscountKobo: input.hqFundedDiscountKobo ?? 0,
            paymentMethod: input.paymentMethod,
            payTo: input.payTo ?? Prisma.JsonNull,
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
            reservedUntil: new Date(Date.now() + PAYMENT_HOLD_HOURS * 3600_000),
            items: { create: input.lines.map(({ variantId, qty, unitPriceKobo, sizeKg }) => ({ variantId, qty, unitPriceKobo, sizeKg })) },
            events: { create: { status: "PENDING_PAYMENT", note: input.routedToHq ? "Order placed (sent to HQ: area distributor short of stock)" : "Order placed" } },
          },
          include: { distributor: true },
        });
      });
    } catch (e) {
      // Retry only on order-number collision.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Could not create order");
}

/** Releases held stock and coupon for one unpaid order. Safe to call twice. */
export async function cancelUnpaidOrder(orderId: string, note: string, actor = "system") {
  return db.$transaction(async (tx) => {
    const n = await tx.order.updateMany({ where: { id: orderId, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED", reservedUntil: null } });
    if (n.count !== 1) return false;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    for (const i of order.items) {
      await moveStock(tx, { distributorId: order.distributorId, variantId: i.variantId, heldDelta: -i.qty, type: "ONLINE_SALE", actor, record: false });
    }
    if (order.couponId) await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "id" = ${order.couponId}`;
    // An unpaid free-sample request doesn't use up the customer's one sample.
    if (order.type === "SAMPLE") await tx.sampleClaim.deleteMany({ where: { orderId } });
    await tx.orderStatusEvent.create({ data: { orderId, status: "CANCELLED", note, actor } });
    return true;
  });
}

/** Cancels transfers not paid within the hold time. Orders the customer says they've paid wait for the distributor instead. */
export async function releaseExpiredReservations(): Promise<number> {
  const expired = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", reservedUntil: { lt: new Date() }, customerMarkedPaidAt: null },
    select: { id: true },
    take: 100,
  });
  let n = 0;
  for (const o of expired) if (await cancelUnpaidOrder(o.id, "Payment not received in time")) n++;
  return n;
}

export type MarkPaidResult = "PAID" | "ALREADY_PAID" | "NOT_FOUND" | "AMOUNT_MISMATCH";

/**
 * Marks an order paid: confirmed by the distributor (bank transfer), or
 * automatically for ₦0 orders. Idempotent: the status change is conditional,
 * so only the first caller wins. Stock leaves the distributor's shelf here.
 */
export async function markOrderPaid(
  number: string,
  p: { source: string; reference?: string; amountKobo?: number; currency?: string },
): Promise<MarkPaidResult> {
  const order = await db.order.findUnique({ where: { number }, include: { items: true, user: true } });
  if (!order) return "NOT_FOUND";
  if (order.paidAt) return "ALREADY_PAID";

  // If a payment provider reports an amount, it must match exactly.
  if (p.amountKobo != null && (p.currency !== "NGN" || p.amountKobo !== order.totalKobo)) {
    await db.auditLog.create({
      data: { actor: p.source, action: "payment.amount_mismatch", entity: "Order", entityId: order.id,
        after: { reference: p.reference, amountKobo: p.amountKobo, currency: p.currency, expected: order.totalKobo } },
    });
    return "AMOUNT_MISMATCH";
  }

  const result = await db.$transaction(async (tx) => {
    const wasCancelled = order.status === "CANCELLED";
    const now = new Date();
    const n = await tx.order.updateMany({
      where: { id: order.id, paidAt: null, status: { in: ["PENDING_PAYMENT", "CANCELLED"] } },
      data: {
        status: "PAID", paidAt: now, reservedUntil: null,
        paymentConfirmedAt: now, paymentConfirmedBy: p.source,
        ...(p.reference ? { paymentRef: p.reference } : {}),
      },
    });
    if (n.count !== 1) return "ALREADY_PAID" as const;

    for (const i of order.items) {
      await moveStock(tx, {
        distributorId: order.distributorId, variantId: i.variantId,
        delta: -i.qty, heldDelta: wasCancelled ? 0 : -i.qty, // a cancelled order's hold was already released
        type: SALE_TYPE[order.type], actor: p.source, orderId: order.id, reference: order.number,
      });
    }
    if (wasCancelled && order.couponId) await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${order.couponId}`;

    await tx.orderStatusEvent.create({
      data: { orderId: order.id, status: "PAID", actor: p.source,
        note: order.totalKobo === 0 ? "No payment needed" : wasCancelled ? "Payment confirmed after the hold expired. Please check stock." : "Payment confirmed" },
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

  if (result === "PAID" && order.totalKobo > 0) await notifyOrderPaid(order);
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

/** Expires points older than 12 months that haven't been spent (oldest spent first). */
export async function expireOldPoints(months = 12): Promise<number> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const rows = await db.$queryRaw<{ userId: string; earned: bigint; used: bigint }[]>`
    SELECT "userId",
      COALESCE(SUM(CASE WHEN delta > 0 AND "createdAt" < ${cutoff} THEN delta END), 0) AS earned,
      COALESCE(-SUM(CASE WHEN delta < 0 THEN delta END), 0) AS used
    FROM "PointsTransaction" WHERE status = 'CONFIRMED'
    GROUP BY "userId"`;
  let n = 0;
  for (const r of rows) {
    const due = pointsToExpire(Number(r.earned), Number(r.used));
    if (due > 0) {
      await db.pointsTransaction.create({
        data: { userId: r.userId, delta: -due, reason: "EXPIRY", status: "CONFIRMED", note: `Points older than ${months} months` },
      });
      n++;
    }
  }
  return n;
}

/** 3 days after a free sample is delivered: a personal "come back" coupon by SMS. */
export async function sendSampleFollowUps(): Promise<number> {
  const due = await db.order.findMany({
    where: { type: "SAMPLE", status: "DELIVERED", followUpSentAt: null, deliveredAt: { lt: new Date(Date.now() - 3 * 86400_000) } },
    select: { id: true, userId: true, contactPhone: true },
    take: 100,
  });
  let n = 0;
  for (const o of due) {
    const claimed = await db.order.updateMany({ where: { id: o.id, followUpSentAt: null }, data: { followUpSentAt: new Date() } });
    if (claimed.count !== 1 || !o.userId) continue;
    const coupon = await db.coupon.create({
      data: {
        code: newCouponCode("TRY"), type: "FIXED", value: 1_000_00, minOrderKobo: 20_000_00, maxUses: 1,
        userId: o.userId, source: "WINBACK", expiresAt: new Date(Date.now() + 30 * 86400_000),
      },
    });
    await sendSms(o.contactPhone, `${site.name}: enjoyed your sample? Here's ₦1,000 off your first bag (orders over ₦20,000): ${coupon.code}. Valid 30 days. ${site.url}/shop`);
    n++;
  }
  return n;
}

/** 2 hours in: remind customers who haven't paid. Customers who say they've paid but the seller
 * hasn't confirmed within the seller's time limit: alert HQ. */
export async function paymentFollowUps(): Promise<{ reminders: number; escalations: number }> {
  const now = Date.now();
  const due = await db.order.findMany({
    where: {
      status: "PENDING_PAYMENT", paymentMethod: "BANK_TRANSFER", customerMarkedPaidAt: null, paymentReminderAt: null,
      createdAt: { lt: new Date(now - PAYMENT_REMINDER_HOURS * 3600_000) },
    },
    take: 200,
  });
  let reminders = 0;
  for (const o of due) {
    const n = await db.order.updateMany({ where: { id: o.id, paymentReminderAt: null }, data: { paymentReminderAt: new Date() } });
    if (n.count === 1) { await notifyPaymentReminder(o); reminders++; }
  }

  const waiting = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", customerMarkedPaidAt: { not: null }, paymentEscalatedAt: null },
    include: { distributor: true },
    take: 200,
  });
  let escalations = 0;
  for (const o of waiting) {
    if (now - o.customerMarkedPaidAt!.getTime() < o.distributor.slaHours * 3600_000) continue;
    const n = await db.order.updateMany({ where: { id: o.id, paymentEscalatedAt: null }, data: { paymentEscalatedAt: new Date() } });
    if (n.count === 1) {
      await alertHq(`${o.distributor.name} hasn't confirmed the customer's transfer for ${o.number} after ${o.distributor.slaHours}h. Check /ops/orders.`);
      escalations++;
    }
  }
  return { reminders, escalations };
}
