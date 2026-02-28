// GameVibe AI API Key Management Service
// Manages enterprise API keys, permissions, and security

import { injectable, inject } from 'inversify';
import { createHash, randomBytes } from 'crypto';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { TYPES } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface CreateAPIKeyRequest {
  name: string;
  organizationId: string;
  organizationName: string;
  tier: 'STARTER' | 'PRO' | 'ENTERPRISE';
  permissions: APIPermission[];
  expiresInDays?: number;
  metadata?: Record<string, any>;
}

export interface APIPermission {
  resource: string; // 'games', 'users', 'analytics', 'leaderboards', 'subscriptions', 'webhooks'
  actions: string[]; // 'read', 'write', 'create', 'delete'
  scope?: string; // 'own' | 'organization' | 'global'
}

export interface RateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

export interface APIKey {
  id: string;
  key: string; // Only returned on creation
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
  usage: APIKeyUsage;
}

export interface APIKeyUsage {
  totalRequests: number;
  requestsToday: number;
  requestsThisMonth: number;
  lastRequestAt?: Date;
  averageResponseTime: number;
}

export interface APIKeyStats {
  totalKeys: number;
  activeKeys: number;
  keysByTier: Record<string, number>;
  totalRequests: number;
  requestsToday: number;
  averageResponseTime: number;
}

@injectable()
export class APIKeyManagementService {
  private logger = new Logger('APIKeyManagementService');

  // Default rate limits by tier
  private static readonly DEFAULT_RATE_LIMITS: Record<string, RateLimit> = {
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

  // Default permissions by tier
  private static readonly DEFAULT_PERMISSIONS: Record<string, APIPermission[]> = {
    STARTER: [
      { resource: 'games', actions: ['read'], scope: 'organization' },
      { resource: 'analytics', actions: ['read'], scope: 'organization' },
      { resource: 'leaderboards', actions: ['read'], scope: 'organization' }
    ],
    PRO: [
      { resource: 'games', actions: ['read', 'create', 'write'], scope: 'organization' },
      { resource: 'users', actions: ['read'], scope: 'organization' },
      { resource: 'analytics', actions: ['read'], scope: 'organization' },
      { resource: 'leaderboards', actions: ['read', 'write'], scope: 'organization' },
      { resource: 'subscriptions', actions: ['read'], scope: 'organization' }
    ],
    ENTERPRISE: [
      { resource: 'games', actions: ['read', 'create', 'write', 'delete'], scope: 'organization' },
      { resource: 'users', actions: ['read', 'write'], scope: 'organization' },
      { resource: 'analytics', actions: ['read', 'write'], scope: 'organization' },
      { resource: 'leaderboards', actions: ['read', 'write', 'delete'], scope: 'organization' },
      { resource: 'subscriptions', actions: ['read', 'write'], scope: 'organization' },
      { resource: 'webhooks', actions: ['read', 'create', 'write', 'delete'], scope: 'organization' }
    ]
  };

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService
  ) {}

  /**
   * Create a new API key
   */
  async createAPIKey(request: CreateAPIKeyRequest): Promise<APIKey> {
    // Generate API key
    const keyId = this.generateKeyId();
    const apiKey = this.generateAPIKey();
    const hashedKey = this.hashAPIKey(apiKey);

    // Set expiration date
    const expiresAt = request.expiresInDays 
      ? new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    // Use default permissions if not provided
    const permissions = request.permissions.length > 0 
      ? request.permissions 
      : APIKeyManagementService.DEFAULT_PERMISSIONS[request.tier];

    // Get rate limits for tier
    const rateLimits = APIKeyManagementService.DEFAULT_RATE_LIMITS[request.tier];

    const newAPIKey: APIKey = {
      id: keyId,
      key: apiKey, // Only returned here
      hashedKey,
      name: request.name,
      organizationId: request.organizationId,
      organizationName: request.organizationName,
      tier: request.tier,
      permissions,
      rateLimits,
      isActive: true,
      createdAt: new Date(),
      expiresAt,
      metadata: request.metadata || {},
      usage: {
        totalRequests: 0,
        requestsToday: 0,
        requestsThisMonth: 0,
        averageResponseTime: 0
      }
    };

    // Store in database
    await this.storeAPIKey(newAPIKey);

    // Cache the key for quick access
    const cacheKey = `api_key:${hashedKey}`;
    await this.cache.set(cacheKey, { ...newAPIKey, key: undefined }, 300); // 5 minutes

    this.logger.info('API key created', {
      keyId,
      organizationId: request.organizationId,
      tier: request.tier,
      permissions: permissions.length
    });

    return newAPIKey;
  }

