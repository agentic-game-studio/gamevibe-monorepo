import axios from 'axios';
import { z } from 'zod';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Schemas
export const GameSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  shortId: z.string(),
  type: z.enum(['PLATFORMER', 'SHOOTER', 'PUZZLE', 'RPG', 'ENDLESS_RUNNER', 'RACING', 'STRATEGY']),
  serverId: z.string(),
  creatorId: z.string(),
  creatorName: z.string().optional(),
  creatorAvatar: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  plays: z.number(),
  shares: z.number(),
  likes: z.number(),
  createdAt: z.string(),
  metadata: z.any().optional(),
});

export const CreatorSchema = z.object({
  userId: z.string(),
  username: z.string(),
  avatar: z.string().optional(),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']),
  balance: z.number(),
  lifetimeEarned: z.number(),
  gamesCreated: z.number(),
  totalPlays: z.number(),
  totalShares: z.number(),
  uniqueServers: z.number(),
});

export const LeaderboardEntrySchema = z.object({
  id: z.string(),
  gameId: z.string(),
  userId: z.string(),
  username: z.string(),
  score: z.number(),
  createdAt: z.string(),
});

export const TrendingGameSchema = GameSchema.extend({
  trendingScore: z.number(),
  uniqueServers: z.number(),
  recentPlays: z.number(),
});

// Types
export type Game = z.infer<typeof GameSchema>;
export type Creator = z.infer<typeof CreatorSchema>;
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;
export type TrendingGame = z.infer<typeof TrendingGameSchema>;

// API Client
class APIClient {
  private client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
  });

  // Games
  async getTrendingGames(limit = 10): Promise<TrendingGame[]> {
    const { data } = await this.client.get('/api/discover/trending', {
      params: { limit },
    });
    return z.array(TrendingGameSchema).parse(data.games);
  }

  async searchGames(query: string, type?: string, limit = 20): Promise<Game[]> {
    const { data } = await this.client.get('/api/discover/search', {
      params: { query, type, limit },
    });
    return z.array(GameSchema).parse(data.games);
  }

  async getFeaturedGames(limit = 10): Promise<Game[]> {
    const { data } = await this.client.get('/api/discover/featured', {
      params: { limit },
    });
    return z.array(GameSchema).parse(data.games);
  }

  async getGame(gameId: string): Promise<Game> {
    const { data } = await this.client.get(`/api/games/${gameId}`);
    return GameSchema.parse(data);
  }

  async getGamesByCreator(creatorId: string, limit = 20): Promise<Game[]> {
    const { data } = await this.client.get('/api/games', {
      params: { creatorId, limit },
    });
    return z.array(GameSchema).parse(data.games);
  }

  async getAllGames(params: {
    page?: number;
    limit?: number;
    type?: string;
    sort?: string;
  }): Promise<{ games: Game[]; totalPages: number; total: number }> {
    const { data } = await this.client.get('/api/games', { params });
    return {
      games: z.array(GameSchema).parse(data.games || []),
      totalPages: data.totalPages || 1,
      total: data.total || 0,
    };
  }

  // Creators
  async getTopCreators(limit = 10, timeframe = '30d'): Promise<Creator[]> {
    const { data } = await this.client.get('/api/creators/top', {
      params: { limit, timeframe },
    });
    return z.array(CreatorSchema).parse(data.creators);
  }

  async getCreator(userId: string): Promise<Creator> {
    const { data } = await this.client.get(`/api/creators/${userId}`);
    return CreatorSchema.parse(data);
  }

  // Leaderboards
  async getGameLeaderboard(gameId: string, limit = 10): Promise<LeaderboardEntry[]> {
    const { data } = await this.client.get(`/api/leaderboard/${gameId}`, {
      params: { limit },
    });
    return z.array(LeaderboardEntrySchema).parse(data.entries);
  }

  async getGlobalLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    const { data } = await this.client.get('/api/leaderboard/global', {
      params: { limit },
    });
    return z.array(LeaderboardEntrySchema).parse(data.entries);
  }

  // Platform Stats
  async getPlatformStats(): Promise<{
    totalGames: number;
    totalPlayers: number;
    totalPlays: number;
    activeServers: number;
  }> {
    const { data } = await this.client.get('/api/discover/stats');
    return data.stats;
  }

  // Live Activity
  async getLiveActivity(limit = 20): Promise<any[]> {
    const { data } = await this.client.get('/api/live-activity/feed', {
      params: { limit },
    });
    return data.activities;
  }

  // Embed
  async createEmbed(gameId: string, options?: {
    width?: number;
    height?: number;
    theme?: string;
  }): Promise<{ embedId: string; embedCode: string; shareUrl: string }> {
    const { data } = await this.client.post('/api/embed/generate', {
      gameId,
      ...options,
    });
    return data;
  }
}

export const apiClient = new APIClient();