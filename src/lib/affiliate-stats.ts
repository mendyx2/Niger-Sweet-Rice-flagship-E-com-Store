import "server-only";
import { db } from "./db";

export async function affiliateStats(userId: string) {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [clicks30, orders, points] = await Promise.all([
    db.affiliateClick.count({ where: { affiliateId: userId, createdAt: { gte: since } } }),
    db.order.findMany({ where: { affiliateId: userId, paidAt: { not: null } }, select: { subtotalKobo: true, discountKobo: true, paidAt: true } }),
    db.pointsTransaction.groupBy({ by: ["status"], where: { userId, reason: "AFFILIATE" }, _sum: { delta: true } }),
  ]);
  const pts = (s: string) => points.find((p) => p.status === s)?._sum.delta ?? 0;
  return {
    clicks30,
    orders: orders.length,
    orders30: orders.filter((o) => o.paidAt && o.paidAt >= since).length,
    salesKobo: orders.reduce((n, o) => n + o.subtotalKobo - o.discountKobo, 0),
    pointsConfirmed: pts("CONFIRMED"),
    pointsPending: pts("PENDING"),
  };
}
