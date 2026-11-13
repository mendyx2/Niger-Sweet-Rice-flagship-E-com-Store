import "server-only";
import type { OrderStatus } from "@prisma/client";
import { db } from "./db";
import { cancelUnpaidOrder, markOrderPaid } from "./orders";
import { moveStock } from "./stock";
import { notifyPaymentNotReceived, notifyStatus } from "./notify";
import { NEXT_STATUSES } from "./status-text";

export type ActionResult = { ok: boolean; message: string };

/**
 * Moves an order to a new status. Used by HQ (/ops, any order) and by
 * distributors (/partner, only their own orders: pass `distributorId`).
 */
export async function changeOrderStatus(input: {
  orderId: string;
  status: OrderStatus;
  actor: string;
  distributorId?: string; // restrict to this distributor's orders
  riderName?: string;
  riderPhone?: string;
  note?: string;
}): Promise<ActionResult> {
  const { orderId, status, actor, riderName, riderPhone, note } = input;
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || (input.distributorId && order.distributorId !== input.distributorId)) return { ok: false, message: "Order not found." };
  if (!NEXT_STATUSES[order.status].includes(status)) {
    return { ok: false, message: `Can't change from ${order.status} to ${status}.` };
  }

  if (status === "CANCELLED" && order.status === "PENDING_PAYMENT") {
    await cancelUnpaidOrder(order.id, note || "Cancelled", actor);
  } else {
    try {
      await db.$transaction(async (tx) => {
        const n = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: { status, ...(status === "DELIVERED" ? { deliveredAt: new Date() } : {}) },
        });
        if (n.count !== 1) throw new Error("STALE");
        if (status === "CANCELLED") {
          // Paid order cancelled: bags go back on the distributor's shelf and its points are voided.
          // The refund is made by whoever received the transfer.
          for (const i of order.items) {
            await moveStock(tx, {
              distributorId: order.distributorId, variantId: i.variantId, delta: i.qty,
              type: "ORDER_CANCELLED", actor, orderId: order.id, reference: order.number,
            });
          }
          await tx.pointsTransaction.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "REVERSED" } });
        }
        if (status === "OUT_FOR_DELIVERY" && (riderName || riderPhone)) {
          await tx.shipment.upsert({
            where: { orderId: order.id },
            create: { orderId: order.id, riderName: riderName || null, riderPhone: riderPhone || null },
            update: { riderName: riderName || null, riderPhone: riderPhone || null },
          });
        }
        await tx.orderStatusEvent.create({ data: { orderId: order.id, status, note: note || null, actor } });
        if (status === "DELIVERED" && order.type === "REPLACEMENT") {
          await tx.returnClaim.updateMany({ where: { replacementOrderId: order.id }, data: { status: "COMPLETED" } });
        }
        await tx.auditLog.create({
          data: { actor, action: "order.status", entity: "Order", entityId: order.id, before: { status: order.status }, after: { status } },
        });
      });
    } catch (e) {
      if (e instanceof Error && e.message === "STALE") return { ok: false, message: "This order changed in the meantime. Please reload." };
      throw e;
    }
  }
  const extra = status === "OUT_FOR_DELIVERY" && riderName ? `Rider: ${riderName}${riderPhone ? `, ${riderPhone}` : ""}.` : undefined;
  await notifyStatus(order, status, extra);
  return { ok: true, message: `${order.number} updated.` };
}

/** The seller confirms the customer's transfer has arrived in their bank account. */
export async function confirmTransferReceived(orderId: string, actor: string, distributorId?: string): Promise<ActionResult> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || (distributorId && order.distributorId !== distributorId)) return { ok: false, message: "Order not found." };
  const r = await markOrderPaid(order.number, { source: actor });
  if (r === "ALREADY_PAID") return { ok: false, message: "This order is already marked as paid." };
  if (r !== "PAID") return { ok: false, message: "Couldn't confirm this payment." };
  return { ok: true, message: `Payment confirmed for ${order.number}. The customer has been notified.` };
}

/** The seller hasn't seen the money: the customer is asked to check, and the normal payment deadline applies again. */
export async function reportTransferNotReceived(orderId: string, actor: string, distributorId?: string): Promise<ActionResult> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || (distributorId && order.distributorId !== distributorId)) return { ok: false, message: "Order not found." };
  if (order.status !== "PENDING_PAYMENT") return { ok: false, message: "This order isn't awaiting payment." };
  await db.$transaction([
    db.order.update({ where: { id: order.id }, data: { customerMarkedPaidAt: null } }),
    db.orderStatusEvent.create({ data: { orderId: order.id, status: "PENDING_PAYMENT", note: "Seller hasn't received the transfer yet", actor } }),
  ]);
  await notifyPaymentNotReceived(order);
  return { ok: true, message: "The customer has been asked to check their transfer." };
}
