// GameVibe AI Enterprise API
// Comprehensive REST API for third-party integrations and enterprise clients

import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { Container } from 'inversify';
import { createHash, randomBytes } from 'crypto';
import { DatabaseService } from '../services/database.js';
import { CacheService } from '../services/cache.js';
import { RateLimitService } from '../services/rate-limit.js';
import { TYPES } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface APIKey {
  id: string;
  key: string;
  hashedKey: string;
  name: string;
  organizationId: string;
  organizationName: string;
  tier: 'STARTER' | 'PRO' | 'ENTERPRISE';
  permissions: APIPermission[];
  rateLimits: RateLimit;
  isActive: boolean;
  lastUsed?: Date;
  createdAt: Date;
  expiresAt?: Date;
  metadata: Record<string, any>;
}

export interface APIPermission {
  resource: string; // 'games', 'users', 'analytics', 'leaderboards'
  actions: string[]; // 'read', 'write', 'delete', 'create'
  scope?: string; // 'own' | 'organization' | 'global'
}

export interface RateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

export interface WebhookConfig {
  id: string;
  apiKeyId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  retryConfig: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffSeconds: number;
  };
  headers?: Record<string, string>;
  createdAt: Date;
}

export interface APIUsageLog {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  requestSize: number;
  responseSize: number;
}

export class EnterpriseAPI {
  private logger = new Logger('EnterpriseAPI');
  private db: DatabaseService;
  private cache: CacheService;
  private rateLimit: RateLimitService;

  // Rate limit configurations by tier
  private static readonly RATE_LIMITS: Record<string, RateLimit> = {
    STARTER: {
      requestsPerMinute: 100,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      burstLimit: 10
    },
    PRO: {
      requestsPerMinute: 500,
      requestsPerHour: 10000,
      requestsPerDay: 100000,
      burstLimit: 50
    },
    ENTERPRISE: {
      requestsPerMinute: 2000,
      requestsPerHour: 50000,
      requestsPerDay: 1000000,
      burstLimit: 200
    }
  };

  constructor(container: Container) {
    this.db = container.get<DatabaseService>(TYPES.DatabaseService);
    this.cache = container.get<CacheService>(TYPES.CacheService);
    this.rateLimit = container.get<RateLimitService>(TYPES.RateLimitService);
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    const startTime = Date.now();

    // Only handle /api/v1/enterprise routes
    if (!pathname.startsWith('/api/v1/enterprise')) {
      return false;
    }

    try {
      // Skip authentication for documentation endpoints
      if (pathname.includes('/docs') || pathname.includes('/openapi.json')) {
        return false; // Let the docs handler process it
      }

      // Authentication
      const apiKey = await this.authenticateRequest(req);
      if (!apiKey) {
        this.sendResponse(res, 401, { error: 'Invalid or missing API key' });
        return true;
      }

      // Rate limiting
      const rateLimitCheck = await this.checkRateLimit(apiKey, req);
      if (!rateLimitCheck.allowed) {
        this.sendResponse(res, 429, {
          error: 'Rate limit exceeded',
          retryAfter: rateLimitCheck.retryAfter,
          limits: apiKey.rateLimits
        });
        return true;
      }

      // Permission check
      const hasPermission = await this.checkPermissions(apiKey, pathname, req.method!);
      if (!hasPermission) {
        this.sendResponse(res, 403, { error: 'Insufficient permissions' });
        return true;
      }

      // Route handling
      const handled = await this.routeRequest(req, res, pathname, apiKey);
      
      // Log API usage
      await this.logAPIUsage(apiKey, req, res, pathname, startTime);

      return handled;

    } catch (error) {
      this.logger.error('Enterprise API error:', error);
      this.sendResponse(res, 500, { error: 'Internal server error' });
      return true;
    }
  }

