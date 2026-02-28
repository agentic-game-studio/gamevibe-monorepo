import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { AnalyticsService } from './analytics.js';
import { PersonalCreditService } from './personal-credits.js';

export interface CreatorMetrics {
  totalGames: number;
  totalPlays: number;
  totalShares: number;
  uniqueServers: number;
  uniquePlayers: number;
  viralGames: number;
  averagePlayRate: number;
  topGames: GameMetrics[];
  recentActivity: ActivityEvent[];
  serverDistribution: ServerStats[];
  timeSeriesData: TimeSeriesPoint[];
  earnings: EarningsMetrics;
  tier: CreatorTierInfo;
}

export interface GameMetrics {
  gameId: string;
  name: string;
  type: string;
  playCount: number;
  shareCount: number;
  serverReach: number;
  createdAt: Date;
  lastPlayedAt?: Date;
  viralScore: number;
}

export interface ServerStats {
  serverId: string;
  serverName: string;
  totalPlays: number;
  uniquePlayers: number;
  lastActivity: Date;
}

export interface ActivityEvent {
  type: 'game_created' | 'game_played' | 'game_shared' | 'milestone_reached';
  gameId?: string;
  gameName?: string;
  serverId: string;
  serverName: string;
  timestamp: Date;
  details: any;
}

export interface TimeSeriesPoint {
  date: string;
  plays: number;
  shares: number;
  newGames: number;
  earnings: number;
}

export interface EarningsMetrics {
  totalEarned: number;
  thisMonth: number;
  lastMonth: number;
  averagePerGame: number;
  topEarningGame: { gameId: string; name: string; earned: number };
}

export interface CreatorTierInfo {
  current: string;
  progress: number;
  nextTier: string | null;
  multiplier: number;
  perks: string[];
}

