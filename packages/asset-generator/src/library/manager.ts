import { 
  AssetEntry, 
  AssetType, 
  AssetStyle, 
  ColorScheme,
  AssetManifest 
} from '../types/index.js';
import { S3Storage } from '../storage/s3.js';
import { AssetCache } from '../storage/cache.js';
import { Logger } from '@gamevibe/shared';
import { nanoid } from 'nanoid';

export interface AssetLibraryConfig {
  storage: S3Storage;
  cache: AssetCache;
  logger: Logger;
}

export interface AssetSearchCriteria {
  gameId?: string;
  type?: AssetType;
  style?: AssetStyle;
  colorScheme?: ColorScheme;
  tags?: string[];
  theme?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
}

export interface AssetCollection {
  id: string;
  name: string;
  description?: string;
  assets: AssetEntry[];
  metadata: {
    theme: string;
    style: AssetStyle;
    colorScheme: ColorScheme;
    tags: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetTemplate {
  id: string;
  name: string;
  type: AssetType;
  description: string;
  baseAsset: AssetEntry;
  variations: AssetEntry[];
  parameters: {
    style: AssetStyle;
    colorScheme: ColorScheme;
    theme: string;
  };
  usage: {
    count: number;
    lastUsed: Date;
  };
}

export class AssetLibraryManager {
  private storage: S3Storage;
  private cache: AssetCache;
  private logger: Logger;
  private collections: Map<string, AssetCollection> = new Map();
  private templates: Map<string, AssetTemplate> = new Map();

  constructor(config: AssetLibraryConfig) {
    this.storage = config.storage;
    this.cache = config.cache;
    this.logger = config.logger;
  }

  // Asset Management
  async addAsset(gameId: string, asset: AssetEntry): Promise<void> {
    // Store asset metadata in cache
    const key = `${gameId}:${asset.type}:${asset.id}`;
    await this.cache.setAsset(key, asset);

    // Update game manifest
    const manifest = await this.cache.getManifest(gameId);
    if (manifest) {
      this.addAssetToManifest(manifest, asset);
      await this.cache.setManifest(gameId, manifest);
    }

    this.logger.info(`Added asset ${asset.id} to library for game ${gameId}`);
  }

  async getAsset(gameId: string, assetId: string): Promise<AssetEntry | null> {
    // Check cache first
    const cachedAsset = await this.cache.getAsset(`${gameId}:*:${assetId}`);
    if (cachedAsset) return cachedAsset;

    // TODO: Check database if not in cache
    return null;
  }

  async searchAssets(criteria: AssetSearchCriteria): Promise<{
    assets: AssetEntry[];
    total: number;
    hasMore: boolean;
  }> {
    const limit = criteria.limit || 20;
    const offset = criteria.offset || 0;
    const assets: AssetEntry[] = [];

    // Search in cache (simplified for now)
    // In production, this would query the database
    if (criteria.gameId) {
      const manifest = await this.cache.getManifest(criteria.gameId);
      if (manifest) {
        const allAssets = this.extractAssetsFromManifest(manifest);
        
        // Apply filters
        const filtered = allAssets.filter(asset => {
          if (criteria.type && asset.type !== criteria.type) return false;
          if (criteria.tags && criteria.tags.length > 0) {
            const hasAllTags = criteria.tags.every(tag => asset.tags.includes(tag));
            if (!hasAllTags) return false;
          }
          return true;
        });

        // Apply pagination
        const paginated = filtered.slice(offset, offset + limit);
        assets.push(...paginated);

        return {
          assets,
          total: filtered.length,
          hasMore: offset + limit < filtered.length
        };
      }
    }

    return { assets: [], total: 0, hasMore: false };
  }

  // Collection Management
  async createCollection(
    name: string,
    assets: AssetEntry[],
    metadata: AssetCollection['metadata']
  ): Promise<AssetCollection> {
    const collection: AssetCollection = {
      id: nanoid(),
      name,
      assets,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.collections.set(collection.id, collection);
    
    // Cache the collection
    await this.cache.setTemplate(`collection:${collection.id}`, collection);

    this.logger.info(`Created asset collection: ${name} with ${assets.length} assets`);
    return collection;
  }

  async getCollection(collectionId: string): Promise<AssetCollection | null> {
    // Check memory first
    if (this.collections.has(collectionId)) {
      return this.collections.get(collectionId)!;
    }

    // Check cache
    const cached = await this.cache.getTemplate(`collection:${collectionId}`);
    if (cached) {
      this.collections.set(collectionId, cached);
      return cached;
    }

    return null;
  }

  async updateCollection(
    collectionId: string,
    updates: Partial<AssetCollection>
  ): Promise<AssetCollection | null> {
    const collection = await this.getCollection(collectionId);
    if (!collection) return null;

    const updated = {
      ...collection,
      ...updates,
      updatedAt: new Date()
    };

    this.collections.set(collectionId, updated);
    await this.cache.setTemplate(`collection:${collectionId}`, updated);

    return updated;
  }

  // Template Management
  async createTemplate(
    name: string,
    type: AssetType,
    baseAsset: AssetEntry,
    parameters: AssetTemplate['parameters']
  ): Promise<AssetTemplate> {
    const template: AssetTemplate = {
      id: nanoid(),
      name,
      type,
      description: `Template for ${type} assets in ${parameters.style} style`,
      baseAsset,
      variations: [],
      parameters,
      usage: {
        count: 0,
        lastUsed: new Date()
      }
    };

    this.templates.set(template.id, template);
    
    // Cache the template
    await this.cache.setTemplate(`assetTemplate:${template.id}`, template);

    this.logger.info(`Created asset template: ${name}`);
    return template;
  }

  async getTemplate(templateId: string): Promise<AssetTemplate | null> {
    // Check memory first
    if (this.templates.has(templateId)) {
      return this.templates.get(templateId)!;
    }

    // Check cache
    const cached = await this.cache.getTemplate(`assetTemplate:${templateId}`);
    if (cached) {
      this.templates.set(templateId, cached);
      return cached;
    }

    return null;
  }

  async getPopularTemplates(limit: number = 10): Promise<AssetTemplate[]> {
    const templates = Array.from(this.templates.values());
    
    // Sort by usage count
    templates.sort((a, b) => b.usage.count - a.usage.count);
    
    return templates.slice(0, limit);
  }

  async useTemplate(templateId: string): Promise<AssetTemplate | null> {
    const template = await this.getTemplate(templateId);
    if (!template) return null;

    // Update usage stats
    template.usage.count++;
    template.usage.lastUsed = new Date();

    this.templates.set(templateId, template);
    await this.cache.setTemplate(`assetTemplate:${templateId}`, template);

    return template;
  }

  // Asset Organization
  async organizeAssetsByGame(gameId: string): Promise<{
    sprites: AssetEntry[];
    backgrounds: AssetEntry[];
    ui: AssetEntry[];
    effects: AssetEntry[];
  }> {
    const manifest = await this.cache.getManifest(gameId);
    if (!manifest) {
      return {
        sprites: [],
        backgrounds: [],
        ui: [],
        effects: []
      };
    }

    return manifest.manifest;
  }

  async getAssetStats(gameId?: string): Promise<{
    totalAssets: number;
    byType: Record<AssetType, number>;
    totalSize: number;
    averageSize: number;
  }> {
    let assets: AssetEntry[] = [];

    if (gameId) {
      const manifest = await this.cache.getManifest(gameId);
      if (manifest) {
        assets = this.extractAssetsFromManifest(manifest);
      }
    } else {
      // Get all assets from cache stats
      const stats = await this.cache.getCacheStats();
      return {
        totalAssets: stats.assets,
        byType: {} as Record<AssetType, number>, // Would need to query for this
        totalSize: stats.size,
        averageSize: stats.assets > 0 ? stats.size / stats.assets : 0
      };
    }

    const byType: Record<AssetType, number> = {
      sprite: 0,
      background: 0,
      ui: 0,
      effect: 0,
      tile: 0
    };

    let totalSize = 0;
    for (const asset of assets) {
      byType[asset.type]++;
      totalSize += asset.sizeBytes;
    }

    return {
      totalAssets: assets.length,
      byType,
      totalSize,
      averageSize: assets.length > 0 ? totalSize / assets.length : 0
    };
  }

  // Cleanup and Maintenance
  async cleanupUnusedAssets(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // TODO: Implement actual cleanup logic
    // This would query the database for old, unused assets
    // and delete them from S3 and cache

    this.logger.info(`Cleanup of assets older than ${daysOld} days requested`);
    return 0;
  }

  async exportCollection(
    collectionId: string,
    format: 'zip' | 'json' = 'json'
  ): Promise<Buffer> {
    const collection = await this.getCollection(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    if (format === 'json') {
      return Buffer.from(JSON.stringify(collection, null, 2));
    }

    // TODO: Implement ZIP export with actual asset files
    throw new Error('ZIP export not yet implemented');
  }

  // Helper methods
  private addAssetToManifest(manifest: AssetManifest, asset: AssetEntry): void {
    switch (asset.type) {
      case 'sprite':
        manifest.manifest.sprites.push(asset);
        break;
      case 'background':
        manifest.manifest.backgrounds.push(asset);
        break;
      case 'ui':
        manifest.manifest.ui.push(asset);
        break;
      case 'effect':
        manifest.manifest.effects.push(asset);
        break;
    }
  }

  private extractAssetsFromManifest(manifest: AssetManifest): AssetEntry[] {
    return [
      ...manifest.manifest.sprites,
      ...manifest.manifest.backgrounds,
      ...manifest.manifest.ui,
      ...manifest.manifest.effects
    ];
  }

  async duplicateAsset(
    gameId: string,
    assetId: string,
    newName: string
  ): Promise<AssetEntry | null> {
    const asset = await this.getAsset(gameId, assetId);
    if (!asset) return null;

    // Download original asset
    const key = this.storage.buildAssetKey(gameId, asset.type, asset.name);
    const buffer = await this.storage.downloadAsset(key);

    // Create new asset entry
    const newAsset: AssetEntry = {
      ...asset,
      id: nanoid(),
      name: newName,
      createdAt: new Date()
    };

    // Upload with new name
    const newUrl = await this.storage.uploadAsset(
      gameId,
      asset.type,
      newName,
      buffer
    );

    newAsset.url = newUrl;

    // Add to library
    await this.addAsset(gameId, newAsset);

    return newAsset;
  }
}