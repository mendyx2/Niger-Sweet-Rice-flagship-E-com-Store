/*
  Warnings:

  - You are about to drop the column `photoUrls` on the `ReturnClaim` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ReturnClaim" DROP COLUMN "photoUrls";

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "ClaimPhoto" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addressKey" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "badge" TEXT,
    "couponCode" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SampleClaim_userId_key" ON "SampleClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SampleClaim_addressKey_key" ON "SampleClaim"("addressKey");

-- CreateIndex
CREATE UNIQUE INDEX "SampleClaim_orderId_key" ON "SampleClaim"("orderId");

-- AddForeignKey
ALTER TABLE "ClaimPhoto" ADD CONSTRAINT "ClaimPhoto_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ReturnClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