@injectable()
export class CreatorAnalyticsService {
  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.PersonalCreditService) private personalCreditService: PersonalCreditService
  ) {}

  /**
   * Get comprehensive creator metrics
   */
  async getCreatorMetrics(creatorDiscordId: string): Promise<CreatorMetrics> {
    const cacheKey = `creator:metrics:${creatorDiscordId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get creator's user record
    const creator = await this.db.prisma.user.findUnique({
      where: { discordId: creatorDiscordId }
    });

    if (!creator) {
      throw new Error('Creator not found');
    }

    // Fetch all games by creator
    const games = await this.db.prisma.game.findMany({
      where: { creatorId: creator.id },
      include: {
        server: true
      }
    });

    // Calculate metrics
    const totalGames = games.length;
    const totalPlays = games.reduce((sum, game) => sum + game.playCount, 0);
    
    // Extract share data from metadata
    const gameShares = games.map(game => {
      const metadata = game.metadata as any || {};
      return {
        gameId: game.id,
        shares: metadata.totalShares || 0,
        serverReach: metadata.uniqueServerReach || 1,
        sharedServers: metadata.sharedServers || []
      };
    });

    const totalShares = gameShares.reduce((sum, g) => sum + g.shares, 0);
    
    // Get unique servers
    const allServers = new Set<string>();
    games.forEach(game => {
      allServers.add(game.server.discordId);
      const metadata = game.metadata as any || {};
      if (metadata.sharedServers) {
        metadata.sharedServers.forEach((s: string) => allServers.add(s));
      }
    });
    const uniqueServers = allServers.size;

    // Get unique players (approximation based on play patterns)
    const uniquePlayers = Math.floor(totalPlays / 3.5); // Average plays per player

    // Count viral games (100+ plays)
    const viralGames = games.filter(g => g.playCount >= 100).length;

    // Calculate average play rate
    const averagePlayRate = totalGames > 0 ? totalPlays / totalGames : 0;

    // Get top games
    const topGames: GameMetrics[] = games
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10)
      .map(game => {
        const shareData = gameShares.find(g => g.gameId === game.id);
        return {
          gameId: game.shortId,
          name: game.name,
          type: game.type,
          playCount: game.playCount,
          shareCount: shareData?.shares || 0,
          serverReach: shareData?.serverReach || 1,
          createdAt: game.createdAt,
          viralScore: this.calculateViralScore(game.playCount, shareData?.shares || 0, shareData?.serverReach || 1)
        };
      });

    // Get recent activity
    const recentActivity = await this.getRecentActivity(creator.id, games);

    // Get server distribution
    const serverDistribution = await this.getServerDistribution(games);

    // Get time series data (last 30 days)
    const timeSeriesData = await this.getTimeSeriesData(creator.id, 30);

    // Get earnings metrics
    const earningsMetrics = await this.getEarningsMetrics(creator.id, games);

    // Get tier info
    const tierInfo = await this.getTierInfo(creatorDiscordId);

    const metrics: CreatorMetrics = {
      totalGames,
      totalPlays,
      totalShares,
      uniqueServers,
      uniquePlayers,
      viralGames,
      averagePlayRate,
      topGames,
      recentActivity,
      serverDistribution,
      timeSeriesData,
      earnings: earningsMetrics,
      tier: tierInfo
    };

    // Cache for 10 minutes
    await this.cache.set(cacheKey, JSON.stringify(metrics), 600);

    // Track analytics
    await this.analytics.track('creator_metrics_viewed', {
      creatorId: creatorDiscordId,
      totalGames,
      totalPlays,
      uniqueServers
    });

    return metrics;
  }

  /**
   * Get cross-server analytics for a specific game
   */
  async getGameCrossServerAnalytics(gameShortId: string): Promise<any> {
    const game = await this.db.prisma.game.findUnique({
      where: { shortId: gameShortId },
      include: {
        server: true,
        creator: true
      }
    });

    if (!game) {
      throw new Error('Game not found');
    }

    const metadata = game.metadata as any || {};
    const sharedServers = metadata.sharedServers || [];
    const shares = metadata.shares || [];

    // Get server details
    const serverDetails = await Promise.all(
      sharedServers.map(async (serverId: string) => {
        const server = await this.db.prisma.server.findUnique({
          where: { discordId: serverId }
        });
        
        // Count plays from this server (from shares metadata)
        const serverShares = shares.filter((s: any) => s.serverId === serverId);
        
        return {
          serverId,
          serverName: server?.name || 'Unknown Server',
          shareCount: serverShares.length,
          firstShared: serverShares[0]?.timestamp || null,
          lastShared: serverShares[serverShares.length - 1]?.timestamp || null
        };
      })
    );

    // Calculate viral metrics
    const viralCoefficient = this.calculateViralCoefficient(
      game.playCount,
      metadata.totalShares || 0,
      sharedServers.length
    );

    return {
      game: {
        id: game.shortId,
        name: game.name,
        type: game.type,
        creator: game.creator.username,
        originalServer: game.server.name,
        createdAt: game.createdAt
      },
      metrics: {
        totalPlays: game.playCount,
        totalShares: metadata.totalShares || 0,
        uniqueServers: sharedServers.length,
        viralCoefficient,
        viralScore: this.calculateViralScore(
          game.playCount,
          metadata.totalShares || 0,
          sharedServers.length
        )
      },
      serverDistribution: serverDetails,
      shareTimeline: this.generateShareTimeline(shares),
      growthRate: this.calculateGrowthRate(shares)
    };
  }

  /**
   * Private helper methods
   */
  private async getRecentActivity(creatorId: string, games: any[]): Promise<ActivityEvent[]> {
    const activities: ActivityEvent[] = [];
    
    // Add game creation events
    games.forEach(game => {
      activities.push({
        type: 'game_created',
        gameId: game.shortId,
        gameName: game.name,
        serverId: game.server.discordId,
        serverName: game.server.name,
        timestamp: game.createdAt,
        details: { gameType: game.type }
      });
    });

    // Sort by timestamp and return recent 50
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 50);
  }

  private async getServerDistribution(games: any[]): Promise<ServerStats[]> {
    const serverMap = new Map<string, ServerStats>();

    games.forEach(game => {
      const serverId = game.server.discordId;
      const existing = serverMap.get(serverId) || {
        serverId,
        serverName: game.server.name,
        totalPlays: 0,
        uniquePlayers: 0,
        lastActivity: game.updatedAt
      };

      existing.totalPlays += game.playCount;
      if (game.updatedAt > existing.lastActivity) {
        existing.lastActivity = game.updatedAt;
      }

      serverMap.set(serverId, existing);
    });

    return Array.from(serverMap.values())
      .sort((a, b) => b.totalPlays - a.totalPlays);
  }

  private async getTimeSeriesData(creatorId: string, days: number): Promise<TimeSeriesPoint[]> {
    const points: TimeSeriesPoint[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // In a real implementation, this would query actual time-series data
      // For now, return sample data
      points.push({
        date: dateStr,
        plays: Math.floor(Math.random() * 100),
        shares: Math.floor(Math.random() * 20),
        newGames: Math.floor(Math.random() * 3),
        earnings: Math.floor(Math.random() * 50)
      });
    }

    return points;
  }

  private async getEarningsMetrics(creatorId: string, games: any[]): Promise<EarningsMetrics> {
    // Get personal credit data
    const credits = await this.db.prisma.userPersonalCredits.findUnique({
      where: { userId: creatorId }
    });

    const totalEarned = credits?.totalEarned || 0;
    const thisMonth = credits?.totalEarned || 0; // Would need date filtering
    const lastMonth = 0; // Would need historical data
    const averagePerGame = games.length > 0 ? totalEarned / games.length : 0;

    // Find top earning game (most plays = most earnings)
    const topGame = games.sort((a, b) => b.playCount - a.playCount)[0];

    return {
      totalEarned,
      thisMonth,
      lastMonth,
      averagePerGame,
      topEarningGame: topGame ? {
        gameId: topGame.shortId,
        name: topGame.name,
        earned: Math.floor(topGame.playCount / 10) // 1 credit per 10 plays
      } : { gameId: '', name: 'N/A', earned: 0 }
    };
  }

  private async getTierInfo(creatorDiscordId: string): Promise<CreatorTierInfo> {
    const credits = await this.db.prisma.userPersonalCredits.findUnique({
      where: { userId: creatorDiscordId }
    });

    const tier = credits?.creatorTier || 'BRONZE';
    const totalEarned = credits?.totalEarned || 0;

    const tierMultipliers: Record<string, number> = {
      BRONZE: 1,
      SILVER: 2,
      GOLD: 3,
      DIAMOND: 5
    };

    const tierThresholds: Record<string, number> = {
      BRONZE: 0,
      SILVER: 100,
      GOLD: 1000,
      DIAMOND: 10000
    };

    const tierPerks: Record<string, string[]> = {
      BRONZE: ['Basic credit earning', 'Access to personal credits'],
      SILVER: ['2x earning multiplier', 'Priority support', 'Silver badge'],
      GOLD: ['3x earning multiplier', 'Beta features', 'Gold badge', 'Monthly bonus'],
      DIAMOND: ['5x earning multiplier', 'VIP support', 'Diamond badge', 'Exclusive features']
    };

    const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'];
    const currentIndex = tierOrder.indexOf(tier);
    const nextTier = currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;
    
    const progress = nextTier 
      ? ((totalEarned - tierThresholds[tier]) / (tierThresholds[nextTier] - tierThresholds[tier])) * 100
      : 100;

    return {
      current: tier,
      progress: Math.min(100, Math.max(0, progress)),
      nextTier,
      multiplier: tierMultipliers[tier],
      perks: tierPerks[tier]
    };
  }

  private calculateViralScore(plays: number, shares: number, servers: number): number {
    // Weighted formula for viral score
    const playWeight = 0.4;
    const shareWeight = 0.3;
    const serverWeight = 0.3;

    const normalizedPlays = Math.min(plays / 1000, 1);
    const normalizedShares = Math.min(shares / 100, 1);
    const normalizedServers = Math.min(servers / 50, 1);

    return Math.round(
      (normalizedPlays * playWeight + 
       normalizedShares * shareWeight + 
       normalizedServers * serverWeight) * 100
    );
  }

  private calculateViralCoefficient(plays: number, shares: number, servers: number): number {
    if (shares === 0) return 0;
    
    // Viral coefficient = (shares * conversion rate * average value)
    const conversionRate = servers / Math.max(shares, 1); // Servers reached per share
    const averageValue = plays / Math.max(servers, 1); // Plays per server
    
    return Number((shares * conversionRate * averageValue / plays).toFixed(2));
  }

  private generateShareTimeline(shares: any[]): any {
    // Group shares by date
    const timeline: Record<string, number> = {};
    
    shares.forEach((share: any) => {
      const date = new Date(share.timestamp).toISOString().split('T')[0];
      timeline[date] = (timeline[date] || 0) + 1;
    });

    return timeline;
  }

  private calculateGrowthRate(shares: any[]): number {
    if (shares.length < 2) return 0;

    // Sort shares by timestamp
    const sortedShares = shares.sort((a: any, b: any) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate average time between shares
    let totalTime = 0;
    for (let i = 1; i < sortedShares.length; i++) {
      const timeDiff = new Date(sortedShares[i].timestamp).getTime() - 
                       new Date(sortedShares[i-1].timestamp).getTime();
      totalTime += timeDiff;
    }

    const avgTimeBetweenShares = totalTime / (sortedShares.length - 1);
    
    // Convert to shares per day
    const sharesPerDay = (24 * 60 * 60 * 1000) / avgTimeBetweenShares;
    
    return Number(sharesPerDay.toFixed(2));
  }
}