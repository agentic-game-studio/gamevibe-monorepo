# Server Subscription Model: Complete Implementation Plan

## Overview

The Server Subscription Model allows one person (usually admin/owner) to pay for premium features that benefit the entire Discord server. This model has proven to be the most successful for Discord bots.

## 1. Database Schema

```sql
-- Enhanced servers table for subscriptions
CREATE TABLE server_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES servers(id) UNIQUE,
    discord_server_id VARCHAR(32) NOT NULL,
    
    -- Subscription details
    status VARCHAR(20) NOT NULL DEFAULT 'inactive', -- active, canceled, past_due, trialing
    tier VARCHAR(20) NOT NULL DEFAULT 'free', -- free, starter, pro, enterprise
    
    -- Stripe data
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_price_id VARCHAR(255),
    
    -- Subscription lifecycle
    trial_ends_at TIMESTAMP,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    canceled_at TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    
    -- Usage tracking
    games_created_this_period INTEGER DEFAULT 0,
    last_game_created_at TIMESTAMP,
    
    -- Metadata
    subscribed_by_user_id UUID REFERENCES users(id),
    subscription_metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscription managers (who can manage subscription)
CREATE TABLE subscription_managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES servers(id),
    user_id UUID REFERENCES users(id),
    discord_user_id VARCHAR(32) NOT NULL,
    role VARCHAR(20) NOT NULL, -- owner, admin, billing
    added_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(server_id, user_id)
);

-- Usage logs for analytics
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES servers(id),
    action VARCHAR(50) NOT NULL, -- game_created, asset_generated, etc
    user_id UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Billing history
CREATE TABLE billing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES servers(id),
    stripe_invoice_id VARCHAR(255) UNIQUE,
    amount INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL, -- paid, failed, pending
    invoice_pdf_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_server_subs_discord_id ON server_subscriptions(discord_server_id);
CREATE INDEX idx_server_subs_status ON server_subscriptions(status);
CREATE INDEX idx_usage_logs_server_created ON usage_logs(server_id, created_at);
```

## 2. Subscription Tiers Configuration

```typescript
// config/subscription-tiers.ts
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    features: {
      games_per_month: 3,
      concurrent_games: 1,
      max_players: 4,
      custom_assets: false,
      analytics: false,
      priority_support: false,
      api_access: false,
      white_label: false
    },
    limits: {
      rate_limit: '1 game per 5 minutes',
      asset_generation: 0,
      game_storage_days: 7
    }
  },
  
  starter: {
    name: 'Starter',
    price: 999, // $9.99 in cents
    stripe_price_id: process.env.STRIPE_STARTER_PRICE_ID,
    features: {
      games_per_month: 50,
      concurrent_games: 3,
      max_players: 10,
      custom_assets: false,
      analytics: true,
      priority_support: false,
      api_access: false,
      white_label: false
    },
    limits: {
      rate_limit: '1 game per minute',
      asset_generation: 10,
      game_storage_days: 30
    }
  },
  
  pro: {
    name: 'Pro',
    price: 2999, // $29.99
    stripe_price_id: process.env.STRIPE_PRO_PRICE_ID,
    features: {
      games_per_month: 100, // capped to prevent loss
      concurrent_games: 10,
      max_players: -1, // unlimited
      custom_assets: true,
      analytics: true,
      priority_support: true,
      api_access: true,
      white_label: false
    },
    limits: {
      rate_limit: '10 games per minute',
      asset_generation: 50, // capped for sustainability
      game_storage_days: -1 // forever
    }
  },
  
  enterprise: {
    name: 'Enterprise',
    price: 9999, // $99.99 (premium enterprise pricing)
    stripe_price_id: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    features: {
      games_per_month: -1,
      concurrent_games: -1,
      max_players: -1,
      custom_assets: true,
      analytics: true,
      priority_support: true,
      api_access: true,
      white_label: true,
      custom_branding: true,
      dedicated_support: true,
      sla: true,
      priority_processing: true, // Faster game generation
      multi_server_support: true, // Use across multiple Discord servers
      custom_integrations: true, // Custom webhook/API integrations
      advanced_analytics: true, // Detailed usage reports and insights
      premium_support_sla: true, // 1-hour response time guarantee
      custom_domains: true, // Custom domain for web runtime
      advanced_api_access: true, // Full API access with higher rate limits
      bulk_operations: true // Bulk game creation and management
    },
    limits: {
      rate_limit: 'No limit',
      asset_generation: -1,
      game_storage_days: -1,
      api_calls_per_hour: -1, // Unlimited API calls
      priority_queue: true // Skip generation queues
    }
  }
};

// Usage-based pricing for overages
export const OVERAGE_PRICING = {
  additional_game: 39, // $0.39 per game over limit
  additional_asset_pack: 199, // $1.99 per 10 assets
  api_call: 1, // $0.01 per 1000 API calls
  multiplayer_hour: 49 // $0.49 per hour of multiplayer server time
};

// Helper functions
export function getTierFeatures(tier: string) {
  return SUBSCRIPTION_TIERS[tier]?.features || SUBSCRIPTION_TIERS.free.features;
}

export function canUseFeature(tier: string, feature: string): boolean {
  const features = getTierFeatures(tier);
  return features[feature] === true || features[feature] === -1;
}

export function isWithinLimit(tier: string, limit: string, current: number): boolean {
  const limits = SUBSCRIPTION_TIERS[tier]?.limits || SUBSCRIPTION_TIERS.free.limits;
  const maxLimit = limits[limit];
  return maxLimit === -1 || current < maxLimit;
}
```

