import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { AnalyticsService } from './analytics.js';

export interface ViralCoefficient {
  overall: number;
  serverToServer: number;
  userToUser: number;
  contentToUser: number;
  timeframe: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidenceLevel: number; // 0-100%
}

export interface ViralMetrics {
  viralCoefficient: ViralCoefficient;
  growthMetrics: {
    totalServers: number;
    totalUsers: number;
    serverGrowthRate: number; // servers/day
    userGrowthRate: number; // users/day
    retentionRate: number; // % of users still active after 7 days
    averageServerSize: number;
  };
  contentMetrics: {
    totalGames: number;
    gamesSharedToday: number;
    averageServerReach: number; // avg servers per game
    viralGameThreshold: number; // plays needed to be "viral"
    viralGamesCount: number;
    shareConversionRate: number; // % of shares that lead to new users
  };
  engagementMetrics: {
    dailyActiveUsers: number;
    averageGamesPerUser: number;
    averagePlayTimeMinutes: number;
    achievementUnlockRate: number; // achievements per user per day
    challengeParticipationRate: number; // % of users participating in challenges
    ambassadorImpactScore: number; // server growth correlation with ambassador activity
  };
  topPerformers: {
    viralCreators: Array<{
      userId: string;
      username: string;
      viralScore: number;
      totalReach: number;
      gamesCreated: number;
    }>;
    viralServers: Array<{
      serverId: string;
      serverName: string;
      memberCount: number;
      gamesCreated: number;
      crossServerShares: number;
      growthImpact: number;
    }>;
    viralGames: Array<{
      gameId: string;
      name: string;
      creatorUsername: string;
      playCount: number;
      serverReach: number;
      viralCoefficient: number;
    }>;
  };
  predictions: {
    projectedServersNextMonth: number;
    projectedUsersNextMonth: number;
    timeToViralCoefficient1_2: number; // days to reach 1.2+ viral coefficient
    recommendedActions: string[];
  };
}

export interface TimeframeSummary {
  period: '24h' | '7d' | '30d' | '90d';
  startDate: Date;
  endDate: Date;
  metrics: ViralMetrics;
}

