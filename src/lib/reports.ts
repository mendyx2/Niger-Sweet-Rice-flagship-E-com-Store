/** Pure aggregation for the owner's sales reports (unit tested). Money in kobo. */

export type ReportOrder = {
  type: "STANDARD" | "SAMPLE" | "REPLACEMENT";
  userId: string | null;
  paidAt: Date;
  subtotalKobo: number;
  discountKobo: number;
  deliveryFeeKobo: number;
  zoneName: string;
  couponId: string | null;
  referrerId: string | null;
  affiliateCode: string | null;
  items: { sizeKg: number; qty: number; unitPriceKobo: number }[];
};

const LAGOS_OFFSET_MS = 3600_000; // Africa/Lagos = UTC+1, no daylight saving
export const lagosDay = (d: Date) => new Date(d.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);

export function buildReport(orders: ReportOrder[], from: Date, to: Date) {
  const sales = orders.filter((o) => o.type === "STANDARD");
  const goods = (o: ReportOrder) => o.subtotalKobo - o.discountKobo;

  // Daily sales, including empty days so gaps are visible.
  const days: { day: string; salesKobo: number; orders: number }[] = [];
  for (let t = new Date(lagosDay(from) + "T00:00:00Z").getTime(); t <= new Date(lagosDay(to) + "T00:00:00Z").getTime(); t += 86400_000) {
    days.push({ day: new Date(t).toISOString().slice(0, 10), salesKobo: 0, orders: 0 });
  }
  const dayIdx = new Map(days.map((d, i) => [d.day, i]));
  for (const o of sales) {
    const i = dayIdx.get(lagosDay(o.paidAt));
    if (i != null) { days[i].salesKobo += goods(o); days[i].orders++; }
  }

  const bySize = new Map<number, { sizeKg: number; bags: number; salesKobo: number }>();
  for (const o of sales) for (const it of o.items) {
    const r = bySize.get(it.sizeKg) ?? { sizeKg: it.sizeKg, bags: 0, salesKobo: 0 };
    r.bags += it.qty;
    r.salesKobo += it.qty * it.unitPriceKobo;
    bySize.set(it.sizeKg, r);
  }

  const byArea = new Map<string, { area: string; orders: number; salesKobo: number }>();
  for (const o of sales) {
    const r = byArea.get(o.zoneName) ?? { area: o.zoneName, orders: 0, salesKobo: 0 };
    r.orders++; r.salesKobo += goods(o);
    byArea.set(o.zoneName, r);
  }

  // Each order counts under one channel, most specific first.
  const channelOf = (o: ReportOrder) => (o.affiliateCode ? "Affiliate link" : o.referrerId ? "Friend referral" : o.couponId ? "Coupon / promotion" : "Direct");
  const byChannel = new Map<string, { channel: string; orders: number; salesKobo: number }>();
  for (const o of sales) {
    const c = channelOf(o);
    const r = byChannel.get(c) ?? { channel: c, orders: 0, salesKobo: 0 };
    r.orders++; r.salesKobo += goods(o);
    byChannel.set(c, r);
  }

  const byAffiliate = new Map<string, { code: string; orders: number; salesKobo: number }>();
  for (const o of sales) if (o.affiliateCode) {
    const r = byAffiliate.get(o.affiliateCode) ?? { code: o.affiliateCode, orders: 0, salesKobo: 0 };
    r.orders++; r.salesKobo += goods(o);
    byAffiliate.set(o.affiliateCode, r);
  }

  // Sample conversion: of people who got a sample in the period, how many later bought.
  const samplers = new Map<string, Date>();
  for (const o of orders) if (o.type === "SAMPLE" && o.userId && !samplers.has(o.userId)) samplers.set(o.userId, o.paidAt);
  let converted = 0;
  for (const [u, at] of samplers) if (sales.some((o) => o.userId === u && o.paidAt > at)) converted++;

  const salesKobo = sales.reduce((n, o) => n + goods(o), 0);
  const byDesc = <T extends { salesKobo: number }>(a: T, b: T) => b.salesKobo - a.salesKobo;
  return {
    totals: {
      salesKobo,
      deliveryKobo: sales.reduce((n, o) => n + o.deliveryFeeKobo, 0),
      discountKobo: sales.reduce((n, o) => n + o.discountKobo, 0),
      orders: sales.length,
      avgOrderKobo: sales.length ? Math.round(salesKobo / sales.length) : 0,
      kg: sales.reduce((n, o) => n + o.items.reduce((m, i) => m + i.sizeKg * i.qty, 0), 0),
      samples: samplers.size,
      samplesConverted: converted,
      replacements: orders.filter((o) => o.type === "REPLACEMENT").length,
    },
    days,
    bySize: [...bySize.values()].sort((a, b) => b.sizeKg - a.sizeKg),
    byArea: [...byArea.values()].sort(byDesc),
    byChannel: [...byChannel.values()].sort(byDesc),
    byAffiliate: [...byAffiliate.values()].sort(byDesc).slice(0, 10),
  };
}
