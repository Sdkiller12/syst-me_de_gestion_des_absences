-- AlterEnum: add RETRY_EXHAUSTED to SmsStatus
ALTER TYPE "SmsStatus" ADD VALUE 'RETRY_EXHAUSTED';

-- AlterTable: add retryCount, maxRetries, nextRetryAt to SmsLog
ALTER TABLE "SmsLog" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SmsLog" ADD COLUMN "maxRetries" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "SmsLog" ADD COLUMN "nextRetryAt" TIMESTAMP(3);

-- CreateIndex for nextRetryAt
CREATE INDEX "SmsLog_nextRetryAt_idx" ON "SmsLog"("nextRetryAt");

-- CreateTable: RevokedToken
CREATE TABLE "RevokedToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RevokedToken_tokenHash_key" ON "RevokedToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RevokedToken_tokenHash_idx" ON "RevokedToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RevokedToken_expiresAt_idx" ON "RevokedToken"("expiresAt");