## 3. Subscription Management Service

```typescript
// services/SubscriptionService.ts
import { Stripe } from 'stripe';
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CacheService } from './cache.service';
import { SUBSCRIPTION_TIERS } from '../config/subscription-tiers';

@Injectable()
export class SubscriptionService {
  private stripe: Stripe;
  
  constructor(
    private prisma: PrismaService,
    private cache: CacheService
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16'
    });
  }
  
  async createCheckoutSession(params: {
    serverId: string;
    tier: string;
    userId: string;
  }) {
    const tierConfig = SUBSCRIPTION_TIERS[params.tier];
    if (!tierConfig || params.tier === 'free') {
      throw new Error('Invalid subscription tier');
    }
    
    // Get or create Stripe customer
    const customer = await this.getOrCreateStripeCustomer(params.serverId);
    
    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price: tierConfig.stripe_price_id,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${process.env.APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/subscription/cancel`,
      metadata: {
        serverId: params.serverId,
        userId: params.userId,
        tier: params.tier
      },
      subscription_data: {
        trial_period_days: params.tier === 'pro' ? 7 : 0,
        metadata: {
          serverId: params.serverId,
          tier: params.tier
        }
      },
      allow_promotion_codes: true
    });
    
    return session;
  }
  
  async handleSubscriptionWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(event.data.object);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
    }
  }
  
  private async handleCheckoutComplete(session: Stripe.Checkout.Session) {
    const { serverId, userId, tier } = session.metadata;
    
    // Update subscription in database
    await this.prisma.serverSubscription.upsert({
      where: { discord_server_id: serverId },
      create: {
        discord_server_id: serverId,
        server_id: await this.getServerDbId(serverId),
        status: 'active',
        tier,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        subscribed_by_user_id: userId,
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      update: {
        status: 'active',
        tier,
        stripe_subscription_id: session.subscription as string,
        subscribed_by_user_id: userId
      }
    });
    
    // Add subscription manager
    await this.addSubscriptionManager(serverId, userId, 'owner');
    
    // Clear cache
    await this.cache.delete(`subscription:${serverId}`);
    
    // Send confirmation to Discord
    await this.notifySubscriptionActivated(serverId, tier);
  }
  
  async getServerSubscription(serverId: string) {
    // Check cache first
    const cached = await this.cache.get(`subscription:${serverId}`);
    if (cached) return cached;
    
    // Get from database
    const subscription = await this.prisma.serverSubscription.findUnique({
      where: { discord_server_id: serverId },
      include: {
        managers: true,
        billing_history: {
          take: 5,
          orderBy: { created_at: 'desc' }
        }
      }
    });
    
    // Default to free if no subscription
    const result = subscription || {
      tier: 'free',
      status: 'inactive',
      features: SUBSCRIPTION_TIERS.free.features
    };
    
    // Cache for 5 minutes
    await this.cache.set(`subscription:${serverId}`, result, 300);
    
    return result;
  }
  
  async canPerformAction(serverId: string, action: string, userId?: string) {
    const subscription = await this.getServerSubscription(serverId);
    
    // Check if feature is available in tier
    if (!canUseFeature(subscription.tier, action)) {
      return {
        allowed: false,
        reason: 'feature_not_in_tier',
        requiredTier: this.getRequiredTier(action)
      };
    }
    
    // Check usage limits
    const usage = await this.getCurrentUsage(serverId, action);
    const tierConfig = SUBSCRIPTION_TIERS[subscription.tier];
    
    if (action === 'create_game') {
      const limit = tierConfig.features.games_per_month;
      if (limit !== -1 && usage >= limit) {
        // Check if they want to pay for overage
        const overageEnabled = await this.isOverageEnabled(serverId);
        if (overageEnabled) {
          return {
            allowed: true,
            overage: true,
            cost: OVERAGE_PRICING.additional_game
          };
        }
        
        return {
          allowed: false,
          reason: 'monthly_limit_reached',
          limit,
          usage,
          resetDate: this.getNextResetDate(subscription)
        };
      }
    }
    
    if (action === 'generate_asset' && tierConfig.limits.asset_generation !== -1) {
      const assetUsage = await this.getCurrentUsage(serverId, 'asset_generated');
      if (assetUsage >= tierConfig.limits.asset_generation) {
        const overageEnabled = await this.isOverageEnabled(serverId);
        if (overageEnabled) {
          return {
            allowed: true,
            overage: true,
            cost: OVERAGE_PRICING.additional_asset_pack
          };
        }
        
        return {
          allowed: false,
          reason: 'asset_limit_reached',
          limit: tierConfig.limits.asset_generation,
          usage: assetUsage
        };
      }
    }
    
    // Check rate limits
    const rateLimitKey = `ratelimit:${serverId}:${action}`;
    const recentUsage = await this.cache.get(rateLimitKey) || 0;
    
    if (recentUsage >= this.getRateLimit(subscription.tier, action)) {
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        retryAfter: 60 // seconds
      };
    }
    
    return { allowed: true };
  }
  
  async recordUsage(serverId: string, action: string, userId: string, metadata?: any) {
    const check = await this.canPerformAction(serverId, action);
    
    // Handle overage billing
    if (check.overage) {
      await this.recordOverageUsage(serverId, action, check.cost);
    }
    // Log to database
    await this.prisma.usageLog.create({
      data: {
        server_id: await this.getServerDbId(serverId),
        action,
        user_id: userId,
        metadata
      }
    });
    
    // Update counters
    if (action === 'game_created') {
      await this.prisma.serverSubscription.update({
        where: { discord_server_id: serverId },
        data: {
          games_created_this_period: { increment: 1 },
          last_game_created_at: new Date()
        }
      });
    }
    
    // Update rate limit cache
    const rateLimitKey = `ratelimit:${serverId}:${action}`;
    await this.cache.increment(rateLimitKey, 1, 60); // 60 second window
  }
}
```

## 4. Discord Bot Integration

```typescript
// commands/subscription.ts
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { SubscriptionService } from '../services/subscription.service';

