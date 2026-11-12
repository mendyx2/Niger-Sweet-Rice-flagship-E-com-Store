import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";

/** Cache tags. Staff edits in /ops call updateTag() with these. */
export const TAGS = { catalogue: "catalogue", zones: "zones", promotions: "promotions" } as const;

export type CatalogueVariant = {
  id: string;
  sku: string;
  sizeKg: number;
  retailPriceKobo: number | null;
  compareAtPriceKobo: number | null;
  available: number;
  isSampleSize: boolean;
  imageUrl: string | null;
};

export type CatalogueProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  updatedAt: Date;
  variants: CatalogueVariant[];
};

/** Active products with active bag sizes, largest bag first. Cached until a price edit. */
export async function getProducts(): Promise<CatalogueProduct[]> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.catalogue);

  const products = await db.product.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { variants: { where: { active: true }, orderBy: { sizeKg: "desc" } } },
  });
  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    updatedAt: p.updatedAt,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      sizeKg: v.sizeKg,
      retailPriceKobo: v.retailPriceKobo,
      compareAtPriceKobo: v.compareAtPriceKobo,
      available: Math.max(v.stockQty - v.reservedQty, 0),
      isSampleSize: v.isSampleSize,
      imageUrl: v.imageUrl,
    })),
  }));
}

export async function getProduct(slug: string): Promise<CatalogueProduct | null> {
  const products = await getProducts();
  return products.find((p) => p.slug === slug) ?? null;
}

export async function getZones() {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.zones);
  return db.deliveryZone.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

/** Lowest available retail price across sizes, for "from ₦X" labels. */
export function fromPrice(p: CatalogueProduct): number | null {
  const prices = p.variants.map((v) => v.retailPriceKobo).filter((x): x is number => x != null);
  return prices.length ? Math.min(...prices) : null;
}

/** Live promotions for /promotions and the home page. Re-checked every few minutes so start/end dates apply on time. */
export async function getActivePromotions() {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.promotions);
  const now = new Date();
  return db.promotion.findMany({
    where: { active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 12,
  });
}
