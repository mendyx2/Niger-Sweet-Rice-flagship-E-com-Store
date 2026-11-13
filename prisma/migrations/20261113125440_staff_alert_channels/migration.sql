-- AlterTable
ALTER TABLE "Distributor" ADD COLUMN     "alertEmail" TEXT;

-- CreateTable
CREATE TABLE "TelegramChat" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT,
    "isHq" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramChat_chatId_key" ON "TelegramChat"("chatId");

-- CreateIndex
CREATE INDEX "TelegramChat_userId_idx" ON "TelegramChat"("userId");

-- AddForeignKey
ALTER TABLE "TelegramChat" ADD CONSTRAINT "TelegramChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
