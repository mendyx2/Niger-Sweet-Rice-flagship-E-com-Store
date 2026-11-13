import "server-only";
import { db } from "./db";
import { quote, type Quote, type QuoteLine, type QuoteZone, type CouponIssue } from "./pricing";
import { offersForZone } from "./network";
import { routeOrder, type OfferFee } from "./network-rules";

export type CartViewLine = {
  variantId: string;
  productName: string;
  productSlug: string;
  sizeKg: number;
  imageUrl: string | null;
  qty: number;
  unitPriceKobo: number | null;
  available: number;
  forSale: boolean;
};

export type Fulfiller = { distributorId: string; name: string; isHq: boolean; routedToHq: boolean };

export type CartQuote = {
  lines: CartViewLine[];
  quote: Quote | null;
  zone: (Pick<QuoteZone, "id" | "name" | "kind"> & { terms: string | null }) | null;
  fulfiller: Fulfiller | null;
  couponCode: string | null;
  couponIssue: CouponIssue | "COUPON_NOT_FOUND" | null;
};

const MAX_LINES = 20;
const NO_ZONE_FEE: OfferFee = { baseFeeKobo: 0, perKgFeeKobo: 0, minOrderKg: null, minOrderKobo: null, etaHours: null, terms: null };

/**
 * Prices the cart for the customer's area: routes it to the area's distributor
 * (or HQ if that distributor can't fill it), then uses that distributor's
 * prices, stock and delivery fee. Used by the cart, checkout and order creation.
 */
export async function priceCart(opts: {
  lines: QuoteLine[];
  zoneId?: string | null;
  couponCode?: string | null;
  userId?: string | null;
  wholesale?: boolean;
}): Promise<CartQuote> {
  const lines = opts.lines
    .filter((l) => typeof l.variantId === "string" && l.variantId.length < 40)
    .slice(0, MAX_LINES);
  const [variants, offers] = await Promise.all([
    db.variant.findMany({ where: { id: { in: lines.map((l) => l.variantId) } }, include: { product: true } }),
    offersForZone(opts.zoneId ?? null),
  ]);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const known = lines.filter((l) => byId.has(l.variantId));

  const routing = routeOrder(known, offers.owner, offers.hq, opts.wholesale);
  const offer = routing.offer ?? offers.hq;
  const ov = new Map(offer.variants.map((v) => [v.variantId, v]));

  const view: CartViewLine[] = known.map((l) => {
    const v = byId.get(l.variantId)!;
    const o = ov.get(v.id);
    const price = o && (opts.wholesale && o.wholesalePriceKobo != null ? o.wholesalePriceKobo : o.retailPriceKobo);
    return {
      variantId: v.id,
      productName: v.product.name,
      productSlug: v.product.slug,
      sizeKg: v.sizeKg,
      imageUrl: v.imageUrl,
      qty: l.qty,
      unitPriceKobo: price ?? null,
      available: o?.available ?? 0,
      forSale: !!o?.active && price != null,
    };
  });

  const zone = offers.zone;
  const code = opts.couponCode?.trim().toUpperCase() || null;
  const coupon = code ? await db.coupon.findUnique({ where: { code } }) : null;

  // Before an area is chosen, price the goods and discount only (no delivery fee or minimum order yet).
  const fee = zone ? offer.fee : NO_ZONE_FEE;
  const pricingZone: QuoteZone = {
    id: zone?.id ?? "", name: zone?.name ?? "", kind: zone?.kind ?? "PICKUP",
    ...(fee ?? NO_ZONE_FEE),
    // An area nobody can serve yet is treated as unavailable.
    active: zone ? zone.active && !!fee && !!routing.offer : true,
  };

  const q = quote({
    lines: known,
    variants: offer.variants.map((v) => ({
      id: v.variantId, sizeKg: v.sizeKg, retailPriceKobo: v.retailPriceKobo, wholesalePriceKobo: v.wholesalePriceKobo,
      stockQty: v.available, reservedQty: 0, active: v.active,
    })),
    zone: pricingZone,
    coupon,
    wholesale: opts.wholesale,
    userId: opts.userId,
  });
  return {
    lines: view,
    quote: q,
    zone: zone ? { id: zone.id, name: zone.name, kind: zone.kind, terms: fee?.terms ?? zone.terms } : null,
    fulfiller: routing.offer
      ? { distributorId: routing.offer.distributorId, name: routing.offer.name, isHq: routing.offer.isHq, routedToHq: routing.routedToHq }
      : null,
    couponCode: code,
    couponIssue: code && !coupon ? "COUPON_NOT_FOUND" : q.couponIssue,
  };
}

export function couponMessage(issue: CartQuote["couponIssue"]): string | null {
  switch (issue) {
    case null: return null;
    case "COUPON_NOT_FOUND": return "We couldn't find that coupon code.";
    case "COUPON_NOT_STARTED": return "This coupon isn't active yet.";
    case "COUPON_EXPIRED": return "This coupon has expired.";
    case "COUPON_USED_UP": return "This coupon has already been used.";
    case "COUPON_NOT_YOURS": return "This coupon belongs to another account.";
    case "COUPON_MIN_ORDER": return "Your order is below this coupon's minimum spend.";
  }
}
