import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { PersonalCreditService } from './personal-credits.js';
import { AnalyticsService } from './analytics.js';
import { AchievementService } from './achievement.js';
import { ViralMetricsService } from './viral-metrics.js';

export interface ReferralStats {
  totalReferrals: number;
  subscribedReferrals: number;
  totalEarnings: number;
  conversionRate: number;
  monthlyCommission: number;
  nextMilestone: {
    count: number;
    reward: number;
  } | null;
  recentReferrals: Array<{
    serverName: string;
    installedAt: Date;
    subscribedAt?: Date;
    tier?: string;
  }>;
}

export interface ReferralMilestone {
  count: number;
  reward: number;
  achieved: boolean;
}

@injectable()
export class ServerReferralService {
  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.PersonalCreditService) private personalCreditService: PersonalCreditService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.AchievementService) private achievementService: AchievementService,
    @inject(TYPES.ViralMetricsService) private viralMetricsService: ViralMetricsService
  ) {}

  /**
   * Generate or retrieve referral code for a server
   */
  async getOrCreateReferralCode(serverDiscordId: string): Promise<string> {
    const server = await this.db.prisma.server.findUnique({
      where: { discordId: serverDiscordId }
    });

    if (!server) {
      throw new Error('Server not found');
    }

    if (server.referralCode) {
      return server.referralCode;
    }

    // Generate new referral code
    let referralCode: string;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      referralCode = this.generateReferralCode();
      
      const existing = await this.db.prisma.server.findUnique({
        where: { referralCode }
      });

      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new Error('Failed to generate unique referral code');
    }

    // Update server with referral code
    await this.db.prisma.server.update({
      where: { id: server.id },
      data: { referralCode: referralCode! }
    });

    return referralCode!;
  }

  /**
   * Process server installation via referral
   */
  async processInstallReferral(
    referralCode: string,
    newServerDiscordId: string
  ): Promise<boolean> {
    try {
      const referringServer = await this.db.prisma.server.findUnique({
        where: { referralCode },
        include: { 
          subscription: {
            include: {
              managers: true
            }
          }
        }
      });

      if (!referringServer) {
        console.log(`Referral code ${referralCode} not found`);
        return false;
      }

      const newServer = await this.db.prisma.server.findUnique({
        where: { discordId: newServerDiscordId }
      });

      if (!newServer) {
        console.log(`New server ${newServerDiscordId} not found`);
        return false;
      }

      // Check if already referred
      const existing = await this.db.prisma.serverReferral.findUnique({
        where: { referredServerId: newServer.id }
      });

      if (existing) {
        console.log(`Server ${newServerDiscordId} already referred`);
        return false;
      }

      // Create referral record
      await this.db.prisma.serverReferral.create({
        data: {
          referringServerId: referringServer.id,
          referredServerId: newServer.id,
          referralCode,
          installedAt: new Date()
        }
      });

      // Process install reward
      await this.personalCreditService.processServerReferral(
        referringServer.discordId,
        newServerDiscordId,
        referralCode,
        'install'
      );

      // Track viral event for metrics
      await this.viralMetricsService.trackViralEvent(
        'SERVER_INVITE',
        referringServer.discordId,
        newServerDiscordId,
        { referralCode, action: 'install' }
      );

      // Check referral milestones
      await this.checkReferralMilestones(referringServer.discordId);

      // Track analytics
      await this.analytics.track('server_referral_install', {
        referringServerId: referringServer.discordId,
        referredServerId: newServerDiscordId,
        referralCode
      });

      console.log(`✅ Processed install referral: ${referringServer.name} → ${newServer.name}`);
      return true;

    } catch (error) {
      console.error('Error processing install referral:', error);
      return false;
    }
  }

  /**
   * Process subscription via referral
   */
  async processSubscriptionReferral(
    referredServerDiscordId: string,
    tier: string
  ): Promise<void> {
    const referredServer = await this.db.prisma.server.findUnique({
      where: { discordId: referredServerDiscordId }
    });

    if (!referredServer) return;

    const referral = await this.db.prisma.serverReferral.findUnique({
      where: { referredServerId: referredServer.id },
      include: { referringServer: true }
    });

    if (referral && !referral.subscribedAt) {
      // Update referral with subscription info
      await this.db.prisma.serverReferral.update({
        where: { id: referral.id },
        data: {
          subscribedAt: new Date(),
          subscriptionTier: tier as any
        }
      });

      // Process subscription reward
      await this.personalCreditService.processServerReferral(
        referral.referringServer.discordId,
        referredServerDiscordId,
        referral.referralCode,
        'subscribe',
        tier
      );

      // Track viral event
      await this.viralMetricsService.trackViralEvent(
        'SERVER_INVITE',
        referral.referringServer.discordId,
        referredServerDiscordId,
        { referralCode: referral.referralCode, action: 'subscribe', tier }
      );

      // Check subscription milestones
      await this.checkSubscriptionMilestones(referral.referringServer.discordId);

      // Track analytics
      await this.analytics.track('server_referral_subscription', {
        referringServerId: referral.referringServer.discordId,
        referredServerId: referredServerDiscordId,
        referralCode: referral.referralCode,
        tier
      });
    }
  }

  /**
   * Get comprehensive referral statistics for a server
   */
  async getReferralStats(serverDiscordId: string): Promise<ReferralStats> {
    const cacheKey = `referral_stats:${serverDiscordId}`;
    const cached = await this.cache.get<string>(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const server = await this.db.prisma.server.findUnique({
      where: { discordId: serverDiscordId },
      include: {
        referredServers: {
          include: {
            referredServer: true
          },
          orderBy: { installedAt: 'desc' }
        }
      }
    });

    if (!server) {
      throw new Error('Server not found');
    }

    const referrals = server.referredServers || [];
    const totalReferrals = referrals.length;
    const subscribedReferrals = referrals.filter(r => r.subscribedAt).length;
    const conversionRate = totalReferrals > 0 ? (subscribedReferrals / totalReferrals) * 100 : 0;

    // Calculate total earnings
    const totalEarnings = referrals.reduce((sum, ref) => {
      let earnings = 100; // Base install reward
      if (ref.subscribedAt && ref.subscriptionTier) {
        const tierRewards = {
          STARTER: 500,
          PRO: 1000,
          ENTERPRISE: 2500
        };
        earnings += tierRewards[ref.subscriptionTier as keyof typeof tierRewards] || 0;
      }
      return sum + earnings;
    }, 0);

    // Calculate monthly commission (10% of subscription values)
    const monthlyCommission = subscribedReferrals * 100; // Simplified calculation

    // Get next milestone
    const nextMilestone = this.getNextMilestone(totalReferrals);

    // Format recent referrals
    const recentReferrals = referrals.slice(0, 10).map(ref => ({
      serverName: ref.referredServer.name,
      installedAt: ref.installedAt,
      subscribedAt: ref.subscribedAt || undefined,
      tier: ref.subscriptionTier || undefined
    }));

    const stats: ReferralStats = {
      totalReferrals,
      subscribedReferrals,
      totalEarnings,
      conversionRate,
      monthlyCommission,
      nextMilestone,
      recentReferrals
    };

    // Cache for 5 minutes
    await this.cache.set(cacheKey, JSON.stringify(stats), 300);

    return stats;
  }

  /**
   * Get referral milestones for a server
   */
  async getReferralMilestones(serverDiscordId: string): Promise<ReferralMilestone[]> {
    const stats = await this.getReferralStats(serverDiscordId);
    
    const milestones = [
      { count: 5, reward: 250 },
      { count: 10, reward: 500 },
      { count: 25, reward: 1250 },
      { count: 50, reward: 2500 },
      { count: 100, reward: 5000 }
    ];

    return milestones.map(milestone => ({
      ...milestone,
      achieved: stats.totalReferrals >= milestone.count
    }));
  }

  /**
   * Process monthly commissions for all referring servers
   */
  async processMonthlyCommissions(): Promise<number> {
    let processedCount = 0;

    try {
      // Get all servers with active referrals that have subscriptions
      const referrals = await this.db.prisma.serverReferral.findMany({
        where: {
          subscribedAt: { not: null },
          subscriptionTier: { not: null }
        },
        include: {
          referringServer: {
            include: { 
              subscription: {
                include: {
                  managers: true
                }
              }
            }
          }
        }
      });

      for (const referral of referrals) {
        const primaryManager = referral.referringServer.subscription?.managers?.[0];
        if (primaryManager) {
          // Calculate monthly commission (10% of subscription value)
          const tierValues = {
            STARTER: 10, // $9.99 -> ~$1 commission
            PRO: 30,     // $29.99 -> ~$3 commission  
            ENTERPRISE: 100 // $99.99 -> ~$10 commission
          };

          const commission = tierValues[referral.subscriptionTier as keyof typeof tierValues] || 0;

          if (commission > 0) {
            await this.personalCreditService.earnCredits(
              primaryManager.userId,
              commission,
              'SERVER_REFERRAL' as any,
              { 
                type: 'monthly_commission',
                referredServerId: referral.referredServerId,
                tier: referral.subscriptionTier
              }
            );

            processedCount++;
          }
        }
      }

      // Track analytics
      await this.analytics.track('monthly_commissions_processed', {
        processedCount,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Processed ${processedCount} monthly referral commissions`);

    } catch (error) {
      console.error('Error processing monthly commissions:', error);
    }

    return processedCount;
  }

  /**
   * Check and award referral milestones
   */
  private async checkReferralMilestones(serverDiscordId: string): Promise<void> {
    const stats = await this.getReferralStats(serverDiscordId);
    const milestones = await this.getReferralMilestones(serverDiscordId);

    const server = await this.db.prisma.server.findUnique({
      where: { discordId: serverDiscordId },
      include: { 
        subscription: {
          include: {
            managers: true
          }
        }
      }
    });

    const primaryManager = server?.subscription?.managers?.[0];
    if (!primaryManager) return;

    // Check if any milestone was just reached
    const justAchieved = milestones.find(m => 
      m.achieved && m.count === stats.totalReferrals
    );

    if (justAchieved) {
      // Award milestone bonus
      await this.personalCreditService.earnCredits(
        primaryManager.userId,
        justAchieved.reward,
        'BONUS' as any,
        { 
          type: 'referral_milestone',
          milestone: justAchieved.count,
          reward: justAchieved.reward
        }
      );

      // Track achievement
      const user = await this.db.prisma.user.findUnique({
        where: { id: primaryManager.userId }
      });

      if (user) {
        await this.achievementService.checkProgress(
          user.discordId,
          'server_referrals',
          stats.totalReferrals,
          { milestone: justAchieved.count }
        );
      }
    }
  }

  /**
   * Check subscription-based milestones
   */
  private async checkSubscriptionMilestones(serverDiscordId: string): Promise<void> {
    const stats = await this.getReferralStats(serverDiscordId);
    
    const server = await this.db.prisma.server.findUnique({
      where: { discordId: serverDiscordId },
      include: { 
        subscription: {
          include: {
            managers: true
          }
        }
      }
    });

    const primaryManager = server?.subscription?.managers?.[0];
    if (!primaryManager) return;

    // Check subscription milestones (different from install milestones)
    const subscriptionMilestones = [
      { count: 1, reward: 100 },
      { count: 5, reward: 500 },
      { count: 10, reward: 1000 },
      { count: 25, reward: 2500 }
    ];

    const justAchieved = subscriptionMilestones.find(m => 
      m.count === stats.subscribedReferrals
    );

    if (justAchieved) {
      await this.personalCreditService.earnCredits(
        primaryManager.userId,
        justAchieved.reward,
        'BONUS' as any,
        { 
          type: 'subscription_milestone',
          milestone: justAchieved.count,
          reward: justAchieved.reward
        }
      );
    }
  }

  /**
   * Generate a unique referral code
   */
  private generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'SRV-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Get next milestone for referrals
   */
  private getNextMilestone(currentReferrals: number): { count: number; reward: number } | null {
    const milestones = [
      { count: 5, reward: 250 },
      { count: 10, reward: 500 },
      { count: 25, reward: 1250 },
      { count: 50, reward: 2500 },
      { count: 100, reward: 5000 }
    ];

    return milestones.find(m => m.count > currentReferrals) || null;
  }

  /**
   * Store referral code temporarily for OAuth callback
   */
  async storeReferralCodeForCallback(state: string, referralCode: string): Promise<void> {
    const key = `oauth_referral:${state}`;
    await this.cache.set(key, referralCode, 600); // 10 minute TTL
  }

  /**
   * Retrieve and clear referral code from OAuth callback
   */
  async retrieveReferralCodeFromCallback(state: string): Promise<string | null> {
    const key = `oauth_referral:${state}`;
    const referralCode = await this.cache.get<string>(key);
    
    if (referralCode) {
      await this.cache.delete(key);
      return referralCode;
    }
    
    return null;
  }

  /**
   * Get top referring servers (for leaderboards)
   */
  async getTopReferrers(limit: number = 10): Promise<Array<{
    serverName: string;
    serverDiscordId: string;
    totalReferrals: number;
    subscribedReferrals: number;
    conversionRate: number;
    totalEarnings: number;
  }>> {
    const servers = await this.db.prisma.server.findMany({
      where: {
        referralCode: { not: null },
        referredServers: { some: {} }
      },
      include: {
        referredServers: true
      }
    });

    const serverStats = await Promise.all(
      servers.map(async server => {
        const stats = await this.getReferralStats(server.discordId);
        return {
          serverName: server.name,
          serverDiscordId: server.discordId,
          totalReferrals: stats.totalReferrals,
          subscribedReferrals: stats.subscribedReferrals,
          conversionRate: stats.conversionRate,
          totalEarnings: stats.totalEarnings
        };
      })
    );

    return serverStats
      .sort((a, b) => b.totalReferrals - a.totalReferrals)
      .slice(0, limit);
  }
}