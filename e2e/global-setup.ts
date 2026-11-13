import { execSync } from "node:child_process";
import { E2E_DB } from "../playwright.config";
import { db } from "./db";

/**
 * Prepares the test database WITHOUT wiping it: applies migrations, loads the
 * normal starting data (seed, idempotent), then sets the fixtures below to
 * known values. Tests create their own uniquely-named customers and codes,
 * so repeated runs don't collide.
 */
export default async function globalSetup() {
  if (!/e2e|test/i.test(new URL(E2E_DB).pathname)) {
    throw new Error(`Refusing to use ${E2E_DB}: the end-to-end database name must contain "e2e" or "test".`);
  }
  const env = { ...process.env, DATABASE_URL: E2E_DB };
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });

  const v = Object.fromEntries((await db.variant.findMany()).map((x) => [x.sizeKg, x]));
  const kobo = (naira: number) => naira * 100;

  // HQ prices, distributor ranges, distributor price, HQ per-bag fee, HQ stock
  const prices: Record<number, { retail: number; was?: number; min?: number; max?: number; cost?: number; fee?: number }> = {
    50: { retail: 85_000, min: 83_000, max: 88_000, cost: 78_000, fee: 500 },
    25: { retail: 43_000, min: 41_000, max: 45_000, cost: 39_000, fee: 300 },
    5: { retail: 9_500, was: 10_500 },
    1: { retail: 1_500, cost: 1_000 },
  };
  for (const [kg, p] of Object.entries(prices)) {
    const id = v[Number(kg)].id;
    await db.variant.update({
      where: { id },
      data: { retailPriceKobo: kobo(p.retail), compareAtPriceKobo: p.was ? kobo(p.was) : null, minRetailKobo: p.min ? kobo(p.min) : null,
        maxRetailKobo: p.max ? kobo(p.max) : null, distributorCostKobo: p.cost ? kobo(p.cost) : null, active: true },
    });
    const fee = await db.hqFeeRate.findFirst({ where: { variantId: id }, orderBy: { effectiveFrom: "desc" } });
    if (p.fee && fee?.feeKobo !== kobo(p.fee)) await db.hqFeeRate.create({ data: { variantId: id, feeKobo: kobo(p.fee), setBy: "e2e" } });
    await db.distributorStock.update({ where: { distributorId_variantId: { distributorId: "hq", variantId: id } }, data: { onHand: 200, held: 0, inTransit: 0 } });
  }
  await db.distributor.update({ where: { id: "hq" }, data: { bankName: "Zenith Bank", accountNumber: "1012345678", accountName: "Naija Sweet Rice Ltd" } });

  // Gova Max Ltd: Gwarinpa + Kubwa, own prices and fees, known stock, an owner login
  const gova = await db.distributor.update({
    where: { slug: "gova-max-ltd" },
    data: { status: "ACTIVE", phone: "+2348120004444", bankName: "GTBank", accountNumber: "0234567891", accountName: "Gova Max Ltd" },
  });
  for (const name of ["Gwarinpa", "Kubwa"]) {
    const z = await db.deliveryZone.findFirstOrThrow({ where: { name } });
    await db.deliveryZone.update({ where: { id: z.id }, data: { distributorId: gova.id } });
    const fee = { baseFeeKobo: kobo(1_500), perKgFeeKobo: kobo(20), etaHours: 24, minOrderKg: null, minOrderKobo: null };
    await db.distributorZoneFee.upsert({ where: { distributorId_zoneId: { distributorId: gova.id, zoneId: z.id } }, create: { distributorId: gova.id, zoneId: z.id, ...fee }, update: fee });
  }
  for (const [kg, naira] of [[50, 84_000], [25, 42_500]] as const) {
    const data = { retailPriceKobo: kobo(naira), wholesalePriceKobo: null };
    await db.distributorPrice.upsert({ where: { distributorId_variantId: { distributorId: gova.id, variantId: v[kg].id } }, create: { distributorId: gova.id, variantId: v[kg].id, ...data }, update: data });
  }
  for (const [kg, qty] of [[50, 10], [25, 4], [5, 0], [1, 5]] as const) {
    await db.distributorStock.update({ where: { distributorId_variantId: { distributorId: gova.id, variantId: v[kg].id } }, data: { onHand: qty, held: 0, inTransit: 0 } });
  }
  const owner = await db.user.upsert({
    where: { phone: "+2348120003333" },
    create: { phone: "+2348120003333", name: "Musa Gova", referralCode: "GOVAOWNER1" },
    update: { roles: ["BUYER"] },
  });
  await db.distributorMember.upsert({ where: { userId: owner.id }, create: { userId: owner.id, distributorId: gova.id, role: "OWNER" }, update: { distributorId: gova.id, role: "OWNER" } });

  // Leftovers from an interrupted earlier run
  await db.telegramChat.deleteMany({ where: { chatId: "5551" } });
  await db.otpCode.deleteMany({});
  await db.$disconnect();
}
