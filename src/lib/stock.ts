import "server-only";
import type { StockMovementType } from "@prisma/client";
import type { Tx } from "./network";

/**
 * Every stock change goes through here: it updates the distributor's stock row
 * and appends a StockMovement (the history mirrored to the Google sheet).
 */
export async function moveStock(
  tx: Tx,
  m: {
    distributorId: string;
    variantId: string;
    delta?: number;        // change to on-hand
    heldDelta?: number;    // change to held-for-unpaid-orders
    transitDelta?: number; // change to in-transit
    type: StockMovementType;
    actor: string;
    orderId?: string;
    walkInSaleId?: string;
    reference?: string;
    note?: string;
    record?: boolean;      // false = adjust holds only, no history row (holds aren't stock movements)
  },
) {
  const delta = m.delta ?? 0, held = m.heldDelta ?? 0, transit = m.transitDelta ?? 0;
  await tx.$executeRaw`
    INSERT INTO "DistributorStock" ("distributorId", "variantId", "onHand", "held", "inTransit", "updatedAt")
    VALUES (${m.distributorId}, ${m.variantId}, 0, 0, 0, NOW())
    ON CONFLICT ("distributorId", "variantId") DO NOTHING`;
  const rows = await tx.$queryRaw<{ onHand: number }[]>`
    UPDATE "DistributorStock"
    SET "onHand" = "onHand" + ${delta}, "held" = GREATEST("held" + ${held}, 0), "inTransit" = GREATEST("inTransit" + ${transit}, 0), "updatedAt" = NOW()
    WHERE "distributorId" = ${m.distributorId} AND "variantId" = ${m.variantId}
    RETURNING "onHand"`;
  if (m.record === false || (delta === 0 && transit === 0)) return rows[0]?.onHand;
  await tx.stockMovement.create({
    data: {
      distributorId: m.distributorId, variantId: m.variantId, delta, transitDelta: transit, onHandAfter: rows[0]?.onHand,
      type: m.type, actor: m.actor, orderId: m.orderId, walkInSaleId: m.walkInSaleId, reference: m.reference, note: m.note,
    },
  });
  return rows[0]?.onHand;
}

/** Holds stock for an unpaid order only if enough is free. Returns false if not. */
export async function holdStock(tx: Tx, distributorId: string, variantId: string, qty: number): Promise<boolean> {
  const n = await tx.$executeRaw`
    UPDATE "DistributorStock" SET "held" = "held" + ${qty}, "updatedAt" = NOW()
    WHERE "distributorId" = ${distributorId} AND "variantId" = ${variantId} AND "onHand" - "held" >= ${qty}`;
  return n === 1;
}