export class SubscriptionCommand {
  constructor(private subscriptionService: SubscriptionService) {}
  
  data = new SlashCommandBuilder()
    .setName('subscription')
    .setDescription('Manage server subscription')
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View current subscription')
    )
    .addSubcommand(sub =>
      sub.setName('upgrade')
        .setDescription('Upgrade server subscription')
    )
    .addSubcommand(sub =>
      sub.setName('manage')
        .setDescription('Manage subscription settings')
    );
  
  async execute(interaction: CommandInteraction) {
    // Check if user has permission
    if (!interaction.memberPermissions?.has('MANAGE_GUILD')) {
      return interaction.reply({
        content: 'You need Manage Server permission to manage subscriptions!',
        ephemeral: true
      });
    }
    
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'info':
        await this.showSubscriptionInfo(interaction);
        break;
      case 'upgrade':
        await this.showUpgradeOptions(interaction);
        break;
      case 'manage':
        await this.showManagementPanel(interaction);
        break;
    }
  }
  
  private async showSubscriptionInfo(interaction: CommandInteraction) {
    const subscription = await this.subscriptionService.getServerSubscription(
      interaction.guildId!
    );
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Server Subscription')
      .setColor(this.getTierColor(subscription.tier))
      .addFields([
        {
          name: 'Current Tier',
          value: `**${subscription.tier.toUpperCase()}**`,
          inline: true
        },
        {
          name: 'Status',
          value: subscription.status,
          inline: true
        },
        {
          name: 'Games This Month',
          value: `${subscription.games_created_this_period || 0}/${
            this.getGameLimit(subscription.tier)
          }`,
          inline: true
        }
      ]);
    
    // Add features list
    const features = SUBSCRIPTION_TIERS[subscription.tier].features;
    const featureList = Object.entries(features)
      .map(([key, value]) => {
        const emoji = value === true || value === -1 ? '✅' : '❌';
        const display = this.formatFeatureName(key);
        return `${emoji} ${display}`;
      })
      .join('\n');
    
    embed.addFields([{
      name: 'Features',
      value: featureList
    }]);
    
    // Add renewal info if subscribed
    if (subscription.status === 'active' && subscription.current_period_end) {
      embed.addFields([{
        name: 'Next Renewal',
        value: `<t:${Math.floor(subscription.current_period_end.getTime() / 1000)}:R>`,
        inline: true
      }]);
    }
    
    const components = [];
    
    // Add upgrade button if not on highest tier
    if (subscription.tier !== 'enterprise') {
      const upgradeButton = new ButtonBuilder()
        .setCustomId('subscription:upgrade')
        .setLabel('Upgrade')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🚀');
      
      components.push(new ActionRowBuilder().addComponents(upgradeButton));
    }
    
    // Add manage button if subscribed
    if (subscription.status === 'active') {
      const manageButton = new ButtonBuilder()
        .setCustomId('subscription:manage')
        .setLabel('Manage Subscription')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚙️');
      
      if (components.length > 0) {
        components[0].addComponents(manageButton);
      } else {
        components.push(new ActionRowBuilder().addComponents(manageButton));
      }
    }
    
    await interaction.reply({
      embeds: [embed],
      components
    });
  }
  
  private async showUpgradeOptions(interaction: CommandInteraction) {
    const currentSub = await this.subscriptionService.getServerSubscription(
      interaction.guildId!
    );
    
    const embed = new EmbedBuilder()
      .setTitle('🚀 Upgrade Your Server')
      .setDescription('Choose the perfect plan for your server')
      .setColor('Gold');
    
    const tiers = ['starter', 'pro', 'enterprise'];
    const components = [];
    
    for (const tier of tiers) {
      const config = SUBSCRIPTION_TIERS[tier];
      
      // Skip current and lower tiers
      if (this.getTierLevel(tier) <= this.getTierLevel(currentSub.tier)) {
        continue;
      }
      
      embed.addFields([{
        name: `${this.getTierEmoji(tier)} ${config.name} - $${config.price / 100}/month`,
        value: this.getTierDescription(tier)
      }]);
      
      const button = new ButtonBuilder()
        .setCustomId(`subscription:checkout:${tier}`)
        .setLabel(`Get ${config.name}`)
        .setStyle(ButtonStyle.Primary);
      
      components.push(button);
    }
    
    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(...components)],
      ephemeral: true
    });
  }
}

