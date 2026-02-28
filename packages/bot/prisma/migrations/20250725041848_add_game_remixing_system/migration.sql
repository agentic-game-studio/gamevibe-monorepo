-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIALING');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ManagerRole" AS ENUM ('OWNER', 'ADMIN', 'BILLING');

-- CreateEnum
CREATE TYPE "RemixType" AS ENUM ('FORK', 'VARIATION', 'COMMUNITY', 'OFFICIAL');

-- CreateTable
CREATE TABLE "server_subscriptions" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "discordServerId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "gamesCreatedThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "lastGameCreatedAt" TIMESTAMP(3),
    "subscribedByUserId" TEXT,
    "subscriptionMetadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_managers" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "role" "ManagerRole" NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_history" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "invoicePdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_remixes" (
    "id" TEXT NOT NULL,
    "originalGameId" TEXT NOT NULL,
    "remixGameId" TEXT NOT NULL,
    "remixType" "RemixType" NOT NULL DEFAULT 'FORK',
    "title" TEXT,
    "description" TEXT,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "forkCount" INTEGER NOT NULL DEFAULT 0,
    "remixedByUserId" TEXT NOT NULL,
    "remixedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_remixes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_versions" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "remixId" TEXT,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "assets" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "changelog" TEXT,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "diffFromPrevious" JSONB NOT NULL DEFAULT '{}',
    "isLatest" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "server_subscriptions_serverId_key" ON "server_subscriptions"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "server_subscriptions_discordServerId_key" ON "server_subscriptions"("discordServerId");

-- CreateIndex
CREATE UNIQUE INDEX "server_subscriptions_stripeCustomerId_key" ON "server_subscriptions"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "server_subscriptions_stripeSubscriptionId_key" ON "server_subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_managers_serverId_userId_key" ON "subscription_managers"("serverId", "userId");

-- CreateIndex
CREATE INDEX "usage_logs_serverId_createdAt_idx" ON "usage_logs"("serverId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "billing_history_stripeInvoiceId_key" ON "billing_history"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "game_remixes_remixGameId_key" ON "game_remixes"("remixGameId");

-- CreateIndex
CREATE INDEX "game_remixes_originalGameId_idx" ON "game_remixes"("originalGameId");

-- CreateIndex
CREATE INDEX "game_remixes_remixedByUserId_idx" ON "game_remixes"("remixedByUserId");

-- CreateIndex
CREATE INDEX "game_remixes_popularity_idx" ON "game_remixes"("popularity");

-- CreateIndex
CREATE INDEX "game_versions_gameId_isLatest_idx" ON "game_versions"("gameId", "isLatest");

-- CreateIndex
CREATE INDEX "game_versions_remixId_idx" ON "game_versions"("remixId");

-- CreateIndex
CREATE UNIQUE INDEX "game_versions_gameId_version_key" ON "game_versions"("gameId", "version");

-- AddForeignKey
ALTER TABLE "server_subscriptions" ADD CONSTRAINT "server_subscriptions_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_subscriptions" ADD CONSTRAINT "server_subscriptions_subscribedByUserId_fkey" FOREIGN KEY ("subscribedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_managers" ADD CONSTRAINT "subscription_managers_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "server_subscriptions"("serverId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_managers" ADD CONSTRAINT "subscription_managers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_managers" ADD CONSTRAINT "subscription_managers_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "server_subscriptions"("serverId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "server_subscriptions"("serverId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_remixes" ADD CONSTRAINT "game_remixes_originalGameId_fkey" FOREIGN KEY ("originalGameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_remixes" ADD CONSTRAINT "game_remixes_remixGameId_fkey" FOREIGN KEY ("remixGameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_remixes" ADD CONSTRAINT "game_remixes_remixedByUserId_fkey" FOREIGN KEY ("remixedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_versions" ADD CONSTRAINT "game_versions_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_versions" ADD CONSTRAINT "game_versions_remixId_fkey" FOREIGN KEY ("remixId") REFERENCES "game_remixes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_versions" ADD CONSTRAINT "game_versions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
