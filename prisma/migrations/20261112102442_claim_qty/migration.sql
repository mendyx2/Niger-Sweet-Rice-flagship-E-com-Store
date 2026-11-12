-- AlterTable
ALTER TABLE "ReturnClaim" ADD COLUMN     "qty" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "ReturnClaim_orderId_idx" ON "ReturnClaim"("orderId");

-- CreateIndex
CREATE INDEX "ReturnClaim_status_idx" ON "ReturnClaim"("status");
