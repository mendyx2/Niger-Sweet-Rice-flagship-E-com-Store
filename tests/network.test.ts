import { describe, expect, it } from "vitest";
import { bestOfferPerSize, hqFeeFor, routeOrder, withinBand, type Offer } from "@/lib/network-rules";

const fee = { baseFeeKobo: 100_000, perKgFeeKobo: 2_000, minOrderKg: null, minOrderKobo: null, etaHours: 24, terms: null };
const v = (variantId: string, price: number | null, available: number) =>
  ({ variantId, sizeKg: Number(variantId), retailPriceKobo: price, wholesalePriceKobo: null, available, active: true });
const offer = (id: string, isHq: boolean, variants: ReturnType<typeof v>[], ready = true): Offer =>
  ({ distributorId: id, name: id, isHq, ready, fee, variants });

const gova = offer("gova", false, [v("50", 8_400_000, 10), v("5", 950_000, 0)]);
const hq = offer("hq", true, [v("50", 8_500_000, 40), v("5", 950_000, 60)]);

describe("order routing", () => {
  it("sends the order to the area's distributor when it has everything", () => {
    expect(routeOrder([{ variantId: "50", qty: 2 }], gova, hq)).toEqual({ offer: gova, routedToHq: false });
  });
  it("falls back to HQ when the distributor is short of any bag", () => {
    expect(routeOrder([{ variantId: "50", qty: 1 }, { variantId: "5", qty: 1 }], gova, hq)).toEqual({ offer: hq, routedToHq: true });
    expect(routeOrder([{ variantId: "50", qty: 11 }], gova, hq).offer?.distributorId).toBe("hq");
  });
  it("uses HQ for areas without a distributor, or whose distributor isn't ready", () => {
    expect(routeOrder([{ variantId: "50", qty: 1 }], null, hq)).toEqual({ offer: hq, routedToHq: false });
    expect(routeOrder([{ variantId: "50", qty: 1 }], { ...gova, ready: false }, hq).offer?.distributorId).toBe("hq");
  });
  it("keeps the order with the distributor when nobody can fill it (so the cart explains why)", () => {
    expect(routeOrder([{ variantId: "50", qty: 99 }], gova, hq).offer?.distributorId).toBe("gova");
  });
});

describe("product page offers", () => {
  it("shows each size from the distributor, or HQ where the distributor has none", () => {
    const o = bestOfferPerSize(gova, hq);
    expect(o.find((x) => x.variantId === "50")?.from.distributorId).toBe("gova");
    expect(o.find((x) => x.variantId === "5")?.from.distributorId).toBe("hq");
  });
});

describe("price range and HQ fee", () => {
  it("checks distributor prices against HQ's range", () => {
    expect(withinBand(8_400_000, 8_300_000, 8_800_000)).toBe(true);
    expect(withinBand(8_200_000, 8_300_000, 8_800_000)).toBe(false);
    expect(withinBand(9_000_000, null, 8_800_000)).toBe(false);
    expect(withinBand(null, null, null)).toBe(false);
  });
  it("charges the fixed per-bag fee on distributor sales only", () => {
    const fees = new Map([["50", 50_000], ["5", 10_000]]);
    expect(hqFeeFor([{ variantId: "50", qty: 2 }, { variantId: "5", qty: 3 }], fees, false)).toBe(130_000);
    expect(hqFeeFor([{ variantId: "50", qty: 2 }], fees, true)).toBe(0);
  });
});

import { currentMonth, isMonth, monthRange } from "@/lib/statement-dates";
describe("statement months (Lagos time)", () => {
  it("starts and ends at midnight in Lagos", () => {
    const r = monthRange("2026-11");
    expect(r.from.toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-11-30T23:00:00.000Z");
    expect(monthRange("2026-12").to.toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });
  it("knows the current Lagos month and validates input", () => {
    expect(currentMonth(new Date("2026-11-30T23:30:00Z"))).toBe("2026-12");
    expect(isMonth("2026-11")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("x")).toBe(false);
  });
});
