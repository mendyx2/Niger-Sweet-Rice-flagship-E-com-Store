import "server-only";
import { db } from "./db";
import { DEFAULT_REWARD_RULES, redemptionTier } from "./rewards";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newCouponCode(prefix = "PTS"): string {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  return `${prefix}-${Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("")}`;
}

export type RedeemResult =
  | { ok: true; code: string; valueKobo: number; expiresAt: Date }
  | { ok: false; error: "UNKNOWN_TIER" | "NOT_ENOUGH_POINTS" };

/**
 * Exchanges confirmed points for a single-use personal coupon. A per-user
 * advisory lock serialises redemptions so the same points can't be spent twice.
 */
export async function redeemPoints(userId: string, tierPoints: number, rules = DEFAULT_REWARD_RULES): Promise<RedeemResult> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"points:" + userId}))`;
    const agg = await tx.pointsTransaction.aggregate({ where: { userId, status: "CONFIRMED" }, _sum: { delta: true } });
    const balance = agg._sum.delta ?? 0;
    const r = redemptionTier(tierPoints, balance, rules);
    if (!r.ok) return r;

    const expiresAt = new Date(Date.now() + rules.couponValidDays * 86400_000);
    const coupon = await tx.coupon.create({
      data: {
        code: newCouponCode(),
        type: "FIXED",
        value: r.tier.couponKobo,
        minOrderKobo: r.tier.minOrderKobo,
        maxUses: 1,
        userId,
        source: "POINTS_REDEMPTION",
        expiresAt,
      },
    });
    await tx.pointsTransaction.create({
      data: { userId, delta: -r.tier.points, reason: "REDEMPTION", status: "CONFIRMED", couponId: coupon.id, note: `Coupon ${coupon.code}` },
    });
    return { ok: true, code: coupon.code, valueKobo: coupon.value, expiresAt };
  });
}

/** Coupons the user can still use: personal ones, unused and unexpired. */
export async function availableCoupons(userId: string) {
  const now = new Date();
  const list = await db.coupon.findMany({
    where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }], startsAt: { lte: now } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return list.filter((c) => c.usedCount < c.maxUses);
}
