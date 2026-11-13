"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { offersForZone } from "@/lib/network";
import { bestOfferPerSize } from "@/lib/network-rules";

export type AreaOffer = {
  variantId: string;
  retailPriceKobo: number | null;
  compareAtPriceKobo: number | null;
  available: number;
  seller: string;
  sellerIsHq: boolean;
};

/** Per bag size: the price and stock from the seller covering this area (or HQ where that seller has none). */
export async function getAreaOffers(zoneId: string): Promise<{ zoneName: string; offers: AreaOffer[] } | null> {
  if (!z.string().min(1).max(40).safeParse(zoneId).success) return null;
  const { zone, owner, hq } = await offersForZone(zoneId);
  if (!zone) return null;
  const variants = await db.variant.findMany({ select: { id: true, compareAtPriceKobo: true } });
  const compareAt = new Map(variants.map((v) => [v.id, v.compareAtPriceKobo]));
  return {
    zoneName: zone.name,
    offers: bestOfferPerSize(owner, hq).map((o) => {
      // Customers may order more than the local distributor holds: the cart then sends the order to HQ.
      const hqLeft = hq.ready ? (hq.variants.find((v) => v.variantId === o.variantId)?.available ?? 0) : 0;
      return {
        variantId: o.variantId,
        retailPriceKobo: o.retailPriceKobo,
        // HQ's "was" price is an HQ promotion; distributors' prices are shown as they are.
        compareAtPriceKobo: o.from.isHq ? (compareAt.get(o.variantId) ?? null) : null,
        available: Math.max(o.available, hqLeft),
        seller: o.from.name,
        sellerIsHq: o.from.isHq,
      };
    }),
  };
}
