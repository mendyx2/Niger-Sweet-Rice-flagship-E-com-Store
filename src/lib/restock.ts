import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { HQ_ID, type Tx } from "./network";
import { moveStock } from "./stock";
import { alertHq, notifyDistributor } from "./staff-alerts";
import { formatNaira } from "./money";
import { site } from "./site";

export type RestockLine = { variantId: string; sizeKg: number; qty: number; unitCostKobo?: number };

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newNumber = () => "RS-" + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % ALPHABET.length]).join("");

export class RestockError extends Error {}

/** Moves bags from HQ's shelf into a distributor's "in transit" (shared by restocks and ad-hoc dispatches). */
export async function dispatchBags(tx: Tx, distributorId: string, distributorName: string, lines: { variantId: string; sizeKg: number; qty: number }[], actor: string, reference?: string) {
  for (const l of lines.filter((x) => x.qty > 0)) {
    const hq = await tx.distributorStock.findUnique({ where: { distributorId_variantId: { distributorId: HQ_ID, variantId: l.variantId } } });
    const free = (hq?.onHand ?? 0) - (hq?.held ?? 0);
    if (free < l.qty) throw new RestockError(`HQ only has ${free} × ${l.sizeKg}kg free to send.`);
    await moveStock(tx, { distributorId: HQ_ID, variantId: l.variantId, delta: -l.qty, type: "RESTOCK_SENT", actor, reference, note: `Sent to ${distributorName}` });
    await moveStock(tx, { distributorId, variantId: l.variantId, transitDelta: l.qty, type: "RESTOCK_SENT", actor, reference, note: "From HQ, awaiting receipt" });
  }
}

/**
 * Bags HQ still owes a distributor: free samples and replacement bags it gave
 * from its own stock, minus free bags HQ has already sent back.
 */
export async function bagsOwedByHq(distributorId: string): Promise<Map<string, number>> {
  const [given, restocks] = await Promise.all([
    db.stockMovement.groupBy({ by: ["variantId"], where: { distributorId, type: { in: ["SAMPLE", "REPLACEMENT"] }, status: "APPLIED" }, _sum: { delta: true } }),
    db.restockOrder.findMany({ where: { distributorId, status: { in: ["DISPATCHED", "RECEIVED"] } }, select: { freeLines: true } }),
  ]);
  const owed = new Map<string, number>();
  for (const g of given) owed.set(g.variantId, -(g._sum.delta ?? 0));
  for (const r of restocks) for (const l of (r.freeLines as RestockLine[] | null) ?? []) owed.set(l.variantId, (owed.get(l.variantId) ?? 0) - l.qty);
  for (const [k, v] of owed) if (v <= 0) owed.delete(k);
  return owed;
}

