import { describe, expect, it } from "vitest";
import { quote, type QuoteVariant, type QuoteZone, type QuoteCoupon } from "@/lib/pricing";

const v = (id: string, sizeKg: number, price: number | null, stock = 100): QuoteVariant => ({
  id, sizeKg, retailPriceKobo: price, wholesalePriceKobo: price ? price - 100_000 : null,
  stockQty: stock, reservedQty: 0, active: true,
});
const variants = [v("50", 50, 8_000_000), v("25", 25, 4_100_000), v("5", 5, 900_000), v("1", 1, null)];

const abuja: QuoteZone = { id: "wuse", name: "Wuse", kind: "ABUJA", baseFeeKobo: 150_000, perKgFeeKobo: 2_000,
  minOrderKg: null, minOrderKobo: null, active: true };
const suleja: QuoteZone = { ...abuja, id: "suleja", name: "Suleja", kind: "NEARBY_TOWN", minOrderKg: 50 };
const pickup: QuoteZone = { ...abuja, id: "pickup", kind: "PICKUP" };

const coupon = (o: Partial<QuoteCoupon> = {}): QuoteCoupon => ({
  code: "SAVE10", type: "PERCENT", value: 10, maxDiscountKobo: null, minOrderKobo: 0, maxUses: 1, usedCount: 0,
  userId: null, startsAt: new Date("2026-01-01"), expiresAt: null, ...o,
});

describe("quote", () => {
  it("totals goods + weight-based delivery", () => {
    const q = quote({ lines: [{ variantId: "50", qty: 1 }, { variantId: "5", qty: 2 }], variants, zone: abuja });
    expect(q.ok).toBe(true);
    expect(q.totalKg).toBe(60);
    expect(q.subtotalKobo).toBe(9_800_000);
    expect(q.deliveryFeeKobo).toBe(150_000 + 60 * 2_000);
    expect(q.totalKobo).toBe(9_800_000 + 270_000);
  });

  it("charges nothing for flagship pickup", () => {
    expect(quote({ lines: [{ variantId: "5", qty: 1 }], variants, zone: pickup }).deliveryFeeKobo).toBe(0);
  });

  it("enforces nearby-town minimum order (MOQ)", () => {
    const q = quote({ lines: [{ variantId: "25", qty: 1 }], variants, zone: suleja });
    expect(q.ok).toBe(false);
    expect(q.issues).toContainEqual({ code: "BELOW_MIN_KG", minKg: 50, cartKg: 25 });
    expect(quote({ lines: [{ variantId: "25", qty: 2 }], variants, zone: suleja }).ok).toBe(true);
  });

  it("rejects sizes without a price yet", () => {
    const q = quote({ lines: [{ variantId: "1", qty: 1 }], variants, zone: abuja });
    expect(q.issues).toContainEqual({ code: "NOT_FOR_SALE", variantId: "1" });
  });

  it("rejects bad quantities and over-stock orders", () => {
    expect(quote({ lines: [{ variantId: "5", qty: 0 }], variants, zone: abuja }).ok).toBe(false);
    expect(quote({ lines: [{ variantId: "5", qty: 1.5 }], variants, zone: abuja }).ok).toBe(false);
    const q = quote({ lines: [{ variantId: "5", qty: 101 }], variants, zone: abuja });
    expect(q.issues).toContainEqual({ code: "OUT_OF_STOCK", variantId: "5", available: 100 });
  });

  it("merges duplicate lines", () => {
    const q = quote({ lines: [{ variantId: "5", qty: 1 }, { variantId: "5", qty: 2 }], variants, zone: abuja });
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0].qty).toBe(3);
  });

  it("uses wholesale prices for approved sellers", () => {
    const q = quote({ lines: [{ variantId: "50", qty: 1 }], variants, zone: abuja, wholesale: true });
    expect(q.subtotalKobo).toBe(7_900_000);
  });

  it("applies coupons to goods only, with caps and rules", () => {
    const now = new Date("2026-06-01");
    const base = { lines: [{ variantId: "50", qty: 1 }], variants, zone: abuja, now };
    expect(quote({ ...base, coupon: coupon() }).discountKobo).toBe(800_000);
    expect(quote({ ...base, coupon: coupon({ maxDiscountKobo: 200_000 }) }).discountKobo).toBe(200_000);
    expect(quote({ ...base, coupon: coupon({ type: "FIXED", value: 99_000_000 }) }).discountKobo).toBe(8_000_000);
    expect(quote({ ...base, coupon: coupon({ usedCount: 1 }) }).couponIssue).toBe("COUPON_USED_UP");
    expect(quote({ ...base, coupon: coupon({ expiresAt: new Date("2026-05-01") }) }).couponIssue).toBe("COUPON_EXPIRED");
    expect(quote({ ...base, coupon: coupon({ userId: "someone" }), userId: "me" }).couponIssue).toBe("COUPON_NOT_YOURS");
    expect(quote({ ...base, coupon: coupon({ minOrderKobo: 9_000_000 }) }).couponIssue).toBe("COUPON_MIN_ORDER");
  });
});