  /**
   * Get API key by ID (without the actual key value)
   */
  async getAPIKey(keyId: string): Promise<Omit<APIKey, 'key'> | null> {
    const cacheKey = `api_key_id:${keyId}`;
    
    let apiKey = await this.cache.get<Omit<APIKey, 'key'>>(cacheKey);
    if (!apiKey) {
      apiKey = await this.loadAPIKeyById(keyId);
      if (apiKey) {
        await this.cache.set(cacheKey, apiKey, 300);
      }
    }

    return apiKey;
  }

  /**
   * Get API key by the actual key value (for authentication)
   */
  async getAPIKeyByValue(keyValue: string): Promise<Omit<APIKey, 'key'> | null> {
    const hashedKey = this.hashAPIKey(keyValue);
    const cacheKey = `api_key:${hashedKey}`;
    
    let apiKey = await this.cache.get<Omit<APIKey, 'key'>>(cacheKey);
    if (!apiKey) {
      apiKey = await this.loadAPIKeyByHash(hashedKey);
      if (apiKey) {
        await this.cache.set(cacheKey, apiKey, 300);
      }
    }

    return apiKey;
  }

  /**
   * List API keys for an organization
   */
  async listAPIKeys(
    organizationId: string,
    options: {
      limit?: number;
      offset?: number;
      includeInactive?: boolean;
    } = {}
  ): Promise<{ keys: Omit<APIKey, 'key'>[]; total: number }> {
    const { limit = 50, offset = 0, includeInactive = false } = options;

    const cacheKey = `api_keys:org:${organizationId}:${limit}:${offset}:${includeInactive}`;
    
    let result = await this.cache.get<{ keys: Omit<APIKey, 'key'>[]; total: number }>(cacheKey);
    if (!result) {
      result = await this.loadAPIKeysByOrganization(organizationId, {
        limit,
        offset,
        includeInactive
      });
      
      if (result) {
        await this.cache.set(cacheKey, result, 60); // 1 minute
      }
    }

    return result || { keys: [], total: 0 };
  }

  /**
   * Update API key
   */
  async updateAPIKey(
    keyId: string,
    updates: {
      name?: string;
      permissions?: APIPermission[];
      isActive?: boolean;
      rateLimits?: RateLimit;
      metadata?: Record<string, any>;
    }
  ): Promise<Omit<APIKey, 'key'> | null> {
    const apiKey = await this.getAPIKey(keyId);
    if (!apiKey) {
      return null;
    }

    // Apply updates
    const updatedKey: Omit<APIKey, 'key'> = {
      ...apiKey,
      ...updates,
      // Prevent changing sensitive fields
      id: apiKey.id,
      hashedKey: apiKey.hashedKey,
      organizationId: apiKey.organizationId,
      createdAt: apiKey.createdAt
    };

    // Store updated key
    await this.updateAPIKeyInDatabase(updatedKey);

    // Invalidate caches
    await this.invalidateAPIKeyCache(keyId, apiKey.hashedKey, apiKey.organizationId);

    this.logger.info('API key updated', {
      keyId,
      updates: Object.keys(updates)
    });

    return updatedKey;
  }

  /**
   * Deactivate API key (soft delete)
   */
  async deactivateAPIKey(keyId: string): Promise<boolean> {
    const result = await this.updateAPIKey(keyId, { isActive: false });
    
    if (result) {
      this.logger.info('API key deactivated', { keyId });
    }

    return !!result;
  }

