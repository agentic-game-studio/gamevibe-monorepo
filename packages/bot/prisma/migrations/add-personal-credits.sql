-- Personal Credits System Migration
-- Add these tables to support the personal credit system

-- Create enums
CREATE TYPE "CreatorTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'DIAMOND');
CREATE TYPE "TransactionType" AS ENUM ('EARNED', 'SPENT', 'EXPIRED');
CREATE TYPE "EarningReason" AS ENUM (
  'GAME_PLAYS',
  'VIRAL_GAME',
  'CROSS_SERVER',
  'SERVER_REFERRAL',
  'SERVER_SUBSCRIPTION',
  'ENGAGEMENT_BOOST',
  'CHALLENGE_WON',
  'ACHIEVEMENT',
  'TIER_UPGRADE',
  'BONUS'
);
CREATE TYPE "ShareType" AS ENUM ('DISCORD', 'TWITTER', 'EMBED', 'DIRECT');
CREATE TYPE "ConversionAction" AS ENUM ('VIEW', 'PLAY', 'CREATE', 'SUBSCRIBE');
CREATE TYPE "ViralEventType" AS ENUM (
  'GAME_CREATED',
  'HIGH_SCORE',
  'ACHIEVEMENT_UNLOCKED',
  'CHALLENGE_CREATED',
  'CHALLENGE_WON',
  'VIRAL_MOMENT',
  'MILESTONE_REACHED',
  'REMIX_CREATED',
  'TRENDING_GAME'
);

-- Personal credits balance table
CREATE TABLE "UserPersonalCredits" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "totalEarned" INTEGER NOT NULL DEFAULT 0,
  "totalSpent" INTEGER NOT NULL DEFAULT 0,
  "creatorTier" "CreatorTier" NOT NULL DEFAULT 'BRONZE',
  "tierUpgradedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserPersonalCredits_pkey" PRIMARY KEY ("id")
);

-- Credit transaction history
CREATE TABLE "PersonalCreditTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "earningReason" "EarningReason",
  "earningMeta" JSONB,
  "spentOn" TEXT,
  "serverId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PersonalCreditTransaction_pkey" PRIMARY KEY ("id")
);

-- Server referral tracking
CREATE TABLE "ServerReferral" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "referralCode" TEXT,
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "subscribedAt" TIMESTAMP(3),
  "subscriptionTier" "SubscriptionTier",
  "initialReward" INTEGER NOT NULL DEFAULT 0,
  "monthlyCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
  "totalCommissionEarned" INTEGER NOT NULL DEFAULT 0,
  "lastCommissionAt" TIMESTAMP(3),

  CONSTRAINT "ServerReferral_pkey" PRIMARY KEY ("id")
);

-- Game server reach tracking
CREATE TABLE "GameServerReach" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "playCount" INTEGER NOT NULL DEFAULT 0,
  "uniquePlayers" INTEGER NOT NULL DEFAULT 0,
  "firstPlayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastPlayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GameServerReach_pkey" PRIMARY KEY ("id")
);

-- User achievements
CREATE TABLE "UserAchievement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "sharedAt" TIMESTAMP(3),
  "shareCount" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- Game sharing tracking
CREATE TABLE "GameShare" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "sharerId" TEXT NOT NULL,
  "shareCode" TEXT NOT NULL,
  "shareType" "ShareType" NOT NULL,
  "channelId" TEXT,
  "serverId" TEXT,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "playCount" INTEGER NOT NULL DEFAULT 0,
  "conversionCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastClickedAt" TIMESTAMP(3),

  CONSTRAINT "GameShare_pkey" PRIMARY KEY ("id")
);

-- Share conversion tracking
CREATE TABLE "ShareConversion" (
  "id" TEXT NOT NULL,
  "shareId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" "ConversionAction" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShareConversion_pkey" PRIMARY KEY ("id")
);

-- Viral event tracking
CREATE TABLE "ViralEvent" (
  "id" TEXT NOT NULL,
  "type" "ViralEventType" NOT NULL,
  "userId" TEXT NOT NULL,
  "serverId" TEXT,
  "gameId" TEXT,
  "metadata" JSONB,
  "viralScore" INTEGER NOT NULL DEFAULT 0,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ViralEvent_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
ALTER TABLE "UserPersonalCredits" ADD CONSTRAINT "UserPersonalCredits_userId_key" UNIQUE ("userId");
ALTER TABLE "ServerReferral" ADD CONSTRAINT "ServerReferral_serverId_key" UNIQUE ("serverId");
ALTER TABLE "GameServerReach" ADD CONSTRAINT "GameServerReach_gameId_serverId_key" UNIQUE ("gameId", "serverId");
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_achievementId_key" UNIQUE ("userId", "achievementId");
ALTER TABLE "GameShare" ADD CONSTRAINT "GameShare_shareCode_key" UNIQUE ("shareCode");
ALTER TABLE "ShareConversion" ADD CONSTRAINT "ShareConversion_shareId_userId_action_key" UNIQUE ("shareId", "userId", "action");

-- Create indexes
CREATE INDEX "UserPersonalCredits_userId_idx" ON "UserPersonalCredits"("userId");
CREATE INDEX "UserPersonalCredits_creatorTier_idx" ON "UserPersonalCredits"("creatorTier");
CREATE INDEX "PersonalCreditTransaction_userId_createdAt_idx" ON "PersonalCreditTransaction"("userId", "createdAt" DESC);
CREATE INDEX "PersonalCreditTransaction_earningReason_idx" ON "PersonalCreditTransaction"("earningReason");
CREATE INDEX "ServerReferral_referrerId_idx" ON "ServerReferral"("referrerId");
CREATE INDEX "ServerReferral_referralCode_idx" ON "ServerReferral"("referralCode");
CREATE INDEX "GameServerReach_gameId_idx" ON "GameServerReach"("gameId");
CREATE INDEX "UserAchievement_userId_completed_idx" ON "UserAchievement"("userId", "completed");
CREATE INDEX "GameShare_shareCode_idx" ON "GameShare"("shareCode");
CREATE INDEX "GameShare_gameId_createdAt_idx" ON "GameShare"("gameId", "createdAt" DESC);
CREATE INDEX "GameShare_sharerId_createdAt_idx" ON "GameShare"("sharerId", "createdAt" DESC);
CREATE INDEX "ViralEvent_userId_timestamp_idx" ON "ViralEvent"("userId", "timestamp" DESC);
CREATE INDEX "ViralEvent_type_timestamp_idx" ON "ViralEvent"("type", "timestamp" DESC);

-- Add foreign key constraints
ALTER TABLE "PersonalCreditTransaction" ADD CONSTRAINT "PersonalCreditTransaction_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "UserPersonalCredits"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GameServerReach" ADD CONSTRAINT "GameServerReach_gameId_fkey" 
  FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GameShare" ADD CONSTRAINT "GameShare_gameId_fkey" 
  FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShareConversion" ADD CONSTRAINT "ShareConversion_shareId_fkey" 
  FOREIGN KEY ("shareId") REFERENCES "GameShare"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update trigger for updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_personal_credits_updated_at BEFORE UPDATE ON "UserPersonalCredits"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();