  private async routeRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    pathname: string, 
    apiKey: APIKey
  ): Promise<boolean> {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    
    // Extract route after /api/v1/enterprise
    const route = pathname.substring('/api/v1/enterprise'.length);

    // Game Management API
    if (route.startsWith('/games')) {
      return await this.handleGameRoutes(req, res, route, url, apiKey);
    }

    // User Management API
    if (route.startsWith('/users')) {
      return await this.handleUserRoutes(req, res, route, url, apiKey);
    }

    // Analytics API
    if (route.startsWith('/analytics')) {
      return await this.handleAnalyticsRoutes(req, res, route, url, apiKey);
    }

    // Leaderboard API
    if (route.startsWith('/leaderboards')) {
      return await this.handleLeaderboardRoutes(req, res, route, url, apiKey);
    }

    // Subscription Management API
    if (route.startsWith('/subscriptions')) {
      return await this.handleSubscriptionRoutes(req, res, route, url, apiKey);
    }

    // Webhook Management API
    if (route.startsWith('/webhooks')) {
      return await this.handleWebhookRoutes(req, res, route, url, apiKey);
    }

    // Bulk Operations API
    if (route.startsWith('/bulk')) {
      return await this.handleBulkRoutes(req, res, route, url, apiKey);
    }

    // API Management
    if (route.startsWith('/api-keys')) {
      return await this.handleAPIKeyRoutes(req, res, route, url, apiKey);
    }

    // Status and Info
    if (route === '/status' || route === '') {
      return await this.handleStatusRoute(req, res, apiKey);
    }

    this.sendResponse(res, 404, { error: 'Endpoint not found' });
    return true;
  }

  // Game Management API Routes
  private async handleGameRoutes(
    req: IncomingMessage,
    res: ServerResponse,
    route: string,
    url: URL,
    apiKey: APIKey
  ): Promise<boolean> {
    const method = req.method!;

    // GET /games - List games
    if (route === '/games' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const serverId = url.searchParams.get('serverId');
      const status = url.searchParams.get('status');

      const games = await this.listGames({
        organizationId: apiKey.organizationId,
        limit: Math.min(limit, 1000), // Cap at 1000
        offset,
        serverId,
        status
      });

      this.sendResponse(res, 200, {
        games: games.items,
        pagination: {
          total: games.total,
          limit,
          offset,
          hasMore: games.total > offset + limit
        }
      });
      return true;
    }

    // GET /games/{gameId} - Get specific game
    const gameMatch = route.match(/^\/games\/([^\/]+)$/);
    if (gameMatch && method === 'GET') {
      const gameId = gameMatch[1];
      const game = await this.getGame(gameId, apiKey.organizationId);
      
      if (!game) {
        this.sendResponse(res, 404, { error: 'Game not found' });
        return true;
      }

      this.sendResponse(res, 200, { game });
      return true;
    }

    // POST /games - Create game
    if (route === '/games' && method === 'POST') {
      const body = await this.parseRequestBody(req);
      const game = await this.createGame(body, apiKey.organizationId);
      this.sendResponse(res, 201, { game });
      return true;
    }

    // PUT /games/{gameId} - Update game
    if (gameMatch && method === 'PUT') {
      const gameId = gameMatch[1];
      const body = await this.parseRequestBody(req);
      const game = await this.updateGame(gameId, body, apiKey.organizationId);
      
      if (!game) {
        this.sendResponse(res, 404, { error: 'Game not found' });
        return true;
      }

      this.sendResponse(res, 200, { game });
      return true;
    }

    // DELETE /games/{gameId} - Delete game
    if (gameMatch && method === 'DELETE') {
      const gameId = gameMatch[1];
      const deleted = await this.deleteGame(gameId, apiKey.organizationId);
      
      if (!deleted) {
        this.sendResponse(res, 404, { error: 'Game not found' });
        return true;
      }

      this.sendResponse(res, 204, null);
      return true;
    }

    return false;
  }

  // Analytics API Routes
  private async handleAnalyticsRoutes(
    req: IncomingMessage,
    res: ServerResponse,
    route: string,
    url: URL,
    apiKey: APIKey
  ): Promise<boolean> {
    const method = req.method!;

    // GET /analytics/overview - Organization analytics overview
    if (route === '/analytics/overview' && method === 'GET') {
      const timeframe = url.searchParams.get('timeframe') || '30d';
      const analytics = await this.getAnalyticsOverview(apiKey.organizationId, timeframe);
      this.sendResponse(res, 200, { analytics });
      return true;
    }

    // GET /analytics/games/{gameId} - Game-specific analytics
    const gameAnalyticsMatch = route.match(/^\/analytics\/games\/([^\/]+)$/);
    if (gameAnalyticsMatch && method === 'GET') {
      const gameId = gameAnalyticsMatch[1];
      const timeframe = url.searchParams.get('timeframe') || '30d';
      const metrics = url.searchParams.get('metrics')?.split(',') || ['plays', 'users', 'scores'];
      
      const analytics = await this.getGameAnalytics(gameId, {
        organizationId: apiKey.organizationId,
        timeframe,
        metrics
      });
      
      this.sendResponse(res, 200, { analytics });
      return true;
    }

    // GET /analytics/real-time - Real-time analytics
    if (route === '/analytics/real-time' && method === 'GET') {
      const realTimeData = await this.getRealTimeAnalytics(apiKey.organizationId);
      this.sendResponse(res, 200, { data: realTimeData });
      return true;
    }

    // POST /analytics/events - Track custom events
    if (route === '/analytics/events' && method === 'POST') {
      const body = await this.parseRequestBody(req);
      await this.trackCustomEvent(body, apiKey.organizationId);
      this.sendResponse(res, 200, { success: true });
      return true;
    }

    return false;
  }

  // Status Route
  private async handleStatusRoute(
    req: IncomingMessage,
    res: ServerResponse,
    apiKey: APIKey
  ): Promise<boolean> {
    const status = {
      service: 'GameVibe Enterprise API',
      version: 'v1.0.0',
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        organization: apiKey.organizationName,
        tier: apiKey.tier,
        permissions: apiKey.permissions,
        rateLimits: apiKey.rateLimits
      },
      endpoints: {
        games: '/api/v1/enterprise/games',
        users: '/api/v1/enterprise/users',
        analytics: '/api/v1/enterprise/analytics',
        leaderboards: '/api/v1/enterprise/leaderboards',
        subscriptions: '/api/v1/enterprise/subscriptions',
        webhooks: '/api/v1/enterprise/webhooks',
        bulk: '/api/v1/enterprise/bulk'
      },
      documentation: 'https://docs.gamevibe.ai/enterprise-api',
      support: 'enterprise@gamevibe.ai'
    };

    this.sendResponse(res, 200, status);
    return true;
  }

  // Authentication
  private async authenticateRequest(req: IncomingMessage): Promise<APIKey | null> {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const apiKeyValue = authHeader.substring(7);
    
    // Check cache first
    const cacheKey = `api_key:${this.hashAPIKey(apiKeyValue)}`;
    let apiKey = await this.cache.get<APIKey>(cacheKey);
    
    if (!apiKey) {
      // Load from database
      apiKey = await this.getAPIKeyByValue(apiKeyValue);
      
      if (apiKey) {
        // Cache for 5 minutes
        await this.cache.set(cacheKey, apiKey, 300);
      }
    }

    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp (async)
    this.updateAPIKeyLastUsed(apiKey.id).catch(error => {
      this.logger.error('Failed to update API key last used:', error);
    });

    return apiKey;
  }

  // Rate Limiting
  private async checkRateLimit(apiKey: APIKey, req: IncomingMessage): Promise<{
    allowed: boolean;
    retryAfter?: number;
  }> {
    const limits = apiKey.rateLimits;
    const keyPrefix = `rate_limit:${apiKey.id}`;

    // Check minute limit
    const minuteKey = `${keyPrefix}:minute:${Math.floor(Date.now() / 60000)}`;
    const minuteCount = await this.cache.get<number>(minuteKey) || 0;
    
    if (minuteCount >= limits.requestsPerMinute) {
      return { allowed: false, retryAfter: 60 };
    }

    // Check hour limit
    const hourKey = `${keyPrefix}:hour:${Math.floor(Date.now() / 3600000)}`;
    const hourCount = await this.cache.get<number>(hourKey) || 0;
    
    if (hourCount >= limits.requestsPerHour) {
      return { allowed: false, retryAfter: 3600 };
    }

    // Check daily limit
    const dayKey = `${keyPrefix}:day:${Math.floor(Date.now() / 86400000)}`;
    const dayCount = await this.cache.get<number>(dayKey) || 0;
    
    if (dayCount >= limits.requestsPerDay) {
      return { allowed: false, retryAfter: 86400 };
    }

    // Increment counters
    await Promise.all([
      this.cache.set(minuteKey, minuteCount + 1, 60),
      this.cache.set(hourKey, hourCount + 1, 3600),
      this.cache.set(dayKey, dayCount + 1, 86400)
    ]);

    return { allowed: true };
  }

  // Permission Checking
  private async checkPermissions(apiKey: APIKey, pathname: string, method: string): Promise<boolean> {
    const resource = this.extractResourceFromPath(pathname);
    const action = this.methodToAction(method);

    return apiKey.permissions.some(permission => {
      return permission.resource === resource && permission.actions.includes(action);
    });
  }

  // Utility Methods
  private extractResourceFromPath(pathname: string): string {
    if (pathname.includes('/games')) return 'games';
    if (pathname.includes('/users')) return 'users';
    if (pathname.includes('/analytics')) return 'analytics';
    if (pathname.includes('/leaderboards')) return 'leaderboards';
    if (pathname.includes('/subscriptions')) return 'subscriptions';
    if (pathname.includes('/webhooks')) return 'webhooks';
    return 'general';
  }

  private methodToAction(method: string): string {
    switch (method.toUpperCase()) {
      case 'GET': return 'read';
      case 'POST': return 'create';
      case 'PUT':
      case 'PATCH': return 'write';
      case 'DELETE': return 'delete';
      default: return 'read';
    }
  }

  private hashAPIKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private async parseRequestBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  private sendResponse(res: ServerResponse, statusCode: number, data: any): void {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-API-Version', 'v1');
    res.setHeader('X-RateLimit-Remaining', '1000'); // Would be calculated dynamically
    res.statusCode = statusCode;
    res.end(data ? JSON.stringify(data, null, 2) : '');
  }

  // Database operations (stub implementations - would need actual database integration)
  private async getAPIKeyByValue(value: string): Promise<APIKey | null> {
    // Implementation would query database
    this.logger.debug('Getting API key by value', { hashedValue: this.hashAPIKey(value) });
    return null;
  }

  private async updateAPIKeyLastUsed(apiKeyId: string): Promise<void> {
    this.logger.debug('Updating API key last used', { apiKeyId });
  }

  private async listGames(criteria: any): Promise<{ items: any[]; total: number }> {
    this.logger.debug('Listing games', criteria);
    return { items: [], total: 0 };
  }

  private async getGame(gameId: string, organizationId: string): Promise<any | null> {
    this.logger.debug('Getting game', { gameId, organizationId });
    return null;
  }

  private async createGame(data: any, organizationId: string): Promise<any> {
    this.logger.debug('Creating game', { organizationId });
    return { id: 'game_' + Date.now(), ...data };
  }

  private async updateGame(gameId: string, data: any, organizationId: string): Promise<any | null> {
    this.logger.debug('Updating game', { gameId, organizationId });
    return null;
  }

  private async deleteGame(gameId: string, organizationId: string): Promise<boolean> {
    this.logger.debug('Deleting game', { gameId, organizationId });
    return false;
  }

  private async getAnalyticsOverview(organizationId: string, timeframe: string): Promise<any> {
    this.logger.debug('Getting analytics overview', { organizationId, timeframe });
    return { totalGames: 0, totalPlays: 0, totalUsers: 0 };
  }

  private async getGameAnalytics(gameId: string, options: any): Promise<any> {
    this.logger.debug('Getting game analytics', { gameId, options });
    return { plays: [], users: [], scores: [] };
  }

  private async getRealTimeAnalytics(organizationId: string): Promise<any> {
    this.logger.debug('Getting real-time analytics', { organizationId });
    return { activeUsers: 0, currentPlays: 0 };
  }

  private async trackCustomEvent(data: any, organizationId: string): Promise<void> {
    this.logger.debug('Tracking custom event', { organizationId, event: data.event });
  }

  private async logAPIUsage(
    apiKey: APIKey,
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string,
    startTime: number
  ): Promise<void> {
    const usage: Partial<APIUsageLog> = {
      apiKeyId: apiKey.id,
      endpoint: pathname,
      method: req.method!,
      statusCode: res.statusCode,
      responseTime: Date.now() - startTime,
      timestamp: new Date(),
      userAgent: req.headers['user-agent'],
      ipAddress: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
      requestSize: parseInt(req.headers['content-length'] || '0'),
      responseSize: 0 // Would need to track response size
    };

    this.logger.debug('API usage logged', usage);
  }

  // Stub methods for other route handlers
  private async handleUserRoutes(...args: any[]): Promise<boolean> { return false; }
  private async handleLeaderboardRoutes(...args: any[]): Promise<boolean> { return false; }
  private async handleSubscriptionRoutes(...args: any[]): Promise<boolean> { return false; }
  private async handleWebhookRoutes(...args: any[]): Promise<boolean> { return false; }
  private async handleBulkRoutes(...args: any[]): Promise<boolean> { return false; }
  private async handleAPIKeyRoutes(...args: any[]): Promise<boolean> { return false; }
}