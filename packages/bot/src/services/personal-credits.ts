// Personal Credits Service
// Manages user-specific credits that work across all servers

import { injectable, inject } from 'inversify';
import { CreatorTier, CreditTransactionType } from '../generated/prisma/index.js';
import { DatabaseService } from './database.js';

// Define enums that may not exist in the current schema
const TransactionType = {
  EARNED: 'EARNED' as const,
  SPENT: 'SPENT' as const
};

const EarningReason = {
  ACHIEVEMENT: 'ACHIEVEMENT' as const,
  CHALLENGE_WIN: 'CHALLENGE_WIN' as const,
  CHALLENGE_REFUND: 'CHALLENGE_REFUND' as const,
  ACTIVITY: 'ACTIVITY' as const,
  GAME_PLAYS: 'GAME_PLAYS' as const,
  VIRAL_GAME: 'VIRAL_GAME' as const,
  CROSS_SERVER: 'CROSS_SERVER' as const,
  SERVER_REFERRAL: 'SERVER_REFERRAL' as const,
  SERVER_SUBSCRIPTION: 'SERVER_SUBSCRIPTION' as const,
  BONUS: 'BONUS' as const,
  TIER_UPGRADE: 'TIER_UPGRADE' as const
};
import { TYPES } from '../types.js';
import { CacheService } from './cache.js';
import { AnalyticsService } from './analytics.js';
import { AchievementService } from './achievement.js';
import { AmbassadorService } from './ambassador.js';
import { ViralNotificationService } from './viral-notifications.js';
import { Client } from 'discord.js';

// Configuration
const CREATOR_TIERS = {
  BRONZE: {
    threshold: 0,
    earningMultiplier: 1.0,
    monthlyBonus: 0,
    perks: []
  },
  SILVER: {
    threshold: 1000,
    earningMultiplier: 1.1, // 10% bonus
    monthlyBonus: 50,
    perks: ['exclusive_template_1', 'priority_queue']
  },
  GOLD: {
    threshold: 10000,
    earningMultiplier: 1.25, // 25% bonus
    monthlyBonus: 200,
    perks: ['exclusive_template_1', 'exclusive_template_2', 'priority_queue', 'custom_branding']
  },
  DIAMOND: {
    threshold: 100000,
    earningMultiplier: 1.5, // 50% bonus
    monthlyBonus: 1000,
    perks: ['all_exclusive_templates', 'priority_queue', 'custom_branding', 'early_access', 'lifetime_pro']
  }
};

const EARNING_RULES = {
  GAME_PLAYS: {
    per: 10,
    reward: 1,
    dailyCap: 100
  },
  VIRAL_GAME: {
    thresholds: [
      { plays: 100, reward: 10 },
      { plays: 1000, reward: 100 },
      { plays: 10000, reward: 1000 },
      { plays: 100000, reward: 10000 }
    ]
  },
  CROSS_SERVER: {
    threshold: 5,
    reward: 50,
    additionalPerServer: 5,
    maxServers: 100
  },
  SERVER_REFERRAL: {
    install: 100,
    subscribe: {
      FREE: 0,
      STARTER: 500,
      PRO: 1000,
      ENTERPRISE: 2500
    }
  },
  ENGAGEMENT_BOOST: {
    threshold: 0.5, // 50% increase
    reward: 200
  },
  CHALLENGE_WON: {
    base: 20,
    tournament: 100
  }
};

export interface PersonalCredits {
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  creatorTier: CreatorTier;
  tierMultiplier: number;
  tierPerks: string[];
  nextTierProgress: {
    currentTier: string;
    nextTier: string | null;
    progress: number;
    required: number;
  };
}

export interface EarningResult {
  success: boolean;
  creditsEarned: number;
  newBalance: number;
  tierUpgraded?: boolean;
  newTier?: CreatorTier;
  achievement?: string;
}