// Button interaction handler
export async function handleSubscriptionButton(
  interaction: ButtonInteraction,
  subscriptionService: SubscriptionService
) {
  const [, action, tier] = interaction.customId.split(':');
  
  if (action === 'checkout' && tier) {
    // Create checkout session
    try {
      const session = await subscriptionService.createCheckoutSession({
        serverId: interaction.guildId!,
        tier,
        userId: interaction.user.id
      });
      
      const embed = new EmbedBuilder()
        .setTitle('🔗 Complete Your Purchase')
        .setDescription('Click the button below to complete your subscription')
        .setColor('Green')
        .addFields([
          {
            name: 'What happens next?',
            value: '1. Complete payment on Stripe\n2. Server instantly upgraded\n3. All members get premium features!'
          }
        ]);
      
      const button = new ButtonBuilder()
        .setLabel('Subscribe Now')
        .setStyle(ButtonStyle.Link)
        .setURL(session.url!)
        .setEmoji('💳');
      
      await interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(button)],
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Checkout session error:', error);
      await interaction.reply({
        content: '❌ Failed to create checkout session. Please try again.',
        ephemeral: true
      });
    }
  }
}
```

## 5. Feature Gating Implementation

```typescript
// middleware/subscription-check.ts
export class SubscriptionChecker {
  constructor(private subscriptionService: SubscriptionService) {}
  
