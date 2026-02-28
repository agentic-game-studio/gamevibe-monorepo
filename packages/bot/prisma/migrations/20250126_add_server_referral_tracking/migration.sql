-- Add referral tracking fields to servers table
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;

-- Create unique index on referral code
CREATE UNIQUE INDEX IF NOT EXISTS "servers_referralCode_key" ON "servers"("referralCode");

-- CreateTable
CREATE TABLE IF NOT EXISTS "server_referrals" (
    "id" TEXT NOT NULL,
    "referringServerId" TEXT NOT NULL,
    "referredServerId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscribedAt" TIMESTAMP(3),
    "subscriptionTier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "server_referrals_referredServerId_key" ON "server_referrals"("referredServerId");
CREATE INDEX IF NOT EXISTS "server_referrals_referringServerId_idx" ON "server_referrals"("referringServerId");
CREATE INDEX IF NOT EXISTS "server_referrals_referralCode_idx" ON "server_referrals"("referralCode");
CREATE INDEX IF NOT EXISTS "server_referrals_subscribedAt_idx" ON "server_referrals"("subscribedAt");

-- AddForeignKey
ALTER TABLE "server_referrals" ADD CONSTRAINT "server_referrals_referringServerId_fkey" FOREIGN KEY ("referringServerId") REFERENCES "servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_referrals" ADD CONSTRAINT "server_referrals_referredServerId_fkey" FOREIGN KEY ("referredServerId") REFERENCES "servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;