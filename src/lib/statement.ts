import "server-only";
import { db } from "./db";
import { monthRange } from "./statement-dates";

export { currentMonth, isMonth, monthRange } from "./statement-dates";

/**
 * A distributor's month: online and shop sales, bags out, and the statement lines
 * (HQ per-bag fees owed − HQ-funded discounts credited). Settled outside the platform.
 */
export async function distributorMonth(distributorId: string, month: string) {
  const { from, to, label } = monthRange(month);
  const [orders, walkIns, movements] = await Promise.all([
    db.order.findMany({
      where: { distributorId, paidAt: { gte: from, lt: to }, status: { not: "CANCELLED" } },
      include: { items: true },
    }),
    db.walkInSale.findMany({ where: { distributorId, createdAt: { gte: from, lt: to } } }),
    db.stockMovement.findMany({
      where: { distributorId, createdAt: { gte: from, lt: to }, status: "APPLIED", type: { in: ["SAMPLE", "REPLACEMENT", "RESTOCK_RECEIVED", "DAMAGED"] } },
      include: { variant: true },
    }),
  ]);
  const sales = orders.filter((o) => o.type === "STANDARD");
  const bags = new Map<number, { online: number; shop: number }>();
  const add = (kg: number, k: "online" | "shop", n: number) => {
    const r = bags.get(kg) ?? { online: 0, shop: 0 };
    r[k] += n;
    bags.set(kg, r);
  };
  for (const o of sales) for (const i of o.items) add(i.sizeKg, "online", i.qty);
  for (const w of walkIns) for (const l of w.lines as { sizeKg: number; qty: number }[]) add(l.sizeKg, "shop", l.qty);

  const goodsOnline = sales.reduce((n, o) => n + o.subtotalKobo - o.discountKobo, 0);
  const deliveryFees = orders.reduce((n, o) => n + o.deliveryFeeKobo, 0);
  const shopTotal = walkIns.reduce((n, w) => n + w.totalKobo, 0);
  const hqFees = sales.reduce((n, o) => n + o.hqFeeKobo, 0);
  const hqCredits = sales.reduce((n, o) => n + o.hqFundedDiscountKobo, 0);
  const owedByHqInBags = movements.filter((m) => m.type === "SAMPLE" || m.type === "REPLACEMENT");

  return {
    label,
    onlineOrders: sales.length,
    goodsOnline,
    deliveryFees,
    shopSales: walkIns.length,
    shopTotal,
    bags: [...bags.entries()].sort((a, b) => b[0] - a[0]).map(([sizeKg, v]) => ({ sizeKg, ...v })),
    received: movements.filter((m) => m.type === "RESTOCK_RECEIVED").reduce((n, m) => n + m.delta * m.variant.sizeKg, 0),
    statement: {
      hqFees,
      hqCredits,
      net: hqFees - hqCredits, // positive = distributor pays HQ
      bagsToReplace: owedByHqInBags.map((m) => ({ sizeKg: m.variant.sizeKg, qty: -m.delta, type: m.type })),
    },
  };
}

/** Freezes a finished month into a Statement (idempotent: an existing statement is left as it is). */
export async function closeStatement(distributorId: string, month: string, actor: string) {
  const existing = await db.statement.findUnique({ where: { distributorId_month: { distributorId, month } } });
  if (existing) return existing;
  const m = await distributorMonth(distributorId, month);
  return db.statement.create({
    data: {
      distributorId, month, closedBy: actor,
      feesKobo: m.statement.hqFees, creditsKobo: m.statement.hqCredits, netKobo: m.statement.net,
      bagsToReplace: m.statement.bagsToReplace, onlineOrders: m.onlineOrders, goodsOnlineKobo: m.goodsOnline, shopTotalKobo: m.shopTotal,
    },
  });
}

export async function settleStatement(id: string, actor: string, note: string | null) {
  const n = await db.statement.updateMany({ where: { id, status: "OPEN" }, data: { status: "SETTLED", settledAt: new Date(), settledBy: actor, settleNote: note } });
  return n.count === 1;
}
