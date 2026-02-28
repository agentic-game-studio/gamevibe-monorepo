import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
// Remove circular dependency - credits are managed externally
import { AnalyticsService } from './analytics.js';
import { DiscordAPIError, EmbedBuilder } from 'discord.js';
import { 
  ServerAmbassador, 
  AmbassadorStatus, 
  AmbassadorRank, 
  AmbassadorActivity,
  ActivityType,
  AmbassadorReward,
  RewardType 
} from '../generated/prisma/index.js';

export interface AmbassadorStats {
  totalAmbassadors: number;
  activeAmbassadors: number;
  totalActivities: number;
  totalContributions: number;
  topAmbassadors: AmbassadorWithDetails[];
  monthlyActivities: number;
  averageRank: number;
}

export interface AmbassadorWithDetails extends ServerAmbassador {
  user: any;
  server: any;
  appointedBy: any;
  activities: AmbassadorActivity[];
  rewards: AmbassadorReward[];
}

export interface AppointAmbassadorRequest {
  serverId: string;
  userId: string;
  appointedById: string;
  notes?: string;
  specialPermissions?: string[];
  creditMultiplier?: number;
  maxPersonalCredits?: number;
}

export interface AmbassadorActivityRequest {
  ambassadorId: string;
  serverId: string;
  type: ActivityType;
  title: string;
  description?: string;
  points?: number;
  metadata?: any;
  relatedGameId?: string;
  relatedUserId?: string;
  relatedChallengeId?: string;
}

