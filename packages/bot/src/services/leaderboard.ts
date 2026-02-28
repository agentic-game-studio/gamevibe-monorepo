import { injectable, inject } from 'inversify';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { TYPES } from '../types.js';
import { LeaderboardEntry, User, Game } from '../generated/prisma/index.js';

export interface LeaderboardEntryWithUser extends LeaderboardEntry {
  user: User;
}

export interface LeaderboardStats {
  totalPlayers: number;
  highestScore: number;
  averageScore: number;
  recentEntries: LeaderboardEntryWithUser[];
}

@injectable()
export class LeaderboardService {
  constructor(
    @inject(TYPES.DatabaseService) private database: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService
  ) {}

  async submitScore(
    gameId: string,
    userId: string,
    score: number,
    metadata?: Record<string, any>
  ): Promise<LeaderboardEntry> {
    // Get or create user
    const user = await this.database.getUserByDiscordId(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if game exists
    const game = await this.database.prisma.game.findUnique({
      where: { id: gameId }
    });
    if (!game) {
      throw new Error('Game not found');
    }

    // Get existing entry
    const existing = await this.database.prisma.leaderboardEntry.findUnique({
      where: {
        gameId_userId: {
          gameId,
          userId: user.id
        }
      }
    });

    // Only update if new score is higher
    if (existing && existing.score >= score) {
      return existing;
    }

    // Update or create entry
    const entry = await this.database.prisma.leaderboardEntry.upsert({
      where: {
        gameId_userId: {
          gameId,
          userId: user.id
        }
      },
      update: {
        score,
        metadata: metadata || {},
        achievedAt: new Date()
      },
      create: {
        gameId,
        userId: user.id,
        score,
        metadata: metadata || {}
      }
    });

    // Invalidate cache
    await this.cache.delete(`leaderboard:${gameId}:*`);

    // Update game play count
    await this.database.prisma.game.update({
      where: { id: gameId },
      data: { playCount: { increment: 1 } }
    });

    return entry;
  }

  async getLeaderboard(
    gameId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<LeaderboardEntryWithUser[]> {
    const cacheKey = `leaderboard:${gameId}:${limit}:${offset}`;
    
    // Check cache
    const cached = await this.cache.get<LeaderboardEntryWithUser[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const entries = await this.database.prisma.leaderboardEntry.findMany({
      where: { gameId },
      orderBy: { score: 'desc' },
      take: limit,
      skip: offset,
      include: { user: true }
    });

    // Cache for 5 minutes
    await this.cache.set(cacheKey, entries, 300);

    return entries;
  }

  async getGlobalLeaderboard(
    limit: number = 10
  ): Promise<Array<LeaderboardEntryWithUser & { game: Game }>> {
    const cacheKey = `leaderboard:global:${limit}`;
    
    // Check cache
    const cached = await this.cache.get<Array<LeaderboardEntryWithUser & { game: Game }>>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch top scores across all games
    const entries = await this.database.prisma.leaderboardEntry.findMany({
      orderBy: { score: 'desc' },
      take: limit,
      include: {
        user: true,
        game: true
      }
    });

    // Cache for 5 minutes
    await this.cache.set(cacheKey, entries, 300);

    return entries;
  }

  async getUserRank(gameId: string, userId: string): Promise<number | null> {
    const user = await this.database.getUserByDiscordId(userId);
    if (!user) {
      return null;
    }

    const entry = await this.database.prisma.leaderboardEntry.findUnique({
      where: {
        gameId_userId: {
          gameId,
          userId: user.id
        }
      }
    });

    if (!entry) {
      return null;
    }

    // Count entries with higher scores
    const rank = await this.database.prisma.leaderboardEntry.count({
      where: {
        gameId,
        score: { gt: entry.score }
      }
    });

    return rank + 1;
  }

  async getLeaderboardStats(gameId: string): Promise<LeaderboardStats> {
    const cacheKey = `leaderboard:stats:${gameId}`;
    
    // Check cache
    const cached = await this.cache.get<LeaderboardStats>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get aggregate data
    const [stats, recentEntries] = await Promise.all([
      this.database.prisma.leaderboardEntry.aggregate({
        where: { gameId },
        _count: true,
        _max: { score: true },
        _avg: { score: true }
      }),
      this.database.prisma.leaderboardEntry.findMany({
        where: { gameId },
        orderBy: { achievedAt: 'desc' },
        take: 5,
        include: { user: true }
      })
    ]);

    const result: LeaderboardStats = {
      totalPlayers: stats._count,
      highestScore: stats._max.score || 0,
      averageScore: Math.round(stats._avg.score || 0),
      recentEntries
    };

    // Cache for 5 minutes
    await this.cache.set(cacheKey, result, 300);

    return result;
  }

  async getUserStats(userId: string): Promise<{
    totalGamesPlayed: number;
    totalScore: number;
    bestScore: number;
    averageScore: number;
    recentGames: Array<{ game: Game; score: number; rank: number }>;
  }> {
    const user = await this.database.getUserByDiscordId(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get aggregate stats
    const stats = await this.database.prisma.leaderboardEntry.aggregate({
      where: { userId: user.id },
      _count: true,
      _sum: { score: true },
      _max: { score: true },
      _avg: { score: true }
    });

    // Get recent games with ranks
    const recentEntries = await this.database.prisma.leaderboardEntry.findMany({
      where: { userId: user.id },
      orderBy: { achievedAt: 'desc' },
      take: 5,
      include: { game: true }
    });

    // Calculate ranks for recent games
    const recentGamesWithRanks = await Promise.all(
      recentEntries.map(async (entry) => {
        const rank = await this.getUserRank(entry.gameId, userId);
        return {
          game: entry.game,
          score: entry.score,
          rank: rank || 0
        };
      })
    );

    return {
      totalGamesPlayed: stats._count,
      totalScore: stats._sum.score || 0,
      bestScore: stats._max.score || 0,
      averageScore: Math.round(stats._avg.score || 0),
      recentGames: recentGamesWithRanks
    };
  }
}