import "server-only";
import { db } from "./db";

/** Balance = sum of the append-only ledger. Pending points are shown separately. */
export async function pointsBalance(userId: string) {
  const rows = await db.pointsTransaction.groupBy({
    by: ["status"],
    where: { userId, status: { in: ["CONFIRMED", "PENDING"] } },
    _sum: { delta: true },
  });
  const get = (s: string) => rows.find((r) => r.status === s)?._sum.delta ?? 0;
  return { confirmed: get("CONFIRMED"), pending: get("PENDING") };
}