@injectable()
export class AmbassadorService {
  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.DiscordClient) private discord: any
  ) {}

  /**
   * Appoint a user as server ambassador
   */
  async appointAmbassador(request: AppointAmbassadorRequest): Promise<ServerAmbassador> {
    // Validate user and server exist
    const [user, server] = await Promise.all([
      this.db.prisma.user.findUnique({ where: { discordId: request.userId } }),
      this.db.prisma.server.findUnique({ where: { discordId: request.serverId } })
    ]);

    if (!user) throw new Error('User not found');
    if (!server) throw new Error('Server not found');

    // Check if user is already an ambassador for this server
    const existingAmbassador = await this.db.prisma.serverAmbassador.findUnique({
      where: {
        serverId_userId: {
          serverId: server.id,
          userId: user.id
        }
      }
    });

    if (existingAmbassador) {
      throw new Error('User is already an ambassador for this server');
    }

    // Create ambassador record
    const ambassador = await this.db.prisma.serverAmbassador.create({
      data: {
        serverId: server.id,
        userId: user.id,
        appointedById: request.appointedById,
        notes: request.notes,
        specialPermissions: request.specialPermissions || [],
        creditMultiplier: request.creditMultiplier || 1.5,
        maxPersonalCredits: request.maxPersonalCredits || 2000
      },
      include: {
        user: true,
        server: true,
        appointedBy: true
      }
    });

    // Track analytics
    await this.analytics.track('ambassador_appointed', {
      ambassadorId: ambassador.id,
      serverId: request.serverId,
      userId: request.userId,
      appointedById: request.appointedById
    });

    // Send notification to new ambassador
    await this.sendAmbassadorNotification(ambassador, 'appointed');

    // Clear cache
    await this.clearAmbassadorCache(server.id, user.id);

    return ambassador;
  }

  /**
   * Remove an ambassador
   */
  async removeAmbassador(
    serverId: string, 
    userId: string, 
    removedById: string,
    reason?: string
  ): Promise<void> {
    const [user, server] = await Promise.all([
      this.db.prisma.user.findUnique({ where: { discordId: userId } }),
      this.db.prisma.server.findUnique({ where: { discordId: serverId } })
    ]);

    if (!user || !server) {
      throw new Error('User or server not found');
    }

    // Update ambassador status to retired
    const ambassador = await this.db.prisma.serverAmbassador.update({
      where: {
        serverId_userId: {
          serverId: server.id,
          userId: user.id
        }
      },
      data: {
        status: AmbassadorStatus.RETIRED,
        notes: reason ? `Removed: ${reason}` : 'Removed by admin'
      },
      include: {
        user: true,
        server: true
      }
    });

    // Track analytics
    await this.analytics.track('ambassador_removed', {
      ambassadorId: ambassador.id,
      serverId,
      userId,
      removedById,
      reason
    });

    // Send notification
    await this.sendAmbassadorNotification(ambassador, 'removed', { reason });

    // Clear cache
    await this.clearAmbassadorCache(server.id, user.id);
  }

  /**
   * Record ambassador activity
   */
  async recordActivity(request: AmbassadorActivityRequest): Promise<AmbassadorActivity> {
    // Validate ambassador exists and is active
    const ambassador = await this.db.prisma.serverAmbassador.findUnique({
      where: { id: request.ambassadorId },
      include: { user: true, server: true }
    });

    if (!ambassador) {
      throw new Error('Ambassador not found');
    }

    if (ambassador.status !== AmbassadorStatus.ACTIVE) {
      throw new Error('Ambassador is not active');
    }

    // Calculate points based on activity type
    const points = request.points || this.getActivityPoints(request.type);

    // Create activity record
    const activity = await this.db.prisma.ambassadorActivity.create({
      data: {
        ambassadorId: request.ambassadorId,
        serverId: ambassador.serverId,
        type: request.type,
        title: request.title,
        description: request.description,
        points,
        metadata: request.metadata || {},
        relatedGameId: request.relatedGameId,
        relatedUserId: request.relatedUserId,
        relatedChallengeId: request.relatedChallengeId,
        isVerified: true // Auto-verify system activities
      }
    });

    // Update ambassador contributions
    await this.db.prisma.serverAmbassador.update({
      where: { id: request.ambassadorId },
      data: {
        totalContributions: { increment: points },
        monthlyContributions: { increment: points },
        lastActiveAt: new Date()
      }
    });

    // Check for rank advancement
    await this.checkRankAdvancement(request.ambassadorId);

    // Award personal credits for high-value activities
    if (points >= 50) {
      const bonusCredits = Math.floor(points / 10);
      // TODO: Credits managed externally to avoid circular dependency
      // await this.personalCreditService.addCredits(...)
    }

    // Track analytics
    await this.analytics.track('ambassador_activity_recorded', {
      ambassadorId: request.ambassadorId,
      activityType: request.type,
      points,
      serverId: request.serverId
    });

    // Clear cache
    await this.clearAmbassadorCache(ambassador.serverId, ambassador.userId);

    return activity;
  }

  /**
   * Get ambassador statistics for a server
   */
  async getServerAmbassadorStats(serverId: string): Promise<AmbassadorStats> {
    const cacheKey = `ambassador_stats:${serverId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const server = await this.db.prisma.server.findUnique({
      where: { discordId: serverId }
    });

    if (!server) {
      throw new Error('Server not found');
    }

    // Get ambassador counts
    const [totalAmbassadors, activeAmbassadors] = await Promise.all([
      this.db.prisma.serverAmbassador.count({
        where: { serverId: server.id }
      }),
      this.db.prisma.serverAmbassador.count({
        where: { 
          serverId: server.id,
          status: AmbassadorStatus.ACTIVE
        }
      })
    ]);

    // Get activity stats
    const [totalActivities, monthlyActivities] = await Promise.all([
      this.db.prisma.ambassadorActivity.count({
        where: { serverId: server.id }
      }),
      this.db.prisma.ambassadorActivity.count({
        where: {
          serverId: server.id,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    // Get total contributions
    const contributionStats = await this.db.prisma.serverAmbassador.aggregate({
      where: { serverId: server.id },
      _sum: { totalContributions: true },
      _avg: { rank: true }
    });

    // Get top ambassadors
    const topAmbassadors = await this.db.prisma.serverAmbassador.findMany({
      where: { 
        serverId: server.id,
        status: AmbassadorStatus.ACTIVE
      },
      include: {
        user: { select: { discordId: true, username: true } },
        server: { select: { discordId: true, name: true } },
        appointedBy: { select: { discordId: true, username: true } },
        activities: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
        rewards: {
          take: 3,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { totalContributions: 'desc' },
      take: 10
    }) as AmbassadorWithDetails[];

    const stats: AmbassadorStats = {
      totalAmbassadors,
      activeAmbassadors,
      totalActivities,
      totalContributions: contributionStats._sum.totalContributions || 0,
      topAmbassadors,
      monthlyActivities,
      averageRank: this.rankToNumber(contributionStats._avg.rank as any) || 1
    };

    // Cache for 10 minutes
    await this.cache.set(cacheKey, JSON.stringify(stats), 600);

    return stats;
  }

  /**
   * Get user's ambassador status for a server
   */
  async getUserAmbassadorStatus(serverId: string, userId: string): Promise<AmbassadorWithDetails | null> {
    const [user, server] = await Promise.all([
      this.db.prisma.user.findUnique({ where: { discordId: userId } }),
      this.db.prisma.server.findUnique({ where: { discordId: serverId } })
    ]);

    if (!user || !server) return null;

    const ambassador = await this.db.prisma.serverAmbassador.findUnique({
      where: {
        serverId_userId: {
          serverId: server.id,
          userId: user.id
        }
      },
      include: {
        user: { select: { discordId: true, username: true } },
        server: { select: { discordId: true, name: true } },
        appointedBy: { select: { discordId: true, username: true } },
        activities: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        rewards: {
          orderBy: { createdAt: 'desc' }
        }
      }
    }) as AmbassadorWithDetails;

    return ambassador;
  }

  /**
   * Process monthly ambassador rewards
   */
  async processMonthlyRewards(serverId: string): Promise<AmbassadorReward[]> {
    const server = await this.db.prisma.server.findUnique({
      where: { discordId: serverId }
    });

    if (!server) throw new Error('Server not found');

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    // Get active ambassadors with monthly contributions
    const ambassadors = await this.db.prisma.serverAmbassador.findMany({
      where: {
        serverId: server.id,
        status: AmbassadorStatus.ACTIVE,
        monthlyContributions: { gt: 0 }
      },
      include: { user: true },
      orderBy: { monthlyContributions: 'desc' }
    });

    const rewards: AmbassadorReward[] = [];

    for (const ambassador of ambassadors) {
      // Calculate reward based on contributions
      const baseReward = Math.floor(ambassador.monthlyContributions / 10);
      const bonusReward = ambassador.rank === AmbassadorRank.MASTER ? 50 : 
                         ambassador.rank === AmbassadorRank.SENIOR ? 30 : 
                         ambassador.rank === AmbassadorRank.AMBASSADOR ? 20 : 10;

      const totalCredits = baseReward + bonusReward;

      // Create reward record
      const reward = await this.db.prisma.ambassadorReward.create({
        data: {
          ambassadorId: ambassador.id,
          serverId: ambassador.serverId,
          type: RewardType.MONTHLY_BONUS,
          title: `Monthly Ambassador Bonus - ${currentMonth}`,
          description: `Performance bonus for ${ambassador.monthlyContributions} contribution points`,
          personalCredits: totalCredits,
          period: currentMonth,
          contributionPoints: ambassador.monthlyContributions,
          isAwarded: true,
          awardedAt: new Date()
        }
      });

      // TODO: Credits managed externally to avoid circular dependency
      // await this.personalCreditService.addCredits(...)

      rewards.push(reward);
    }

    // Reset monthly contributions for all ambassadors
    await this.db.prisma.serverAmbassador.updateMany({
      where: { serverId: server.id },
      data: { monthlyContributions: 0 }
    });

    // Track analytics
    await this.analytics.track('ambassador_monthly_rewards_processed', {
      serverId,
      rewardsCount: rewards.length,
      totalCreditsAwarded: rewards.reduce((sum, r) => sum + r.personalCredits, 0),
      period: currentMonth
    });

    return rewards;
  }

  /**
   * Check and handle rank advancement
   */
  private async checkRankAdvancement(ambassadorId: string): Promise<void> {
    const ambassador = await this.db.prisma.serverAmbassador.findUnique({
      where: { id: ambassadorId },
      include: { user: true }
    });

    if (!ambassador) return;

    let newRank: AmbassadorRank | null = null;
    const contributions = ambassador.totalContributions;

    // Determine new rank based on contributions
    if (contributions >= 2000 && ambassador.rank !== AmbassadorRank.MASTER) {
      newRank = AmbassadorRank.MASTER;
    } else if (contributions >= 1000 && ambassador.rank === AmbassadorRank.AMBASSADOR) {
      newRank = AmbassadorRank.SENIOR;
    } else if (contributions >= 500 && ambassador.rank === AmbassadorRank.APPRENTICE) {
      newRank = AmbassadorRank.AMBASSADOR;
    }

    if (newRank) {
      // Update rank
      await this.db.prisma.serverAmbassador.update({
        where: { id: ambassadorId },
        data: { rank: newRank }
      });

      // Create rank promotion reward
      const rankReward = this.getRankReward(newRank);
      const reward = await this.db.prisma.ambassadorReward.create({
        data: {
          ambassadorId,
          serverId: ambassador.serverId,
          type: RewardType.RANK_PROMOTION,
          title: `Promoted to ${newRank}`,
          description: `Congratulations on reaching ${newRank} rank!`,
          personalCredits: rankReward,
          rankAchieved: newRank,
          isAwarded: true,
          awardedAt: new Date()
        }
      });

      // TODO: Credits managed externally to avoid circular dependency
      // await this.personalCreditService.addCredits(...)

      // Send promotion notification
      await this.sendRankPromotionNotification(ambassador, newRank);
    }
  }

  /**
   * Get activity points based on type
   */
  private getActivityPoints(type: ActivityType): number {
    const pointsMap = {
      [ActivityType.GAME_CREATED]: 25,
      [ActivityType.PLAYER_RECRUITED]: 15,
      [ActivityType.CHALLENGE_HOSTED]: 20,
      [ActivityType.COMMUNITY_EVENT]: 50,
      [ActivityType.FEEDBACK_PROVIDED]: 10,
      [ActivityType.BUG_REPORTED]: 30,
      [ActivityType.TUTORIAL_CREATED]: 40,
      [ActivityType.MENTORED_USER]: 35,
      [ActivityType.VIRAL_CONTENT]: 60,
      [ActivityType.SERVER_GROWTH]: 45
    };

    return pointsMap[type] || 10;
  }

  /**
   * Get rank reward credits
   */
  private getRankReward(rank: AmbassadorRank): number {
    const rewards = {
      [AmbassadorRank.APPRENTICE]: 0,
      [AmbassadorRank.AMBASSADOR]: 100,
      [AmbassadorRank.SENIOR]: 250,
      [AmbassadorRank.MASTER]: 500
    };

    return rewards[rank] || 0;
  }

  /**
   * Convert rank enum to number for averaging
   */
  private rankToNumber(rank: AmbassadorRank): number {
    const rankValues = {
      [AmbassadorRank.APPRENTICE]: 1,
      [AmbassadorRank.AMBASSADOR]: 2,
      [AmbassadorRank.SENIOR]: 3,
      [AmbassadorRank.MASTER]: 4
    };

    return rankValues[rank] || 1;
  }

  /**
   * Send ambassador notification
   */
  private async sendAmbassadorNotification(
    ambassador: any, 
    type: 'appointed' | 'removed' | 'promoted',
    details?: any
  ): Promise<void> {
    try {
      const user = await this.discord.users.fetch(ambassador.user.discordId);
      let embed: EmbedBuilder;

      switch (type) {
        case 'appointed':
          embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🎖️ Ambassador Appointment')
            .setDescription(`Congratulations! You have been appointed as a server ambassador for **${ambassador.server.name}**!`)
            .addFields(
              { name: '🏆 Rank', value: ambassador.rank, inline: true },
              { name: '💎 Credit Multiplier', value: `${ambassador.creditMultiplier}x`, inline: true },
              { name: '📈 Max Credits', value: `${ambassador.maxPersonalCredits}`, inline: true }
            )
            .setTimestamp();
          break;

        case 'removed':
          embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🎖️ Ambassador Status Removed')
            .setDescription(`Your ambassador status for **${ambassador.server.name}** has been removed.`)
            .addFields(
              { name: 'Reason', value: details?.reason || 'Administrative decision', inline: false }
            )
            .setTimestamp();
          break;

        case 'promoted':
          embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🎖️ Ambassador Promotion!')
            .setDescription(`Congratulations! You have been promoted to **${details.newRank}** rank!`)
            .addFields(
              { name: '🏆 New Rank', value: details.newRank, inline: true },
              { name: '💰 Bonus Reward', value: `${this.getRankReward(details.newRank)} credits`, inline: true }
            )
            .setTimestamp();
          break;
      }

      await user.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send ambassador notification:', error);
    }
  }

  /**
   * Send rank promotion notification
   */
  private async sendRankPromotionNotification(ambassador: any, newRank: AmbassadorRank): Promise<void> {
    await this.sendAmbassadorNotification(ambassador, 'promoted', { newRank });
  }

  /**
   * Clear ambassador cache
   */
  private async clearAmbassadorCache(serverId: string, userId: string): Promise<void> {
    await Promise.all([
      this.cache.del(`ambassador_stats:${serverId}`),
      this.cache.del(`ambassador_status:${serverId}:${userId}`)
    ]);
  }
}