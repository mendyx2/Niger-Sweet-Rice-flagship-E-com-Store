import { describe, expect, it } from "vitest";
import { pointsFor, pointsForOrder, pointsConfirmableAt, redemptionTier, rewardProgress } from "@/lib/rewards";
import { canClaimReplacement } from "@/lib/returns";

const order = { type: "STANDARD" as const, subtotalKobo: 8_000_000, discountKobo: 0, buyerId: "buyer",
  referrerId: null, affiliateUserId: null, isBuyersFirstOrder: false };

describe("purchase points", () => {
  it("earns 1 point per full ₦100", () => {
    expect(pointsFor(8_000_000, 1)).toBe(800);
    expect(pointsFor(9_999, 1)).toBe(0);
  });
  it("awards buyer, referrer (with first-order bonus) and affiliate", () => {
    const a = pointsForOrder({ ...order, referrerId: "ref", affiliateUserId: "aff", isBuyersFirstOrder: true });
    expect(a).toEqual([
      { userId: "buyer", delta: 800, reason: "PURCHASE" },
      { userId: "ref", delta: 850, reason: "REFERRAL" },
      { userId: "aff", delta: 1600, reason: "AFFILIATE" },
    ]);
  });
  it("earns on goods after discount", () => {
    expect(pointsForOrder({ ...order, discountKobo: 4_000_000 })[0].delta).toBe(400);
  });
  it("blocks self-referral and free orders", () => {
    expect(pointsForOrder({ ...order, referrerId: "buyer", affiliateUserId: "buyer" })).toHaveLength(1);
    expect(pointsForOrder({ ...order, type: "SAMPLE" })).toEqual([]);
    expect(pointsForOrder({ ...order, type: "REPLACEMENT" })).toEqual([]);
  });
  it("confirms points after the 48h return window", () => {
    expect(pointsConfirmableAt(new Date("2026-06-01T10:00:00Z")).toISOString()).toBe("2026-06-03T10:00:00.000Z");
  });
  it("redeems only known, affordable tiers", () => {
    expect(redemptionTier(500, 600).ok).toBe(true);
    expect(redemptionTier(500, 400)).toEqual({ ok: false, error: "NOT_ENOUGH_POINTS" });
    expect(redemptionTier(123, 9999)).toEqual({ ok: false, error: "UNKNOWN_TIER" });
    expect(rewardProgress(700).pointsToNext).toBe(300);
  });
});

describe("replacement window", () => {
  const delivered = new Date("2026-06-01T10:00:00Z");
  it("allows claims within 48 hours of delivery only", () => {
    expect(canClaimReplacement(delivered, new Date("2026-06-03T09:59:00Z"))).toBe(true);
    expect(canClaimReplacement(delivered, new Date("2026-06-03T10:01:00Z"))).toBe(false);
    expect(canClaimReplacement(null)).toBe(false);
  });
});

import { sampleAddressKey } from "@/lib/samples";
describe("free sample address matching", () => {
  it("treats spelling variants of the same address as one", () => {
    expect(sampleAddressKey("z", "12, Aminu Kano Crescent")).toBe(sampleAddressKey("z", "12 aminu kano cres."));
    expect(sampleAddressKey("z", "5 Ahmadu Bello Street")).toBe(sampleAddressKey("z", "5 ahmadu bello st"));
  });
  it("keeps different addresses and areas apart", () => {
    expect(sampleAddressKey("z", "12 Aminu Kano Cres")).not.toBe(sampleAddressKey("z", "14 Aminu Kano Cres"));
    expect(sampleAddressKey("a", "12 Aminu Kano Cres")).not.toBe(sampleAddressKey("b", "12 Aminu Kano Cres"));
  });
});

import { pointsToExpire } from "@/lib/rewards";
describe("points expiry (oldest spent first)", () => {
  it("expires only old points that weren't spent", () => {
    expect(pointsToExpire(800, 500)).toBe(300);
    expect(pointsToExpire(800, 900)).toBe(0);
    expect(pointsToExpire(0, 0)).toBe(0);
  });
});
