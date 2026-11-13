import "server-only";
import type { DeliveryZone, Distributor, Prisma } from "@prisma/client";
import { db } from "./db";
import { withinBand, type Offer, type OfferFee } from "./network-rules";

export const HQ_ID = "hq";

const hasBank = (d: Distributor) => !!(d.bankName && d.accountNumber && d.accountName);

/** What a distributor (or HQ) can sell into a given area: prices, stock and delivery fee. */
async function buildOffer(d: Distributor, zone: DeliveryZone | null): Promise<Offer> {
  const [variants, stock, prices, fee] = await Promise.all([
    db.variant.findMany({ include: { product: true } }),
    db.distributorStock.findMany({ where: { distributorId: d.id } }),
    d.isHq ? Promise.resolve([]) : db.distributorPrice.findMany({ where: { distributorId: d.id } }),
    zone && !d.isHq ? db.distributorZoneFee.findUnique({ where: { distributorId_zoneId: { distributorId: d.id, zoneId: zone.id } } }) : null,
  ]);
  const stockBy = new Map(stock.map((s) => [s.variantId, Math.max(s.onHand - s.held, 0)]));
  const priceBy = new Map(prices.map((p) => [p.variantId, p]));

  const zoneFee: OfferFee | null = d.isHq
    ? zone && { baseFeeKobo: zone.baseFeeKobo, perKgFeeKobo: zone.perKgFeeKobo, minOrderKg: zone.minOrderKg, minOrderKobo: zone.minOrderKobo, etaHours: zone.etaHours, terms: zone.terms }
    : fee && { baseFeeKobo: fee.baseFeeKobo, perKgFeeKobo: fee.perKgFeeKobo, minOrderKg: fee.minOrderKg, minOrderKobo: fee.minOrderKobo, etaHours: fee.etaHours, terms: fee.terms };
  // Pickup is free at HQ's flagship store only.
  const pickupFee: OfferFee = { baseFeeKobo: 0, perKgFeeKobo: 0, minOrderKg: null, minOrderKobo: null, etaHours: zone?.etaHours ?? null, terms: zone?.terms ?? null };

  return {
    distributorId: d.id,
    name: d.isHq ? "Naija Sweet Rice HQ" : d.name,
    isHq: d.isHq,
    ready: d.status === "ACTIVE" && hasBank(d),
    fee: zone?.kind === "PICKUP" ? (d.isHq ? pickupFee : null) : zoneFee,
    variants: variants.map((v) => {
      const p = priceBy.get(v.id);
      // Distributor prices only count if they sit inside HQ's current range.
      const retail = d.isHq ? v.retailPriceKobo : p && withinBand(p.retailPriceKobo, v.minRetailKobo, v.maxRetailKobo) ? p.retailPriceKobo : null;
      return {
        variantId: v.id,
        sizeKg: v.sizeKg,
        retailPriceKobo: retail,
        wholesalePriceKobo: d.isHq ? v.wholesalePriceKobo : retail != null ? (p?.wholesalePriceKobo ?? null) : null,
        available: stockBy.get(v.id) ?? 0,
        active: v.active && v.product.active,
      };
    }),
  };
}

export async function getHq(): Promise<Distributor> {
  return db.distributor.findUniqueOrThrow({ where: { id: HQ_ID } });
}

/** The area's own distributor offer (if any) and HQ's offer for the same area. */
export async function offersForZone(zoneId: string | null) {
  const zone = zoneId ? await db.deliveryZone.findUnique({ where: { id: zoneId }, include: { distributor: true } }) : null;
  const hq = await getHq();
  const ownerD = zone?.distributor && !zone.distributor.isHq ? zone.distributor : null;
  const [owner, hqOffer] = await Promise.all([ownerD ? buildOffer(ownerD, zone) : null, buildOffer(hq, zone)]);
  return { zone, owner, hq: hqOffer };
}

export async function offerFor(distributorId: string, zoneId: string | null) {
  const [d, zone] = await Promise.all([
    db.distributor.findUniqueOrThrow({ where: { id: distributorId } }),
    zoneId ? db.deliveryZone.findUnique({ where: { id: zoneId } }) : null,
  ]);
  return buildOffer(d, zone);
}

/** Current HQ per-bag fee for each bag size (latest rate in force). */
export async function currentHqFees(at = new Date()): Promise<Map<string, number>> {
  const rows = await db.hqFeeRate.findMany({ where: { effectiveFrom: { lte: at } }, orderBy: { effectiveFrom: "desc" } });
  const m = new Map<string, number>();
  for (const r of rows) if (!m.has(r.variantId)) m.set(r.variantId, r.feeKobo);
  return m;
}

export function payToSnapshot(d: Distributor) {
  return { distributorName: d.isHq ? "Naija Sweet Rice HQ" : d.name, bankName: d.bankName, accountNumber: d.accountNumber, accountName: d.accountName };
}

export type Tx = Prisma.TransactionClient;
