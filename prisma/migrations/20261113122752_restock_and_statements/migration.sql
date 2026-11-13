-- CreateEnum
CREATE TYPE "RestockStatus" AS ENUM ('REQUESTED', 'INVOICED', 'PAID', 'DISPATCHED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StatementStatus" AS ENUM ('OPEN', 'SETTLED');

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "distributorCostKobo" INTEGER;

-- CreateTable
CREATE TABLE "RestockOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "status" "RestockStatus" NOT NULL DEFAULT 'REQUESTED',
    "lines" JSONB NOT NULL,
    "freeLines" JSONB,
    "totalKobo" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "reference" TEXT,
    "requestedBy" TEXT NOT NULL,
    "paidMarkedAt" TIMESTAMP(3),
    "invoicedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestockOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "feesKobo" INTEGER NOT NULL,
    "creditsKobo" INTEGER NOT NULL,
    "netKobo" INTEGER NOT NULL,
    "bagsToReplace" JSONB NOT NULL,
    "onlineOrders" INTEGER NOT NULL,
    "goodsOnlineKobo" INTEGER NOT NULL,
    "shopTotalKobo" INTEGER NOT NULL,
    "status" "StatementStatus" NOT NULL DEFAULT 'OPEN',
    "closedBy" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "settledBy" TEXT,
    "settleNote" TEXT,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestockOrder_number_key" ON "RestockOrder"("number");

-- CreateIndex
CREATE INDEX "RestockOrder_distributorId_status_idx" ON "RestockOrder"("distributorId", "status");

-- CreateIndex
CREATE INDEX "RestockOrder_status_idx" ON "RestockOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_distributorId_month_key" ON "Statement"("distributorId", "month");

-- AddForeignKey
ALTER TABLE "RestockOrder" ADD CONSTRAINT "RestockOrder_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
