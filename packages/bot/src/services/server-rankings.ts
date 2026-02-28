import { injectable, inject } from 'inversify';
import { DatabaseService } from './database.js';
import { AnalyticsService } from './analytics.js';
import { CacheService } from './cache.js';
import { ViralMetricsService } from './viral-metrics.js';
import { LiveActivityService } from './live-activity.js';
import { TYPES } from '../types.js';

export interface ServerRankingMetrics {
  serverId: string;
  serverName: string;
  memberCount: number;
  totalGames: number;
  totalPlays: number;
  totalCreators: number;
  activeCreators: number; // Creators active in last 30 days
  averagePlayTime: number; // In minutes
  gamesThisWeek: number;
  gamesThisMonth: number;
  viralScore: number; // Cross-server reach score
  engagementRate: number; // Play-to-creation ratio
  diversityScore: number; // Variety of game types created
  communityScore: number; // Overall community engagement
  rank: number;
  previousRank: number | null;
  rankChange: 'up' | 'down' | 'same' | 'new';
  lastUpdated: Date;
}

export interface ServerRankingCategory {
  category: 'overall' | 'creative' | 'engagement' | 'viral' | 'growth' | 'diversity';
  title: string;
  description: string;
  weight: number;
  servers: ServerRankingMetrics[];
}

export interface ServerRankingStats {
  totalServers: number;
  totalActiveServers: number; // Active in last 30 days
  averageGamesPerServer: number;
  topPerformingRegion: string;
  mostActiveHour: number;
  categoryLeaders: Record<string, { serverId: string; serverName: string; score: number }>;
  weeklyGrowth: {
    newServers: number;
    newGames: number;
    newCreators: number;
  };
  timeframe: string;
}

export interface ServerComparison {
  serverA: ServerRankingMetrics;
  serverB: ServerRankingMetrics;
  differences: {
    metric: string;
    valueA: number;
    valueB: number;
    difference: number;
    betterServer: 'A' | 'B' | 'tie';
  }[];
  overallWinner: 'A' | 'B' | 'tie';
  recommendations: string[];
}

