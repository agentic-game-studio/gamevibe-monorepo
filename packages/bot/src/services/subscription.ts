// GameVibe AI Subscription Service
// Handles Stripe integration and subscription management

import Stripe from 'stripe';
import { injectable, inject } from 'inversify';
import { SubscriptionStatus, SubscriptionTier, ManagerRole } from '../generated/prisma/index.js';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { SubscriptionNotifications } from './subscription-notifications.js';
import { CreditService } from './credit.js';
import { TYPES } from '../types.js';
import { 
  SUBSCRIPTION_TIERS, 
  OVERAGE_PRICING, 
  getTierFeatures, 
  getTierLevel,
  getRequiredTier,
  canUseFeature,
  getRateLimit,
  type SubscriptionTierKey
} from '../config/subscription-tiers.js';

export interface CheckoutSessionParams {
  serverId: string;
  tier: string;
  userId: string;
}

export interface ActionCheckResult {
  allowed: boolean;
  reason?: string;
  requiredTier?: string;
  limit?: number;
  usage?: number;
  resetDate?: Date;
  retryAfter?: number;
  overage?: boolean;
  cost?: number;
}

export interface SubscriptionInfo {
  id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  gamesCreatedThisPeriod: number;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  features: any;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

@injectable()
export class SubscriptionService {
  private stripe: Stripe;
  
  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.SubscriptionNotifications) private notifications: SubscriptionNotifications,
    @inject(TYPES.CreditService) private creditService: CreditService
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16'
    });
  }
  
  /**
   * Create a Stripe checkout session for subscription
   */
  async createCheckoutSession(params: CheckoutSessionParams): Promise<Stripe.Checkout.Session> {
    const tierConfig = SUBSCRIPTION_TIERS[params.tier as SubscriptionTierKey];
    if (!tierConfig || params.tier === 'free' || !tierConfig.stripe_price_id) {
      throw new Error('Invalid subscription tier or no price ID available');
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
      success_url: `${process.env.APP_URL || 'http://localhost:3000'}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/subscription/cancel`,
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
  
  /**
   * Handle Stripe webhook events
   */
  async handleSubscriptionWebhook(event: Stripe.Event): Promise<void> {
    console.log(`Processing Stripe webhook: ${event.type}`);
    
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object as Stripe.Checkout.Session;
          
          // Check if this is a credit purchase or subscription
          if (session.metadata?.type === 'credit_purchase') {
            await this.handleCreditPurchaseComplete(session);
          } else {
            await this.handleCheckoutComplete(session);
          }
          break;
          
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;
          
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
          break;
          
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
          
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
          
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`Error processing webhook ${event.type}:`, error);
      throw error;
    }
  }
  
  /**
   * Get server subscription information
   */
  async getServerSubscription(serverId: string): Promise<SubscriptionInfo> {
    // Check cache first
    const cacheKey = `subscription:${serverId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }
    
    // Get from database
    const subscription = await this.db.prisma.serverSubscription.findUnique({
      where: { discordServerId: serverId },
      include: {
        managers: true,
        billingHistory: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    // Default to free if no subscription
    let result: SubscriptionInfo;
    if (subscription) {
      result = {
        ...subscription,
        features: getTierFeatures(subscription.tier.toLowerCase())
      };
    } else {
      result = {
        id: 'free',
        tier: SubscriptionTier.FREE,
        status: SubscriptionStatus.INACTIVE,
        gamesCreatedThisPeriod: 0,
        features: SUBSCRIPTION_TIERS.free.features
      };
    }
    
    // Cache for 5 minutes
    await this.cache.set(cacheKey, JSON.stringify(result), 300);
    
    return result;
  }
  
  /**
   * Check if a server can perform a specific action
   */
  async canPerformAction(serverId: string, action: string, userId?: string): Promise<ActionCheckResult> {
    const subscription = await this.getServerSubscription(serverId);
    const tierKey = subscription.tier.toLowerCase() as SubscriptionTierKey;
    
    // Check if feature is available in tier
    if (action === 'create_game' && !this.canCreateGame(tierKey)) {
      return {
        allowed: false,
        reason: 'feature_not_in_tier',
        requiredTier: getRequiredTier('games_per_month')
      };
    }
    
    if (action.startsWith('generate_asset') && !canUseFeature(tierKey, 'custom_assets')) {
      return {
        allowed: false,
        reason: 'feature_not_in_tier',
        requiredTier: getRequiredTier('custom_assets')
      };
    }
    
    // Check usage limits
    if (action === 'create_game') {
      const limit = SUBSCRIPTION_TIERS[tierKey].features.games_per_month;
      if (limit !== -1 && subscription.gamesCreatedThisPeriod >= limit) {
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
          usage: subscription.gamesCreatedThisPeriod,
          resetDate: subscription.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };
      }
    }
    
    if (action === 'generate_asset') {
      const assetLimit = SUBSCRIPTION_TIERS[tierKey].limits.asset_generation;
      if (assetLimit !== -1) {
        const assetUsage = await this.getCurrentUsage(serverId, 'asset_generated');
        if (assetUsage >= assetLimit) {
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
            limit: assetLimit,
            usage: assetUsage
          };
        }
      }
    }
    
    // Check rate limits
    const rateLimitKey = `ratelimit:${serverId}:${action}`;
    const recentUsage = parseInt(await this.cache.get(rateLimitKey) || '0');
    const rateLimit = getRateLimit(tierKey, action);
    
    if (rateLimit !== -1 && recentUsage >= rateLimit) {
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        retryAfter: 60 // seconds
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Record usage for a server action
   */
  async recordUsage(serverDiscordId: string, action: string, userDiscordId: string, metadata?: any): Promise<void> {
    const check = await this.canPerformAction(serverDiscordId, action, userDiscordId);
    
    // Handle overage billing
    if (check.overage && check.cost) {
      await this.recordOverageUsage(serverDiscordId, action, check.cost);
    }
    
    // Get database IDs from Discord IDs
    const serverDbId = await this.getServerDbId(serverDiscordId);
    const userDbId = await this.getUserDbId(userDiscordId);
    
    // Ensure server subscription exists
    const subscription = await this.db.prisma.serverSubscription.upsert({
      where: { discordServerId: serverDiscordId },
      create: {
        discordServerId: serverDiscordId,
        serverId: serverDbId,
        status: 'INACTIVE',
        tier: 'FREE',
        gamesCreatedThisPeriod: 0
      },
      update: {} // Just return existing if it exists
    });
    
    console.log(`[recordUsage] Discord IDs: server=${serverDiscordId}, user=${userDiscordId}`);
    console.log(`[recordUsage] Database IDs: serverDbId=${serverDbId}, subscriptionServerId=${subscription.serverId}, userDbId=${userDbId}`);
    
    // Log to database
    try {
      await this.db.prisma.usageLog.create({
        data: {
          serverId: subscription.serverId,
          action,
          userId: userDbId,
          metadata: metadata || {}
        }
      });
      
      // Update counters
      if (action === 'game_created') {
        await this.db.prisma.serverSubscription.upsert({
          where: { discordServerId: serverDiscordId },
          create: {
            discordServerId: serverDiscordId,
            serverId: serverDbId,
            gamesCreatedThisPeriod: 1,
            lastGameCreatedAt: new Date()
          },
          update: {
            gamesCreatedThisPeriod: { increment: 1 },
            lastGameCreatedAt: new Date()
          }
        });
      }
      
      // Update rate limit cache
      const rateLimitKey = `ratelimit:${serverDiscordId}:${action}`;
      const currentCount = parseInt(await this.cache.get(rateLimitKey) || '0');
      await this.cache.set(rateLimitKey, (currentCount + 1).toString(), 60); // 60 second window
      
      // Clear subscription cache
      await this.cache.delete(`subscription:${serverDiscordId}`);
      
      // Check for usage limit warnings
      await this.checkUsageWarnings(serverDiscordId, action);
      
    } catch (error) {
      console.error('Error recording usage:', error);
      throw error;
    }
  }
  
  /**
   * Check for usage warnings and send notifications
   */
  private async checkUsageWarnings(serverId: string, action: string): Promise<void> {
    const subscription = await this.getServerSubscription(serverId);
    const tierKey = subscription.tier.toLowerCase() as SubscriptionTierKey;
    const features = SUBSCRIPTION_TIERS[tierKey].features;
    
    let limit: number;
    let current: number;
    let limitType: string;
    
    if (action === 'create_game' || action === 'game_created') {
      limit = features.games_per_month;
      limitType = 'game creation';
      current = await this.getCurrentUsage(serverId, 'create_game') + await this.getCurrentUsage(serverId, 'game_created');
    } else if (action === 'generate_asset') {
      const limits = SUBSCRIPTION_TIERS[tierKey].limits;
      limit = limits.asset_generation;
      limitType = 'asset generation';
      current = await this.getCurrentUsage(serverId, 'generate_asset');
    } else {
      return; // No warnings for other actions
    }
    
    // Only warn for limited tiers
    if (limit === -1) return;
    
    const percentage = (current / limit) * 100;
    
    // Send warning if at 80% or 95% usage
    if (percentage >= 80) {
      await this.notifications.notifyUsageLimitWarning(serverId, limitType, current, limit, percentage);
    }
  }
  
  /**
   * Check for trial subscriptions ending soon
   */
  async checkTrialEndingNotifications(): Promise<void> {
    const trialSubscriptions = await this.db.prisma.serverSubscription.findMany({
      where: {
        status: SubscriptionStatus.TRIALING,
        currentPeriodEnd: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
        }
      }
    });

    for (const subscription of trialSubscriptions) {
      const daysLeft = Math.ceil(
        (subscription.currentPeriodEnd!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      
      if (daysLeft <= 7 && daysLeft > 0) {
        await this.notifications.notifyTrialEnding(subscription.discordServerId, daysLeft);
      }
    }
  }

  /**
   * Check for subscription renewals and send reminders
   */
  async checkRenewalReminders(): Promise<void> {
    const activeSubscriptions = await this.db.prisma.serverSubscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
        }
      }
    });

    for (const subscription of activeSubscriptions) {
      const daysUntil = Math.ceil(
        (subscription.currentPeriodEnd!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      
      if (daysUntil <= 7 && daysUntil > 0) {
        await this.notifications.notifyRenewalReminder(
          subscription.discordServerId,
          subscription.tier,
          subscription.currentPeriodEnd!,
          daysUntil
        );
      }
    }
  }

  /**
   * Add a subscription manager
   */
  async addSubscriptionManager(serverId: string, userId: string, role: ManagerRole, addedBy?: string): Promise<void> {
    await this.db.prisma.subscriptionManager.create({
      data: {
        serverId: serverId,
        userId: userId,
        discordUserId: userId,
        role,
        addedById: addedBy
      }
    });
  }

  /**
   * Process monthly credit resets for all subscriptions
   */
  async processMonthlyResets(): Promise<void> {
    // This is a wrapper around the CreditService method
    // Called by scheduled jobs to handle monthly credit allocation and rollover
    await this.creditService.processMonthlyReset();
  }

  /**
   * Update user's credit tier when subscription changes
   */
  async updateUserCreditTier(userId: string, serverId: string, newTier: SubscriptionTier): Promise<void> {
    const tierKey = newTier.toLowerCase() as 'free' | 'starter' | 'pro' | 'enterprise';
    const creditTier = tierKey.toUpperCase() as 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
    
    await this.creditService.updateSubscriptionTier(userId, serverId, creditTier);
    
    console.log(`Updated credit tier for user ${userId} in server ${serverId} to ${creditTier}`);
  }
  
  // Private helper methods
  
  private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const { serverId, userId, tier } = session.metadata || {};
    if (!serverId || !userId || !tier) {
      throw new Error('Missing metadata in checkout session');
    }
    
    // Update subscription in database
    await this.db.prisma.serverSubscription.upsert({
      where: { discordServerId: serverId },
      create: {
        discordServerId: serverId,
        serverId: await this.getServerDbId(serverId),
        status: SubscriptionStatus.ACTIVE,
        tier: tier.toUpperCase() as SubscriptionTier,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        subscribedByUserId: userId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      update: {
        status: SubscriptionStatus.ACTIVE,
        tier: tier.toUpperCase() as SubscriptionTier,
        stripeSubscriptionId: session.subscription as string,
        subscribedByUserId: userId
      }
    });
    
    // Add subscription manager
    await this.addSubscriptionManager(serverId, userId, ManagerRole.OWNER);
    
    // Update user's credit tier and allocate monthly credits
    await this.creditService.updateSubscriptionTier(
      userId, 
      serverId, 
      tier.toUpperCase() as 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'
    );
    
    // Clear cache
    await this.cache.delete(`subscription:${serverId}`);
    
    // Send notifications
    await this.notifications.notifySubscriptionActivated(serverId, tier, userId);
    
    console.log(`Subscription activated for server ${serverId} with tier ${tier} - Credits allocated`);
  }

  private async handleCreditPurchaseComplete(session: Stripe.Checkout.Session): Promise<void> {
    try {
      await this.creditService.handleCreditPurchaseSuccess(session);
      console.log(`Credit purchase completed for session ${session.id}`);
    } catch (error) {
      console.error('Failed to handle credit purchase completion:', error);
      throw error;
    }
  }
  
  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const { serverId, tier } = subscription.metadata || {};
    if (!serverId) return;
    
    const status = this.mapStripeStatus(subscription.status);
    
    // Get existing subscription to check for tier changes
    const existingSub = await this.db.prisma.serverSubscription.findFirst({
      where: { stripeSubscriptionId: subscription.id }
    });
    
    await this.db.prisma.serverSubscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    });
    
    // Update credit tier if tier changed
    if (existingSub && tier && existingSub.subscribedByUserId) {
      const newTier = tier.toUpperCase() as SubscriptionTier;
      if (existingSub.tier !== newTier) {
        await this.updateUserCreditTier(
          existingSub.subscribedByUserId,
          existingSub.discordServerId,
          newTier
        );
      }
    }
    
    // Clear cache
    if (existingSub) {
      await this.cache.delete(`subscription:${existingSub.discordServerId}`);
    }
  }
  
  private async handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
    // Get subscription info before canceling
    const serverSub = await this.db.prisma.serverSubscription.findFirst({
      where: { stripeSubscriptionId: subscription.id }
    });
    
    await this.db.prisma.serverSubscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date()
      }
    });
    
    // Downgrade credit tier to FREE after cancellation
    if (serverSub && serverSub.subscribedByUserId) {
      await this.updateUserCreditTier(
        serverSub.subscribedByUserId,
        serverSub.discordServerId,
        SubscriptionTier.FREE
      );
    }
    
    // Clear cache and send notifications
    if (serverSub) {
      await this.cache.delete(`subscription:${serverSub.discordServerId}`);
      
      // Send cancellation notification
      const endsAt = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : undefined;
      await this.notifications.notifySubscriptionCanceled(
        serverSub.discordServerId, 
        serverSub.tier, 
        endsAt
      );
    }
  }
  
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription as string);
    const { serverId } = subscription.metadata || {};
    if (!serverId) return;
    
    // Get the server subscription to get the correct serverId
    const serverSubscription = await this.db.prisma.serverSubscription.findFirst({
      where: { stripeSubscriptionId: subscription.id }
    });
    
    if (!serverSubscription) {
      console.error(`No server subscription found for Stripe subscription ${subscription.id}`);
      return;
    }
    
    // Record billing history
    await this.db.prisma.billingHistory.create({
      data: {
        serverId: serverSubscription.serverId,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        status: 'paid',
        invoicePdfUrl: invoice.invoice_pdf
      }
    });
    
    // Reset usage counters for new period
    await this.db.prisma.serverSubscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        gamesCreatedThisPeriod: 0,
        status: SubscriptionStatus.ACTIVE
      }
    });
    
    // Process monthly credit reset and allocation
    await this.creditService.processMonthlyReset();
  }
  
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription as string);
    const { serverId } = subscription.metadata || {};  
    if (!serverId) return;
    
    // Get the server subscription to get the correct serverId
    const serverSubscription = await this.db.prisma.serverSubscription.findFirst({
      where: { stripeSubscriptionId: subscription.id }
    });
    
    if (!serverSubscription) {
      console.error(`No server subscription found for Stripe subscription ${subscription.id}`);
      return;
    }
    
    // Record billing history
    await this.db.prisma.billingHistory.create({
      data: {
        serverId: serverSubscription.serverId,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency.toUpperCase(),
        status: 'failed'
      }
    });
    
    // Update subscription status
    await this.db.prisma.serverSubscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: SubscriptionStatus.PAST_DUE }
    });
    
    // Send payment failure notification
    const attemptCount = invoice.attempt_count || 1;
    await this.notifications.notifyPaymentFailed(serverSubscription.discordServerId, attemptCount);
  }
  
  private async getOrCreateStripeCustomer(serverId: string): Promise<Stripe.Customer> {
    // Check if customer already exists
    const subscription = await this.db.prisma.serverSubscription.findUnique({
      where: { discordServerId: serverId }
    });
    
    if (subscription?.stripeCustomerId) {
      return await this.stripe.customers.retrieve(subscription.stripeCustomerId) as Stripe.Customer;
    }
    
    // Create new customer
    const customer = await this.stripe.customers.create({
      metadata: { serverId }
    });
    
    return customer;
  }
  
  private async getServerDbId(discordServerId: string): Promise<string> {
    console.log(`[getServerDbId] Looking up server with discordId: ${discordServerId}`);
    const server = await this.db.prisma.server.findUnique({
      where: { discordId: discordServerId }
    });
    
    if (!server) {
      console.log(`[getServerDbId] Server not found, creating new server for discordId: ${discordServerId}`);
      // Create server if it doesn't exist
      const newServer = await this.db.prisma.server.create({
        data: {
          discordId: discordServerId,
          name: 'Unknown Server',
          memberCount: 0
        }
      });
      console.log(`[getServerDbId] Created new server with id: ${newServer.id}`);
      return newServer.id;
    }
    
    console.log(`[getServerDbId] Found existing server with id: ${server.id}`);
    return server.id;
  }
  
  private async getUserDbId(discordUserId: string): Promise<string> {
    const user = await this.db.prisma.user.findUnique({
      where: { discordId: discordUserId }
    });
    
    if (!user) {
      // Create user if it doesn't exist
      const newUser = await this.db.prisma.user.create({
        data: {
          discordId: discordUserId,
          username: `User-${discordUserId.slice(-4)}`,
          discriminator: '0000',
          avatarUrl: null,
          premiumTier: 0,
          premiumExpiresAt: null
        }
      });
      return newUser.id;
    }
    
    return user.id;
  }
  
  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case 'active': return SubscriptionStatus.ACTIVE;
      case 'canceled': return SubscriptionStatus.CANCELED;
      case 'past_due': return SubscriptionStatus.PAST_DUE;
      case 'trialing': return SubscriptionStatus.TRIALING;
      default: return SubscriptionStatus.INACTIVE;
    }
  }
  
  private canCreateGame(tier: SubscriptionTierKey): boolean {
    return SUBSCRIPTION_TIERS[tier].features.games_per_month > 0 || 
           SUBSCRIPTION_TIERS[tier].features.games_per_month === -1;
  }
  
  private async getCurrentUsage(serverDiscordId: string, action: string): Promise<number> {
    const subscription = await this.db.prisma.serverSubscription.findUnique({
      where: { discordServerId: serverDiscordId }
    });
    
    if (!subscription) return 0;
    
    const periodStart = subscription.currentPeriodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const count = await this.db.prisma.usageLog.count({
      where: {
        serverId: subscription.serverId, // Use subscription.serverId which matches UsageLog's foreign key
        action,
        createdAt: { gte: periodStart }
      }
    });
    
    return count;
  }
  
  private async isOverageEnabled(serverId: string): Promise<boolean> {
    // For now, overage is disabled. Could be a server setting in the future
    return false;
  }
  
  private async recordOverageUsage(serverId: string, action: string, cost: number): Promise<void> {
    // Record overage usage for billing
    console.log(`Overage usage for server ${serverId}: ${action} costs ${cost} cents`);
    // TODO: Implement overage billing logic
  }
}