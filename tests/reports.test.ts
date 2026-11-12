import { describe, expect, it } from "vitest";
import { buildReport, lagosDay, type ReportOrder } from "@/lib/reports";

const o = (p: Partial<ReportOrder>): ReportOrder => ({
  type: "STANDARD", userId: "u1", paidAt: new Date("2026-11-10T10:00:00Z"), subtotalKobo: 8_500_000, discountKobo: 0,
  deliveryFeeKobo: 350_000, zoneName: "Wuse", couponId: null, referrerId: null, affiliateCode: null,
  items: [{ sizeKg: 50, qty: 1, unitPriceKobo: 8_500_000 }], ...p,
});

describe("owner report", () => {
  it("buckets days in Lagos time", () => {
    expect(lagosDay(new Date("2026-11-10T23:30:00Z"))).toBe("2026-11-11");
  });
  it("totals sales after discount and excludes samples/replacements", () => {
    const r = buildReport([
      o({ discountKobo: 500_000 }),
      o({ type: "SAMPLE", subtotalKobo: 0, items: [{ sizeKg: 1, qty: 1, unitPriceKobo: 0 }], userId: "u2", paidAt: new Date("2026-11-09T09:00:00Z") }),
      o({ type: "REPLACEMENT", subtotalKobo: 0 }),
      o({ userId: "u2", zoneName: "Garki", affiliateCode: "ABC1234", items: [{ sizeKg: 5, qty: 2, unitPriceKobo: 950_000 }], subtotalKobo: 1_900_000 }),
    ], new Date("2026-11-08T00:00:00Z"), new Date("2026-11-11T00:00:00Z"));
    expect(r.totals.orders).toBe(2);
    expect(r.totals.salesKobo).toBe(8_000_000 + 1_900_000);
    expect(r.totals.kg).toBe(60);
    expect(r.totals.samples).toBe(1);
    expect(r.totals.samplesConverted).toBe(1);
    expect(r.totals.replacements).toBe(1);
    expect(r.days).toHaveLength(4);
    expect(r.days.find((d) => d.day === "2026-11-10")?.orders).toBe(2);
    expect(r.byChannel.map((c) => c.channel)).toEqual(["Direct", "Affiliate link"]);
    expect(r.bySize.map((s) => s.sizeKg)).toEqual([50, 5]);
    expect(r.byAffiliate[0]).toEqual({ code: "ABC1234", orders: 1, salesKobo: 1_900_000 });
  });
});
