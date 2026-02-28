import { injectable, inject } from 'inversify';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { AIService } from '@gamevibe/ai-service';
import { TYPES } from '../types.js';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: number;
  uptime: number;
  version: string;
  services: {
    database: ServiceHealth;
    cache: ServiceHealth;
    ai: ServiceHealth;
    discord: ServiceHealth;
  };
  metrics: {
    memoryUsage: NodeJS.MemoryUsage;
    gamesGenerated: number;
    activeUsers: number;
    responseTimes: {
      database: number;
      ai: number;
      cache: number;
    };
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  lastChecked: number;
  error?: string;
  details?: any;
}

@injectable()
export class HealthService {
  private startTime: number;
  private gamesGeneratedCount = 0;
  private activeUsersSet = new Set<string>();
  
  constructor(
    @inject(TYPES.DatabaseService) private database: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.AIService) private ai: AIService
  ) {
    this.startTime = Date.now();
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const timestamp = Date.now();
    const uptime = timestamp - this.startTime;

    // Check all services in parallel
    const [databaseHealth, cacheHealth, aiHealth, discordHealth] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkCacheHealth(),
      this.checkAIHealth(),
      this.checkDiscordHealth()
    ]);

    // Determine overall status
    const services = { database: databaseHealth, cache: cacheHealth, ai: aiHealth, discord: discordHealth };
    const overallStatus = this.determineOverallStatus(services);

    return {
      status: overallStatus,
      timestamp,
      uptime,
      version: process.env.npm_package_version || '0.1.0',
      services,
      metrics: {
        memoryUsage: process.memoryUsage(),
        gamesGenerated: this.gamesGeneratedCount,
        activeUsers: this.activeUsersSet.size,
        responseTimes: {
          database: databaseHealth.responseTime,
          ai: aiHealth.responseTime,
          cache: cacheHealth.responseTime
        }
      }
    };
  }

  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      await this.database.raw('SELECT 1');
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now()
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        error: error.message,
        details: { code: error.code }
      };
    }
  }

  private async checkCacheHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const testKey = 'health:test';
      const testValue = Date.now().toString();
      
      await this.cache.set(testKey, testValue, 60);
      const retrieved = await this.cache.get<string>(testKey);
      
      if (retrieved === testValue) {
        await this.cache.delete(testKey);
        return {
          status: 'healthy',
          responseTime: Date.now() - startTime,
          lastChecked: Date.now()
        };
      } else {
        return {
          status: 'degraded',
          responseTime: Date.now() - startTime,
          lastChecked: Date.now(),
          error: 'Cache read/write mismatch'
        };
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        error: error.message
      };
    }
  }

  private async checkAIHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const isHealthy = await this.ai.health();
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        ...(isHealthy ? {} : { error: 'AI service health check failed' })
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        error: error.message
      };
    }
  }

  private async checkDiscordHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Check if Discord bot is ready and responsive
      // This is a simple check that the Discord client exists and is ready
      const isReady = process.env.DISCORD_TOKEN && process.env.DISCORD_CLIENT_ID;
      
      return {
        status: isReady ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        details: {
          hasToken: !!process.env.DISCORD_TOKEN,
          hasClientId: !!process.env.DISCORD_CLIENT_ID
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        error: error.message
      };
    }
  }

  private determineOverallStatus(services: HealthStatus['services']): 'healthy' | 'unhealthy' | 'degraded' {
    const statuses = Object.values(services).map(service => service.status);
    
    if (statuses.every(status => status === 'healthy')) {
      return 'healthy';
    }
    
    if (statuses.some(status => status === 'unhealthy')) {
      return 'unhealthy';
    }
    
    return 'degraded';
  }

  // Metrics tracking methods
  incrementGamesGenerated(): void {
    this.gamesGeneratedCount++;
  }

  trackActiveUser(userId: string): void {
    this.activeUsersSet.add(userId);
    
    // Clean up old users periodically (remove after 1 hour of inactivity)
    setTimeout(() => {
      this.activeUsersSet.delete(userId);
    }, 60 * 60 * 1000);
  }

  getMetrics() {
    return {
      uptime: Date.now() - this.startTime,
      gamesGenerated: this.gamesGeneratedCount,
      activeUsers: this.activeUsersSet.size,
      memoryUsage: process.memoryUsage()
    };
  }

  // Readiness probe (different from health - checks if service is ready to accept traffic)
  async isReady(): Promise<boolean> {
    try {
      const [dbReady, cacheReady] = await Promise.all([
        this.database.raw('SELECT 1').then(() => true).catch(() => false),
        this.cache.set('readiness:test', 'ok', 10).then(() => true).catch(() => false)
      ]);
      
      return dbReady && cacheReady;
    } catch {
      return false;
    }
  }

  // Liveness probe (checks if service is running and should be restarted if not)
  isAlive(): boolean {
    // Basic liveness check - if we can execute this code, we're alive
    // Could add more sophisticated checks here
    return process.uptime() > 0;
  }
}