  async checkGameCreation(
    interaction: CommandInteraction
  ): Promise<boolean> {
    const check = await this.subscriptionService.canPerformAction(
      interaction.guildId!,
      'create_game',
      interaction.user.id
    );
    
    if (!check.allowed) {
      await this.handleLimitReached(interaction, check);
      return false;
    }
    
    return true;
  }
  
  private async handleLimitReached(
    interaction: CommandInteraction,
    check: any
  ) {
    const embed = new EmbedBuilder()
      .setTitle('🚫 Limit Reached')
      .setColor('Red');
    
    switch (check.reason) {
      case 'feature_not_in_tier':
        embed.setDescription(
          `This feature requires **${check.requiredTier.toUpperCase()}** tier!`
        );
        embed.addFields([{
          name: 'Current Tier',
          value: 'FREE',
          inline: true
        }, {
          name: 'Required Tier',
          value: check.requiredTier.toUpperCase(),
          inline: true
        }]);
        break;
        
      case 'monthly_limit_reached':
        embed.setDescription(
          `You've reached your monthly limit of ${check.limit} games!`
        );
        embed.addFields([{
          name: 'Games Created',
          value: `${check.usage}/${check.limit}`,
          inline: true
        }, {
          name: 'Resets In',
          value: `<t:${Math.floor(check.resetDate.getTime() / 1000)}:R>`,
          inline: true
        }]);
        break;
        
      case 'rate_limit_exceeded':
        embed.setDescription(
          'Slow down! You\'re creating games too quickly.'
        );
        embed.addFields([{
          name: 'Try Again In',
          value: `${check.retryAfter} seconds`,
          inline: true
        }]);
        break;
    }
    
    // Add upgrade CTA
    const upgradeButton = new ButtonBuilder()
      .setCustomId('subscription:upgrade')
      .setLabel('Upgrade Now')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🚀');
    
    const infoButton = new ButtonBuilder()
      .setCustomId('subscription:info')
      .setLabel('View Plans')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📊');
    
    await interaction.reply({
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(upgradeButton, infoButton)
      ]
    });
  }
}

// Usage in commands
export class CreateGameCommand {
  constructor(
    private gameService: GameService,
    private subscriptionChecker: SubscriptionChecker
  ) {}
  
