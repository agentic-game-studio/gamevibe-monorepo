import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { AnalyticsService } from './analytics.js';
import { Client } from 'discord.js';

export interface TrendingGame {
  id: string;
  shortId: string;
  title: string;
  description: string;
  type: string;
  creatorName: string;
  creatorId: string;
  serverName: string;
  serverId: string;
  playCount: number;
  serverCount: number;
  lastPlayedAt: Date;
  createdAt: Date;
  trendingScore: number;
  tags: string[];
  metadata: Record<string, any>;
}

export interface DiscoveryFilters {
  gameType?: string;
  minPlays?: number;
  maxAge?: 'day' | 'week' | 'month' | 'all';
  tags?: string[];
  excludeServer?: string;
  language?: string;
}

export interface GameDiscoveryStats {
  totalGames: number;
  totalPlays: number;
  averageRating: number;
  popularTypes: Array<{
    type: string;
    count: number;
    playPercentage: number;
  }>;
  topServers: Array<{
    serverId: string;
    serverName: string;
    gameCount: number;
    totalPlays: number;
  }>;
  recentTrends: Array<{
    period: string;
    gamesCreated: number;
    totalPlays: number;
    newServers: number;
  }>;
}

@injectable()
export class CrossServerDiscoveryService {
  private readonly CACHE_TTL = {
    TRENDING: 300, // 5 minutes for trending games
    DISCOVERY: 600, // 10 minutes for discovery results
    STATS: 900 // 15 minutes for platform stats
  };

