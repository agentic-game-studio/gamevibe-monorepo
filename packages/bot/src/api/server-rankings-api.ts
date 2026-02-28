import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { Container } from 'inversify';
import { ServerRankingService } from '../services/server-rankings.js';
import { AnalyticsService } from '../services/analytics.js';
import { TYPES } from '../types.js';

export class ServerRankingsAPI {
  private serverRankingService: ServerRankingService;
  private analytics: AnalyticsService;

  constructor(container: Container) {
    this.serverRankingService = container.get<ServerRankingService>(TYPES.ServerRankingService);
    this.analytics = container.get<AnalyticsService>(TYPES.AnalyticsService);
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    // Parse URL
    const url = new URL(req.url!, `http://${req.headers.host}`);
    
    // Match server rankings API routes
    const leaderboardMatch = pathname.match(/^\/api\/server-rankings\/leaderboard$/);
    const serverRankMatch = pathname.match(/^\/api\/server-rankings\/server\/([^\/]+)$/);
    const compareMatch = pathname.match(/^\/api\/server-rankings\/compare$/);
    const trendingMatch = pathname.match(/^\/api\/server-rankings\/trending$/);
    const statsMatch = pathname.match(/^\/api\/server-rankings\/stats$/);
    const updateMatch = pathname.match(/^\/api\/server-rankings\/update$/);

    if (leaderboardMatch && req.method === 'GET') {
      await this.handleGetLeaderboard(req, res, url);
      return true;
    } else if (serverRankMatch && req.method === 'GET') {
      await this.handleGetServerRank(req, res, serverRankMatch[1], url);
      return true;
    } else if (compareMatch && req.method === 'POST') {
      await this.handleCompareServers(req, res);
      return true;
    } else if (trendingMatch && req.method === 'GET') {
      await this.handleGetTrending(req, res, url);
      return true;
    } else if (statsMatch && req.method === 'GET') {
      await this.handleGetStats(req, res, url);
      return true;
    } else if (updateMatch && req.method === 'POST') {
      await this.handleUpdateRankings(req, res);
      return true;
    }

    return false;
  }