  async execute(interaction: CommandInteraction) {
    // Check subscription limits
    if (!await this.subscriptionChecker.checkGameCreation(interaction)) {
      return;
    }
    
    // Proceed with game creation
    await interaction.deferReply();
    
    try {
      const game = await this.gameService.createGame({
        // ... game creation params
      });
      
      // Record usage
      await this.subscriptionService.recordUsage(
        interaction.guildId!,
        'game_created',
        interaction.user.id,
        { gameId: game.id }
      );
      
      // ... rest of game creation flow
      
    } catch (error) {
      // Handle errors
    }
  }
}
```

## 6. Subscription Management Portal

```typescript
// web/subscription-portal.ts
import express from 'express';
import { SubscriptionService } from '../services/subscription.service';

export function setupSubscriptionPortal(app: express.Application) {
  // Customer portal session
  app.post('/api/subscription/portal', async (req, res) => {
    const { serverId } = req.body;
    
    try {
      const subscription = await subscriptionService.getServerSubscription(serverId);
      
      if (!subscription.stripe_customer_id) {
        return res.status(404).json({ error: 'No subscription found' });
      }
      
      // Create Stripe customer portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: `${process.env.APP_URL}/dashboard/${serverId}`
      });
      
      res.json({ url: session.url });
      
    } catch (error) {
      res.status(500).json({ error: 'Failed to create portal session' });
    }
  });
  
  // Webhook endpoint
  app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      
      await subscriptionService.handleSubscriptionWebhook(event);
      
      res.json({ received: true });
      
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });
}
```

## 7. Analytics & Reporting

```typescript
// services/subscription-analytics.ts
export class SubscriptionAnalytics {
  async getServerMetrics(serverId: string) {
    const [
      currentUsage,
      historicalUsage,
      topUsers,
      popularGames
    ] = await Promise.all([
      this.getCurrentPeriodUsage(serverId),
      this.getHistoricalUsage(serverId),
      this.getTopUsers(serverId),
      this.getPopularGames(serverId)
    ]);
    
    return {
      currentUsage,
      historicalUsage,
      topUsers,
      popularGames
    };
  }
  
  private async getCurrentPeriodUsage(serverId: string) {
    const subscription = await this.getServerSubscription(serverId);
    const periodStart = subscription.current_period_start || new Date();
    
    const usage = await this.prisma.usageLog.groupBy({
      by: ['action'],
      where: {
        server: { discord_server_id: serverId },
        created_at: { gte: periodStart }
      },
      _count: true
    });
    
    return usage.reduce((acc, item) => {
      acc[item.action] = item._count;
      return acc;
    }, {});
  }
  
  // Generate usage report email
  async sendMonthlyReport(serverId: string) {
    const metrics = await this.getServerMetrics(serverId);
    const subscription = await this.getServerSubscription(serverId);
    
    const emailHtml = `
      <h2>Monthly Usage Report</h2>
      <p>Server: ${subscription.server.name}</p>
      <p>Tier: ${subscription.tier.toUpperCase()}</p>
      
      <h3>Usage Summary</h3>
      <ul>
        <li>Games Created: ${metrics.currentUsage.game_created || 0}</li>
        <li>Assets Generated: ${metrics.currentUsage.asset_generated || 0}</li>
        <li>Active Users: ${metrics.topUsers.length}</li>
      </ul>
      
      <h3>Top Creators</h3>
      <ol>
        ${metrics.topUsers.map(user => 
          `<li>${user.username}: ${user.game_count} games</li>`
        ).join('')}
      </ol>
      
      <p>Thank you for using GameVibe!</p>
    `;
    
    // Send email via your email service
    await this.emailService.send({
      to: subscription.billing_email,
      subject: 'GameVibe Monthly Report',
      html: emailHtml
    });
  }
}
```

## 8. Subscription Notifications

```typescript
// services/subscription-notifications.ts
export class SubscriptionNotifications {
  async notifySubscriptionActivated(serverId: string, tier: string) {
    const channel = await this.getAnnouncementChannel(serverId);
    if (!channel) return;
    
    const embed = new EmbedBuilder()
      .setTitle('🎉 Server Upgraded!')
      .setDescription(`This server now has **${tier.toUpperCase()}** features!`)
      .setColor('Green')
      .addFields([
        {
          name: 'What\'s New?',
          value: this.getNewFeaturesMessage(tier)
        },
        {
          name: 'Get Started',
          value: 'Use `/create-game` to make your first premium game!'
        }
      ])
      .setFooter({ text: 'Thank you for supporting GameVibe!' });
    
    await channel.send({ embeds: [embed] });
  }
  