  /**
   * Permanently delete API key
   */
  async deleteAPIKey(keyId: string): Promise<boolean> {
    const apiKey = await this.getAPIKey(keyId);
    if (!apiKey) {
      return false;
    }

    // Delete from database
    const deleted = await this.deleteAPIKeyFromDatabase(keyId);
    
    if (deleted) {
      // Invalidate caches
      await this.invalidateAPIKeyCache(keyId, apiKey.hashedKey, apiKey.organizationId);
      
      this.logger.info('API key deleted', { keyId });
    }

    return deleted;
  }

  /**
   * Record API key usage
   */
  async recordUsage(
    keyId: string,
    responseTime: number,
    requestSize: number,
    responseSize: number
  ): Promise<void> {
    // Update usage statistics
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7);

    const usageKey = `usage:${keyId}`;
    const dailyKey = `usage:daily:${keyId}:${today}`;
    const monthlyKey = `usage:monthly:${keyId}:${thisMonth}`;

    // Increment counters
    await Promise.all([
      this.cache.increment(usageKey),
      this.cache.increment(dailyKey, 1, 86400), // Expire after 24 hours
      this.cache.increment(monthlyKey, 1, 86400 * 31), // Expire after 31 days
      this.updateResponseTime(keyId, responseTime)
    ]);