@injectable()
export class ServerRankingService {
  private readonly cacheKeyPrefix = 'server_rankings:';
  private readonly cacheTTL = 15 * 60; // 15 minutes

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.ViralMetricsService) private viralMetrics: ViralMetricsService,
    @inject(TYPES.LiveActivityService) private liveActivity: LiveActivityService
  ) {}

  /**
   * Get server rankings for all categories
   */
  async getServerRankings(
    category: 'overall' | 'creative' | 'engagement' | 'viral' | 'growth' | 'diversity' = 'overall',
    limit: number = 50,
    timeframe: 'week' | 'month' | 'all' = 'month'
  ): Promise<ServerRankingCategory> {
    const cacheKey = `${this.cacheKeyPrefix}${category}:${timeframe}:${limit}`;
    let ranking = await this.cache.get<ServerRankingCategory>(cacheKey);

    if (!ranking) {
      ranking = await this.calculateServerRankings(category, limit, timeframe);
      await this.cache.set(cacheKey, ranking, this.cacheTTL);
    }

    return ranking;
  }

  /**
   * Get specific server's ranking and metrics
   */
  async getServerRanking(
    serverId: string,
    category: 'overall' | 'creative' | 'engagement' | 'viral' | 'growth' | 'diversity' = 'overall',
    timeframe: 'week' | 'month' | 'all' = 'month'
  ): Promise<ServerRankingMetrics | null> {
    const cacheKey = `${this.cacheKeyPrefix}server:${serverId}:${category}:${timeframe}`;
    let serverRanking = await this.cache.get<ServerRankingMetrics>(cacheKey);

    if (!serverRanking) {
      const rankings = await this.getServerRankings(category, 1000, timeframe);
      serverRanking = rankings.servers.find(s => s.serverId === serverId) || null;

      if (serverRanking) {
        await this.cache.set(cacheKey, serverRanking, this.cacheTTL);
      }
    }

    return serverRanking;
  }

  /**
   * Get overall ranking statistics
   */
  async getRankingStats(
    timeframe: 'week' | 'month' | 'all' = 'month'
  ): Promise<ServerRankingStats> {
    const cacheKey = `${this.cacheKeyPrefix}stats:${timeframe}`;
    let stats = await this.cache.get<ServerRankingStats>(cacheKey);

    if (!stats) {
      stats = await this.calculateRankingStats(timeframe);
      await this.cache.set(cacheKey, stats, this.cacheTTL);
    }

    return stats;
  }

  /**
   * Compare two servers
   */
  async compareServers(
    serverAId: string,
    serverBId: string,
    timeframe: 'week' | 'month' | 'all' = 'month'
  ): Promise<ServerComparison | null> {
    const [serverA, serverB] = await Promise.all([
      this.getServerRanking(serverAId, 'overall', timeframe),
      this.getServerRanking(serverBId, 'overall', timeframe)
    ]);

    if (!serverA || !serverB) {
      return null;
    }

    return this.generateServerComparison(serverA, serverB);
  }

  /**
   * Get trending servers (biggest movers)
   */
  async getTrendingServers(
    direction: 'up' | 'down' | 'both' = 'up',
    limit: number = 20
  ): Promise<ServerRankingMetrics[]> {
    const cacheKey = `${this.cacheKeyPrefix}trending:${direction}:${limit}`;
    let trending = await this.cache.get<ServerRankingMetrics[]>(cacheKey);

    if (!trending) {
      const rankings = await this.getServerRankings('overall', 1000, 'month');
      
      trending = rankings.servers
        .filter(server => {
          if (direction === 'up') return server.rankChange === 'up';
          if (direction === 'down') return server.rankChange === 'down';
          return server.rankChange === 'up' || server.rankChange === 'down';
        })
        .sort((a, b) => {
          const aChange = Math.abs((a.previousRank || a.rank) - a.rank);
          const bChange = Math.abs((b.previousRank || b.rank) - b.rank);
          return bChange - aChange; // Biggest changes first
        })
        .slice(0, limit);

      await this.cache.set(cacheKey, trending, this.cacheTTL);
    }

    return trending;
  }

  /**
   * Update server rankings (called periodically)
   */
  async updateRankings(): Promise<void> {
    console.log('📊 Updating server rankings...');

    try {
      // Clear cache to force recalculation
      const categories = ['overall', 'creative', 'engagement', 'viral', 'growth', 'diversity'];
      const timeframes = ['week', 'month', 'all'];

      for (const category of categories) {
        for (const timeframe of timeframes) {
          const cacheKey = `${this.cacheKeyPrefix}${category}:${timeframe}:*`;
          // Note: In production, you'd want a more specific cache invalidation
          await this.cache.delete(cacheKey);
        }
      }

      // Recalculate all rankings
      for (const category of categories) {
        for (const timeframe of timeframes) {
          await this.getServerRankings(category as any, 100, timeframe as any);
        }
      }

      // Record update activity
      await this.liveActivity.recordActivity(
        'RANKINGS_UPDATED',
        'system',
        {
          totalServers: (await this.getRankingStats()).totalServers,
          timestamp: new Date().toISOString()
        }
      );

      console.log('✅ Server rankings updated successfully');

    } catch (error) {
      console.error('❌ Error updating server rankings:', error);
      throw error;
    }
  }

  private async calculateServerRankings(
    category: string,
    limit: number,
    timeframe: string
  ): Promise<ServerRankingCategory> {
    // Get previous rankings for comparison
    const previousRankings = await this.getPreviousRankings(category);

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (timeframe) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get all servers with games
    const servers = await this.db.prisma.server.findMany({
      include: {
        games: {
          where: timeframe !== 'all' ? {
            createdAt: { gte: startDate }
          } : undefined,
          include: {
            _count: {
              select: { gamePlays: true }
            }
          }
        },
        _count: {
          select: {
            games: timeframe !== 'all' ? {
              where: { createdAt: { gte: startDate } }
            } : true
          }
        }
      }
    });

    // Calculate metrics for each server
    const serverMetrics: ServerRankingMetrics[] = [];

    for (const server of servers) {
      if (server.games.length === 0 && timeframe !== 'all') continue;

      const metrics = await this.calculateServerMetrics(server, startDate, timeframe);
      
      // Get previous rank
      const previousRank = previousRankings.get(server.discordGuildId);
      
      serverMetrics.push({
        ...metrics,
        previousRank,
        rankChange: 'same', // Will be calculated after sorting
        lastUpdated: now
      });
    }

    // Sort by category-specific score
    const sortedServers = this.sortServersByCategory(serverMetrics, category);

    // Calculate ranks and rank changes
    sortedServers.forEach((server, index) => {
      server.rank = index + 1;
      
      if (server.previousRank === null) {
        server.rankChange = 'new';
      } else if (server.previousRank > server.rank) {
        server.rankChange = 'up';
      } else if (server.previousRank < server.rank) {
        server.rankChange = 'down';
      } else {
        server.rankChange = 'same';
      }
    });

    // Store current rankings for next comparison
    await this.storePreviousRankings(category, sortedServers);

    return {
      category: category as any,
      title: this.getCategoryTitle(category),
      description: this.getCategoryDescription(category),
      weight: this.getCategoryWeight(category),
      servers: sortedServers.slice(0, limit)
    };
  }

  private async calculateServerMetrics(
    server: any,
    startDate: Date,
    timeframe: string
  ): Promise<Omit<ServerRankingMetrics, 'rank' | 'previousRank' | 'rankChange' | 'lastUpdated'>> {
    const totalGames = server.games.length;
    const totalPlays = server.games.reduce((sum: number, game: any) => sum + game._count.gamePlays, 0);

    // Get unique creators
    const creatorIds = new Set(server.games.map((game: any) => game.creatorId));
    const totalCreators = creatorIds.size;

    // Active creators (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeCreators = new Set(
      server.games
        .filter((game: any) => new Date(game.createdAt) >= thirtyDaysAgo)
        .map((game: any) => game.creatorId)
    ).size;

    // Calculate time-based metrics
    const gamesThisWeek = server.games.filter((game: any) => 
      new Date(game.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    const gamesThisMonth = server.games.filter((game: any) => 
      new Date(game.createdAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;

    // Calculate viral score
    const viralCoeff = await this.viralMetrics.calculateViralCoefficient(
      server.discordGuildId,
      timeframe === 'week' ? '7d' : '30d'
    );
    const viralScore = Math.round(viralCoeff.overall * 100);

    // Calculate engagement rate
    const engagementRate = totalGames > 0 ? Math.round((totalPlays / totalGames) * 100) / 100 : 0;

    // Calculate diversity score (based on game types)
    const gameTypes = new Set(server.games.map((game: any) => game.type));
    const diversityScore = Math.min(100, gameTypes.size * 20); // Max 5 types = 100 points

    // Calculate community score (weighted average)
    const communityScore = Math.round(
      (viralScore * 0.3) +
      (engagementRate * 0.25) +
      (diversityScore * 0.2) +
      (Math.min(100, activeCreators * 10) * 0.25) // Active creators bonus
    );

    return {
      serverId: server.discordGuildId,
      serverName: server.name || `Server ${server.discordGuildId.slice(-4)}`,
      memberCount: server.memberCount || 0,
      totalGames,
      totalPlays,
      totalCreators,
      activeCreators,
      averagePlayTime: 0, // Would need session tracking
      gamesThisWeek,
      gamesThisMonth,
      viralScore,
      engagementRate,
      diversityScore,
      communityScore
    };
  }

  private sortServersByCategory(
    servers: ServerRankingMetrics[],
    category: string
  ): ServerRankingMetrics[] {
    switch (category) {
      case 'creative':
        return servers.sort((a, b) => b.totalGames - a.totalGames);
      case 'engagement':
        return servers.sort((a, b) => b.engagementRate - a.engagementRate);
      case 'viral':
        return servers.sort((a, b) => b.viralScore - a.viralScore);
      case 'growth':
        return servers.sort((a, b) => b.gamesThisMonth - a.gamesThisMonth);
      case 'diversity':
        return servers.sort((a, b) => b.diversityScore - a.diversityScore);
      default: // overall
        return servers.sort((a, b) => b.communityScore - a.communityScore);
    }
  }

  private async calculateRankingStats(timeframe: string): Promise<ServerRankingStats> {
    const rankings = await this.getServerRankings('overall', 1000, timeframe as any);
    
    const totalServers = rankings.servers.length;
    const totalActiveServers = rankings.servers.filter(s => s.gamesThisMonth > 0).length;
    const averageGamesPerServer = rankings.servers.reduce((sum, s) => sum + s.totalGames, 0) / totalServers;

    // Get category leaders
    const categories = ['creative', 'engagement', 'viral', 'growth', 'diversity'];
    const categoryLeaders: Record<string, any> = {};

    for (const cat of categories) {
      const catRankings = await this.getServerRankings(cat as any, 1, timeframe as any);
      if (catRankings.servers.length > 0) {
        const leader = catRankings.servers[0];
        categoryLeaders[cat] = {
          serverId: leader.serverId,
          serverName: leader.serverName,
          score: this.getCategoryScore(leader, cat)
        };
      }
    }

    return {
      totalServers,
      totalActiveServers,
      averageGamesPerServer: Math.round(averageGamesPerServer * 100) / 100,
      topPerformingRegion: 'Unknown', // Would need region data
      mostActiveHour: 14, // 2 PM UTC - example
      categoryLeaders,
      weeklyGrowth: {
        newServers: 0, // Would need tracking
        newGames: rankings.servers.reduce((sum, s) => sum + s.gamesThisWeek, 0),
        newCreators: 0 // Would need tracking
      },
      timeframe
    };
  }

  private generateServerComparison(
    serverA: ServerRankingMetrics,
    serverB: ServerRankingMetrics
  ): ServerComparison {
    const metrics = [
      { key: 'totalGames', name: 'Total Games' },
      { key: 'totalPlays', name: 'Total Plays' },
      { key: 'engagementRate', name: 'Engagement Rate' },
      { key: 'viralScore', name: 'Viral Score' },
      { key: 'diversityScore', name: 'Diversity Score' },
      { key: 'communityScore', name: 'Community Score' }
    ];

    const differences = metrics.map(metric => {
      const valueA = (serverA as any)[metric.key];
      const valueB = (serverB as any)[metric.key];
      const difference = valueA - valueB;
      
      return {
        metric: metric.name,
        valueA,
        valueB,
        difference: Math.round(difference * 100) / 100,
        betterServer: difference > 0 ? 'A' as const : difference < 0 ? 'B' as const : 'tie' as const
      };
    });

    const aWins = differences.filter(d => d.betterServer === 'A').length;
    const bWins = differences.filter(d => d.betterServer === 'B').length;
    
    const overallWinner = aWins > bWins ? 'A' as const : bWins > aWins ? 'B' as const : 'tie' as const;

    const recommendations = this.generateRecommendations(serverA, serverB, differences);

    return {
      serverA,
      serverB,
      differences,
      overallWinner,
      recommendations
    };
  }

  private generateRecommendations(
    serverA: ServerRankingMetrics,
    serverB: ServerRankingMetrics,
    differences: any[]
  ): string[] {
    const recommendations: string[] = [];

    // Find areas where each server excels
    const aStrengths = differences.filter(d => d.betterServer === 'A' && d.difference > 10);
    const bStrengths = differences.filter(d => d.betterServer === 'B' && d.difference < -10);

    if (aStrengths.find(s => s.metric === 'Viral Score')) {
      recommendations.push(`${serverA.serverName} could share viral growth strategies with ${serverB.serverName}`);
    }

    if (bStrengths.find(s => s.metric === 'Engagement Rate')) {
      recommendations.push(`${serverA.serverName} could learn engagement techniques from ${serverB.serverName}`);
    }

    if (serverA.diversityScore < 60) {
      recommendations.push(`${serverA.serverName} could improve by encouraging more diverse game types`);
    }

    if (serverB.diversityScore < 60) {
      recommendations.push(`${serverB.serverName} could improve by encouraging more diverse game types`);
    }

    return recommendations.slice(0, 3); // Max 3 recommendations
  }

  private getCategoryTitle(category: string): string {
    const titles = {
      overall: 'Overall Community Rankings',
      creative: 'Most Creative Servers',
      engagement: 'Highest Engagement',
      viral: 'Most Viral Content',
      growth: 'Fastest Growing',
      diversity: 'Most Diverse Games'
    };
    return titles[category as keyof typeof titles] || 'Server Rankings';
  }

  private getCategoryDescription(category: string): string {
    const descriptions = {
      overall: 'Servers ranked by overall community health and activity',
      creative: 'Servers creating the most games and content',
      engagement: 'Servers with the highest play-to-creation ratios',
      viral: 'Servers with content spreading across multiple servers',
      growth: 'Servers with the most recent growth and activity',
      diversity: 'Servers creating the most varied types of games'
    };
    return descriptions[category as keyof typeof descriptions] || 'Server rankings by category';
  }

  private getCategoryWeight(category: string): number {
    const weights = {
      overall: 1.0,
      creative: 0.8,
      engagement: 0.9,
      viral: 0.7,
      growth: 0.6,
      diversity: 0.5
    };
    return weights[category as keyof typeof weights] || 0.5;
  }

  private getCategoryScore(server: ServerRankingMetrics, category: string): number {
    switch (category) {
      case 'creative': return server.totalGames;
      case 'engagement': return server.engagementRate;
      case 'viral': return server.viralScore;
      case 'growth': return server.gamesThisMonth;
      case 'diversity': return server.diversityScore;
      default: return server.communityScore;
    }
  }

  private async getPreviousRankings(category: string): Promise<Map<string, number>> {
    const cacheKey = `${this.cacheKeyPrefix}previous:${category}`;
    const previous = await this.cache.get<Record<string, number>>(cacheKey);
    return new Map(Object.entries(previous || {}));
  }

  private async storePreviousRankings(
    category: string,
    rankings: ServerRankingMetrics[]
  ): Promise<void> {
    const cacheKey = `${this.cacheKeyPrefix}previous:${category}`;
    const rankingMap = rankings.reduce((map, server) => {
      map[server.serverId] = server.rank;
      return map;
    }, {} as Record<string, number>);

    await this.cache.set(cacheKey, rankingMap, 24 * 60 * 60); // 24 hours
  }
}