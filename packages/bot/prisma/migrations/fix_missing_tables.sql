-- Create missing enums
DO $$ BEGIN
    CREATE TYPE "AchievementCategory" AS ENUM ('CREATION', 'ENGAGEMENT', 'SOCIAL', 'MILESTONE', 'CHALLENGE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AchievementRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Achievement table
CREATE TABLE IF NOT EXISTS "achievements" (
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

-- Create unique index on key
CREATE UNIQUE INDEX IF NOT EXISTS "achievements_key_key" ON "achievements"("key");

-- Create AchievementProgress table  
CREATE TABLE IF NOT EXISTS "achievement_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "targetValue" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "achievement_progress_pkey" PRIMARY KEY ("id")
);

-- Create indexes and constraints
CREATE UNIQUE INDEX IF NOT EXISTS "achievement_progress_userId_achievementId_key" ON "achievement_progress"("userId", "achievementId");
CREATE INDEX IF NOT EXISTS "achievement_progress_userId_idx" ON "achievement_progress"("userId");

-- Create UserAchievement table
CREATE TABLE IF NOT EXISTS "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creditsClaimed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    
    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "user_achievements_userId_achievementId_key" ON "user_achievements"("userId", "achievementId");
CREATE INDEX IF NOT EXISTS "user_achievements_userId_idx" ON "user_achievements"("userId");
CREATE INDEX IF NOT EXISTS "user_achievements_unlockedAt_idx" ON "user_achievements"("unlockedAt");