@injectable()
export class ViralMetricsService {
  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService
  ) {}

  /**
   * Calculate real-time viral coefficient
   */
  async calculateViralCoefficient(timeframeDays: number = 30): Promise<ViralCoefficient> {
    const cacheKey = `viral_coefficient:${timeframeDays}d`;
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));

    // Calculate server-to-server viral coefficient
    const serverToServer = await this.calculateServerToServerCoefficient(startDate, endDate);
    
    // Calculate user-to-user viral coefficient  
    const userToUser = await this.calculateUserToUserCoefficient(startDate, endDate);
    
    // Calculate content-to-user viral coefficient
    const contentToUser = await this.calculateContentToUserCoefficient(startDate, endDate);

    // Overall viral coefficient (weighted average)
    const overall = (serverToServer * 0.4) + (userToUser * 0.3) + (contentToUser * 0.3);

    // Calculate trend by comparing with previous period
    const previousPeriodStart = new Date(startDate.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));
    const previousCoefficient = await this.calculateViralCoefficient(timeframeDays);
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (overall > previousCoefficient.overall * 1.05) trend = 'increasing';
    else if (overall < previousCoefficient.overall * 0.95) trend = 'decreasing';

    // Confidence level based on data volume
    const totalDataPoints = await this.getDataPointsCount(startDate, endDate);
    const confidenceLevel = Math.min(100, Math.max(20, (totalDataPoints / 100) * 100));

    const result: ViralCoefficient = {
      overall,
      serverToServer,
      userToUser,
      contentToUser,
      timeframe: `${timeframeDays}d`,
      trend,
      confidenceLevel
    };

    // Cache for 1 hour
    await this.cache.set(cacheKey, JSON.stringify(result), 3600);

    return result;
  }

  /**
   * Get comprehensive viral metrics
   */
  async getViralMetrics(timeframeDays: number = 30): Promise<ViralMetrics> {
    const cacheKey = `viral_metrics:${timeframeDays}d`;
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));

    // Calculate all metrics in parallel for performance
    const [
      viralCoefficient,
      growthMetrics,
      contentMetrics,
      engagementMetrics,
      topPerformers,
      predictions
    ] = await Promise.all([
      this.calculateViralCoefficient(timeframeDays),
      this.calculateGrowthMetrics(startDate, endDate),
      this.calculateContentMetrics(startDate, endDate),
      this.calculateEngagementMetrics(startDate, endDate),
      this.getTopPerformers(startDate, endDate),
      this.generatePredictions(startDate, endDate)
    ]);

    const metrics: ViralMetrics = {
      viralCoefficient,
      growthMetrics,
      contentMetrics,
      engagementMetrics,
      topPerformers,
      predictions
    };

    // Cache for 30 minutes
    await this.cache.set(cacheKey, JSON.stringify(metrics), 1800);

    return metrics;
  }

  /**
   * Get viral metrics for multiple timeframes
   */
  async getTimeframeSummaries(): Promise<TimeframeSummary[]> {
    const timeframes = [
      { period: '24h' as const, days: 1 },
      { period: '7d' as const, days: 7 },
      { period: '30d' as const, days: 30 },
      { period: '90d' as const, days: 90 }
    ];

    const summaries = await Promise.all(
      timeframes.map(async ({ period, days }) => {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
        const metrics = await this.getViralMetrics(days);

        return {
          period,
          startDate,
          endDate,
          metrics
        };
      })
    );

    return summaries;
  }

  /**
   * Track viral event for coefficient calculation
   */
  async trackViralEvent(
    type: 'SERVER_INVITE' | 'USER_INVITE' | 'GAME_SHARE' | 'CROSS_SERVER_PLAY',
    sourceId: string,
    targetId: string,
    metadata?: any
  ): Promise<void> {
    try {
      // Record viral event for future coefficient calculations
      await this.db.prisma.viralEvent.create({
        data: {
          type,
          sourceId,
          targetId,
          metadata: metadata || {},
          timestamp: new Date()
        }
      });

      // Track analytics
      await this.analytics.track('viral_event', {
        type,
        sourceId,
        targetId,
        ...metadata
      });

      // Clear relevant caches
      await this.clearViralMetricsCache();

    } catch (error) {
      console.error('Error tracking viral event:', error);
    }
  }

  /**
   * Calculate server-to-server viral coefficient
   */
  private async calculateServerToServerCoefficient(startDate: Date, endDate: Date): Promise<number> {
    // Get all servers that existed at the start of the period
    const existingServers = await this.db.prisma.server.count({
      where: {
        createdAt: { lt: startDate }
      }
    });

    if (existingServers === 0) return 0;

    // Get new servers added during the period via referrals/invites
    const newServersViaViral = await this.db.prisma.serverReferral.count({
      where: {
        installedAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Calculate coefficient: new servers per existing server
    return newServersViaViral / existingServers;
  }

  /**
   * Calculate user-to-user viral coefficient
   */
  private async calculateUserToUserCoefficient(startDate: Date, endDate: Date): Promise<number> {
    // Get all users that existed at the start of the period
    const existingUsers = await this.db.prisma.user.count({
      where: {
        createdAt: { lt: startDate }
      }
    });

    if (existingUsers === 0) return 0;

    // Get new users added during the period
    const newUsers = await this.db.prisma.user.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Calculate coefficient: new users per existing user
    return newUsers / existingUsers;
  }

  /**
   * Calculate content-to-user viral coefficient
   */
  private async calculateContentToUserCoefficient(startDate: Date, endDate: Date): Promise<number> {
    // Get games shared during the period (estimated via viral events)
    const gamesShared = await this.db.prisma.viralEvent.count({
      where: {
        type: 'GAME_SHARE',
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    if (gamesShared === 0) return 0;

    // Get new users who joined after playing shared content
    const newUsersFromShares = await this.db.prisma.user.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        // This would need additional tracking to identify users who came from shared content
        // For now, we'll estimate based on overall growth patterns
      }
    });

    // Estimate: assume 30% of new users come from shared content
    const estimatedFromShares = Math.floor(newUsersFromShares * 0.3);

    return estimatedFromShares / gamesShared;
  }

  /**
   * Calculate growth metrics
   */
  private async calculateGrowthMetrics(startDate: Date, endDate: Date): Promise<ViralMetrics['growthMetrics']> {
    const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));

    const [totalServers, totalUsers, newServers, newUsers, retentionData, serverSizes] = await Promise.all([
      this.db.prisma.server.count(),
      this.db.prisma.user.count(),
      this.db.prisma.server.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      this.db.prisma.user.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      this.calculateRetentionRate(startDate),
      this.db.prisma.server.aggregate({
        _avg: { memberCount: true }
      })
    ]);

    return {
      totalServers,
      totalUsers,
      serverGrowthRate: newServers / daysDiff,
      userGrowthRate: newUsers / daysDiff,
      retentionRate: retentionData,
      averageServerSize: serverSizes._avg.memberCount || 0
    };
  }

  /**
   * Calculate content metrics
   */
  private async calculateContentMetrics(startDate: Date, endDate: Date): Promise<ViralMetrics['contentMetrics']> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [totalGames, gamesSharedToday, viralGames, avgServerReach] = await Promise.all([
      this.db.prisma.game.count(),
      this.db.prisma.viralEvent.count({
        where: {
          type: 'GAME_SHARE',
          timestamp: { gte: oneDayAgo }
        }
      }),
      this.db.prisma.game.count({
        where: { playCount: { gte: 100 } }
      }),
      this.calculateAverageServerReach()
    ]);

    const shareConversionRate = await this.calculateShareConversionRate(startDate, endDate);

    return {
      totalGames,
      gamesSharedToday,
      averageServerReach: avgServerReach,
      viralGameThreshold: 100,
      viralGamesCount: viralGames,
      shareConversionRate
    };
  }

  /**
   * Calculate engagement metrics
   */
  private async calculateEngagementMetrics(startDate: Date, endDate: Date): Promise<ViralMetrics['engagementMetrics']> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [dailyActiveUsers, gameStats, achievementStats, challengeStats, ambassadorImpact] = await Promise.all([
      this.calculateDailyActiveUsers(oneDayAgo),
      this.calculateGameEngagementStats(),
      this.calculateAchievementStats(oneDayAgo),
      this.calculateChallengeStats(),
      this.calculateAmbassadorImpact(startDate, endDate)
    ]);

    return {
      dailyActiveUsers,
      averageGamesPerUser: gameStats.avgGamesPerUser,
      averagePlayTimeMinutes: gameStats.avgPlayTimeMinutes,
      achievementUnlockRate: achievementStats.unlockRate,
      challengeParticipationRate: challengeStats.participationRate,
      ambassadorImpactScore: ambassadorImpact
    };
  }

  /**
   * Get top performers
   */
  private async getTopPerformers(startDate: Date, endDate: Date): Promise<ViralMetrics['topPerformers']> {
    const [viralCreators, viralServers, viralGames] = await Promise.all([
      this.getTopViralCreators(10),
      this.getTopViralServers(10),
      this.getTopViralGames(10)
    ]);

    return {
      viralCreators,
      viralServers,
      viralGames
    };
  }

  /**
   * Generate predictions
   */
  private async generatePredictions(startDate: Date, endDate: Date): Promise<ViralMetrics['predictions']> {
    const growthMetrics = await this.calculateGrowthMetrics(startDate, endDate);
    const viralCoefficient = await this.calculateViralCoefficient();

    const projectedServersNextMonth = Math.round(
      growthMetrics.totalServers + (growthMetrics.serverGrowthRate * 30)
    );

    const projectedUsersNextMonth = Math.round(
      growthMetrics.totalUsers + (growthMetrics.userGrowthRate * 30)
    );

    // Calculate days to reach viral coefficient 1.2
    const currentCoefficient = viralCoefficient.overall;
    const targetCoefficient = 1.2;
    const growthRate = viralCoefficient.trend === 'increasing' ? 0.01 : 
                      viralCoefficient.trend === 'decreasing' ? -0.005 : 0;
    
    const timeToViralCoefficient1_2 = growthRate > 0 ? 
      Math.ceil((targetCoefficient - currentCoefficient) / growthRate) : -1;

    const recommendedActions = this.generateRecommendations(viralCoefficient, growthMetrics);

    return {
      projectedServersNextMonth,
      projectedUsersNextMonth,
      timeToViralCoefficient1_2,
      recommendedActions
    };
  }

  /**
   * Helper methods for calculations
   */
  private async getDataPointsCount(startDate: Date, endDate: Date): Promise<number> {
    const [gameCount, userCount, serverCount] = await Promise.all([
      this.db.prisma.game.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      this.db.prisma.user.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      this.db.prisma.server.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      })
    ]);

    return gameCount + userCount + serverCount;
  }

  private async calculateRetentionRate(startDate: Date): Promise<number> {
    // Calculate 7-day retention rate
    const sevenDaysAgo = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(startDate.getTime() - 14 * 24 * 60 * 60 * 1000);

    const newUsers = await this.db.prisma.user.count({
      where: {
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }
      }
    });

    if (newUsers === 0) return 0;

    // Count users who were active in the last 7 days
    const retainedUsers = await this.db.prisma.user.count({
      where: {
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        updatedAt: { gte: sevenDaysAgo }
      }
    });

    return (retainedUsers / newUsers) * 100;
  }

  private async calculateShareConversionRate(startDate: Date, endDate: Date): Promise<number> {
    // This would require additional tracking to be fully accurate
    // For now, return an estimated conversion rate
    return 0.15; // 15% conversion rate estimate
  }

  private async calculateDailyActiveUsers(since: Date): Promise<number> {
    return await this.db.prisma.user.count({
      where: {
        updatedAt: { gte: since }
      }
    });
  }

  private async calculateGameEngagementStats(): Promise<{
    avgGamesPerUser: number;
    avgPlayTimeMinutes: number;
  }> {
    const gameStats = await this.db.prisma.game.aggregate({
      _count: { id: true }
    });

    const userCount = await this.db.prisma.user.count();
    const avgGamesPerUser = userCount > 0 ? gameStats._count.id / userCount : 0;

    // Estimate average play time (would need session tracking for accuracy)
    const avgPlayTimeMinutes = 8.5; // Estimated average play time

    return { avgGamesPerUser, avgPlayTimeMinutes };
  }

  private async calculateAchievementStats(since: Date): Promise<{ unlockRate: number }> {
    const [totalUsers, achievementsUnlocked] = await Promise.all([
      this.db.prisma.user.count(),
      this.db.prisma.userAchievement.count({
        where: { unlockedAt: { gte: since } }
      })
    ]);

    const unlockRate = totalUsers > 0 ? achievementsUnlocked / totalUsers : 0;
    return { unlockRate };
  }

  private async calculateChallengeStats(): Promise<{ participationRate: number }> {
    const [totalUsers, challengeParticipants] = await Promise.all([
      this.db.prisma.user.count(),
      this.db.prisma.challengeParticipant.groupBy({
        by: ['userId'],
        _count: { userId: true }
      })
    ]);

    const participationRate = totalUsers > 0 ? 
      (challengeParticipants.length / totalUsers) * 100 : 0;

    return { participationRate };
  }

  private async calculateAmbassadorImpact(startDate: Date, endDate: Date): Promise<number> {
    // Calculate correlation between ambassador activity and server growth
    // This would require more sophisticated analysis
    return 0.75; // Placeholder: 75% correlation score
  }

  private async getTopViralCreators(limit: number): Promise<Array<{
    userId: string;
    username: string;
    viralScore: number;
    totalReach: number;
    gamesCreated: number;
  }>> {
    const creators = await this.db.prisma.user.findMany({
      include: {
        games: {
          select: {
            id: true,
            playCount: true
          }
        }
      },
      take: limit * 2 // Get more to calculate viral scores
    });

    return await Promise.all(creators.map(async creator => {
      const gamesCreated = creator.games.length;
      
      // Calculate total reach by counting unique servers where games were shared
      const totalReach = await this.calculateCreatorReach(creator.games.map(g => g.id));
      const totalPlays = creator.games.reduce((sum, game) => sum + game.playCount, 0);
      const viralScore = gamesCreated > 0 ? (totalReach * totalPlays) / gamesCreated : 0;

      return {
        userId: creator.discordId,
        username: creator.username,
        viralScore,
        totalReach,
        gamesCreated
      };
    }))
      .then(results => results.sort((a, b) => b.viralScore - a.viralScore).slice(0, limit));
  }

  private async getTopViralServers(limit: number): Promise<Array<{
    serverId: string;
    serverName: string;
    memberCount: number;
    gamesCreated: number;
    crossServerShares: number;
    growthImpact: number;
  }>> {
    // This would require additional server tracking
    return []; // Placeholder
  }

  private async getTopViralGames(limit: number): Promise<Array<{
    gameId: string;
    name: string;
    creatorUsername: string;
    playCount: number;
    serverReach: number;
    viralCoefficient: number;
  }>> {
    const games = await this.db.prisma.game.findMany({
      include: {
        creator: {
          select: { username: true }
        }
      },
      orderBy: [
        { playCount: 'desc' }
      ],
      take: limit
    });

    return await Promise.all(games.map(async game => {
      const serverReach = await this.calculateGameServerReach(game.id);
      const viralCoefficient = serverReach > 0 && game.playCount > 0 ? 
        (serverReach / Math.max(1, game.playCount / 10)) : 0;

      return {
        gameId: game.id,
        name: game.name,
        creatorUsername: game.creator.username,
        playCount: game.playCount,
        serverReach,
        viralCoefficient
      };
    }));
  }

  private generateRecommendations(
    viralCoefficient: ViralCoefficient, 
    growthMetrics: ViralMetrics['growthMetrics']
  ): string[] {
    const recommendations: string[] = [];

    if (viralCoefficient.overall < 1.0) {
      recommendations.push("Increase incentives for content sharing and cross-server promotion");
      recommendations.push("Launch ambassador recruitment drive to boost community engagement");
    }

    if (viralCoefficient.overall < 1.2) {
      recommendations.push("Implement referral bonuses for servers that bring in new communities");
      recommendations.push("Create viral challenges and events to boost cross-server activity");
    }

    if (growthMetrics.retentionRate < 60) {
      recommendations.push("Focus on user onboarding and early engagement improvements");
      recommendations.push("Increase new user achievement rewards and tutorial quality");
    }

    if (viralCoefficient.contentToUser < 0.5) {
      recommendations.push("Improve game discovery and sharing mechanisms");
      recommendations.push("Add social preview cards and gameplay GIFs for shared content");
    }

    return recommendations;
  }

  private async clearViralMetricsCache(): Promise<void> {
    // Clear specific cache keys since del with patterns might not be available
    const timeframes = [1, 7, 30, 90];
    const keyPatterns = ['viral_coefficient:', 'viral_metrics:'];
    
    for (const pattern of keyPatterns) {
      for (const timeframe of timeframes) {
        try {
          await this.cache.delete(`${pattern}${timeframe}d`);
        } catch (error) {
          // Ignore delete errors
        }
      }
    }
  }

  /**
   * Calculate average server reach across all games
   */
  private async calculateAverageServerReach(): Promise<number> {
    // Count unique servers per game through viral events
    const gameShares = await this.db.prisma.viralEvent.groupBy({
      by: ['sourceId'], // sourceId is the gameId for GAME_SHARE events
      where: {
        type: 'GAME_SHARE'
      },
      _count: {
        targetId: true // Count unique target servers
      }
    });

    if (gameShares.length === 0) return 1;

    const totalReach = gameShares.reduce((sum, share) => sum + share._count.targetId, 0);
    return totalReach / gameShares.length;
  }

  /**
   * Calculate total reach for a creator's games
   */
  private async calculateCreatorReach(gameIds: string[]): Promise<number> {
    if (gameIds.length === 0) return 0;

    const uniqueServers = await this.db.prisma.viralEvent.groupBy({
      by: ['targetId'],
      where: {
        type: 'GAME_SHARE',
        sourceId: { in: gameIds }
      }
    });

    return uniqueServers.length;
  }

  /**
   * Calculate server reach for a specific game
   */
  private async calculateGameServerReach(gameId: string): Promise<number> {
    const uniqueServers = await this.db.prisma.viralEvent.groupBy({
      by: ['targetId'],
      where: {
        type: 'GAME_SHARE',
        sourceId: gameId
      }
    });

    return Math.max(1, uniqueServers.length); // At least 1 (the origin server)
  }
}