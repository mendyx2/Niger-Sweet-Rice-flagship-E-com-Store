import "server-only";
import { db } from "./db";
import { quote, type Quote, type QuoteLine, type QuoteZone, type CouponIssue } from "./pricing";

export type CartViewLine = {
  variantId: string;
  productName: string;
  productSlug: string;
  sizeKg: number;
  qty: number;
  unitPriceKobo: number | null;
  available: number;
  forSale: boolean;
};

export type CartQuote = {
  lines: CartViewLine[];
  quote: Quote | null;
  zone: Pick<QuoteZone, "id" | "name" | "kind"> & { terms: string | null } | null;
  couponCode: string | null;
  couponIssue: CouponIssue | "COUPON_NOT_FOUND" | null;
};

const MAX_LINES = 20;

/** Loads fresh prices/stock and prices the cart. Used by the cart, checkout and order creation. */
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
  const variants = await db.variant.findMany({
    where: { id: { in: lines.map((l) => l.variantId) } },
    include: { product: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const view: CartViewLine[] = lines
    .filter((l) => byId.has(l.variantId))
    .map((l) => {
      const v = byId.get(l.variantId)!;
      const price = opts.wholesale && v.wholesalePriceKobo != null ? v.wholesalePriceKobo : v.retailPriceKobo;
      return {
        variantId: v.id,
        productName: v.product.name,
        productSlug: v.product.slug,
        sizeKg: v.sizeKg,
        qty: l.qty,
        unitPriceKobo: price,
        available: Math.max(v.stockQty - v.reservedQty, 0),
        forSale: v.active && v.product.active && price != null,
      };
    });

  const zone = opts.zoneId ? await db.deliveryZone.findUnique({ where: { id: opts.zoneId } }) : null;
  const code = opts.couponCode?.trim().toUpperCase() || null;
  const coupon = code ? await db.coupon.findUnique({ where: { code } }) : null;

  if (!zone) return { lines: view, quote: null, zone: null, couponCode: code, couponIssue: null };

  const q = quote({
    lines: lines.filter((l) => byId.has(l.variantId)),
    variants: variants.map((v) => ({ ...v, active: v.active && v.product.active })),
    zone,
    coupon,
    wholesale: opts.wholesale,
    userId: opts.userId,
  });
  return {
    lines: view,
    quote: q,
    zone: { id: zone.id, name: zone.name, kind: zone.kind, terms: zone.terms },
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
