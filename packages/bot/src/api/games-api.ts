import { IncomingMessage, ServerResponse } from 'http';
import { Container } from 'inversify';
import { DatabaseService } from '../services/database.js';
import { TYPES } from '../types.js';
import { parseRequest, sendJSON, sendError } from './utils.js';

export class GamesAPI {
  private db: DatabaseService;

  constructor(container: Container) {
    this.db = container.get<DatabaseService>(TYPES.DatabaseService);
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    // Handle /api/games/* routes
    if (!pathname.startsWith('/api/games')) {
      return false;
    }

    const parts = pathname.split('/').filter(p => p);
    
    try {
      // GET /api/games/recent
      if (req.method === 'GET' && parts.length === 3 && parts[2] === 'recent') {
        await this.getRecentGames(req, res);
        return true;
      }

      // GET /api/games/popular
      if (req.method === 'GET' && parts.length === 3 && parts[2] === 'popular') {
        await this.getPopularGames(req, res);
        return true;
      }

      // GET /api/games/:id/stats
      if (req.method === 'GET' && parts.length === 4 && parts[3] === 'stats') {
        const gameId = parts[2];
        await this.getGameStats(gameId, res);
        return true;
      }

      // GET /api/games/:id (check this last so it doesn't catch 'recent' or 'popular')
      if (req.method === 'GET' && parts.length === 3) {
        const gameId = parts[2];
        await this.getGame(gameId, res);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Games API error:', error);
      sendError(res, 500, 'Internal server error');
      return true;
    }
  }

  private async getGame(gameId: string, res: ServerResponse): Promise<void> {
    try {
      // Try to find by shortId first
      const game = await this.db.prisma.game.findFirst({
        where: {
          OR: [
            { id: gameId },
            { shortId: gameId }
          ]
        },
        include: {
          creator: true,
          server: true
        }
      });

      if (!game) {
        sendError(res, 404, 'Game not found');
        return;
      }

      // Format response to match shared Game type
      const response = {
        id: game.id,
        shortId: game.shortId,
        name: game.name,
        description: game.description,
        type: game.type,
        code: game.code,
        playUrl: `/play/${game.shortId}`,
        thumbnailUrl: game.metadata?.thumbnailUrl || null,
        assets: game.assets || {},
        creatorId: game.creator.discordId,
        serverId: game.server.discordId,
        playCount: game.playCount,
        createdAt: game.createdAt.toISOString(),
        updatedAt: game.updatedAt.toISOString()
      };

      sendJSON(res, response);
    } catch (error) {
      console.error('Error fetching game:', error);
      sendError(res, 500, 'Failed to fetch game');
    }
  }

  private async getRecentGames(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const limit = parseInt(url.searchParams.get('limit') || '10');

      const games = await this.db.prisma.game.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: true,
          server: true
        }
      });

      const response = games.map(game => ({
        id: game.id,
        shortId: game.shortId,
        name: game.name,
        description: game.description,
        type: game.type,
        playUrl: `/play/${game.shortId}`,
        thumbnailUrl: game.metadata?.thumbnailUrl || null,
        creatorId: game.creator.discordId,
        serverId: game.server.discordId,
        playCount: game.playCount,
        createdAt: game.createdAt.toISOString()
      }));

      sendJSON(res, response);
    } catch (error) {
      console.error('Error fetching recent games:', error);
      sendError(res, 500, 'Failed to fetch recent games');
    }
  }

  private async getPopularGames(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const limit = parseInt(url.searchParams.get('limit') || '10');

      const games = await this.db.prisma.game.findMany({
        take: limit,
        orderBy: { playCount: 'desc' },
        where: {
          playCount: { gt: 0 }
        },
        include: {
          creator: true,
          server: true
        }
      });

      const response = games.map(game => ({
        id: game.id,
        shortId: game.shortId,
        name: game.name,
        description: game.description,
        type: game.type,
        playUrl: `/play/${game.shortId}`,
        thumbnailUrl: game.metadata?.thumbnailUrl || null,
        creatorId: game.creator.discordId,
        serverId: game.server.discordId,
        playCount: game.playCount,
        createdAt: game.createdAt.toISOString()
      }));

      sendJSON(res, response);
    } catch (error) {
      console.error('Error fetching popular games:', error);
      sendError(res, 500, 'Failed to fetch popular games');
    }
  }

  private async getGameStats(gameId: string, res: ServerResponse): Promise<void> {
    try {
      const game = await this.db.prisma.game.findFirst({
        where: {
          OR: [
            { id: gameId },
            { shortId: gameId }
          ]
        }
      });

      if (!game) {
        sendError(res, 404, 'Game not found');
        return;
      }

      // Get leaderboard data
      const topScores = await this.db.prisma.leaderboardEntry.findMany({
        where: { gameId: game.id },
        orderBy: { score: 'desc' },
        take: 10,
        include: {
          user: true
        }
      });

      const averageScore = await this.db.prisma.leaderboardEntry.aggregate({
        where: { gameId: game.id },
        _avg: { score: true }
      });

      const response = {
        id: game.id,
        playCount: game.playCount,
        averageScore: averageScore._avg.score || 0,
        topScore: topScores[0]?.score || 0,
        recentPlays: topScores.map(entry => ({
          playerId: entry.user.discordId,
          username: entry.user.username,
          score: entry.score,
          achievedAt: entry.achievedAt.toISOString()
        }))
      };

      sendJSON(res, response);
    } catch (error) {
      console.error('Error fetching game stats:', error);
      sendError(res, 500, 'Failed to fetch game stats');
    }
  }
}