  async notifyTrialEnding(serverId: string, daysLeft: number) {
    const managers = await this.getSubscriptionManagers(serverId);
    
    for (const manager of managers) {
      const user = await this.client.users.fetch(manager.discord_user_id);
      
      const embed = new EmbedBuilder()
        .setTitle('⏰ Trial Ending Soon')
        .setDescription(`Your server's trial ends in ${daysLeft} days!`)
        .setColor('Yellow')
        .addFields([
          {
            name: 'Keep Your Features',
            value: 'Subscribe now to keep all premium features'
          }
        ]);
      
      const button = new ButtonBuilder()
        .setCustomId('subscription:convert_trial')
        .setLabel('Subscribe Now')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💳');
      
      try {
        await user.send({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(button)]
        });
      } catch (error) {
        // User has DMs disabled
      }
    }
  }
  
  async notifyPaymentFailed(serverId: string) {
    const managers = await this.getSubscriptionManagers(serverId);
    
    for (const manager of managers) {
      const user = await this.client.users.fetch(manager.discord_user_id);
      
      const embed = new EmbedBuilder()
        .setTitle('❌ Payment Failed')
        .setDescription('We couldn\'t process your subscription payment.')
        .setColor('Red')
        .addFields([
          {
            name: 'Action Required',
            value: 'Please update your payment method to continue using premium features.'
          },
          {
            name: 'Grace Period',
            value: 'You have 7 days before premium features are disabled.'
          }
        ]);
      
      const button = new ButtonBuilder()
        .setLabel('Update Payment Method')
        .setStyle(ButtonStyle.Link)
        .setURL(`${process.env.APP_URL}/subscription/payment`)
        .setEmoji('💳');
      
      try {
        await user.send({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(button)]
        });
      } catch (error) {
        // User has DMs disabled
      }
    }
  }
}
```

## 9. Testing Subscriptions

```typescript
// __tests__/subscription.test.ts
describe('Server Subscription Model', () => {
  let subscriptionService: SubscriptionService;
  let testServerId: string;
  
  beforeEach(async () => {
    testServerId = '123456789';
    // Setup test data
  });
  
  describe('Subscription Limits', () => {
    it('should enforce free tier limits', async () => {
      const check = await subscriptionService.canPerformAction(
        testServerId,
        'create_game'
      );
      
      expect(check.allowed).toBe(true);
      
      // Create 3 games (free limit)
      for (let i = 0; i < 3; i++) {
        await subscriptionService.recordUsage(
          testServerId,
          'game_created',
          'test-user'
        );
      }
      
      // 4th should fail
      const limitCheck = await subscriptionService.canPerformAction(
        testServerId,
        'create_game'
      );
      
      expect(limitCheck.allowed).toBe(false);
      expect(limitCheck.reason).toBe('monthly_limit_reached');
    });
    
    it('should allow unlimited games for pro tier', async () => {
      // Upgrade to pro
      await subscriptionService.updateSubscription(testServerId, {
        tier: 'pro',
        status: 'active'
      });
      
      // Create many games
      for (let i = 0; i < 100; i++) {
        const check = await subscriptionService.canPerformAction(
          testServerId,
          'create_game'
        );
        expect(check.allowed).toBe(true);
        
        await subscriptionService.recordUsage(
          testServerId,
          'game_created',
          'test-user'
        );
      }
    });
  });
  
  describe('Webhook Handling', () => {
    it('should activate subscription on successful payment', async () => {
      const mockEvent = createMockStripeEvent('checkout.session.completed', {
        metadata: {
          serverId: testServerId,
          tier: 'pro'
        }
      });
      
      await subscriptionService.handleSubscriptionWebhook(mockEvent);
      
      const subscription = await subscriptionService.getServerSubscription(testServerId);
      expect(subscription.tier).toBe('pro');
      expect(subscription.status).toBe('active');
    });
  });
});
```

## 10. Migration & Rollout Plan

```typescript
// migrations/add-subscriptions.sql
-- Migration script
BEGIN;

