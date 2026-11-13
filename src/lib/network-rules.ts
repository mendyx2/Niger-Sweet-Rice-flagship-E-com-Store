/**
 * Pure rules for the distributor network (unit tested; no database access).
 */

export type OfferVariant = {
  variantId: string;
  sizeKg: number;
  retailPriceKobo: number | null;
  wholesalePriceKobo: number | null;
  available: number;
  active: boolean;
};

export type OfferFee = {
  baseFeeKobo: number;
  perKgFeeKobo: number;
  minOrderKg: number | null;
  minOrderKobo: number | null;
  etaHours: number | null;
  terms: string | null;
};

export type Offer = {
  distributorId: string;
  name: string;
  isHq: boolean;
  ready: boolean; // active, has bank details and a delivery fee for the area
  fee: OfferFee | null;
  variants: OfferVariant[];
};

/** Is a distributor price inside HQ's range? (null bound = no limit on that side) */
export function withinBand(price: number | null, min: number | null, max: number | null): boolean {
  if (price == null) return false;
  if (min != null && price < min) return false;
  if (max != null && price > max) return false;
  return true;
}

function canFill(offer: Offer | null, lines: { variantId: string; qty: number }[], wholesale = false): boolean {
  if (!offer?.ready || !offer.fee) return false;
  return lines.every((l) => {
    const v = offer.variants.find((x) => x.variantId === l.variantId);
    const price = v && (wholesale && v.wholesalePriceKobo != null ? v.wholesalePriceKobo : v.retailPriceKobo);
    return !!v && v.active && price != null && v.available >= l.qty;
  });
}

export type Routing = { offer: Offer | null; routedToHq: boolean };

/**
 * One distributor per area. The area's distributor fulfils the order if it can
 * supply every line; otherwise HQ does (if it can). If neither can, the order
 * stays with whoever should normally serve it so the cart shows why.
 */
export function routeOrder(
  lines: { variantId: string; qty: number }[],
  areaOwner: Offer | null,
  hq: Offer | null,
  wholesale = false,
): Routing {
  const owner = areaOwner && !areaOwner.isHq ? areaOwner : null;
  if (owner && canFill(owner, lines, wholesale)) return { offer: owner, routedToHq: false };
  if (canFill(hq, lines, wholesale)) return { offer: hq, routedToHq: !!owner };
  if (owner?.ready && owner.fee) return { offer: owner, routedToHq: false };
  return { offer: hq?.ready ? hq : null, routedToHq: false };
}

/** Per-size offer for the product page: the area's distributor if it can sell that size, else HQ. */
export function bestOfferPerSize(areaOwner: Offer | null, hq: Offer | null) {
  const owner = areaOwner && !areaOwner.isHq && areaOwner.ready ? areaOwner : null;
  const sizes = new Set([...(owner?.variants ?? []), ...(hq?.variants ?? [])].map((v) => v.variantId));
  return [...sizes].map((variantId) => {
    const o = owner?.variants.find((v) => v.variantId === variantId);
    if (o && o.active && o.retailPriceKobo != null && o.available > 0) return { ...o, from: owner! };
    const h = hq?.ready ? hq.variants.find((v) => v.variantId === variantId) : undefined;
    if (h && h.active && h.retailPriceKobo != null && h.available > 0) return { ...h, from: hq! };
    return { ...(o ?? h)!, from: (owner ?? hq)! };
  });
}

/** HQ fee owed on an order: fixed amount per bag (by size), only on distributor (non-HQ) sales. */
export function hqFeeFor(lines: { variantId: string; qty: number }[], feeByVariant: Map<string, number>, isHq: boolean): number {
  if (isHq) return 0;
  return lines.reduce((n, l) => n + (feeByVariant.get(l.variantId) ?? 0) * l.qty, 0);
}

export const PAYMENT_HOLD_HOURS = 3;
export const PAYMENT_REMINDER_HOURS = 2;
