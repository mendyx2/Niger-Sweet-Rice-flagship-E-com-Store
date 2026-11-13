-- Distributor network. Hand-edited to migrate existing data:
-- the flagship store becomes the HQ distributor, owning all existing orders and stock.

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'PAYSTACK', 'NONE');

-- CreateEnum
CREATE TYPE "DistributorStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DistributorRole" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING_BALANCE', 'RESTOCK_SENT', 'RESTOCK_RECEIVED', 'RESTOCK_SHORT', 'ONLINE_SALE', 'WALK_IN_SALE', 'SAMPLE', 'REPLACEMENT', 'ORDER_CANCELLED', 'DAMAGED', 'COUNT_ADJUSTMENT', 'MANUAL_SET');

-- CreateEnum
CREATE TYPE "MovementStatus" AS ENUM ('APPLIED', 'PENDING_APPROVAL', 'REJECTED');

-- AlterTable
ALTER TABLE "DeliveryZone" ADD COLUMN     "distributorId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerMarkedPaidAt" TIMESTAMP(3),
ADD COLUMN     "distributorId" TEXT,
ADD COLUMN     "hqFeeKobo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hqFundedDiscountKobo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payTo" JSONB,
ADD COLUMN     "paymentConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "paymentConfirmedBy" TEXT,
ADD COLUMN     "paymentEscalatedAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
ADD COLUMN     "paymentReminderAt" TIMESTAMP(3),
ADD COLUMN     "routedToHq" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "maxRetailKobo" INTEGER,
ADD COLUMN     "minRetailKobo" INTEGER;

-- CreateTable
CREATE TABLE "Distributor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isHq" BOOLEAN NOT NULL DEFAULT false,
    "status" "DistributorStatus" NOT NULL DEFAULT 'ACTIVE',
    "phone" TEXT,
    "address" TEXT,
    "hours" TEXT,
    "slaHours" INTEGER NOT NULL DEFAULT 4,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "bankUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorMember" (
    "userId" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "role" "DistributorRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributorMember_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DistributorZoneFee" (
    "distributorId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "baseFeeKobo" INTEGER NOT NULL DEFAULT 0,
    "perKgFeeKobo" INTEGER NOT NULL DEFAULT 0,
    "minOrderKg" INTEGER,
    "minOrderKobo" INTEGER,
    "etaHours" INTEGER,
    "terms" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorZoneFee_pkey" PRIMARY KEY ("distributorId","zoneId")
);

-- CreateTable
CREATE TABLE "DistributorPrice" (
    "distributorId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "retailPriceKobo" INTEGER,
    "wholesalePriceKobo" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorPrice_pkey" PRIMARY KEY ("distributorId","variantId")
);

-- CreateTable
CREATE TABLE "HqFeeRate" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "feeKobo" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setBy" TEXT NOT NULL,

    CONSTRAINT "HqFeeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorStock" (
    "distributorId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "held" INTEGER NOT NULL DEFAULT 0,
    "inTransit" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorStock_pkey" PRIMARY KEY ("distributorId","variantId")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "transitDelta" INTEGER NOT NULL DEFAULT 0,
    "onHandAfter" INTEGER,
    "type" "StockMovementType" NOT NULL,
    "status" "MovementStatus" NOT NULL DEFAULT 'APPLIED',
    "orderId" TEXT,
    "walkInSaleId" TEXT,
    "reference" TEXT,
    "actor" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sheetSyncedAt" TIMESTAMP(3),

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalkInSale" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "totalKobo" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalkInSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Distributor_slug_key" ON "Distributor"("slug");

-- CreateIndex
CREATE INDEX "DistributorMember_distributorId_idx" ON "DistributorMember"("distributorId");

-- CreateIndex
CREATE INDEX "HqFeeRate_variantId_effectiveFrom_idx" ON "HqFeeRate"("variantId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "StockMovement_distributorId_createdAt_idx" ON "StockMovement"("distributorId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_status_idx" ON "StockMovement"("status");

-- CreateIndex
CREATE INDEX "StockMovement_sheetSyncedAt_idx" ON "StockMovement"("sheetSyncedAt");

-- CreateIndex
CREATE INDEX "WalkInSale_distributorId_createdAt_idx" ON "WalkInSale"("distributorId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_distributorId_status_idx" ON "Order"("distributorId", "status");

-- AddForeignKey
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorMember" ADD CONSTRAINT "DistributorMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorMember" ADD CONSTRAINT "DistributorMember_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorZoneFee" ADD CONSTRAINT "DistributorZoneFee_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorZoneFee" ADD CONSTRAINT "DistributorZoneFee_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DeliveryZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorPrice" ADD CONSTRAINT "DistributorPrice_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorPrice" ADD CONSTRAINT "DistributorPrice_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HqFeeRate" ADD CONSTRAINT "HqFeeRate_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorStock" ADD CONSTRAINT "DistributorStock_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorStock" ADD CONSTRAINT "DistributorStock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalkInSale" ADD CONSTRAINT "WalkInSale_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ─── Data migration ──────────────────────────────────────────────────────────
-- 1. The flagship store becomes the HQ distributor (fixed id "hq").
INSERT INTO "Distributor" ("id", "name", "slug", "isHq", "status", "slaHours", "createdAt")
VALUES ('hq', 'Naija Sweet Rice HQ', 'hq', true, 'ACTIVE', 4, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- 2. Existing orders belong to HQ. Orders already paid online were paid through Paystack.
UPDATE "Order" SET "distributorId" = 'hq' WHERE "distributorId" IS NULL;
UPDATE "Order" SET "paymentMethod" = 'PAYSTACK' WHERE "paidAt" IS NOT NULL AND "totalKobo" > 0;
UPDATE "Order" SET "paymentMethod" = 'NONE' WHERE "totalKobo" = 0;
ALTER TABLE "Order" ALTER COLUMN "distributorId" SET NOT NULL;

-- 3. HQ's stock moves from Variant into DistributorStock, with an opening-balance movement.
INSERT INTO "DistributorStock" ("distributorId", "variantId", "onHand", "held", "inTransit", "updatedAt")
SELECT 'hq', "id", "stockQty", "reservedQty", 0, CURRENT_TIMESTAMP FROM "Variant";

INSERT INTO "StockMovement" ("id", "distributorId", "variantId", "delta", "transitDelta", "onHandAfter", "type", "status", "actor", "note", "createdAt")
SELECT 'open_' || "id", 'hq', "id", "stockQty", 0, "stockQty", 'OPENING_BALANCE', 'APPLIED', 'migration', 'Stock carried over from the single-store setup', CURRENT_TIMESTAMP
FROM "Variant" WHERE "stockQty" <> 0;

ALTER TABLE "Variant" DROP COLUMN "reservedQty", DROP COLUMN "stockQty";
