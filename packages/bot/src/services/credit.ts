// GameVibe AI Credit Management Service
// Manages AI model credits, balances, and deductions for the subscription system

import { injectable, inject } from 'inversify';
import Stripe from 'stripe';
import { TYPES } from '../types.js';
import { CacheService } from './cache.js';
import { DatabaseService } from './database.js';
import { Logger } from '../utils/logger.js';
import { AI_CREDIT_PRICING, SUBSCRIPTION_TIERS } from '../config/subscription-tiers.js';

export interface CreditBalance {
  userId: string;
  serverId: string;
  totalCredits: number; // in cents
  availableCredits: number; // in cents
  monthlyAllotment: number; // in cents
  tier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  rolloverCredits: number; // in cents
  lastUpdated: Date;
  nextReset: Date;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  serverId: string;
  type: 'DEDUCTION' | 'ALLOCATION' | 'PURCHASE' | 'ROLLOVER' | 'REFUND';
  amount: number; // in cents
  model: string;
  tokensUsed?: number;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  metadata?: any;
  createdAt: Date;
}

export interface CreditUsageStats {
  totalCreditsUsed: number;
  creditsUsedByModel: Record<string, number>;
  averageCostPerGame: number;
  mostUsedModel: string;
  efficientUsageScore: number; // 0-1, how efficiently user uses credits
  projectedMonthlyUsage: number;
  recommendedTier?: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
}

export interface CreditPurchaseResult {
  success: boolean;
  transactionId?: string;
  creditsAdded?: number;
  newBalance?: number;
  checkoutUrl?: string;
  sessionId?: string;
  error?: string;
}

