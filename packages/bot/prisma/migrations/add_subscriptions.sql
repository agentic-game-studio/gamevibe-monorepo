-- GameVibe AI Subscription Migration
-- Adds subscription functionality to existing database
-- Run this manually on existing production databases

BEGIN;

-- Create subscription-related enums
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIALING');
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');
CREATE TYPE "ManagerRole" AS ENUM ('OWNER', 'ADMIN', 'BILLING');

-- Create server_subscriptions table
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_subscriptions_pkey" PRIMARY KEY ("id")
);

-- Create subscription_managers table
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

-- Create usage_logs table
CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- Create billing_history table
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

-- Create unique constraints
CREATE UNIQUE INDEX "server_subscriptions_serverId_key" ON "server_subscriptions"("serverId");
CREATE UNIQUE INDEX "server_subscriptions_discordServerId_key" ON "server_subscriptions"("discordServerId");
CREATE UNIQUE INDEX "server_subscriptions_stripeCustomerId_key" ON "server_subscriptions"("stripeCustomerId");
CREATE UNIQUE INDEX "server_subscriptions_stripeSubscriptionId_key" ON "server_subscriptions"("stripeSubscriptionId");
CREATE UNIQUE INDEX "subscription_managers_serverId_userId_key" ON "subscription_managers"("serverId", "userId");
CREATE UNIQUE INDEX "billing_history_stripeInvoiceId_key" ON "billing_history"("stripeInvoiceId");

-- Create indexes for performance
CREATE INDEX "usage_logs_serverId_createdAt_idx" ON "usage_logs"("serverId", "createdAt");

-- Add foreign key constraints
-- Note: These assume your existing tables use the same ID structure
-- Adjust the references based on your actual schema

ALTER TABLE "server_subscriptions" ADD CONSTRAINT "server_subscriptions_serverId_fkey" 
    FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "server_subscriptions" ADD CONSTRAINT "server_subscriptions_subscribedByUserId_fkey" 
    FOREIGN KEY ("subscribedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subscription_managers" ADD CONSTRAINT "subscription_managers_serverId_fkey" 
    FOREIGN KEY ("serverId") REFERENCES "server_subscriptions"("serverId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_managers" ADD CONSTRAINT "subscription_managers_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_managers" ADD CONSTRAINT "subscription_managers_addedById_fkey" 
    FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_serverId_fkey" 
    FOREIGN KEY ("serverId") REFERENCES "server_subscriptions"("serverId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_serverId_fkey" 
    FOREIGN KEY ("serverId") REFERENCES "server_subscriptions"("serverId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grandfather existing active servers (optional)
-- Uncomment these lines if you want to give existing servers with activity a free starter tier
/*
INSERT INTO "server_subscriptions" ("id", "serverId", "discordServerId", "status", "tier", "subscribedByUserId")
SELECT 
    'sub_' || s."id",
    s."id",
    s."discordId",
    'ACTIVE'::SubscriptionStatus,
    'STARTER'::SubscriptionTier,
    NULL
FROM "servers" s
WHERE s."createdAt" < '2024-01-01'::timestamp
  AND EXISTS (
    SELECT 1 FROM "games" g 
    WHERE g."serverId" = s."id" 
    AND g."createdAt" > (CURRENT_TIMESTAMP - INTERVAL '30 days')
  )
ON CONFLICT ("serverId") DO NOTHING;
*/

-- Create default free subscriptions for all existing servers
INSERT INTO "server_subscriptions" ("id", "serverId", "discordServerId", "status", "tier")
SELECT 
    'sub_' || s."id",
    s."id",
    s."discordId",
    'INACTIVE'::SubscriptionStatus,
    'FREE'::SubscriptionTier
FROM "servers" s
ON CONFLICT ("serverId") DO NOTHING;

COMMIT;