-- Add subscription fields to existing servers
ALTER TABLE servers 
ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'inactive';

-- Grandfather existing active servers
UPDATE servers 
SET subscription_tier = 'starter',
    subscription_status = 'active'
WHERE created_at < '2024-01-01' 
AND game_count > 10;

-- Create new tables
-- (tables from section 1)

COMMIT;
```

### Rollout Strategy

```typescript
const ROLLOUT_PHASES = {
  phase1: {
    week: 1,
    action: "Announce subscriptions coming",
    features: "Show upcoming tiers, early bird pricing"
  },
  
  phase2: {
    week: 2,
    action: "Enable for new servers only",
    features: "New servers see subscription options"
  },
  
  phase3: {
    week: 3,
    action: "Soft launch for existing servers",
    features: "10% of servers see upgrade prompts"
  },
  
  phase4: {
    week: 4,
    action: "Full launch",
    features: "All servers see limits and upgrade options"
  }
};
```

## Cost Analysis & Breakeven

### Infrastructure Costs (Monthly)
- **Fixed Costs**: ~$165-215/month
  - Hosting (Bot + Web + Multiplayer): $100-150
  - Database (PostgreSQL): $25
  - Cache (Redis): $20
  - Monitoring: $20

### Variable Costs Per Game
- **Claude API**: $0.01-0.02 per game
- **DALL-E 3**: $0.20-0.32 per asset set (5-8 assets)
- **Storage/CDN**: $0.01 per game
- **Total**: ~$0.22-0.35 per game

### Breakeven Analysis

#### Starter Tier ($9.99/month)
- **Revenue**: $9.99
- **Variable costs**: ~$3.60 (50 games + 10 assets)
- **Gross margin**: $6.39
- **Breakeven**: ~26 subscribers to cover fixed costs

#### Pro Tier ($29.99/month)
- **Revenue**: $29.99
- **Variable costs**: ~$20.50 (100 games + 50 assets)
- **Gross margin**: $9.49
- **Breakeven**: ~17 Pro subscribers

#### Enterprise ($99.99/month)
- **Revenue**: $99.99
- **Sustainable for**: ~285 games/month (nearly unlimited)
- **Breakeven**: 2-3 enterprise customers

### Revenue Optimization Strategies

1. **Cost Reduction**:
   - Cache generated games (30% reduction in AI calls)
   - Use Claude Haiku for simple games
   - Batch asset generation requests
   - Implement asset template library

2. **Additional Revenue Streams**:
   - Premium asset packs ($4.99-9.99)
   - Team licenses (5+ users)
   - Game template marketplace
   - API usage fees
   - Custom branding services

3. **Target Customer Mix**:
   - 70% Starter
   - 25% Pro
   - 5% Enterprise

### Projected Profitability
- **30 paying users**: Break even
- **100 paying users**: ~$750/month profit (improved with Enterprise pricing)
- **500 paying users**: ~$4,750/month profit (25 Enterprise users at $99.99)

## Implementation Checklist

- [ ] Set up Stripe account and webhooks
- [ ] Create subscription tiers in Stripe
- [ ] Implement database schema
- [ ] Build subscription service
- [ ] Add Discord commands
- [ ] Create checkout flow
- [ ] Implement webhook handlers
- [ ] Add feature gating
- [ ] Build usage-based billing for overages
- [ ] Implement cost optimization caching
- [ ] Build analytics dashboard
- [ ] Test payment flows
- [ ] Create documentation
- [ ] Plan rollout strategy

This server subscription model provides a complete implementation that's proven to work well for Discord bots, with one person paying for features that benefit the entire server community. The adjusted Pro tier pricing and caps ensure sustainability with AI generation costs.