// GameVibe AI Enterprise Webhooks System
// Manages webhook configuration and delivery for enterprise clients

import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { Container } from 'inversify';
import { createHmac, randomBytes } from 'crypto';
import { DatabaseService } from '../services/database.js';
import { CacheService } from '../services/cache.js';
import { TYPES } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface WebhookConfig {
  id: string;
  apiKeyId: string;
  organizationId: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  retryConfig: WebhookRetryConfig;
  headers?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  lastSuccessful?: Date;
  failureCount: number;
  metadata: Record<string, any>;
}

export interface WebhookRetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  maxBackoffSeconds: number;
  timeoutSeconds: number;
}

export interface WebhookEvent {
  id: string;
  webhookId: string;
  event: string;
  data: any;
  attemptCount: number;
  status: 'pending' | 'delivered' | 'failed' | 'expired';
  statusCode?: number;
  errorMessage?: string;
  createdAt: Date;
  scheduledAt: Date;
  deliveredAt?: Date;
  nextRetryAt?: Date;
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  events: string[];
  retryConfig?: Partial<WebhookRetryConfig>;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  url: string;
  httpMethod: string;
  headers: Record<string, string>;
  payload: string;
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    duration: number;
  };
  attemptNumber: number;
  deliveredAt: Date;
  success: boolean;
  errorMessage?: string;
}

export class EnterpriseWebhooksAPI {
  private logger = new Logger('EnterpriseWebhooksAPI');
  private db: DatabaseService;
  private cache: CacheService;

  // Available webhook events
  private static readonly AVAILABLE_EVENTS = [
    'game.created',
    'game.updated', 
    'game.deleted',
    'game.played',
    'user.registered',
    'user.activity',
    'leaderboard.updated',
    'subscription.created',
    'subscription.updated',
    'subscription.cancelled',
    'analytics.milestone',
    'api.rate_limit_exceeded'
  ];

  // Default retry configuration
  private static readonly DEFAULT_RETRY_CONFIG: WebhookRetryConfig = {
    maxRetries: 3,
    backoffMultiplier: 2,
    maxBackoffSeconds: 300, // 5 minutes
    timeoutSeconds: 30
  };