@injectable()
export class PersonalCreditService {
  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.DiscordClient) private client: Client,
    @inject(TYPES.AchievementService) private achievementService: AchievementService,
    @inject(TYPES.AmbassadorService) private ambassadorService: AmbassadorService,
    @inject(TYPES.ViralNotificationService) private viralNotificationService: ViralNotificationService
  ) {}

  /**
   * Get user's personal credit balance and tier info
   */
  async getPersonalCredits(userId: string): Promise<PersonalCredits> {
    const cacheKey = `personal_credits:${userId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const credits = await this.db.prisma.userPersonalCredits.findUnique({
      where: { userId }
    });

    if (!credits) {
      // Create new user credits
      const newCredits = await this.db.prisma.userPersonalCredits.create({
        data: {
          userId,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          creatorTier: CreatorTier.BRONZE
        }
      });
      credits = newCredits;
    }

    const result: PersonalCredits = {
      userId: credits.userId,
      balance: credits.credits,
      totalEarned: credits.lifetimeEarned,
      totalSpent: credits.totalSpent || 0,
      creatorTier: credits.tier as CreatorTier,
      tierMultiplier: CREATOR_TIERS[credits.tier as keyof typeof CREATOR_TIERS].earningMultiplier,
      tierPerks: CREATOR_TIERS[credits.tier as keyof typeof CREATOR_TIERS].perks,
      nextTierProgress: this.calculateTierProgress(credits.lifetimeEarned, credits.tier as CreatorTier)
    };

    // Cache for 5 minutes
    await this.cache.set(cacheKey, JSON.stringify(result), 300);
    
    return result;
  }

  /**
   * Earn credits for user actions
   */
  async earnCredits(
    userId: string,
    baseAmount: number,
    reason: EarningReason,
    metadata?: any
  ): Promise<EarningResult> {
    try {
      // Get current credits
      const currentCredits = await this.getPersonalCredits(userId);
      
      // Apply tier multiplier
      let multipliedAmount = Math.floor(baseAmount * currentCredits.tierMultiplier);
      
      // Apply ambassador bonus if applicable
      multipliedAmount = await this.applyAmbassadorBonus(userId, multipliedAmount, metadata?.serverId);
      
      // Check daily caps if applicable
      const cappedAmount = await this.applyCaps(userId, multipliedAmount, reason);
      
      // Update balance
      const updated = await this.db.prisma.userPersonalCredits.update({
        where: { userId },
        data: {
          balance: { increment: cappedAmount },
          totalEarned: { increment: cappedAmount }
        }
      });

      // Record transaction
      await this.db.prisma.personalCreditTransaction.create({
        data: {
          userId,
          type: TransactionType.EARNED,
          amount: cappedAmount,
          balanceAfter: updated.balance,
          earningReason: reason,
          earningMeta: metadata
        }
      });

      // Clear cache
      await this.cache.delete(`personal_credits:${userId}`);

      // Check for tier upgrade
      const tierResult = await this.checkTierUpgrade(userId, updated.lifetimeEarned);

      // Track analytics
      await this.analytics.trackEvent('personal_credits_earned', {
        userId,
        amount: cappedAmount,
        reason,
        tier: updated.creatorTier,
        ...metadata
      });

      // Send notification for significant earnings
      if (cappedAmount >= 100 || tierResult.upgraded) {
        await this.notifyEarning(userId, cappedAmount, reason, tierResult);
      }

      return {
        success: true,
        creditsEarned: cappedAmount,
        newBalance: updated.balance,
        tierUpgraded: tierResult.upgraded,
        newTier: tierResult.newTier
      };

    } catch (error) {
      console.error('Error earning credits:', error);
      return {
        success: false,
        creditsEarned: 0,
        newBalance: 0
      };
    }
  }

  /**
   * Spend personal credits
   */
  async spendCredits(
    userId: string,
    amount: number,
    reason: string,
    serverId?: string
  ): Promise<boolean> {
    const credits = await this.getPersonalCredits(userId);
    
    if (credits.balance < amount) {
      return false;
    }

    // Update balance
    const updated = await this.db.prisma.userPersonalCredits.update({
      where: { userId },
      data: {
        balance: { decrement: amount },
        totalSpent: { increment: amount }
      }
    });

    // Record transaction
    await this.db.prisma.personalCreditTransaction.create({
      data: {
        userId,
        type: TransactionType.SPENT,
        amount: -amount,
        balanceAfter: updated.balance,
        spentOn: reason,
        serverId
      }
    });

    // Clear cache
    await this.cache.delete(`personal_credits:${userId}`);

    // Track analytics
    await this.analytics.trackEvent('personal_credits_spent', {
      userId,
      amount,
      reason,
      serverId,
      remainingBalance: updated.balance
    });

    return true;
  }

  /**
   * Add credits (wrapper for earnCredits for compatibility)
   */
  async addCredits(
    userId: string,
    amount: number,
    reason: string,
    metadata?: any
  ): Promise<EarningResult> {
    // Map reason string to EarningReason enum
    const reasonMap: { [key: string]: EarningReason } = {
      'achievement': EarningReason.ACHIEVEMENT,
      'challenge_win': EarningReason.CHALLENGE_WIN,
      'challenge_refund': EarningReason.CHALLENGE_REFUND,
      'ambassador_activity': EarningReason.ACTIVITY,
      'ambassador_monthly_bonus': EarningReason.ACTIVITY,
      'ambassador_promotion': EarningReason.ACHIEVEMENT
    };

    const earningReason = reasonMap[reason] || EarningReason.ACTIVITY;

    return await this.earnCredits(userId, amount, earningReason, metadata);
  }

  /**
   * Process game play for credit earning
   */
  async processGamePlay(gameIdOrShortId: string, serverId: string): Promise<void> {
    // Get game details - try shortId first (most common from Discord buttons)
    const game = await this.db.prisma.game.findFirst({
      where: {
        OR: [
          { shortId: gameIdOrShortId },
          { id: gameIdOrShortId }
        ]
      }
    });

    if (!game) return;

    // Update game play count
    const updatedGame = await this.db.prisma.game.update({
      where: { id: game.id },
      data: { playCount: { increment: 1 } }
    });

    // Track server reach
    await this.trackServerReach(game.id, serverId);

    // Check play count milestones
    const playCount = updatedGame.playCount;
    
    // Basic play rewards (every 10 plays)
    if (playCount % EARNING_RULES.GAME_PLAYS.per === 0) {
      await this.earnCredits(
        game.creatorId,
        EARNING_RULES.GAME_PLAYS.reward,
        EarningReason.GAME_PLAYS,
        { gameId: game.id, playCount }
      );
    }

    // Viral thresholds
    for (const threshold of EARNING_RULES.VIRAL_GAME.thresholds) {
      if (playCount === threshold.plays) {
        await this.earnCredits(
          game.creatorId,
          threshold.reward,
          EarningReason.VIRAL_GAME,
          { gameId: game.id, milestone: threshold.plays }
        );

        // Create viral moment
        await this.createViralMoment(game, threshold.plays);
        
        // Trigger viral notification
        const serverCount = await this.db.prisma.gameServerReach.count({
          where: { gameId: game.id }
        });
        
        await this.viralNotificationService.triggerGameViralMilestone(
          game.creatorId,
          game.id,
          game.title,
          playCount,
          serverCount
        );
      }
    }
  }

  /**
   * Track game reach across servers
   */
  private async trackServerReach(gameId: string, serverId: string): Promise<void> {
    // Upsert server reach record
    await this.db.prisma.gameServerReach.upsert({
      where: {
        gameId_serverId: { gameId, serverId }
      },
      create: {
        gameId: game.id,
        serverId,
        playCount: 1,
        uniquePlayers: 1
      },
      update: {
        playCount: { increment: 1 },
        lastPlayedAt: new Date()
      }
    });

    // Check cross-server milestone
    const serverCount = await this.db.prisma.gameServerReach.count({
      where: { gameId }
    });

    const game = await this.db.prisma.game.findUnique({
      where: { id: gameId }
    });

    if (!game) return;

    // First cross-server milestone
    if (serverCount === EARNING_RULES.CROSS_SERVER.threshold) {
      await this.earnCredits(
        game.creatorId,
        EARNING_RULES.CROSS_SERVER.reward,
        EarningReason.CROSS_SERVER,
        { gameId: game.id, serverCount }
      );
      
      // Trigger cross-server viral notification
      await this.viralNotificationService.broadcastViralMoment({
        type: 'CROSS_SERVER_VIRAL',
        userId: game.creatorId,
        gameId: game.id,
        metadata: {
          gameTitle: game.title,
          serverCount,
          milestone: {
            count: serverCount,
            reward: EARNING_RULES.CROSS_SERVER.reward,
            totalPlays: game.playCount
          }
        },
        magnitude: 'major' as const,
        timestamp: new Date()
      });
    }
    
    // Additional servers (every 10 after threshold)
    else if (serverCount > EARNING_RULES.CROSS_SERVER.threshold && 
             serverCount % 10 === 0 &&
             serverCount <= EARNING_RULES.CROSS_SERVER.maxServers) {
      await this.earnCredits(
        game.creatorId,
        EARNING_RULES.CROSS_SERVER.additionalPerServer * 10,
        EarningReason.CROSS_SERVER,
        { gameId: game.id, serverCount }
      );
      
      // Trigger cross-server expansion notification
      const magnitude = serverCount >= 50 ? 'legendary' : serverCount >= 25 ? 'major' : 'minor';
      await this.viralNotificationService.broadcastViralMoment({
        type: 'CROSS_SERVER_VIRAL',
        userId: game.creatorId,
        gameId: game.id,
        metadata: {
          gameTitle: game.title,
          serverCount,
          milestone: {
            count: serverCount,
            reward: EARNING_RULES.CROSS_SERVER.additionalPerServer * 10,
            totalPlays: game.playCount
          }
        },
        magnitude,
        timestamp: new Date()
      });
    }
  }

  /**
   * Process server referral
   */
  async processServerReferral(
    referringServerDiscordId: string,
    referredServerDiscordId: string,
    referralCode: string,
    action: 'install' | 'subscribe',
    tier?: string
  ): Promise<void> {
    // Get server IDs from Discord IDs
    const referringServer = await this.db.prisma.server.findUnique({
      where: { discordId: referringServerDiscordId }
    });
    
    const referredServer = await this.db.prisma.server.findUnique({
      where: { discordId: referredServerDiscordId }
    });

    if (!referringServer || !referredServer) {
      console.error('Server not found for referral processing');
      return;
    }

    if (action === 'install') {
      // Check if server already referred
      const existing = await this.db.prisma.serverReferral.findUnique({
        where: { referredServerId: referredServer.id }
      });

      if (!existing) {
        // Create referral record
        await this.db.prisma.serverReferral.create({
          data: {
            referringServerId: referringServer.id,
            referredServerId: referredServer.id,
            referralCode,
            installedAt: new Date()
          }
        });

        // Award install bonus to the server owner
        const serverOwner = await this.db.prisma.server.findUnique({
          where: { id: referringServer.id },
          include: { subscription: true }
        });

        if (serverOwner?.subscription?.managerId) {
          await this.earnCredits(
            serverOwner.subscription.managerId,
            EARNING_RULES.SERVER_REFERRAL.install,
            EarningReason.SERVER_REFERRAL,
            { serverId: referredServerDiscordId, action: 'install' }
          );
        }
      }
    } else if (action === 'subscribe' && tier) {
      // Update referral with subscription
      const referral = await this.db.prisma.serverReferral.findUnique({
        where: { referredServerId: referredServer.id },
        include: { referringServer: { include: { subscription: true } } }
      });

      if (referral && !referral.subscribedAt) {
        await this.db.prisma.serverReferral.update({
          where: { id: referral.id },
          data: {
            subscribedAt: new Date(),
            subscriptionTier: tier as any
          }
        });

        // Award subscription bonus to the referring server's owner
        const reward = EARNING_RULES.SERVER_REFERRAL.subscribe[tier as keyof typeof EARNING_RULES.SERVER_REFERRAL.subscribe] || 0;
        if (reward > 0 && referral.referringServer.subscription?.managerId) {
          await this.earnCredits(
            referral.referringServer.subscription.managerId,
            reward,
            EarningReason.SERVER_SUBSCRIPTION,
            { serverId: referredServerDiscordId, tier }
          );
        }
      }
    }
  }

  /**
   * Calculate monthly commission for server referrals
   */
  async processMonthlyCommissions(): Promise<void> {
    // Get all active server referrals with subscriptions
    const referrals = await this.db.prisma.serverReferral.findMany({
      where: {
        subscribedAt: { not: null },
        subscriptionTier: { not: null }
      },
      include: {
        referringServer: {
          include: {
            subscription: true
          }
        },
        referredServer: true
      }
    });

    for (const referral of referrals) {
      // Calculate commission based on tier
      const tierPrices = {
        STARTER: 999, // $9.99 in cents
        PRO: 2999,
        ENTERPRISE: 9999
      };

      const price = tierPrices[referral.subscriptionTier as keyof typeof tierPrices] || 0;
      const commissionRate = 0.10; // 10% commission
      const commission = Math.floor(price * commissionRate);
      
      // Convert cents to credits (1 credit = 1 cent)
      if (commission > 0 && referral.referringServer.subscription?.managerId) {
        await this.earnCredits(
          referral.referringServer.subscription.managerId,
          commission,
          EarningReason.BONUS,
          { 
            serverId: referral.referredServer.discordId,
            type: 'monthly_commission',
            tier: referral.subscriptionTier
          }
        );
      }
    }
  }

  /**
   * Check and apply tier upgrades
   */
  private async checkTierUpgrade(
    userId: string, 
    totalEarned: number
  ): Promise<{ upgraded: boolean; newTier?: CreatorTier }> {
    const currentTier = await this.db.prisma.userPersonalCredits.findUnique({
      where: { userId },
      select: { creatorTier: true }
    });

    if (!currentTier) return { upgraded: false };

    // Find appropriate tier
    let newTier: CreatorTier = CreatorTier.BRONZE;
    for (const [tier, config] of Object.entries(CREATOR_TIERS)) {
      if (totalEarned >= config.threshold) {
        newTier = tier as CreatorTier;
      }
    }

    // Check if upgrade needed
    if (newTier !== currentTier.tier && this.isTierHigher(newTier, currentTier.tier)) {
      await this.db.prisma.userPersonalCredits.update({
        where: { userId },
        data: {
          tier: newTier,
          tierUpgradedAt: new Date()
        }
      });

      // Award tier bonus
      const bonusCredits = {
        SILVER: 100,
        GOLD: 500,
        DIAMOND: 2000
      };

      if (bonusCredits[newTier as keyof typeof bonusCredits]) {
        await this.earnCredits(
          userId,
          bonusCredits[newTier as keyof typeof bonusCredits],
          EarningReason.TIER_UPGRADE,
          { previousTier: currentTier.tier, newTier }
        );
      }

      // Check tier achievements
      const tierMap = {
        SILVER: 1,
        GOLD: 2,
        DIAMOND: 3
      };
      
      if (tierMap[newTier as keyof typeof tierMap]) {
        const user = await this.db.prisma.user.findUnique({
          where: { id: userId }
        });
        
        if (user) {
          await this.achievementService.checkProgress(
            user.discordId,
            'creator_tier',
            tierMap[newTier as keyof typeof tierMap],
            { newTier, previousTier: currentTier.tier }
          );
        }
      }

      // Trigger viral notification for tier upgrade
      await this.viralNotificationService.triggerCreatorTierUpgrade(
        userId,
        currentTier.tier,
        newTier,
        totalEarned
      );

      return { upgraded: true, newTier };
    }

    return { upgraded: false };
  }

  /**
   * Helper methods
   */
  private calculateTierProgress(totalEarned: number, currentTier: CreatorTier) {
    const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'];
    const currentIndex = tierOrder.indexOf(currentTier);
    
    if (currentIndex === tierOrder.length - 1) {
      return {
        currentTier,
        nextTier: null,
        progress: totalEarned,
        required: CREATOR_TIERS[currentTier].threshold
      };
    }

    const nextTier = tierOrder[currentIndex + 1] as CreatorTier;
    const currentThreshold = CREATOR_TIERS[currentTier].threshold;
    const nextThreshold = CREATOR_TIERS[nextTier].threshold;

    return {
      currentTier,
      nextTier,
      progress: totalEarned - currentThreshold,
      required: nextThreshold - currentThreshold
    };
  }

  private isTierHigher(tier1: CreatorTier, tier2: CreatorTier): boolean {
    const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'];
    return tierOrder.indexOf(tier1) > tierOrder.indexOf(tier2);
  }

  private async applyCaps(userId: string, amount: number, reason: EarningReason): Promise<number> {
    // Only GAME_PLAYS has daily caps currently
    if (reason !== EarningReason.GAME_PLAYS) {
      return amount;
    }

    const today = new Date().toISOString().split('T')[0];
    const capKey = `daily_cap:${userId}:${reason}:${today}`;
    
    const currentDaily = parseInt(await this.cache.get(capKey) || '0');
    const remaining = EARNING_RULES.GAME_PLAYS.dailyCap - currentDaily;
    
    if (remaining <= 0) {
      return 0;
    }

    const allowed = Math.min(amount, remaining);
    await this.cache.set(capKey, (currentDaily + allowed).toString(), 86400); // 24 hour TTL

    return allowed;
  }

  private async createViralMoment(game: any, plays: number): Promise<void> {
    await this.db.prisma.viralEvent.create({
      data: {
        type: 'VIRAL_MOMENT',
        userId: game.creatorId,
        gameId: game.id,
        metadata: {
          gameTitle: game.title,
          plays,
          achievement: `${plays.toLocaleString()} plays reached!`
        },
        viralScore: Math.floor(Math.log10(plays) * 100)
      }
    });
  }

  private async notifyEarning(
    userId: string, 
    amount: number, 
    reason: EarningReason,
    tierResult: { upgraded: boolean; newTier?: CreatorTier }
  ): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      
      let message = `🎉 You earned **${amount} credits**`;
      
      const reasonMessages = {
        GAME_PLAYS: 'from game plays',
        VIRAL_GAME: 'for reaching a viral milestone',
        CROSS_SERVER: 'for cross-server reach',
        SERVER_REFERRAL: 'for referring a new server',
        SERVER_SUBSCRIPTION: 'for a server subscription',
        ENGAGEMENT_BOOST: 'for boosting server engagement',
        CHALLENGE_WON: 'for winning a challenge',
        ACHIEVEMENT: 'for unlocking an achievement',
        TIER_UPGRADE: 'as a tier upgrade bonus',
        BONUS: 'as a special bonus'
      };

      message += ` ${reasonMessages[reason] || ''}!`;

      if (tierResult.upgraded && tierResult.newTier) {
        message += `\n\n🎊 **Congratulations!** You've been promoted to **${tierResult.newTier} Creator Tier**!`;
      }

      await user.send(message);
    } catch (error) {
      console.error('Failed to send earning notification:', error);
    }
  }

  /**
   * Track content share for analytics
   */
  async trackContentShare(gameId: string, serverId: string, sharerId: string): Promise<void> {
    try {
      // Update share analytics in game metadata
      const game = await this.db.prisma.game.findUnique({
        where: { id: gameId }
      });

      if (!game) return;

      // Track unique servers where the game was shared
      const metadata = game.metadata as any || {};
      const sharedServers = metadata.sharedServers || [];
      
      if (!sharedServers.includes(serverId)) {
        sharedServers.push(serverId);
        
        await this.db.prisma.game.update({
          where: { id: gameId },
          data: {
            metadata: {
              ...metadata,
              sharedServers,
              uniqueServerReach: sharedServers.length
            }
          }
        });

        // Check if game creator should earn credits for cross-server reach
        const serverReachMilestones = [5, 10, 25, 50, 100];
        const currentReach = sharedServers.length;
        
        for (const milestone of serverReachMilestones) {
          if (currentReach === milestone) {
            // Award creator credits for cross-server milestone
            await this.earnCredits(
              game.creatorId,
              milestone * 5, // 5 credits per server in milestone
              EarningReason.CROSS_SERVER,
              { 
                gameId: game.id, 
                milestone, 
                serverCount: currentReach 
              }
            );
            break;
          }
        }
      }

      // Track share event in metadata
      const shareMetadata = metadata.shares || [];
      shareMetadata.push({
        serverId,
        sharerId,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 100 shares to avoid unbounded growth
      if (shareMetadata.length > 100) {
        shareMetadata.splice(0, shareMetadata.length - 100);
      }
      
      await this.db.prisma.game.update({
        where: { id: gameId },
        data: {
          metadata: {
            ...metadata,
            shares: shareMetadata
          }
        }
      });

    } catch (error) {
      console.error('Error tracking content share:', error);
    }
  }

  /**
   * Apply ambassador bonus multiplier if user is an active ambassador
   */
  private async applyAmbassadorBonus(
    userId: string, 
    amount: number, 
    serverId?: string
  ): Promise<number> {
    if (!serverId) return amount;

    try {
      const ambassador = await this.ambassadorService.getUserAmbassadorStatus(serverId, userId);
      
      if (ambassador && ambassador.status === 'ACTIVE') {
        const bonusAmount = Math.floor(amount * ambassador.creditMultiplier);
        
        // Log ambassador bonus for transparency
        await this.analytics.trackEvent('ambassador_credit_bonus_applied', {
          userId,
          serverId,
          originalAmount: amount,
          bonusAmount,
          multiplier: ambassador.creditMultiplier,
          ambassadorRank: ambassador.rank
        });

        return bonusAmount;
      }
    } catch (error) {
      console.error('Error applying ambassador bonus:', error);
      // Return original amount if ambassador check fails
    }

    return amount;
  }
}