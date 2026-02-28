import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { Container } from 'inversify';
import { GameTrackingService } from '../services/game-tracking.js';
import { AnalyticsService } from '../services/analytics.js';
import { TYPES } from '../types.js';

export class AnalyticsAPI {
  private gameTrackingService: GameTrackingService;
  private analyticsService: AnalyticsService;

  constructor(container: Container) {
    this.gameTrackingService = container.get<GameTrackingService>(TYPES.GameTrackingService);
    this.analyticsService = container.get<AnalyticsService>(TYPES.AnalyticsService);
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    // Match API routes
    if (pathname === '/api/analytics/game-start' && req.method === 'POST') {
      await this.handleGameStart(req, res);
      return true;
    } else if (pathname === '/api/analytics/game-end' && req.method === 'POST') {
      await this.handleGameEnd(req, res);
      return true;
    } else if (pathname === '/api/analytics/event' && req.method === 'POST') {
      await this.handleTrackEvent(req, res);
      return true;
    }

    return false;
  }

  private async handleGameStart(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { gameId, timestamp, userAgent } = body;

      if (!gameId) {
        this.sendResponse(res, 400, { error: 'gameId is required' });
        return;
      }

      // Get user info from authorization header (if available)
      const userId = this.getUserIdFromAuth(req);
      const serverId = this.getServerIdFromHeaders(req);

      // Track game start
      const sessionId = await this.gameTrackingService.trackGameStart(
        gameId,
        userId || 'anonymous',
        serverId || 'unknown',
        'web' // Default channel for web runtime
      );

      // Track analytics event
      await this.analyticsService.track('game_started_web', {
        gameId,
        userId,
        serverId,
        timestamp,
        userAgent,
        sessionId
      });

      this.sendResponse(res, 200, { 
        success: true, 
        sessionId,
        message: 'Game start tracked' 
      });
    } catch (error) {
      console.error('Error tracking game start:', error);
      this.sendResponse(res, 500, { error: 'Failed to track game start' });
    }
  }

  private async handleGameEnd(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { gameId, score, duration, timestamp, sessionId } = body;

      if (!gameId) {
        this.sendResponse(res, 400, { error: 'gameId is required' });
        return;
      }

      // Get user info from authorization header (if available)
      const userId = this.getUserIdFromAuth(req);
      const serverId = this.getServerIdFromHeaders(req);

      // Track game play for credit earning
      await this.gameTrackingService.trackGamePlay(
        gameId,
        userId || 'anonymous',
        serverId || 'unknown'
      );

      // Track game end if session exists
      if (sessionId) {
        await this.gameTrackingService.trackGameEnd(sessionId, userId || 'anonymous', score);
      }

      // Track analytics event
      await this.analyticsService.track('game_ended_web', {
        gameId,
        userId,
        serverId,
        score,
        duration,
        timestamp,
        sessionId
      });

      this.sendResponse(res, 200, { 
        success: true, 
        message: 'Game end tracked',
        creditsEarned: 'Credits will be awarded after 10 plays'
      });
    } catch (error) {
      console.error('Error tracking game end:', error);
      this.sendResponse(res, 500, { error: 'Failed to track game end' });
    }
  }

  private async handleTrackEvent(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { event, data, timestamp } = body;

      if (!event) {
        this.sendResponse(res, 400, { error: 'event is required' });
        return;
      }

      // Get user info from authorization header (if available)
      const userId = this.getUserIdFromAuth(req);
      const serverId = this.getServerIdFromHeaders(req);

      // Track analytics event
      await this.analyticsService.track(event, {
        ...data,
        userId,
        serverId,
        timestamp,
        source: 'web'
      });

      this.sendResponse(res, 200, { 
        success: true, 
        message: 'Event tracked' 
      });
    } catch (error) {
      console.error('Error tracking event:', error);
      this.sendResponse(res, 500, { error: 'Failed to track event' });
    }
  }

  private async parseRequestBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
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

  private getUserIdFromAuth(req: IncomingMessage): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    // In a real implementation, decode JWT or validate token
    // For now, just extract a simple user ID if present
    try {
      const token = authHeader.substring(7);
      // This is a placeholder - implement proper JWT validation
      return null;
    } catch (error) {
      return null;
    }
  }

  private getServerIdFromHeaders(req: IncomingMessage): string | null {
    // Check for custom header that might contain server ID
    return req.headers['x-server-id'] as string || null;
  }

  private sendResponse(res: ServerResponse, statusCode: number, data: any): void {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = statusCode;
    res.end(JSON.stringify(data, null, 2));
  }
}