@injectable()
export class CreditService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'credit:';
  private stripe: Stripe;
  private logger = new Logger('CreditService');

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService
  ) {
    // Initialize Stripe only if key is available (allow tests to run without it)
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && stripeKey !== 'placeholder_key' && stripeKey.startsWith('sk_')) {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2024-06-20'
      });
    } else {
      this.logger.warn('Stripe not initialized - using placeholder mode');
      // Create a mock Stripe object for testing
      this.stripe = null as any;
    }
  }

  /**
   * Get user's current credit balance
   */
  async getCreditBalance(userDiscordId: string, serverDiscordId: string): Promise<CreditBalance | null> {
    const cacheKey = `${this.CACHE_PREFIX}balance:${userDiscordId}:${serverDiscordId}`;
    
    // Try cache first
    const cached = await this.cache.get<CreditBalance>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get user and server by Discord IDs to find database IDs
    const user = await this.db.getUser(userDiscordId);
    const server = await this.db.getServer(serverDiscordId);

    if (!user || !server) {
      // User or server doesn't exist, create default balance (this will create them)
      const newBalance = await this.createDefaultBalance(userDiscordId, serverDiscordId);
      await this.cache.set(cacheKey, newBalance, this.CACHE_TTL);
      return newBalance;
    }

    // Get from database using internal IDs
    const balance = await this.db.prisma.creditBalance.findUnique({
      where: { userId_serverId: { userId: user.id, serverId: server.id } }
    });

    if (!balance) {
      // Create default balance for FREE tier
      const newBalance = await this.createDefaultBalance(userDiscordId, serverDiscordId);
      await this.cache.set(cacheKey, newBalance, this.CACHE_TTL);
      return newBalance;
    }

    const creditBalance: CreditBalance = {
      userId: balance.userId,
      serverId: balance.serverId,
      totalCredits: balance.totalCredits,
      availableCredits: balance.availableCredits,
      monthlyAllotment: balance.monthlyAllotment,
      tier: balance.tier as 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE',
      rolloverCredits: balance.rolloverCredits,
      lastUpdated: balance.lastUpdated,
      nextReset: balance.nextReset
    };

    // Cache the result
    await this.cache.set(cacheKey, creditBalance, this.CACHE_TTL);
    return creditBalance;
  }

  /**
   * Check if user has sufficient credits for a model operation
   */
  async hasCredits(
    userId: string, 
    serverId: string, 
    model: string, 
    estimatedTokens: number = 1000
  ): Promise<{ hasCredits: boolean; cost: number; balance: number; reason?: string }> {
    const balance = await this.getCreditBalance(userId, serverId);
    if (!balance) {
      return { hasCredits: false, cost: 0, balance: 0, reason: 'No credit balance found' };
    }

    // FREE tier gets unlimited Haiku
    if (balance.tier === 'FREE' && model === 'claude-3-5-haiku-latest') {
      return { hasCredits: true, cost: 0, balance: balance.availableCredits };
    }

    // Calculate cost
    const costPerToken = AI_CREDIT_PRICING[model as keyof typeof AI_CREDIT_PRICING] || 0;
    const totalCost = Math.ceil((estimatedTokens * costPerToken) / 1000); // costPerToken is per 1000 tokens

    // Check if model is available for tier
    const tierConfig = SUBSCRIPTION_TIERS[balance.tier.toLowerCase() as keyof typeof SUBSCRIPTION_TIERS];
    const allowedModels = tierConfig?.features?.ai_models || ['claude-3-5-haiku-latest'];
    
    if (!allowedModels.includes(model)) {
      return { 
        hasCredits: false, 
        cost: totalCost, 
        balance: balance.availableCredits,
        reason: `Model ${model} not available for ${balance.tier} tier`
      };
    }

    // Check credit balance
    const hasCredits = balance.availableCredits >= totalCost;
    return {
      hasCredits,
      cost: totalCost,
      balance: balance.availableCredits,
      reason: hasCredits ? undefined : 'Insufficient credits'
    };
  }

  /**
   * Deduct credits for model usage
   */
  async deductCredits(
    userId: string,
    serverId: string,
    model: string,
    actualTokens: number,
    metadata?: any
  ): Promise<CreditTransaction | null> {
    // FREE tier Haiku usage is always free
    if (model === 'claude-3-5-haiku-latest') {
      // Still log the transaction for analytics
      return this.logTransaction(userId, serverId, 'DEDUCTION', 0, model, actualTokens, 
        'Free Haiku usage', 0, 0, metadata);
    }

    const balance = await this.getCreditBalance(userId, serverId);
    if (!balance) {
      this.logger.error('No credit balance found for deduction', { userId, serverId });
      return null;
    }

    // Calculate actual cost
    const costPerToken = AI_CREDIT_PRICING[model as keyof typeof AI_CREDIT_PRICING] || 0;
    const actualCost = Math.ceil((actualTokens * costPerToken) / 1000);

    if (balance.availableCredits < actualCost) {
      this.logger.warn('Insufficient credits for deduction', {
        userId, serverId, model, actualCost, available: balance.availableCredits
      });
      return null;
    }

    // Update balance
    const newBalance = balance.availableCredits - actualCost;
    
    await this.db.prisma.creditBalance.update({
      where: { userId_serverId: { userId, serverId } },
      data: {
        availableCredits: newBalance,
        totalCredits: balance.totalCredits + actualCost, // Track total usage
        lastUpdated: new Date()
      }
    });

    // Clear cache
    await this.cache.del(`${this.CACHE_PREFIX}balance:${userId}:${serverId}`);

    // Log transaction
    const transaction = await this.logTransaction(
      userId, serverId, 'DEDUCTION', actualCost, model, actualTokens,
      `AI model usage: ${model}`, balance.availableCredits, newBalance, metadata
    );

    this.logger.info('Credits deducted', {
      userId, serverId, model, actualCost, newBalance, actualTokens
    });

    return transaction;
  }

  /**
   * Add credits to user balance (subscription allocation or purchase)
   */
  async addCredits(
    userId: string,
    serverId: string,
    amount: number,
    type: 'ALLOCATION' | 'PURCHASE',
    description: string,
    metadata?: any
  ): Promise<CreditTransaction | null> {
    const balance = await this.getCreditBalance(userId, serverId);
    if (!balance) {
      this.logger.error('No credit balance found for addition', { userId, serverId });
      return null;
    }

    const newBalance = balance.availableCredits + amount;

    await this.db.prisma.creditBalance.update({
      where: { userId_serverId: { userId, serverId } },
      data: {
        availableCredits: newBalance,
        lastUpdated: new Date()
      }
    });

    // Clear cache
    await this.cache.del(`${this.CACHE_PREFIX}balance:${userId}:${serverId}`);

    // Log transaction
    const transaction = await this.logTransaction(
      userId, serverId, type, amount, 'system', 0,
      description, balance.availableCredits, newBalance, metadata
    );

    this.logger.info('Credits added', {
      userId, serverId, amount, type, newBalance, description
    });

    return transaction;
  }

  /**
   * Update user's subscription tier and allocate monthly credits
   */
  async updateSubscriptionTier(
    userId: string,
    serverId: string,
    newTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'
  ): Promise<void> {
    const balance = await this.getCreditBalance(userId, serverId);
    if (!balance) {
      await this.createDefaultBalance(userId, serverId, newTier);
      return;
    }

    const tierConfig = SUBSCRIPTION_TIERS[newTier.toLowerCase() as keyof typeof SUBSCRIPTION_TIERS];
    const monthlyCredits = tierConfig?.features?.monthly_ai_credits || 0;

    // Calculate next reset date (first of next month)
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    await this.db.prisma.creditBalance.update({
      where: { userId_serverId: { userId, serverId } },
      data: {
        tier: newTier,
        monthlyAllotment: monthlyCredits,
        nextReset,
        lastUpdated: new Date()
      }
    });

    // Allocate monthly credits if upgrading
    if (monthlyCredits > 0) {
      await this.addCredits(
        userId, serverId, monthlyCredits, 'ALLOCATION',
        `Monthly credit allocation for ${newTier} tier`
      );
    }

    // Clear cache
    await this.cache.del(`${this.CACHE_PREFIX}balance:${userId}:${serverId}`);

    this.logger.info('Subscription tier updated', {
      userId, serverId, newTier, monthlyCredits
    });
  }

  /**
   * Process monthly credit rollover and allocation
   */
  async processMonthlyReset(): Promise<void> {
    const now = new Date();
    
    // Get all balances that need reset with user and server info
    const balancesToReset = await this.db.prisma.creditBalance.findMany({
      where: {
        nextReset: { lte: now }
      },
      include: {
        user: true,
        server: true
      }
    });

    for (const balance of balancesToReset) {
      const tierConfig = SUBSCRIPTION_TIERS[balance.tier.toLowerCase() as keyof typeof SUBSCRIPTION_TIERS];
      const rolloverEnabled = tierConfig?.features?.credit_rollover || false;
      const maxRolloverMonths = this.getRolloverMonths(balance.tier as any);
      const monthlyAllotment = balance.monthlyAllotment;

      let newRolloverCredits = 0;
      let newAvailableCredits = monthlyAllotment;

      if (rolloverEnabled && balance.availableCredits > 0) {
        // Calculate rollover amount (unused credits up to limit)
        const maxRollover = monthlyAllotment * maxRolloverMonths;
        newRolloverCredits = Math.min(balance.availableCredits, maxRollover);
        newAvailableCredits += newRolloverCredits;
      }

      // Calculate next reset
      const nextReset = new Date(now);
      nextReset.setMonth(nextReset.getMonth() + 1);
      nextReset.setDate(1);
      nextReset.setHours(0, 0, 0, 0);

      // Update balance
      await this.db.prisma.creditBalance.update({
        where: { id: balance.id },
        data: {
          availableCredits: newAvailableCredits,
          rolloverCredits: newRolloverCredits,
          nextReset,
          lastUpdated: now
        }
      });

      // Log rollover transaction if applicable
      if (newRolloverCredits > 0) {
        await this.logTransaction(
          balance.user.discordId, balance.server.discordId, 'ROLLOVER', newRolloverCredits,
          'system', 0, `Monthly credit rollover (${maxRolloverMonths} months)`,
          balance.availableCredits, newAvailableCredits
        );
      }

      // Clear cache
      await this.cache.del(`${this.CACHE_PREFIX}balance:${balance.user.discordId}:${balance.server.discordId}`);
    }

    this.logger.info('Monthly credit reset processed', { count: balancesToReset.length });
  }

  /**
   * Get user's credit usage statistics
   */
  async getCreditUsageStats(
    userDiscordId: string, 
    serverDiscordId: string, 
    days: number = 30
  ): Promise<CreditUsageStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get database IDs from Discord IDs
    const user = await this.db.getUser(userDiscordId);
    const server = await this.db.getServer(serverDiscordId);

    if (!user || !server) {
      // Return empty stats if user/server doesn't exist
      return {
        totalCreditsUsed: 0,
        creditsUsedByModel: {},
        averageCostPerGame: 0,
        mostUsedModel: 'claude-3-5-haiku-latest',
        efficientUsageScore: 1.0,
        projectedMonthlyUsage: 0,
        recommendedTier: 'FREE'
      };
    }

    const transactions = await this.db.prisma.creditTransaction.findMany({
      where: {
        userId: user.id, // Use database ID
        serverId: server.id, // Use database ID
        type: 'DEDUCTION',
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalCreditsUsed = transactions.reduce((sum, t) => sum + t.amount, 0);
    const creditsUsedByModel: Record<string, number> = {};
    const gameCount = new Set(transactions.map(t => t.metadata?.gameId)).size || 1;

    transactions.forEach(transaction => {
      const model = transaction.model;
      creditsUsedByModel[model] = (creditsUsedByModel[model] || 0) + transaction.amount;
    });

    const mostUsedModel = Object.entries(creditsUsedByModel)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'claude-3-5-haiku-latest';

    const averageCostPerGame = totalCreditsUsed / gameCount;
    const projectedMonthlyUsage = (totalCreditsUsed / days) * 30;

    // Calculate efficiency score (lower cost per game = higher efficiency)
    const maxCostPerGame = 50; // 50 cents considered maximum
    const efficientUsageScore = Math.max(0, 1 - (averageCostPerGame / maxCostPerGame));

    // Recommend tier based on projected usage
    let recommendedTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE' = 'FREE';
    if (projectedMonthlyUsage > 2000) recommendedTier = 'ENTERPRISE';
    else if (projectedMonthlyUsage > 500) recommendedTier = 'PRO';
    else if (projectedMonthlyUsage > 100) recommendedTier = 'STARTER';

    return {
      totalCreditsUsed,
      creditsUsedByModel,
      averageCostPerGame,
      mostUsedModel,
      efficientUsageScore,
      projectedMonthlyUsage,
      recommendedTier
    };
  }

  /**
   * Purchase credit pack via Stripe
   */
  async purchaseCreditPack(
    userId: string,
    serverId: string,
    packSize: 'small' | 'medium' | 'large' | 'xl'
  ): Promise<CreditPurchaseResult> {
    const pack = AI_CREDIT_PRICING.credit_packs[packSize];
    if (!pack) {
      return { success: false, error: 'Invalid credit pack size' };
    }

    // Check if user has a paid subscription tier
    const balance = await this.getCreditBalance(userId, serverId);
    if (!balance || balance.tier === 'FREE') {
      return { 
        success: false, 
        error: 'Credit purchases are only available for paid subscription tiers' 
      };
    }

    try {
      // Create Stripe checkout session for credit purchase
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${packSize.toUpperCase()} Credit Pack`,
              description: `${pack.credits.toLocaleString()} AI credits for GameVibe AI`,
              images: ['https://your-domain.com/credit-pack-image.png'] // Optional
            },
            unit_amount: pack.price_cents
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: `${process.env.APP_URL || 'http://localhost:3000'}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/credits/cancel`,
        metadata: {
          userId,
          serverId,
          packSize,
          credits: pack.credits.toString(),
          type: 'credit_purchase'
        },
        customer_email: undefined, // Could be populated if we have user email
        allow_promotion_codes: true
      });

      this.logger.info('Credit purchase checkout session created', {
        userId,
        serverId,
        packSize,
        sessionId: session.id,
        amount: pack.price_cents
      });

      return {
        success: true,
        sessionId: session.id,
        checkoutUrl: session.url!,
        transactionId: session.id
      };

    } catch (error) {
      this.logger.error('Credit pack purchase failed', { userId, serverId, packSize, error });
      return { success: false, error: 'Failed to create checkout session' };
    }
  }

  /**
   * Handle successful credit purchase from Stripe webhook
   */
  async handleCreditPurchaseSuccess(session: Stripe.Checkout.Session): Promise<void> {
    const { userId, serverId, packSize, credits, type } = session.metadata || {};
    
    if (type !== 'credit_purchase' || !userId || !serverId || !packSize || !credits) {
      this.logger.error('Invalid credit purchase session metadata', { sessionId: session.id });
      return;
    }

    const creditsToAdd = parseInt(credits);
    const pack = AI_CREDIT_PRICING.credit_packs[packSize as keyof typeof AI_CREDIT_PRICING.credit_packs];
    
    if (!pack) {
      this.logger.error('Invalid credit pack in purchase', { packSize, sessionId: session.id });
      return;
    }

    try {
      // Add credits to user balance
      const transaction = await this.addCredits(
        userId, 
        serverId, 
        creditsToAdd, 
        'PURCHASE',
        `Credit pack purchase: ${packSize.toUpperCase()} (${creditsToAdd.toLocaleString()} credits)`,
        { 
          packSize, 
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent,
          amountPaid: session.amount_total
        }
      );

      this.logger.info('Credit purchase completed successfully', {
        userId,
        serverId,
        packSize,
        creditsAdded: creditsToAdd,
        transactionId: transaction?.id,
        sessionId: session.id
      });

    } catch (error) {
      this.logger.error('Failed to process credit purchase', {
        userId,
        serverId,
        packSize,
        sessionId: session.id,
        error
      });
      throw error;
    }
  }

  /**
   * Get available models for user's tier and credit balance
   */
  async getAvailableModels(userId: string, serverId: string): Promise<{
    freeModels: string[];
    availableModels: string[];
    unavailableModels: { model: string; reason: string; cost: number }[];
  }> {
    const balance = await this.getCreditBalance(userId, serverId);
    if (!balance) {
      return { freeModels: ['claude-3-5-haiku-latest'], availableModels: [], unavailableModels: [] };
    }

    const tierConfig = SUBSCRIPTION_TIERS[balance.tier.toLowerCase() as keyof typeof SUBSCRIPTION_TIERS];
    const allowedModels = tierConfig?.features?.ai_models || ['claude-haiku'];

    const freeModels = ['claude-3-5-haiku-latest']; // Always free
    const availableModels: string[] = [];
    const unavailableModels: { model: string; reason: string; cost: number }[] = [];

    for (const model of allowedModels) {
      if (model === 'claude-3-5-haiku-latest') continue; // Already in free models

      const costPer1k = AI_CREDIT_PRICING[model as keyof typeof AI_CREDIT_PRICING] || 0;
      const estimatedCost = Math.ceil(costPer1k * 2); // Estimate for 2k tokens

      if (balance.availableCredits >= estimatedCost) {
        availableModels.push(model);
      } else {
        unavailableModels.push({
          model,
          reason: 'Insufficient credits',
          cost: estimatedCost
        });
      }
    }

    return { freeModels, availableModels, unavailableModels };
  }

  /**
   * Private helper methods
   */

  private async createDefaultBalance(
    userDiscordId: string, 
    serverDiscordId: string, 
    tier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE' = 'FREE'
  ): Promise<CreditBalance> {
    const tierConfig = SUBSCRIPTION_TIERS[tier.toLowerCase() as keyof typeof SUBSCRIPTION_TIERS];
    const monthlyCredits = tierConfig?.features?.monthly_ai_credits || 0;

    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    // Ensure user and server exist and get their database IDs
    const user = await this.db.upsertUser({
      discordId: userDiscordId,
      username: `User-${userDiscordId.slice(-4)}`,
      discriminator: '0000',
      avatarUrl: null,
      premiumTier: 0,
      premiumExpiresAt: null
    });

    const server = await this.db.upsertServer({
      discordId: serverDiscordId,
      name: `Server-${serverDiscordId.slice(-4)}`,
      memberCount: 1
    });

    const balance = await this.db.prisma.creditBalance.create({
      data: {
        userId: user.id, // Use database ID, not Discord ID
        serverId: server.id, // Use database ID, not Discord ID
        totalCredits: 0,
        availableCredits: monthlyCredits,
        monthlyAllotment: monthlyCredits,
        tier,
        rolloverCredits: 0,
        nextReset,
        lastUpdated: new Date()
      }
    });

    return {
      userId: balance.userId,
      serverId: balance.serverId,
      totalCredits: balance.totalCredits,
      availableCredits: balance.availableCredits,
      monthlyAllotment: balance.monthlyAllotment,
      tier: balance.tier as 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE',
      rolloverCredits: balance.rolloverCredits,
      lastUpdated: balance.lastUpdated,
      nextReset: balance.nextReset
    };
  }

  private async logTransaction(
    userDiscordId: string,
    serverDiscordId: string,
    type: 'DEDUCTION' | 'ALLOCATION' | 'PURCHASE' | 'ROLLOVER' | 'REFUND',
    amount: number,
    model: string,
    tokensUsed: number,
    description: string,
    balanceBefore: number,
    balanceAfter: number,
    metadata?: any
  ): Promise<CreditTransaction> {
    // Get user and server database IDs from Discord IDs
    const user = await this.db.getUser(userDiscordId);
    const server = await this.db.getServer(serverDiscordId);

    if (!user || !server) {
      // Ensure user and server exist
      const upsertedUser = await this.db.upsertUser({
        discordId: userDiscordId,
        username: `User-${userDiscordId.slice(-4)}`,
        discriminator: '0000',
        avatarUrl: null,
        premiumTier: 0,
        premiumExpiresAt: null
      });

      const upsertedServer = await this.db.upsertServer({
        discordId: serverDiscordId,
        name: `Server-${serverDiscordId.slice(-4)}`,
        memberCount: 1
      });

      // Create transaction with database IDs
      const transaction = await this.db.prisma.creditTransaction.create({
        data: {
          userId: upsertedUser.id, // Use database ID
          serverId: upsertedServer.id, // Use database ID
          type,
          amount,
          model,
          tokensUsed,
          description,
          balanceBefore,
          balanceAfter,
          metadata: metadata ? JSON.stringify(metadata) : null,
          createdAt: new Date()
        }
      });

      return {
        id: transaction.id,
        userId: transaction.userId,
        serverId: transaction.serverId,
        type: transaction.type as any,
        amount: transaction.amount,
        model: transaction.model,
        tokensUsed: transaction.tokensUsed,
        description: transaction.description,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        metadata: transaction.metadata ? JSON.parse(transaction.metadata) : undefined,
        createdAt: transaction.createdAt
      };
    }

    // Create transaction with existing database IDs
    const transaction = await this.db.prisma.creditTransaction.create({
      data: {
        userId: user.id, // Use database ID
        serverId: server.id, // Use database ID
        type,
        amount,
        model,
        tokensUsed,
        description,
        balanceBefore,
        balanceAfter,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date()
      }
    });

    return {
      id: transaction.id,
      userId: transaction.userId,
      serverId: transaction.serverId,
      type: transaction.type as any,
      amount: transaction.amount,
      model: transaction.model,
      tokensUsed: transaction.tokensUsed,
      description: transaction.description,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      metadata: transaction.metadata ? JSON.parse(transaction.metadata) : undefined,
      createdAt: transaction.createdAt
    };
  }

  private getRolloverMonths(tier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'): number {
    const rolloverMonths = { FREE: 0, STARTER: 2, PRO: 3, ENTERPRISE: 6 };
    return rolloverMonths[tier];
  }
}