  constructor(container: Container) {
    this.db = container.get<DatabaseService>(TYPES.DatabaseService);
    this.cache = container.get<CacheService>(TYPES.CacheService);
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    // Only handle /api/v1/enterprise/webhooks routes
    if (!pathname.startsWith('/api/v1/enterprise/webhooks')) {
      return false;
    }

    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const route = pathname.substring('/api/v1/enterprise/webhooks'.length);
      const method = req.method!;

      // GET /webhooks - List webhooks
      if (route === '' || route === '/') {
        if (method === 'GET') {
          return await this.handleListWebhooks(req, res, url);
        } else if (method === 'POST') {
          return await this.handleCreateWebhook(req, res);
        }
      }

      // Individual webhook operations
      const webhookMatch = route.match(/^\/([^\/]+)$/);
      if (webhookMatch) {
        const webhookId = webhookMatch[1];
        
        if (method === 'GET') {
          return await this.handleGetWebhook(req, res, webhookId);
        } else if (method === 'PUT') {
          return await this.handleUpdateWebhook(req, res, webhookId);
        } else if (method === 'DELETE') {
          return await this.handleDeleteWebhook(req, res, webhookId);
        }
      }

      // Webhook testing
      const testMatch = route.match(/^\/([^\/]+)\/test$/);
      if (testMatch && method === 'POST') {
        return await this.handleTestWebhook(req, res, testMatch[1]);
      }

      // Webhook events/deliveries
      const eventsMatch = route.match(/^\/([^\/]+)\/events$/);
      if (eventsMatch && method === 'GET') {
        return await this.handleGetWebhookEvents(req, res, eventsMatch[1], url);
      }

      const deliveriesMatch = route.match(/^\/([^\/]+)\/deliveries$/);
      if (deliveriesMatch && method === 'GET') {
        return await this.handleGetWebhookDeliveries(req, res, deliveriesMatch[1], url);
      }

      // Available events
      if (route === '/events' && method === 'GET') {
        return await this.handleGetAvailableEvents(req, res);
      }

      this.sendResponse(res, 404, { error: 'Webhook endpoint not found' });
      return true;

    } catch (error) {
      this.logger.error('Webhook API error:', error);
      this.sendResponse(res, 500, { error: 'Internal server error' });
      return true;
    }
  }

  private async handleListWebhooks(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const isActive = url.searchParams.get('active');

    // Get organization ID from authenticated API key (would be passed in context)
    const organizationId = 'org_123'; // Placeholder

    const filters = {
      organizationId,
      limit: Math.min(limit, 100),
      offset,
      isActive: isActive ? isActive === 'true' : undefined
    };

    const result = await this.listWebhooks(filters);
    
    this.sendResponse(res, 200, {
      webhooks: result.webhooks,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: result.total > offset + limit
      }
    });

    return true;
  }

  private async handleCreateWebhook(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const body = await this.parseRequestBody(req);
    const apiKeyId = 'key_123'; // Would come from authentication
    const organizationId = 'org_123'; // Would come from API key

    // Validate request
    const validation = this.validateCreateWebhookRequest(body);
    if (!validation.valid) {
      this.sendResponse(res, 400, { error: validation.error, details: validation.details });
      return true;
    }

    const webhook = await this.createWebhook(apiKeyId, organizationId, body as CreateWebhookRequest);
    
    this.sendResponse(res, 201, { webhook });
    return true;
  }

  private async handleGetWebhook(req: IncomingMessage, res: ServerResponse, webhookId: string): Promise<boolean> {
    const organizationId = 'org_123'; // Would come from API key
    
    const webhook = await this.getWebhook(webhookId, organizationId);
    if (!webhook) {
      this.sendResponse(res, 404, { error: 'Webhook not found' });
      return true;
    }

    this.sendResponse(res, 200, { webhook });
    return true;
  }

  private async handleUpdateWebhook(req: IncomingMessage, res: ServerResponse, webhookId: string): Promise<boolean> {
    const body = await this.parseRequestBody(req);
    const organizationId = 'org_123'; // Would come from API key

    const webhook = await this.updateWebhook(webhookId, organizationId, body);
    if (!webhook) {
      this.sendResponse(res, 404, { error: 'Webhook not found' });
      return true;
    }

    this.sendResponse(res, 200, { webhook });
    return true;
  }

  private async handleDeleteWebhook(req: IncomingMessage, res: ServerResponse, webhookId: string): Promise<boolean> {
    const organizationId = 'org_123'; // Would come from API key
    
    const deleted = await this.deleteWebhook(webhookId, organizationId);
    if (!deleted) {
      this.sendResponse(res, 404, { error: 'Webhook not found' });
      return true;
    }

    this.sendResponse(res, 204, null);
    return true;
  }

  private async handleTestWebhook(req: IncomingMessage, res: ServerResponse, webhookId: string): Promise<boolean> {
    const organizationId = 'org_123'; // Would come from API key
    
    const result = await this.testWebhook(webhookId, organizationId);
    if (!result) {
      this.sendResponse(res, 404, { error: 'Webhook not found' });
      return true;
    }

    this.sendResponse(res, 200, { 
      success: result.success,
      statusCode: result.statusCode,
      response: result.response,
      deliveryTime: result.deliveryTime
    });
    return true;
  }

  private async handleGetWebhookEvents(req: IncomingMessage, res: ServerResponse, webhookId: string, url: URL): Promise<boolean> {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status');
    const organizationId = 'org_123'; // Would come from API key

    const result = await this.getWebhookEvents(webhookId, organizationId, {
      limit: Math.min(limit, 100),
      offset,
      status
    });

    if (!result) {
      this.sendResponse(res, 404, { error: 'Webhook not found' });
      return true;
    }

    this.sendResponse(res, 200, {
      events: result.events,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: result.total > offset + limit
      }
    });

    return true;
  }

  private async handleGetWebhookDeliveries(req: IncomingMessage, res: ServerResponse, webhookId: string, url: URL): Promise<boolean> {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const organizationId = 'org_123'; // Would come from API key

    const result = await this.getWebhookDeliveries(webhookId, organizationId, {
      limit: Math.min(limit, 100),
      offset
    });

    if (!result) {
      this.sendResponse(res, 404, { error: 'Webhook not found' });
      return true;
    }

    this.sendResponse(res, 200, {
      deliveries: result.deliveries,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: result.total > offset + limit
      }
    });

    return true;
  }

  private async handleGetAvailableEvents(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const events = EnterpriseWebhooksAPI.AVAILABLE_EVENTS.map(event => ({
      name: event,
      description: this.getEventDescription(event)
    }));

    this.sendResponse(res, 200, { events });
    return true;
  }

  // Webhook management methods

  async createWebhook(apiKeyId: string, organizationId: string, request: CreateWebhookRequest): Promise<WebhookConfig> {
    const webhookId = this.generateWebhookId();
    const secret = this.generateWebhookSecret();

    const webhook: WebhookConfig = {
      id: webhookId,
      apiKeyId,
      organizationId,
      name: request.name,
      url: request.url,
      events: request.events,
      secret,
      isActive: true,
      retryConfig: { ...EnterpriseWebhooksAPI.DEFAULT_RETRY_CONFIG, ...request.retryConfig },
      headers: request.headers,
      createdAt: new Date(),
      updatedAt: new Date(),
      failureCount: 0,
      metadata: request.metadata || {}
    };

    await this.storeWebhook(webhook);
    
    this.logger.info('Webhook created', {
      webhookId,
      organizationId,
      url: request.url,
      events: request.events
    });

    return webhook;
  }

  async triggerWebhook(organizationId: string, event: string, data: any): Promise<void> {
    // Get all active webhooks for this organization that listen to this event
    const webhooks = await this.getWebhooksForEvent(organizationId, event);

    for (const webhook of webhooks) {
      await this.queueWebhookEvent(webhook, event, data);
    }
  }

  async deliverWebhook(webhook: WebhookConfig, event: WebhookEvent): Promise<WebhookDelivery> {
    const payload = this.createWebhookPayload(webhook, event);
    const signature = this.createSignature(payload, webhook.secret);
    
    const headers = {
      'Content-Type': 'application/json',
      'X-GameVibe-Event': event.event,
      'X-GameVibe-Signature': signature,
      'X-GameVibe-Delivery': event.id,
      'User-Agent': 'GameVibe-Webhooks/1.0',
      ...webhook.headers
    };

    const delivery: WebhookDelivery = {
      id: this.generateDeliveryId(),
      webhookId: webhook.id,
      eventId: event.id,
      url: webhook.url,
      httpMethod: 'POST',
      headers,
      payload,
      attemptNumber: event.attemptCount + 1,
      deliveredAt: new Date(),
      success: false
    };

    try {
      const startTime = Date.now();
      
      // Make HTTP request (this would use actual HTTP client)
      const response = await this.makeWebhookRequest(webhook.url, {
        method: 'POST',
        headers,
        body: payload,
        timeout: webhook.retryConfig.timeoutSeconds * 1000
      });

      const duration = Date.now() - startTime;

      delivery.response = {
        statusCode: response.statusCode,
        headers: response.headers,
        body: response.body,
        duration
      };

      delivery.success = response.statusCode >= 200 && response.statusCode < 300;

      if (!delivery.success) {
        delivery.errorMessage = `HTTP ${response.statusCode}: ${response.body}`;
      }

    } catch (error: any) {
      delivery.success = false;
      delivery.errorMessage = error.message;
      delivery.response = {
        statusCode: 0,
        headers: {},
        body: '',
        duration: 0
      };
    }

    // Store delivery record
    await this.storeWebhookDelivery(delivery);

    // Update event status
    await this.updateWebhookEventStatus(event.id, delivery.success ? 'delivered' : 'failed');

    // Schedule retry if failed and retries remain
    if (!delivery.success && event.attemptCount < webhook.retryConfig.maxRetries) {
      await this.scheduleWebhookRetry(webhook, event);
    }

    this.logger.info('Webhook delivered', {
      webhookId: webhook.id,
      eventId: event.id,
      success: delivery.success,
      statusCode: delivery.response?.statusCode,
      attempt: delivery.attemptNumber
    });

    return delivery;
  }

  // Utility methods

  private validateCreateWebhookRequest(body: any): { valid: boolean; error?: string; details?: any } {
    if (!body.name || typeof body.name !== 'string') {
      return { valid: false, error: 'Name is required and must be a string' };
    }

    if (!body.url || typeof body.url !== 'string') {
      return { valid: false, error: 'URL is required and must be a string' };
    }

    // Validate URL format
    try {
      new URL(body.url);
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }

    if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
      return { valid: false, error: 'Events array is required and must not be empty' };
    }

    // Validate events
    const invalidEvents = body.events.filter((event: string) => 
      !EnterpriseWebhooksAPI.AVAILABLE_EVENTS.includes(event)
    );

    if (invalidEvents.length > 0) {
      return { 
        valid: false, 
        error: 'Invalid events', 
        details: { invalidEvents, availableEvents: EnterpriseWebhooksAPI.AVAILABLE_EVENTS }
      };
    }

    return { valid: true };
  }

  private createWebhookPayload(webhook: WebhookConfig, event: WebhookEvent): string {
    const payload = {
      id: event.id,
      event: event.event,
      timestamp: event.createdAt.toISOString(),
      data: event.data,
      webhook: {
        id: webhook.id,
        name: webhook.name
      }
    };

    return JSON.stringify(payload);
  }

  private createSignature(payload: string, secret: string): string {
    return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
  }

  private getEventDescription(event: string): string {
    const descriptions: Record<string, string> = {
      'game.created': 'Triggered when a new game is created',
      'game.updated': 'Triggered when a game is updated',
      'game.deleted': 'Triggered when a game is deleted',
      'game.played': 'Triggered when a game is played',
      'user.registered': 'Triggered when a new user registers',
      'user.activity': 'Triggered on significant user activity',
      'leaderboard.updated': 'Triggered when leaderboard rankings change',
      'subscription.created': 'Triggered when a subscription is created',
      'subscription.updated': 'Triggered when a subscription is updated',
      'subscription.cancelled': 'Triggered when a subscription is cancelled',
      'analytics.milestone': 'Triggered when analytics milestones are reached',
      'api.rate_limit_exceeded': 'Triggered when API rate limits are exceeded'
    };

    return descriptions[event] || 'Event description not available';
  }

  private generateWebhookId(): string {
    return `webhook_${randomBytes(16).toString('hex')}`;
  }

  private generateWebhookSecret(): string {
    return randomBytes(32).toString('hex');
  }

  private generateDeliveryId(): string {
    return `delivery_${randomBytes(16).toString('hex')}`;
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
    res.statusCode = statusCode;
    res.end(data ? JSON.stringify(data, null, 2) : '');
  }

  // Database operations (stub implementations)
  private async storeWebhook(webhook: WebhookConfig): Promise<void> {
    this.logger.debug('Storing webhook', { webhookId: webhook.id });
  }

  private async listWebhooks(filters: any): Promise<{ webhooks: WebhookConfig[]; total: number }> {
    this.logger.debug('Listing webhooks', filters);
    return { webhooks: [], total: 0 };
  }

  private async getWebhook(webhookId: string, organizationId: string): Promise<WebhookConfig | null> {
    this.logger.debug('Getting webhook', { webhookId, organizationId });
    return null;
  }

  private async updateWebhook(webhookId: string, organizationId: string, updates: any): Promise<WebhookConfig | null> {
    this.logger.debug('Updating webhook', { webhookId, organizationId });
    return null;
  }

  private async deleteWebhook(webhookId: string, organizationId: string): Promise<boolean> {
    this.logger.debug('Deleting webhook', { webhookId, organizationId });
    return false;
  }

  private async testWebhook(webhookId: string, organizationId: string): Promise<any> {
    this.logger.debug('Testing webhook', { webhookId, organizationId });
    return { success: true, statusCode: 200, response: 'OK', deliveryTime: 150 };
  }

  private async getWebhooksForEvent(organizationId: string, event: string): Promise<WebhookConfig[]> {
    this.logger.debug('Getting webhooks for event', { organizationId, event });
    return [];
  }

  private async queueWebhookEvent(webhook: WebhookConfig, event: string, data: any): Promise<void> {
    this.logger.debug('Queueing webhook event', { webhookId: webhook.id, event });
  }

  private async getWebhookEvents(webhookId: string, organizationId: string, filters: any): Promise<any> {
    this.logger.debug('Getting webhook events', { webhookId, organizationId, filters });
    return { events: [], total: 0 };
  }

  private async getWebhookDeliveries(webhookId: string, organizationId: string, filters: any): Promise<any> {
    this.logger.debug('Getting webhook deliveries', { webhookId, organizationId, filters });
    return { deliveries: [], total: 0 };
  }

  private async makeWebhookRequest(url: string, options: any): Promise<any> {
    this.logger.debug('Making webhook request', { url });
    // Simulate HTTP request
    return {
      statusCode: 200,
      headers: {},
      body: 'OK'
    };
  }

  private async storeWebhookDelivery(delivery: WebhookDelivery): Promise<void> {
    this.logger.debug('Storing webhook delivery', { deliveryId: delivery.id });
  }

  private async updateWebhookEventStatus(eventId: string, status: string): Promise<void> {
    this.logger.debug('Updating webhook event status', { eventId, status });
  }

  private async scheduleWebhookRetry(webhook: WebhookConfig, event: WebhookEvent): Promise<void> {
    this.logger.debug('Scheduling webhook retry', { webhookId: webhook.id, eventId: event.id });
  }
}