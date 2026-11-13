import { PrismaClient } from "@prisma/client";
import { E2E_DB } from "../playwright.config";

/** Direct access to the test database, for setting up data and checking results. */
export const db = new PrismaClient({ datasources: { db: { url: E2E_DB } } });

export const zoneId = async (name: string) => (await db.deliveryZone.findFirstOrThrow({ where: { name } })).id;
export const variantId = async (sizeKg: number) => (await db.variant.findFirstOrThrow({ where: { sizeKg } })).id;
export const stockOf = async (distributorSlug: string, sizeKg: number) =>
  db.distributorStock.findFirstOrThrow({ where: { distributor: { slug: distributorSlug }, variant: { sizeKg } } });