  private async handleGetLeaderboard(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    try {
      const category = url.searchParams.get('category') || 'overall';
      const timeframe = url.searchParams.get('timeframe') || 'month';
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // Validate parameters
      const validCategories = ['overall', 'creative', 'engagement', 'viral', 'growth', 'diversity'];
      const validTimeframes = ['week', 'month', 'all'];

      if (!validCategories.includes(category)) {
        this.sendResponse(res, 400, {
          success: false,
          error: `Invalid category. Valid options: ${validCategories.join(', ')}`
        });
        return;
      }

      if (!validTimeframes.includes(timeframe)) {
        this.sendResponse(res, 400, {
          success: false,
          error: `Invalid timeframe. Valid options: ${validTimeframes.join(', ')}`
        });
        return;
      }

      if (limit < 1 || limit > 100) {
        this.sendResponse(res, 400, {
          success: false,
          error: 'Limit must be between 1 and 100'
        });
        return;
      }

      const rankings = await this.serverRankingService.getServerRankings(
        category as any,
        limit + offset, // Get extra to handle offset
        timeframe as any
      );

      // Apply offset
      const paginatedServers = rankings.servers.slice(offset, offset + limit);

      // Track API usage
      await this.analytics.track('server_rankings_api_leaderboard', {
        category,
        timeframe,
        limit,
        offset,
        resultCount: paginatedServers.length,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer
      });

      this.sendResponse(res, 200, {
        success: true,
        data: {
          ...rankings,
          servers: paginatedServers,
          pagination: {
            limit,
            offset,
            total: rankings.servers.length,
            hasMore: offset + limit < rankings.servers.length
          }
        }
      });

    } catch (error: any) {
      console.error('Error in leaderboard API:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: error.message || 'Failed to get leaderboard'
      });
    }
  }

  private async handleGetServerRank(req: IncomingMessage, res: ServerResponse, serverId: string, url: URL): Promise<void> {
    try {
      const category = url.searchParams.get('category') || 'overall';
      const timeframe = url.searchParams.get('timeframe') || 'month';

      const serverRanking = await this.serverRankingService.getServerRanking(
        serverId,
        category as any,
        timeframe as any
      );

      if (!serverRanking) {
        this.sendResponse(res, 404, {
          success: false,
          error: 'Server not found in rankings'
        });
        return;
      }

      // Track API usage
      await this.analytics.track('server_rankings_api_server_rank', {
        serverId,
        category,
        timeframe,
        rank: serverRanking.rank,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer
      });

      this.sendResponse(res, 200, {
        success: true,
        data: serverRanking
      });

    } catch (error: any) {
      console.error('Error in server rank API:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: error.message || 'Failed to get server rank'
      });
    }
  }

  private async handleCompareServers(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { serverAId, serverBId, timeframe = 'month' } = body;

      if (!serverAId || !serverBId) {
        this.sendResponse(res, 400, {
          success: false,
          error: 'Both serverAId and serverBId are required'
        });
        return;
      }

      if (serverAId === serverBId) {
        this.sendResponse(res, 400, {
          success: false,
          error: 'Cannot compare a server with itself'
        });
        return;
      }

      const comparison = await this.serverRankingService.compareServers(
        serverAId,
        serverBId,
        timeframe
      );

      if (!comparison) {
        this.sendResponse(res, 404, {
          success: false,
          error: 'One or both servers not found in rankings'
        });
        return;
      }

      // Track API usage
      await this.analytics.track('server_rankings_api_compare', {
        serverAId,
        serverBId,
        timeframe,
        winner: comparison.overallWinner,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer
      });

      this.sendResponse(res, 200, {
        success: true,
        data: comparison
      });

    } catch (error: any) {
      console.error('Error in compare servers API:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: error.message || 'Failed to compare servers'
      });
    }
  }

  private async handleGetTrending(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    try {
      const direction = url.searchParams.get('direction') || 'up';
      const limit = parseInt(url.searchParams.get('limit') || '20');

      const validDirections = ['up', 'down', 'both'];
      if (!validDirections.includes(direction)) {
        this.sendResponse(res, 400, {
          success: false,
          error: `Invalid direction. Valid options: ${validDirections.join(', ')}`
        });
        return;
      }

      if (limit < 1 || limit > 50) {
        this.sendResponse(res, 400, {
          success: false,
          error: 'Limit must be between 1 and 50'
        });
        return;
      }

      const trending = await this.serverRankingService.getTrendingServers(
        direction as any,
        limit
      );

      // Track API usage
      await this.analytics.track('server_rankings_api_trending', {
        direction,
        limit,
        resultCount: trending.length,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer
      });

      this.sendResponse(res, 200, {
        success: true,
        data: {
          direction,
          servers: trending,
          total: trending.length
        }
      });

    } catch (error: any) {
      console.error('Error in trending API:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: error.message || 'Failed to get trending servers'
      });
    }
  }

  private async handleGetStats(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    try {
      const timeframe = url.searchParams.get('timeframe') || 'month';

      const validTimeframes = ['week', 'month', 'all'];
      if (!validTimeframes.includes(timeframe)) {
        this.sendResponse(res, 400, {
          success: false,
          error: `Invalid timeframe. Valid options: ${validTimeframes.join(', ')}`
        });
        return;
      }

      const stats = await this.serverRankingService.getRankingStats(timeframe as any);

      // Track API usage
      await this.analytics.track('server_rankings_api_stats', {
        timeframe,
        totalServers: stats.totalServers,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer
      });

      this.sendResponse(res, 200, {
        success: true,
        data: stats
      });

    } catch (error: any) {
      console.error('Error in stats API:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: error.message || 'Failed to get ranking stats'
      });
    }
  }

  private async handleUpdateRankings(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      // This endpoint could be protected with API key authentication
      const body = await this.parseRequestBody(req);
      const { apiKey } = body;

      // Simple API key check (in production, use proper authentication)
      const validApiKey = process.env.RANKINGS_UPDATE_API_KEY;
      if (validApiKey && apiKey !== validApiKey) {
        this.sendResponse(res, 401, {
          success: false,
          error: 'Invalid API key'
        });
        return;
      }

      await this.serverRankingService.updateRankings();

      // Track API usage
      await this.analytics.track('server_rankings_api_update', {
        triggeredBy: 'api',
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer
      });

      this.sendResponse(res, 200, {
        success: true,
        message: 'Server rankings updated successfully'
      });

    } catch (error: any) {
      console.error('Error in update rankings API:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: error.message || 'Failed to update rankings'
      });
    }
  }

  private async parseRequestBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
      req.on('error', reject);
    });
  }

  private sendResponse(res: ServerResponse, statusCode: number, data: any): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  }
}