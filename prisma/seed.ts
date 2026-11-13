/**
 * Seeds the catalogue and delivery zones. Safe to re-run: it upserts and
 * never overwrites prices or fees that staff have already set.
 *
 * Bag prices are left EMPTY on purpose: staff set them in /ops/prices.
 * Delivery fees below are PLACEHOLDERS: confirm and edit them in /ops/zones.
 */
import { PrismaClient, ZoneKind } from "@prisma/client";

const db = new PrismaClient();

const SIZES = [
  // One photo for both big bags until a 50kg photo is available (the bag pictured is labelled 25kg).
  { sizeKg: 50, stockQty: 0, isSampleSize: false, imageUrl: "/images/sweet-rice-25kg.jpg" },
  { sizeKg: 25, stockQty: 0, isSampleSize: false, imageUrl: "/images/sweet-rice-25kg.jpg" },
  { sizeKg: 5, stockQty: 0, isSampleSize: false, imageUrl: "/images/sweet-rice-5kg.jpg" },
  { sizeKg: 1, stockQty: 0, isSampleSize: true, imageUrl: "/images/sweet-rice-1kg.jpg" },
];

const ABUJA_AREAS = [
  "Wuse", "Wuse II", "Garki", "Maitama", "Asokoro", "Central Area", "Jabi", "Utako", "Wuye", "Jahi",
  "Katampe", "Gwarinpa", "Life Camp", "Kado", "Dawaki", "Kubwa", "Lugbe", "Apo", "Gudu", "Durumi",
  "Lokogoma", "Galadimawa", "Gwagwalada", "Airport Road",
];

/** Nearby towns: delivery subject to a minimum order (MOQ). */
const NEARBY_TOWNS = ["Suleja", "Madalla", "Zuba", "Mararaba", "Nyanya", "Karu", "Masaka", "Kuje", "Bwari"];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  // The brand is Naija Sweet Rice. Rename the product from its earlier working name if it exists.
  const legacy = await db.product.findUnique({ where: { slug: "niger-sweet-rice" } });
  if (legacy && !(await db.product.findUnique({ where: { slug: "naija-sweet-rice" } }))) {
    await db.product.update({ where: { id: legacy.id }, data: { slug: "naija-sweet-rice", name: "Naija Sweet Rice" } });
  }

  const product = await db.product.upsert({
    where: { slug: "naija-sweet-rice" },
    update: {},
    create: {
      slug: "naija-sweet-rice",
      name: "Naija Sweet Rice",
      description:
        "Clean, stone-free parboiled rice that cooks soft, separate and sweet. Perfect for jollof, fried rice, white rice and tuwo shinkafa. Available in 50kg, 25kg, 5kg and 1kg bags.",
    },
  });

  for (const s of SIZES) {
    await db.variant.upsert({
      where: { productId_sizeKg: { productId: product.id, sizeKg: s.sizeKg } },
      update: {},
      create: { productId: product.id, sku: `NSR-${s.sizeKg}KG`, ...s },
    });
    // Fill in a photo if the size doesn't have one yet; never overwrite staff data.
    if (s.imageUrl) {
      await db.variant.updateMany({
        where: { productId: product.id, sizeKg: s.sizeKg, imageUrl: null },
        data: { imageUrl: s.imageUrl },
      });
    }
  }

  let order = 0;
  const zones: { name: string; kind: ZoneKind; baseFeeKobo: number; perKgFeeKobo: number;
    minOrderKg?: number; etaHours: number; terms?: string }[] = [
    { name: "Pickup at flagship store", kind: "PICKUP", baseFeeKobo: 0, perKgFeeKobo: 0, etaHours: 2,
      terms: "Collect from our Abuja flagship store during opening hours." },
    ...ABUJA_AREAS.map((name) => ({ name, kind: "ABUJA" as const, baseFeeKobo: 2_000_00, perKgFeeKobo: 30_00, etaHours: 24 })),
    ...NEARBY_TOWNS.map((name) => ({
      name, kind: "NEARBY_TOWN" as const, baseFeeKobo: 4_000_00, perKgFeeKobo: 40_00, minOrderKg: 50, etaHours: 48,
      terms: "Minimum order of 50kg for delivery to this town.",
    })),
  ];
  for (const z of zones) {
    await db.deliveryZone.upsert({
      where: { slug: slugify(z.name) },
      update: {},
      create: { slug: slugify(z.name), sortOrder: order++, ...z },
    });
  }

  console.log(`Seeded ${SIZES.length} bag sizes and ${zones.length} delivery zones.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