export async function requestRestock(distributorId: string, lines: RestockLine[], note: string | null, actor: string) {
  const d = await db.distributor.findUniqueOrThrow({ where: { id: distributorId } });
  const clean = lines.filter((l) => l.qty > 0);
  if (!clean.length) throw new RestockError("Enter how many bags you need.");
  for (let i = 0; i < 3; i++) {
    try {
      const r = await db.restockOrder.create({
        data: { number: newNumber(), distributorId, lines: clean, note, requestedBy: actor },
      });
      await alertHq(`${d.name} requested stock ${r.number}: ${clean.map((l) => `${l.qty}×${l.sizeKg}kg`).join(", ")}. Invoice it in /ops/restocks.`);
      return r;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Could not create restock request");
}

/** HQ confirms quantities (may adjust), adds free replacement bags, and prices at the distributor cost. */
export async function invoiceRestock(id: string, qty: Map<string, number>, free: Map<string, number>, actor: string) {
  const r = await db.restockOrder.findUniqueOrThrow({ where: { id }, include: { distributor: true } });
  if (r.status !== "REQUESTED") throw new RestockError("This request has already been invoiced.");
  const variants = await db.variant.findMany();
  const lines: RestockLine[] = [];
  const freeLines: RestockLine[] = [];
  for (const v of variants) {
    const q = qty.get(v.id) ?? 0;
    if (q > 0) {
      if (v.distributorCostKobo == null) throw new RestockError(`Set the distributor price for ${v.sizeKg}kg on the Prices page first.`);
      lines.push({ variantId: v.id, sizeKg: v.sizeKg, qty: q, unitCostKobo: v.distributorCostKobo });
    }
    const f = free.get(v.id) ?? 0;
    if (f > 0) freeLines.push({ variantId: v.id, sizeKg: v.sizeKg, qty: f });
  }
  if (!lines.length && !freeLines.length) throw new RestockError("Nothing to send.");
  const total = lines.reduce((n, l) => n + l.qty * (l.unitCostKobo ?? 0), 0);
  const hq = await db.distributor.findUniqueOrThrow({ where: { id: HQ_ID } });
  await db.restockOrder.update({
    where: { id },
    data: {
      lines, freeLines, totalKobo: total, invoicedAt: new Date(),
      // Free-only deliveries need no payment.
      status: total === 0 ? "PAID" : "INVOICED", ...(total === 0 ? { paidAt: new Date() } : {}),
    },
  });
  await db.auditLog.create({ data: { actor, action: "restock.invoice", entity: "RestockOrder", entityId: id, after: { lines, freeLines, total } } });
  if (total > 0) {
    await notifyDistributor(r.distributorId, `Invoice ${r.number}`, `Invoice ${r.number} for ${formatNaira(total)}. Pay ${hq.bankName} ${hq.accountNumber} (${hq.accountName}), narration ${r.number}, then tap "I've paid HQ" at ${site.url}/partner/stock`);
  }
  return total;
}

export async function distributorMarksRestockPaid(id: string, distributorId: string) {
  const r = await db.restockOrder.findUnique({ where: { id }, include: { distributor: true } });
  if (!r || r.distributorId !== distributorId) throw new RestockError("Not found.");
  if (r.status !== "INVOICED") throw new RestockError("This invoice isn't awaiting payment.");
  if (!r.paidMarkedAt) {
    await db.restockOrder.update({ where: { id }, data: { paidMarkedAt: new Date() } });
    await alertHq(`${r.distributor.name} says they paid ${formatNaira(r.totalKobo)} for ${r.number}. Confirm in /ops/restocks.`);
  }
}

export async function confirmRestockPayment(id: string, actor: string) {
  const n = await db.restockOrder.updateMany({ where: { id, status: "INVOICED" }, data: { status: "PAID", paidAt: new Date() } });
  if (n.count !== 1) throw new RestockError("This invoice isn't awaiting payment.");
  await db.auditLog.create({ data: { actor, action: "restock.paid", entity: "RestockOrder", entityId: id } });
}

/** Paid restock leaves HQ: bought + free bags move to the distributor's "in transit". */
export async function dispatchRestock(id: string, reference: string | null, actor: string) {
  const r = await db.restockOrder.findUniqueOrThrow({ where: { id }, include: { distributor: true } });
  if (r.status !== "PAID") throw new RestockError("Only paid restocks can be dispatched.");
  const all = [...(r.lines as RestockLine[]), ...((r.freeLines as RestockLine[] | null) ?? [])];
  const merged = new Map<string, RestockLine>();
  for (const l of all) {
    const m = merged.get(l.variantId);
    merged.set(l.variantId, m ? { ...m, qty: m.qty + l.qty } : { ...l });
  }
  await db.$transaction(async (tx) => {
    const n = await tx.restockOrder.updateMany({ where: { id, status: "PAID" }, data: { status: "DISPATCHED", dispatchedAt: new Date(), reference } });
    if (n.count !== 1) throw new RestockError("Already dispatched.");
    await dispatchBags(tx, r.distributorId, r.distributor.name, [...merged.values()], actor, reference ?? r.number);
  });
  await notifyDistributor(r.distributorId, `${r.number} dispatched`, `${r.number} is on its way (${[...merged.values()].map((l) => `${l.qty}×${l.sizeKg}kg`).join(", ")}). Confirm when received: ${site.url}/partner/stock`);
}

export async function cancelRestock(id: string, actor: string, distributorId?: string) {
  const r = await db.restockOrder.findUnique({ where: { id } });
  if (!r || (distributorId && r.distributorId !== distributorId)) throw new RestockError("Not found.");
  const n = await db.restockOrder.updateMany({ where: { id, status: { in: ["REQUESTED", "INVOICED"] } }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  if (n.count !== 1) throw new RestockError("Paid or dispatched restocks can't be cancelled here.");
  await db.auditLog.create({ data: { actor, action: "restock.cancel", entity: "RestockOrder", entityId: id } });
}

/** Called when a distributor confirms a delivery: dispatched restocks are now received. */
export async function markRestocksReceived(tx: Tx, distributorId: string) {
  await tx.restockOrder.updateMany({ where: { distributorId, status: "DISPATCHED" }, data: { status: "RECEIVED", receivedAt: new Date() } });
}