  private readonly TRENDING_DECAY_HOURS = 168; // 7 days
  private readonly MIN_PLAYS_FOR_TRENDING = 5;

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.DiscordClient) private client: Client
  ) {}

  /**
   * Get trending games across all servers
   */
  async getTrendingGames(
    limit: number = 20,
    filters: DiscoveryFilters = {}
  ): Promise<TrendingGame[]> {
    const cacheKey = this.generateTrendingCacheKey(limit, filters);
    const cached = await this.cache.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Build where clause based on filters
      const whereClause = this.buildWhereClause(filters);

      // Get games with play tracking data
      const games = await this.db.prisma.game.findMany({
        where: {
          ...whereClause,
          // Only include games with some activity
          gameTracking: {
            totalPlays: {
              gte: this.MIN_PLAYS_FOR_TRENDING
            }
          }
        },
        include: {
          gameTracking: true,
          server: {
            select: {
              discordId: true,
              name: true
            }
          }
        },
        orderBy: {
          gameTracking: {
            totalPlays: 'desc'
          }
        },
        take: limit * 3 // Get more than needed for scoring
      });

      // Calculate trending scores and sort
      const trendingGames = await Promise.all(
        games.map(async (game) => {
          const trendingScore = await this.calculateTrendingScore(game);
          
          return {
            id: game.id,
            shortId: game.shortId,
            title: game.title,
            description: game.description || '',
            type: game.type,
            creatorName: game.metadata?.creatorName || 'Unknown',
            creatorId: game.creatorId,
            serverName: game.server?.name || 'Unknown Server',
            serverId: game.serverId,
            playCount: game.gameTracking?.totalPlays || 0,
            serverCount: game.gameTracking?.uniqueServers || 1,
            lastPlayedAt: game.gameTracking?.lastPlayedAt || game.createdAt,
            createdAt: game.createdAt,
            trendingScore,
            tags: this.extractGameTags(game),
            metadata: game.metadata as Record<string, any> || {}
          } as TrendingGame;
        })
      );

      // Sort by trending score and take the top results
      const sortedGames = trendingGames
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, limit);

      // Enrich with additional data
      const enrichedGames = await this.enrichTrendingGames(sortedGames);

      // Cache the results
      await this.cache.set(cacheKey, JSON.stringify(enrichedGames), this.CACHE_TTL.TRENDING);

      return enrichedGames;

    } catch (error) {
      console.error('Error getting trending games:', error);
      return [];
    }
  }

  /**
   * Discover games similar to a given game
   */
  async getRelatedGames(
    gameId: string,
    limit: number = 10,
    excludeServer?: string
  ): Promise<TrendingGame[]> {
    const cacheKey = `related_games:${gameId}:${limit}:${excludeServer || 'any'}`;
    const cached = await this.cache.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Get the source game
      const sourceGame = await this.db.prisma.game.findUnique({
        where: { id: gameId },
        include: { gameTracking: true }
      });

      if (!sourceGame) return [];

      // Find games with similar characteristics
      const relatedGames = await this.db.prisma.game.findMany({
        where: {
          id: { not: gameId },
          type: sourceGame.type, // Same game type
          serverId: excludeServer ? { not: excludeServer } : undefined,
          gameTracking: {
            totalPlays: { gte: this.MIN_PLAYS_FOR_TRENDING }
          }
        },
        include: {
          gameTracking: true,
          server: {
            select: {
              discordId: true,
              name: true
            }
          }
        },
        orderBy: [
          { gameTracking: { totalPlays: 'desc' } },
          { createdAt: 'desc' }
        ],
        take: limit
      });

      // Convert to trending games format
      const trending = relatedGames.map(game => ({
        id: game.id,
        shortId: game.shortId,
        title: game.title,
        description: game.description || '',
        type: game.type,
        creatorName: game.metadata?.creatorName || 'Unknown',
        creatorId: game.creatorId,
        serverName: game.server?.name || 'Unknown Server',
        serverId: game.serverId,
        playCount: game.gameTracking?.totalPlays || 0,
        serverCount: game.gameTracking?.uniqueServers || 1,
        lastPlayedAt: game.gameTracking?.lastPlayedAt || game.createdAt,
        createdAt: game.createdAt,
        trendingScore: 0, // Will be calculated if needed
        tags: this.extractGameTags(game),
        metadata: game.metadata as Record<string, any> || {}
      })) as TrendingGame[];

      // Cache the results
      await this.cache.set(cacheKey, JSON.stringify(trending), this.CACHE_TTL.DISCOVERY);

      return trending;

    } catch (error) {
      console.error('Error getting related games:', error);
      return [];
    }
  }

  /**
   * Get discovery statistics for the platform
   */
  async getDiscoveryStats(): Promise<GameDiscoveryStats> {
    const cacheKey = 'discovery_stats';
    const cached = await this.cache.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Get total games and plays
      const totalGamesResult = await this.db.prisma.game.aggregate({
        _count: { id: true }
      });

      const totalPlaysResult = await this.db.prisma.gameTracking.aggregate({
        _sum: { totalPlays: true }
      });

      const totalGames = totalGamesResult._count.id;
      const totalPlays = totalPlaysResult._sum.totalPlays || 0;

      // Get popular game types
      const gameTypeStats = await this.db.prisma.game.groupBy({
        by: ['type'],
        _count: { type: true },
        _sum: {
          gameTracking: {
            totalPlays: true
          }
        },
        orderBy: {
          _count: {
            type: 'desc'
          }
        },
        take: 10
      });

      const popularTypes = gameTypeStats.map(stat => ({
        type: stat.type,
        count: stat._count.type,
        playPercentage: totalPlays > 0 ? ((stat._sum.gameTracking?.totalPlays || 0) / totalPlays) * 100 : 0
      }));

      // Get top servers by game count
      const topServersResult = await this.db.prisma.server.findMany({
        select: {
          discordId: true,
          name: true,
          _count: {
            select: {
              games: true
            }
          },
          games: {
            select: {
              gameTracking: {
                select: {
                  totalPlays: true
                }
              }
            }
          }
        },
        orderBy: {
          games: {
            _count: 'desc'
          }
        },
        take: 10
      });

      const topServers = topServersResult.map(server => ({
        serverId: server.discordId,
        serverName: server.name || 'Unknown Server',
        gameCount: server._count.games,
        totalPlays: server.games.reduce((sum, game) => 
          sum + (game.gameTracking?.totalPlays || 0), 0
        )
      }));

      // Get recent trends (last 7 days vs previous 7 days)
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const recentGames = await this.db.prisma.game.count({
        where: { createdAt: { gte: weekAgo } }
      });

      const previousGames = await this.db.prisma.game.count({
        where: { 
          createdAt: { 
            gte: twoWeeksAgo,
            lt: weekAgo
          }
        }
      });

      const recentTrends = [
        {
          period: 'This Week',
          gamesCreated: recentGames,
          totalPlays: 0, // Would calculate from play events
          newServers: 0 // Would calculate from server join events
        },
        {
          period: 'Last Week',
          gamesCreated: previousGames,
          totalPlays: 0,
          newServers: 0
        }
      ];

      const stats: GameDiscoveryStats = {
        totalGames,
        totalPlays,
        averageRating: 4.2, // Would calculate from actual ratings
        popularTypes,
        topServers,
        recentTrends
      };

      // Cache stats
      await this.cache.set(cacheKey, JSON.stringify(stats), this.CACHE_TTL.STATS);

      return stats;

    } catch (error) {
      console.error('Error getting discovery stats:', error);
      return {
        totalGames: 0,
        totalPlays: 0,
        averageRating: 0,
        popularTypes: [],
        topServers: [],
        recentTrends: []
      };
    }
  }

  /**
   * Search games across servers
   */
  async searchGames(
    query: string,
    limit: number = 20,
    filters: DiscoveryFilters = {}
  ): Promise<TrendingGame[]> {
    const cacheKey = `search_games:${query}:${limit}:${JSON.stringify(filters)}`;
    const cached = await this.cache.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const whereClause = {
        ...this.buildWhereClause(filters),
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      };

      const games = await this.db.prisma.game.findMany({
        where: whereClause,
        include: {
          gameTracking: true,
          server: {
            select: {
              discordId: true,
              name: true
            }
          }
        },
        orderBy: [
          { gameTracking: { totalPlays: 'desc' } },
          { createdAt: 'desc' }
        ],
        take: limit
      });

      const searchResults = games.map(game => ({
        id: game.id,
        shortId: game.shortId,
        title: game.title,
        description: game.description || '',
        type: game.type,
        creatorName: game.metadata?.creatorName || 'Unknown',
        creatorId: game.creatorId,
        serverName: game.server?.name || 'Unknown Server',
        serverId: game.serverId,
        playCount: game.gameTracking?.totalPlays || 0,
        serverCount: game.gameTracking?.uniqueServers || 1,
        lastPlayedAt: game.gameTracking?.lastPlayedAt || game.createdAt,
        createdAt: game.createdAt,
        trendingScore: 0,
        tags: this.extractGameTags(game),
        metadata: game.metadata as Record<string, any> || {}
      })) as TrendingGame[];

      // Cache search results
      await this.cache.set(cacheKey, JSON.stringify(searchResults), this.CACHE_TTL.DISCOVERY);

      return searchResults;

    } catch (error) {
      console.error('Error searching games:', error);
      return [];
    }
  }

  /**
   * Get featured games (editor's picks or algorithmic selection)
   */
  async getFeaturedGames(limit: number = 10): Promise<TrendingGame[]> {
    const cacheKey = `featured_games:${limit}`;
    const cached = await this.cache.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Get games with high engagement and quality
      const games = await this.db.prisma.game.findMany({
        where: {
          gameTracking: {
            totalPlays: { gte: 50 }, // Minimum threshold for featuring
            uniqueServers: { gte: 3 } // Must be popular across servers
          }
        },
        include: {
          gameTracking: true,
          server: {
            select: {
              discordId: true,
              name: true
            }
          }
        },
        orderBy: [
          { gameTracking: { totalPlays: 'desc' } },
          { gameTracking: { uniqueServers: 'desc' } },
          { createdAt: 'desc' }
        ],
        take: limit
      });

      const featured = games.map(game => ({
        id: game.id,
        shortId: game.shortId,
        title: game.title,
        description: game.description || '',
        type: game.type,
        creatorName: game.metadata?.creatorName || 'Unknown',
        creatorId: game.creatorId,
        serverName: game.server?.name || 'Unknown Server',
        serverId: game.serverId,
        playCount: game.gameTracking?.totalPlays || 0,
        serverCount: game.gameTracking?.uniqueServers || 1,
        lastPlayedAt: game.gameTracking?.lastPlayedAt || game.createdAt,
        createdAt: game.createdAt,
        trendingScore: 0,
        tags: this.extractGameTags(game),
        metadata: game.metadata as Record<string, any> || {}
      })) as TrendingGame[];

      // Cache featured games
      await this.cache.set(cacheKey, JSON.stringify(featured), this.CACHE_TTL.DISCOVERY);

      return featured;

    } catch (error) {
      console.error('Error getting featured games:', error);
      return [];
    }
  }

  /**
   * Private helper methods
   */
  private async calculateTrendingScore(game: any): Promise<number> {
    const tracking = game.gameTracking;
    if (!tracking) return 0;

    const now = new Date();
    const ageInHours = (now.getTime() - new Date(game.createdAt).getTime()) / (1000 * 60 * 60);
    const lastPlayAge = tracking.lastPlayedAt ? 
      (now.getTime() - new Date(tracking.lastPlayedAt).getTime()) / (1000 * 60 * 60) : ageInHours;

    // Base score from plays
    let score = tracking.totalPlays;

    // Boost newer games
    if (ageInHours < 24) score *= 2; // New games get boost
    else if (ageInHours < 168) score *= 1.5; // Week-old games get smaller boost

    // Boost recently played games
    if (lastPlayAge < 1) score *= 2; // Recently played
    else if (lastPlayAge < 24) score *= 1.5;

    // Boost cross-server games
    if (tracking.uniqueServers > 1) {
      score *= (1 + tracking.uniqueServers * 0.2);
    }

    // Apply time decay
    const decayFactor = Math.max(0.1, 1 - (ageInHours / this.TRENDING_DECAY_HOURS));
    score *= decayFactor;

    return Math.round(score * 100) / 100;
  }

  private buildWhereClause(filters: DiscoveryFilters): any {
    const where: any = {};

    if (filters.gameType) {
      where.type = filters.gameType;
    }

    if (filters.minPlays) {
      where.gameTracking = {
        totalPlays: { gte: filters.minPlays }
      };
    }

    if (filters.maxAge && filters.maxAge !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      switch (filters.maxAge) {
        case 'day':
          cutoff.setDate(now.getDate() - 1);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoff.setMonth(now.getMonth() - 1);
          break;
      }
      
      where.createdAt = { gte: cutoff };
    }

    if (filters.excludeServer) {
      where.serverId = { not: filters.excludeServer };
    }

    return where;
  }

  private extractGameTags(game: any): string[] {
    const tags: string[] = [];
    
    // Add game type as tag
    tags.push(game.type.toLowerCase());
    
    // Extract tags from metadata or description
    const metadata = game.metadata || {};
    if (metadata.tags) {
      tags.push(...metadata.tags);
    }
    
    // Add difficulty if available
    if (metadata.difficulty) {
      tags.push(metadata.difficulty.toLowerCase());
    }
    
    // Add player count tag
    if (metadata.maxPlayers) {
      if (metadata.maxPlayers === 1) tags.push('singleplayer');
      else tags.push('multiplayer');
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  private async enrichTrendingGames(games: TrendingGame[]): Promise<TrendingGame[]> {
    // Add any additional enrichment like creator avatars, server icons, etc.
    return games;
  }

  private generateTrendingCacheKey(limit: number, filters: DiscoveryFilters): string {
    const filterString = JSON.stringify(filters);
    return `trending_games:${limit}:${Buffer.from(filterString).toString('base64')}`;
  }

  /**
   * Analytics tracking
   */
  async trackDiscoveryEvent(
    eventType: 'game_discovered' | 'game_searched' | 'featured_viewed',
    userId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await this.analytics.track(`discovery_${eventType}`, {
      userId,
      ...metadata
    });
  }
}