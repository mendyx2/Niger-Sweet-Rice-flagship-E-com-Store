/**
 * Purchase points → discount coupons. No wallet: points can never be cashed
 * out, only exchanged for single-use coupons.
 *
 * Points are first recorded as PENDING and become CONFIRMED only after the
 * order is delivered AND the return window has closed (see RETURN_WINDOW_HOURS).
 */

export const RETURN_WINDOW_HOURS = 48;

export type RewardRules = {
  /** Points a buyer earns per ₦100 spent on goods (after discount, excl. delivery). */
  purchasePointsPer100Naira: number;
  /** Points a referrer earns per ₦100 of their referred friend's order. */
  referralPointsPer100Naira: number;
  /** One-off bonus for the referrer on a friend's first delivered order. */
  referralFirstOrderBonus: number;
  /** Points an approved affiliate earns per ₦100 of orders through their link. */
  affiliatePointsPer100Naira: number;
  /** Redemption tiers: spend `points` to receive a coupon worth `couponKobo`. */
  tiers: { points: number; couponKobo: number; minOrderKobo: number }[];
  couponValidDays: number;
  pointsExpireMonths: number;
};

/** Defaults: the owner can change these later (stored in the Setting table). */
export const DEFAULT_REWARD_RULES: RewardRules = {
  purchasePointsPer100Naira: 1,
  referralPointsPer100Naira: 1,
  referralFirstOrderBonus: 50,
  affiliatePointsPer100Naira: 2,
  tiers: [
    { points: 500, couponKobo: 2_000_00, minOrderKobo: 10_000_00 },
    { points: 1000, couponKobo: 5_000_00, minOrderKobo: 20_000_00 },
    { points: 2500, couponKobo: 15_000_00, minOrderKobo: 40_000_00 },
  ],
  couponValidDays: 60,
  pointsExpireMonths: 12,
};

/** Points for an amount of goods (kobo). Partial ₦100 blocks earn nothing. */
export function pointsFor(goodsKobo: number, per100Naira: number): number {
  if (goodsKobo <= 0 || per100Naira <= 0) return 0;
  return Math.floor(goodsKobo / 100_00) * per100Naira;
}

export type OrderForPoints = {
  type: "STANDARD" | "SAMPLE" | "REPLACEMENT";
  subtotalKobo: number;
  discountKobo: number;
  buyerId: string | null;
  referrerId: string | null;
  affiliateUserId: string | null;
  isBuyersFirstOrder: boolean;
};

export type PointsAward = { userId: string; delta: number; reason: "PURCHASE" | "REFERRAL" | "AFFILIATE" };

/** Points to award (as PENDING) when an order is paid. */
export function pointsForOrder(order: OrderForPoints, rules = DEFAULT_REWARD_RULES): PointsAward[] {
  // Free samples and replacements never earn points.
  if (order.type !== "STANDARD") return [];
  const goods = Math.max(order.subtotalKobo - order.discountKobo, 0);
  const awards: PointsAward[] = [];

  if (order.buyerId) {
    const p = pointsFor(goods, rules.purchasePointsPer100Naira);
    if (p > 0) awards.push({ userId: order.buyerId, delta: p, reason: "PURCHASE" });
  }
  // No self-referral / self-affiliation.
  if (order.referrerId && order.referrerId !== order.buyerId) {
    let p = pointsFor(goods, rules.referralPointsPer100Naira);
    if (order.isBuyersFirstOrder) p += rules.referralFirstOrderBonus;
    if (p > 0) awards.push({ userId: order.referrerId, delta: p, reason: "REFERRAL" });
  }
  if (order.affiliateUserId && order.affiliateUserId !== order.buyerId) {
    const p = pointsFor(goods, rules.affiliatePointsPer100Naira);
    if (p > 0) awards.push({ userId: order.affiliateUserId, delta: p, reason: "AFFILIATE" });
  }
  return awards;
}

/** When PENDING points on a delivered order may be confirmed. */
export function pointsConfirmableAt(deliveredAt: Date): Date {
  return new Date(deliveredAt.getTime() + RETURN_WINDOW_HOURS * 3600_000);
}

export function redemptionTier(points: number, balance: number, rules = DEFAULT_REWARD_RULES) {
  const tier = rules.tiers.find((t) => t.points === points);
  if (!tier) return { ok: false as const, error: "UNKNOWN_TIER" as const };
  if (balance < tier.points) return { ok: false as const, error: "NOT_ENOUGH_POINTS" as const };
  return { ok: true as const, tier };
}

/** Tiers the user can currently afford, plus the next one to aim for. */
export function rewardProgress(balance: number, rules = DEFAULT_REWARD_RULES) {
  const sorted = [...rules.tiers].sort((a, b) => a.points - b.points);
  const affordable = sorted.filter((t) => t.points <= balance);
  const next = sorted.find((t) => t.points > balance) ?? null;
  return { affordable, next, pointsToNext: next ? next.points - balance : 0 };
}
