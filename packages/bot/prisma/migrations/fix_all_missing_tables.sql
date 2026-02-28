-- This migration creates all missing tables based on the Prisma schema
-- Run this to fix the database state

-- Drop and recreate enums to match schema exactly
DROP TYPE IF EXISTS "AchievementCategory" CASCADE;
CREATE TYPE "AchievementCategory" AS ENUM ('CREATOR', 'PLAYER', 'SOCIAL', 'COLLECTOR', 'MILESTONE', 'SPECIAL');

DROP TYPE IF EXISTS "AchievementRarity" CASCADE;
CREATE TYPE "AchievementRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- Create missing enums
DO $$ BEGIN
    CREATE TYPE "CreatorTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TransactionType" AS ENUM ('EARNED', 'SPENT', 'EXPIRED', 'REFUNDED', 'ADJUSTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "EarningReason" AS ENUM (
        'GAME_PLAYS', 'VIRAL_GAME', 'CROSS_SERVER', 'SERVER_REFERRAL', 
        'SERVER_SUBSCRIPTION', 'ENGAGEMENT_BOOST', 'CHALLENGE_WON', 
        'ACHIEVEMENT', 'TIER_UPGRADE', 'BONUS', 'AMBASSADOR_REWARD', 'CONTENT_CREATION'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ChallengeType" AS ENUM ('SCORE_BEAT', 'SPEED_RUN', 'VERSUS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ChallengeStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AmbassadorRank" AS ENUM ('APPRENTICE', 'AMBASSADOR', 'SENIOR', 'MASTER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Drop existing tables to recreate them properly
DROP TABLE IF EXISTS "achievement_progress" CASCADE;
DROP TABLE IF EXISTS "user_achievements" CASCADE;
DROP TABLE IF EXISTS "achievements" CASCADE;

-- Create Achievement table
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "AchievementCategory" NOT NULL,
    "rarity" "AchievementRarity" NOT NULL,
    "creditReward" INTEGER NOT NULL DEFAULT 0,
    "iconEmoji" TEXT NOT NULL DEFAULT '🏆',
    "targetValue" INTEGER,
    "targetType" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "achievements_key_key" ON "achievements"("key");

-- Create UserAchievement table
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creditsClaimed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    
    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_achievements_userId_achievementId_key" ON "user_achievements"("userId", "achievementId");
CREATE INDEX "user_achievements_userId_idx" ON "user_achievements"("userId");
CREATE INDEX "user_achievements_unlockedAt_idx" ON "user_achievements"("unlockedAt");

-- Create AchievementProgress table
CREATE TABLE "achievement_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "targetValue" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "achievement_progress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "achievement_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "achievement_progress_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "achievement_progress_userId_achievementId_key" ON "achievement_progress"("userId", "achievementId");
CREATE INDEX "achievement_progress_userId_idx" ON "achievement_progress"("userId");

-- Create UserPersonalCredits table
CREATE TABLE IF NOT EXISTS "user_personal_credits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "creatorTier" "CreatorTier" NOT NULL DEFAULT 'BRONZE',
    "tierProgress" INTEGER NOT NULL DEFAULT 0,
    "tierUpgradedAt" TIMESTAMP(3),
    "nextTierThreshold" INTEGER NOT NULL DEFAULT 10,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "user_personal_credits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_personal_credits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_personal_credits_userId_key" ON "user_personal_credits"("userId");

-- Create PersonalCreditTransaction table
CREATE TABLE IF NOT EXISTS "personal_credit_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "reason" "EarningReason",
    "description" TEXT NOT NULL,
    "relatedId" TEXT,
    "relatedType" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "personal_credit_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "personal_credit_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "personal_credit_transactions_userId_idx" ON "personal_credit_transactions"("userId");
CREATE INDEX "personal_credit_transactions_createdAt_idx" ON "personal_credit_transactions"("createdAt");

-- Create CreatorAnalytics table
CREATE TABLE IF NOT EXISTS "creator_analytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalGamesCreated" INTEGER NOT NULL DEFAULT 0,
    "totalPlays" INTEGER NOT NULL DEFAULT 0,
    "totalShares" INTEGER NOT NULL DEFAULT 0,
    "totalRemixes" INTEGER NOT NULL DEFAULT 0,
    "uniquePlayers" INTEGER NOT NULL DEFAULT 0,
    "uniqueServers" INTEGER NOT NULL DEFAULT 0,
    "viralCoefficient" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgPlaysPerGame" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestGameId" TEXT,
    "bestGamePlays" INTEGER NOT NULL DEFAULT 0,
    "lastGameCreatedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "creator_analytics_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "creator_analytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "creator_analytics_userId_key" ON "creator_analytics"("userId");

-- Create GameTracking table  
CREATE TABLE IF NOT EXISTS "game_tracking" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "duration" INTEGER,
    "score" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "game_tracking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "game_tracking_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "game_tracking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "game_tracking_gameId_idx" ON "game_tracking"("gameId");
CREATE INDEX "game_tracking_userId_idx" ON "game_tracking"("userId");
CREATE INDEX "game_tracking_serverId_idx" ON "game_tracking"("serverId");
CREATE INDEX "game_tracking_createdAt_idx" ON "game_tracking"("createdAt");

-- Create Challenge table
CREATE TABLE IF NOT EXISTS "challenges" (
    "id" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "opponentId" TEXT,
    "gameId" TEXT NOT NULL,
    "type" "ChallengeType" NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "wager" INTEGER NOT NULL DEFAULT 0,
    "targetScore" INTEGER,
    "targetTime" INTEGER,
    "challengerScore" INTEGER,
    "opponentScore" INTEGER,
    "winnerId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "challenges_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "challenges_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "challenges_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "challenges_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "challenges_challengerId_idx" ON "challenges"("challengerId");
CREATE INDEX "challenges_opponentId_idx" ON "challenges"("opponentId");
CREATE INDEX "challenges_gameId_idx" ON "challenges"("gameId");
CREATE INDEX "challenges_status_idx" ON "challenges"("status");
CREATE INDEX "challenges_expiresAt_idx" ON "challenges"("expiresAt");

-- Create Ambassador table
CREATE TABLE IF NOT EXISTS "ambassadors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "rank" "AmbassadorRank" NOT NULL DEFAULT 'APPRENTICE',
    "appointedBy" TEXT NOT NULL,
    "appointedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedAt" TIMESTAMP(3),
    "activityScore" INTEGER NOT NULL DEFAULT 0,
    "monthlyScore" INTEGER NOT NULL DEFAULT 0,
    "totalCreditsEarned" INTEGER NOT NULL DEFAULT 0,
    "gamesCreated" INTEGER NOT NULL DEFAULT 0,
    "playersRecruited" INTEGER NOT NULL DEFAULT 0,
    "eventsHosted" INTEGER NOT NULL DEFAULT 0,
    "viralGames" INTEGER NOT NULL DEFAULT 0,
    "challengesCreated" INTEGER NOT NULL DEFAULT 0,
    "communityEngagement" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "removedAt" TIMESTAMP(3),
    "removedBy" TEXT,
    "removalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "ambassadors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ambassadors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ambassadors_userId_serverId_key" ON "ambassadors"("userId", "serverId");
CREATE INDEX "ambassadors_serverId_idx" ON "ambassadors"("serverId");
CREATE INDEX "ambassadors_rank_idx" ON "ambassadors"("rank");
CREATE INDEX "ambassadors_active_idx" ON "ambassadors"("active");

-- Create AmbassadorActivity table
CREATE TABLE IF NOT EXISTS "ambassador_activities" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "relatedId" TEXT,
    "relatedType" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "ambassador_activities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ambassador_activities_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "ambassadors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ambassador_activities_ambassadorId_idx" ON "ambassador_activities"("ambassadorId");
CREATE INDEX "ambassador_activities_createdAt_idx" ON "ambassador_activities"("createdAt");

-- Create AmbassadorReward table  
CREATE TABLE IF NOT EXISTS "ambassador_rewards" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "rank" "AmbassadorRank" NOT NULL,
    "baseReward" INTEGER NOT NULL,
    "performanceBonus" INTEGER NOT NULL DEFAULT 0,
    "totalReward" INTEGER NOT NULL,
    "credited" BOOLEAN NOT NULL DEFAULT false,
    "creditedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "ambassador_rewards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ambassador_rewards_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "ambassadors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ambassador_rewards_ambassadorId_month_year_key" ON "ambassador_rewards"("ambassadorId", "month", "year");
CREATE INDEX "ambassador_rewards_credited_idx" ON "ambassador_rewards"("credited");