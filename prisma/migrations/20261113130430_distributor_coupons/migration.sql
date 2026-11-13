-- AlterEnum
ALTER TYPE "CouponSource" ADD VALUE 'DISTRIBUTOR';

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "distributorId" TEXT;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
