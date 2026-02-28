import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { Container } from 'inversify';
import { LeaderboardService } from '../services/leaderboard.js';
import { TYPES } from '../types.js';

export class LeaderboardAPI {
  private leaderboardService: LeaderboardService;

  constructor(container: Container) {
    this.leaderboardService = container.get<LeaderboardService>(TYPES.LeaderboardService);
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    // Parse URL
    const url = new URL(req.url!, `http://${req.headers.host}`);
    
    // Match API routes
    const submitScoreMatch = pathname.match(/^\/api\/leaderboard\/([^\/]+)\/submit$/);
    const getLeaderboardMatch = pathname.match(/^\/api\/leaderboard\/([^\/]+)$/);
    const getUserRankMatch = pathname.match(/^\/api\/leaderboard\/([^\/]+)\/rank\/([^\/]+)$/);
    const getStatsMatch = pathname.match(/^\/api\/leaderboard\/([^\/]+)\/stats$/);
    const getUserStatsMatch = pathname.match(/^\/api\/user\/([^\/]+)\/stats$/);

    if (submitScoreMatch && req.method === 'POST') {
      await this.handleSubmitScore(req, res, submitScoreMatch[1]);
      return true;
    } else if (getLeaderboardMatch && req.method === 'GET') {
      await this.handleGetLeaderboard(req, res, getLeaderboardMatch[1], url);
      return true;
    } else if (getUserRankMatch && req.method === 'GET') {
      await this.handleGetUserRank(req, res, getUserRankMatch[1], getUserRankMatch[2]);
      return true;
    } else if (getStatsMatch && req.method === 'GET') {
      await this.handleGetStats(req, res, getStatsMatch[1]);
      return true;
    } else if (getUserStatsMatch && req.method === 'GET') {
      await this.handleGetUserStats(req, res, getUserStatsMatch[1]);
      return true;
    }

    return false;
  }

  private async handleSubmitScore(req: IncomingMessage, res: ServerResponse, gameId: string): Promise<void> {
    try {
      // Parse request body
      const body = await this.parseRequestBody(req);
      const { userId, score, metadata } = body;

      if (!userId || typeof score !== 'number') {
        this.sendResponse(res, 400, { error: 'Missing required fields: userId, score' });
        return;
      }

      const entry = await this.leaderboardService.submitScore(gameId, userId, score, metadata);
      this.sendResponse(res, 200, { success: true, entry });
    } catch (error: any) {
      console.error('Error submitting score:', error);
      this.sendResponse(res, 500, { error: error.message || 'Failed to submit score' });
    }
  }

  private async handleGetLeaderboard(req: IncomingMessage, res: ServerResponse, gameId: string, url: URL): Promise<void> {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const entries = await this.leaderboardService.getLeaderboard(gameId, limit, offset);
      this.sendResponse(res, 200, { entries });
    } catch (error: any) {
      console.error('Error getting leaderboard:', error);
      this.sendResponse(res, 500, { error: error.message || 'Failed to get leaderboard' });
    }
  }

  private async handleGetUserRank(req: IncomingMessage, res: ServerResponse, gameId: string, userId: string): Promise<void> {
    try {
      const rank = await this.leaderboardService.getUserRank(gameId, userId);
      this.sendResponse(res, 200, { rank });
    } catch (error: any) {
      console.error('Error getting user rank:', error);
      this.sendResponse(res, 500, { error: error.message || 'Failed to get user rank' });
    }
  }

  private async handleGetStats(req: IncomingMessage, res: ServerResponse, gameId: string): Promise<void> {
    try {
      const stats = await this.leaderboardService.getLeaderboardStats(gameId);
      this.sendResponse(res, 200, stats);
    } catch (error: any) {
      console.error('Error getting leaderboard stats:', error);
      this.sendResponse(res, 500, { error: error.message || 'Failed to get leaderboard stats' });
    }
  }

  private async handleGetUserStats(req: IncomingMessage, res: ServerResponse, userId: string): Promise<void> {
    try {
      const stats = await this.leaderboardService.getUserStats(userId);
      this.sendResponse(res, 200, stats);
    } catch (error: any) {
      console.error('Error getting user stats:', error);
      this.sendResponse(res, 500, { error: error.message || 'Failed to get user stats' });
    }
  }

  private async parseRequestBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Invalid JSON'));
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