    // Update last used timestamp (async, don't wait)
    this.updateLastUsed(keyId).catch(error => {
      this.logger.error('Failed to update last used timestamp:', error);
    });
  }

  /**
   * Get API key usage statistics
   */
  async getUsageStats(keyId: string): Promise<APIKeyUsage | null> {
    const apiKey = await this.getAPIKey(keyId);
    if (!apiKey) {
      return null;
    }

    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7);

    const [totalRequests, requestsToday, requestsThisMonth, avgResponseTime] = await Promise.all([
      this.cache.get<number>(`usage:${keyId}`) || 0,
      this.cache.get<number>(`usage:daily:${keyId}:${today}`) || 0,
      this.cache.get<number>(`usage:monthly:${keyId}:${thisMonth}`) || 0,
      this.cache.get<number>(`avg_response_time:${keyId}`) || 0
    ]);

    return {
      totalRequests,
      requestsToday,
      requestsThisMonth,
      lastRequestAt: apiKey.lastUsed,
      averageResponseTime: avgResponseTime
    };
  }

  /**
   * Get organization API key statistics
   */
  async getOrganizationStats(organizationId: string): Promise<APIKeyStats> {
    const { keys } = await this.listAPIKeys(organizationId, { 
      limit: 1000, 
      includeInactive: true 
    });

    const stats: APIKeyStats = {
      totalKeys: keys.length,
      activeKeys: keys.filter(k => k.isActive).length,
      keysByTier: {
        STARTER: keys.filter(k => k.tier === 'STARTER').length,
        PRO: keys.filter(k => k.tier === 'PRO').length,
        ENTERPRISE: keys.filter(k => k.tier === 'ENTERPRISE').length
      },
      totalRequests: 0,
      requestsToday: 0,
      averageResponseTime: 0
    };

    // Aggregate usage stats
    let totalResponseTime = 0;
    let keysWithRequests = 0;

    for (const key of keys.filter(k => k.isActive)) {
      const usage = await this.getUsageStats(key.id);
      if (usage) {
        stats.totalRequests += usage.totalRequests;
        stats.requestsToday += usage.requestsToday;
        
        if (usage.totalRequests > 0) {
          totalResponseTime += usage.averageResponseTime;
          keysWithRequests++;
        }
      }
    }

    stats.averageResponseTime = keysWithRequests > 0 
      ? totalResponseTime / keysWithRequests 
      : 0;

    return stats;
  }

  /**
   * Rotate API key (generate new key, keep same permissions)
   */
  async rotateAPIKey(keyId: string): Promise<{ key: string; hashedKey: string } | null> {
    const apiKey = await this.getAPIKey(keyId);
    if (!apiKey) {
      return null;
    }

    const newKey = this.generateAPIKey();
    const newHashedKey = this.hashAPIKey(newKey);
    const oldHashedKey = apiKey.hashedKey;

    // Update the key in database
    await this.updateAPIKeyHash(keyId, newHashedKey);

    // Invalidate old cache
    await this.invalidateAPIKeyCache(keyId, oldHashedKey, apiKey.organizationId);

    this.logger.info('API key rotated', { keyId });

    return { key: newKey, hashedKey: newHashedKey };
  }

  // Private utility methods

  private generateKeyId(): string {
    return `gvk_${randomBytes(16).toString('hex')}`;
  }

  private generateAPIKey(): string {
    return `gv_${randomBytes(32).toString('hex')}`;
  }

  private hashAPIKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private async updateResponseTime(keyId: string, responseTime: number): Promise<void> {
    const key = `avg_response_time:${keyId}`;
    const countKey = `response_count:${keyId}`;
    
    const [currentAvg, count] = await Promise.all([
      this.cache.get<number>(key) || 0,
      this.cache.get<number>(countKey) || 0
    ]);

    const newCount = count + 1;
    const newAvg = (currentAvg * count + responseTime) / newCount;

    await Promise.all([
      this.cache.set(key, newAvg),
      this.cache.set(countKey, newCount)
    ]);
  }

  private async invalidateAPIKeyCache(
    keyId: string, 
    hashedKey: string, 
    organizationId: string
  ): Promise<void> {
    const keys = [
      `api_key:${hashedKey}`,
      `api_key_id:${keyId}`,
      `api_keys:org:${organizationId}:*`
    ];

    for (const key of keys) {
      if (key.includes('*')) {
        // Delete all matching keys
        const matchingKeys = await this.cache.keys(key);
        for (const matchingKey of matchingKeys) {
          await this.cache.delete(matchingKey);
        }
      } else {
        await this.cache.delete(key);
      }
    }
  }

  // Database operations (stub implementations - would need actual database integration)
  private async storeAPIKey(apiKey: APIKey): Promise<void> {
    this.logger.debug('Storing API key in database', { keyId: apiKey.id });
    // Implementation would store in database
  }

  private async loadAPIKeyById(keyId: string): Promise<Omit<APIKey, 'key'> | null> {
    this.logger.debug('Loading API key by ID', { keyId });
    // Implementation would load from database
    return null;
  }

  private async loadAPIKeyByHash(hashedKey: string): Promise<Omit<APIKey, 'key'> | null> {
    this.logger.debug('Loading API key by hash', { hashedKey: hashedKey.substring(0, 8) + '...' });
    // Implementation would load from database
    return null;
  }

  private async loadAPIKeysByOrganization(
    organizationId: string,
    options: { limit: number; offset: number; includeInactive: boolean }
  ): Promise<{ keys: Omit<APIKey, 'key'>[]; total: number }> {
    this.logger.debug('Loading API keys by organization', { organizationId, options });
    // Implementation would load from database
    return { keys: [], total: 0 };
  }

  private async updateAPIKeyInDatabase(apiKey: Omit<APIKey, 'key'>): Promise<void> {
    this.logger.debug('Updating API key in database', { keyId: apiKey.id });
    // Implementation would update in database
  }

  private async deleteAPIKeyFromDatabase(keyId: string): Promise<boolean> {
    this.logger.debug('Deleting API key from database', { keyId });
    // Implementation would delete from database
    return false;
  }

  private async updateAPIKeyHash(keyId: string, newHashedKey: string): Promise<void> {
    this.logger.debug('Updating API key hash', { keyId });
    // Implementation would update hash in database
  }

  private async updateLastUsed(keyId: string): Promise<void> {
    this.logger.debug('Updating last used timestamp', { keyId });
    // Implementation would update timestamp in database
  }
}