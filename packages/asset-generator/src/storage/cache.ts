import Redis from 'ioredis';
import { CacheConfig, AssetEntry, AssetManifest, GenerationJob } from '../types/index.js';
import { Logger } from '@gamevibe/shared';

export class AssetCache {
  private redis: Redis;
  private logger: Logger;
  private ttl: {
    hot: number;
    template: number;
    metadata: number;
  };

  constructor(config: CacheConfig, logger: Logger) {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.ttl = config.ttl;
    this.logger = logger;

    this.redis.on('error', (err) => {
      this.logger.error('Redis error:', err);
    });

    this.redis.on('connect', () => {
      this.logger.info('Connected to Redis cache');
    });
  }

  // Asset caching
  async setAsset(key: string, asset: AssetEntry, ttl?: number): Promise<void> {
    const cacheKey = this.buildAssetKey(key);
    await this.redis.setex(
      cacheKey,
      ttl || this.ttl.hot,
      JSON.stringify(asset)
    );
  }

  async getAsset(key: string): Promise<AssetEntry | null> {
    const cacheKey = this.buildAssetKey(key);
    const data = await this.redis.get(cacheKey);
    
    if (!data) return null;
    
    try {
      return JSON.parse(data) as AssetEntry;
    } catch (error) {
      this.logger.error('Failed to parse cached asset:', error);
      return null;
    }
  }

  async deleteAsset(key: string): Promise<void> {
    const cacheKey = this.buildAssetKey(key);
    await this.redis.del(cacheKey);
  }

  // Asset manifest caching
  async setManifest(gameId: string, manifest: AssetManifest): Promise<void> {
    const cacheKey = this.buildManifestKey(gameId);
    await this.redis.setex(
      cacheKey,
      this.ttl.metadata,
      JSON.stringify(manifest)
    );
  }

  async getManifest(gameId: string): Promise<AssetManifest | null> {
    const cacheKey = this.buildManifestKey(gameId);
    const data = await this.redis.get(cacheKey);
    
    if (!data) return null;
    
    try {
      return JSON.parse(data) as AssetManifest;
    } catch (error) {
      this.logger.error('Failed to parse cached manifest:', error);
      return null;
    }
  }

  // Generation job tracking
  async setGenerationJob(job: GenerationJob): Promise<void> {
    const cacheKey = this.buildJobKey(job.id);
    await this.redis.setex(
      cacheKey,
      3600, // 1 hour TTL for job status
      JSON.stringify(job)
    );
  }

  async getGenerationJob(jobId: string): Promise<GenerationJob | null> {
    const cacheKey = this.buildJobKey(jobId);
    const data = await this.redis.get(cacheKey);
    
    if (!data) return null;
    
    try {
      return JSON.parse(data) as GenerationJob;
    } catch (error) {
      this.logger.error('Failed to parse cached job:', error);
      return null;
    }
  }

  async updateGenerationJob(jobId: string, updates: Partial<GenerationJob>): Promise<void> {
    const job = await this.getGenerationJob(jobId);
    if (!job) return;

    const updatedJob = {
      ...job,
      ...updates,
      updatedAt: new Date()
    };

    await this.setGenerationJob(updatedJob);
  }

  // Template caching
  async setTemplate(templateId: string, data: any): Promise<void> {
    const cacheKey = this.buildTemplateKey(templateId);
    await this.redis.setex(
      cacheKey,
      this.ttl.template,
      JSON.stringify(data)
    );
  }

  async getTemplate(templateId: string): Promise<any | null> {
    const cacheKey = this.buildTemplateKey(templateId);
    const data = await this.redis.get(cacheKey);
    
    if (!data) return null;
    
    try {
      return JSON.parse(data);
    } catch (error) {
      this.logger.error('Failed to parse cached template:', error);
      return null;
    }
  }

  // Batch operations
  async setAssetBatch(assets: Array<{ key: string; asset: AssetEntry }>, ttl?: number): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const { key, asset } of assets) {
      const cacheKey = this.buildAssetKey(key);
      pipeline.setex(cacheKey, ttl || this.ttl.hot, JSON.stringify(asset));
    }
    
    await pipeline.exec();
  }

  async getAssetBatch(keys: string[]): Promise<(AssetEntry | null)[]> {
    const cacheKeys = keys.map(key => this.buildAssetKey(key));
    const results = await this.redis.mget(...cacheKeys);
    
    return results.map((data, index) => {
      if (!data) return null;
      
      try {
        return JSON.parse(data) as AssetEntry;
      } catch (error) {
        this.logger.error(`Failed to parse cached asset at index ${index}:`, error);
        return null;
      }
    });
  }

  // Cache warming
  async warmCache(gameId: string, assets: AssetEntry[]): Promise<void> {
    const batch = assets.map(asset => ({
      key: `${gameId}:${asset.type}:${asset.id}`,
      asset
    }));
    
    await this.setAssetBatch(batch, this.ttl.hot);
    this.logger.info(`Warmed cache with ${assets.length} assets for game ${gameId}`);
  }

  // Utility methods
  async clearGameCache(gameId: string): Promise<void> {
    const pattern = `asset:${gameId}:*`;
    const keys = await this.scanKeys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.logger.info(`Cleared ${keys.length} cached assets for game ${gameId}`);
    }
  }

  async getCacheStats(): Promise<{
    size: number;
    assets: number;
    manifests: number;
    templates: number;
    jobs: number;
  }> {
    const info = await this.redis.info('memory');
    const usedMemory = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');
    
    const assetCount = await this.countKeys('asset:*');
    const manifestCount = await this.countKeys('manifest:*');
    const templateCount = await this.countKeys('template:*');
    const jobCount = await this.countKeys('job:*');
    
    return {
      size: usedMemory,
      assets: assetCount,
      manifests: manifestCount,
      templates: templateCount,
      jobs: jobCount
    };
  }

  // Key builders
  private buildAssetKey(key: string): string {
    return `asset:${key}`;
  }

  private buildManifestKey(gameId: string): string {
    return `manifest:${gameId}`;
  }

  private buildJobKey(jobId: string): string {
    return `job:${jobId}`;
  }

  private buildTemplateKey(templateId: string): string {
    return `template:${templateId}`;
  }

  // Helper methods
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    
    do {
      const [newCursor, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    
    return keys;
  }

  private async countKeys(pattern: string): Promise<number> {
    const keys = await this.scanKeys(pattern);
    return keys.length;
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}