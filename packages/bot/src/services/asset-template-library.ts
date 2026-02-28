// GameVibe AI Asset Template Library Service
// Reusable asset system for sprites, backgrounds, and audio

import { injectable, inject } from 'inversify';
import { CacheService } from './cache.js';
import { IntelligentCacheService } from './intelligent-cache.js';
import { AssetService } from './asset.js';
import { TYPES } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface AssetTemplate {
  id: string;
  name: string;
  category: AssetCategory;
  type: AssetType;
  style: AssetStyle;
  theme: AssetTheme;
  url: string;
  thumbnail?: string;
  metadata: AssetMetadata;
  variations: AssetVariation[];
  usage: AssetUsageStats;
  tags: string[];
  createdAt: Date;
  lastUpdated: Date;
}

export interface AssetVariation {
  id: string;
  name: string;
  description: string;
  url: string;
  thumbnail?: string;
  parameters: Record<string, any>;
  generationCost: number;
  popularityScore: number;
}

export interface AssetMetadata {
  dimensions?: { width: number; height: number };
  fileSize: number;
  format: string;
  colorPalette?: string[];
  animationFrames?: number;
  duration?: number; // For audio assets
  quality: 'low' | 'medium' | 'high';
  license: 'free' | 'premium' | 'custom';
}

export interface AssetUsageStats {
  totalUses: number;
  recentUses: number;
  lastUsed: Date;
  gamesUsedIn: string[];
  averageRating: number;
  costSavings: number;
}

export type AssetCategory = 'sprite' | 'background' | 'ui' | 'effect' | 'audio' | 'texture';
export type AssetType = 'character' | 'enemy' | 'item' | 'environment' | 'particle' | 
                       'music' | 'sfx' | 'button' | 'panel' | 'icon';
export type AssetStyle = 'pixel' | 'vector' | 'realistic' | 'cartoon' | 'minimal' | 'retro';
export type AssetTheme = 'space' | 'fantasy' | 'modern' | 'nature' | 'underwater' | 
                        'cyberpunk' | 'medieval' | 'abstract' | 'classic';

export interface AssetSearchCriteria {
  category?: AssetCategory;
  type?: AssetType;
  style?: AssetStyle;
  theme?: AssetTheme;
  tags?: string[];
  quality?: 'low' | 'medium' | 'high';
  license?: 'free' | 'premium' | 'custom';
  gameType?: string;
  dimensions?: { minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number };
}

export interface AssetPackage {
  id: string;
  name: string;
  description: string;
  gameType: string;
  assets: AssetTemplate[];
  totalCost: number;
  theme: AssetTheme;
  style: AssetStyle;
}

export interface AssetGenerationRequest {
  description: string;
  category: AssetCategory;
  type: AssetType;
  style?: AssetStyle;
  theme?: AssetTheme;
  gameType?: string;
  dimensions?: { width: number; height: number };
  variations?: number;
  quality?: 'low' | 'medium' | 'high';
}

@injectable()
export class AssetTemplateLibraryService {
  private logger = new Logger('AssetTemplateLibraryService');
  private static readonly CACHE_PREFIX = 'asset_library';
  private static readonly PACKAGE_PREFIX = 'asset_package';
  
  // Pre-defined asset packages for common game types
  private static readonly DEFAULT_PACKAGES = [
    {
      name: 'Platformer Essentials',
      gameType: 'PLATFORMER',
      theme: 'classic' as AssetTheme,
      style: 'pixel' as AssetStyle,
      assets: [
        { category: 'sprite', type: 'character', name: 'Player Character' },
        { category: 'sprite', type: 'enemy', name: 'Basic Enemy' },
        { category: 'sprite', type: 'item', name: 'Collectible Coin' },
        { category: 'background', type: 'environment', name: 'Platform Background' },
        { category: 'audio', type: 'sfx', name: 'Jump Sound' },
        { category: 'audio', type: 'sfx', name: 'Collect Sound' }
      ]
    },
    {
      name: 'Space Shooter Pack',
      gameType: 'SHOOTER',
      theme: 'space' as AssetTheme,
      style: 'vector' as AssetStyle,
      assets: [
        { category: 'sprite', type: 'character', name: 'Player Ship' },
        { category: 'sprite', type: 'enemy', name: 'Enemy Ships' },
        { category: 'effect', type: 'particle', name: 'Laser Beam' },
        { category: 'background', type: 'environment', name: 'Space Background' },
        { category: 'audio', type: 'music', name: 'Space Battle Theme' },
        { category: 'audio', type: 'sfx', name: 'Laser Sound' }
      ]
    },
    {
      name: 'Puzzle Game UI',
      gameType: 'PUZZLE',
      theme: 'modern' as AssetTheme,
      style: 'minimal' as AssetStyle,
      assets: [
        { category: 'ui', type: 'button', name: 'Game Buttons' },
        { category: 'ui', type: 'panel', name: 'Score Panel' },
        { category: 'sprite', type: 'item', name: 'Puzzle Pieces' },
        { category: 'effect', type: 'particle', name: 'Match Effect' },
        { category: 'audio', type: 'sfx', name: 'Match Sound' },
        { category: 'audio', type: 'music', name: 'Ambient Puzzle Music' }
      ]
    }
  ];

  constructor(
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.IntelligentCacheService) private intelligentCache: IntelligentCacheService,
    @inject(TYPES.AssetService) private assetService: AssetService
  ) {}

  /**
   * Search for assets matching criteria
   */
  async searchAssets(criteria: AssetSearchCriteria, limit: number = 20): Promise<AssetTemplate[]> {
    const searchKey = this.generateSearchKey(criteria);
    const cacheKey = `${AssetTemplateLibraryService.CACHE_PREFIX}:search:${searchKey}`;
    
    // Check cache first
    const cached = await this.cache.get<AssetTemplate[]>(cacheKey);
    if (cached) {
      this.logger.info('Asset search cache hit', { criteria, resultCount: cached.length });
      return cached.slice(0, limit);
    }

    // Search through stored assets
    const allAssetKeys = await this.cache.keys(`${AssetTemplateLibraryService.CACHE_PREFIX}:asset:*`);
    const matchingAssets: Array<{ asset: AssetTemplate; score: number }> = [];

    for (const key of allAssetKeys) {
      const asset = await this.cache.get<AssetTemplate>(key);
      if (!asset) continue;

      const score = this.calculateAssetMatch(asset, criteria);
      if (score > 0.5) { // 50% match threshold
        matchingAssets.push({ asset, score });
      }
    }

    // Sort by relevance score and usage popularity
    const results = matchingAssets
      .sort((a, b) => {
        const scoreA = a.score * 0.7 + (a.asset.usage.totalUses / 1000) * 0.3;
        const scoreB = b.score * 0.7 + (b.asset.usage.totalUses / 1000) * 0.3;
        return scoreB - scoreA;
      })
      .slice(0, limit)
      .map(item => item.asset);

    // Cache results
    await this.cache.set(cacheKey, results, 1800); // 30 minutes

    this.logger.info('Asset search completed', { criteria, resultCount: results.length });
    return results;
  }

  /**
   * Get asset package for a specific game type
   */
  async getAssetPackage(gameType: string, theme?: AssetTheme, style?: AssetStyle): Promise<AssetPackage | null> {
    const packageKey = `${AssetTemplateLibraryService.PACKAGE_PREFIX}:${gameType}:${theme || 'any'}:${style || 'any'}`;
    
    // Check cache first
    let assetPackage = await this.cache.get<AssetPackage>(packageKey);
    if (assetPackage) {
      this.logger.info('Asset package cache hit', { gameType, theme, style });
      return assetPackage;
    }

    // Try to find or create package
    assetPackage = await this.createAssetPackage(gameType, theme, style);
    
    if (assetPackage) {
      // Cache the package
      await this.cache.set(packageKey, assetPackage, 3600); // 1 hour
      this.logger.info('Asset package created and cached', { packageId: assetPackage.id, gameType });
    }

    return assetPackage;
  }

  /**
   * Generate new asset and add to library
   */
  async generateAndStoreAsset(request: AssetGenerationRequest): Promise<AssetTemplate> {
    // Check if similar asset already exists
    const similarAssets = await this.searchAssets({
      category: request.category,
      type: request.type,
      style: request.style,
      theme: request.theme,
      gameType: request.gameType
    }, 5);

    if (similarAssets.length > 0) {
      const existingAsset = similarAssets[0];
      await this.updateUsageStats(existingAsset.id);
      this.logger.info('Using existing similar asset instead of generating new', { 
        assetId: existingAsset.id,
        request 
      });
      return existingAsset;
    }

    // Generate new asset
    const generatedAsset = await this.generateAsset(request);
    
    // Store in library
    const assetTemplate = await this.storeAsset(generatedAsset, request);
    
    this.logger.info('New asset generated and stored', { assetId: assetTemplate.id, request });
    return assetTemplate;
  }

  /**
   * Get asset with variations
   */
  async getAssetWithVariations(assetId: string): Promise<AssetTemplate | null> {
    const cacheKey = `${AssetTemplateLibraryService.CACHE_PREFIX}:asset:${assetId}`;
    const asset = await this.cache.get<AssetTemplate>(cacheKey);
    
    if (asset) {
      await this.updateUsageStats(assetId);
    }
    
    return asset;
  }

  /**
   * Create asset variation
   */
  async createAssetVariation(
    assetId: string, 
    variationRequest: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    }
  ): Promise<AssetVariation | null> {
    const asset = await this.getAssetWithVariations(assetId);
    if (!asset) return null;

    // Check if similar variation exists
    const similarVariation = asset.variations.find(v => 
      this.calculateParameterSimilarity(v.parameters, variationRequest.parameters) > 0.8
    );

    if (similarVariation) {
      similarVariation.popularityScore++;
      await this.updateAsset(asset);
      return similarVariation;
    }

    // Generate new variation
    const variation = await this.generateAssetVariation(asset, variationRequest);
    asset.variations.push(variation);
    asset.lastUpdated = new Date();

    await this.updateAsset(asset);
    
    this.logger.info('Asset variation created', { assetId, variationId: variation.id });
    return variation;
  }

  /**
   * Initialize library with default asset packages
   */
  async initializeLibrary(): Promise<void> {
    this.logger.info('Initializing asset template library');
    
    for (const packageDef of AssetTemplateLibraryService.DEFAULT_PACKAGES) {
      try {
        const existingPackage = await this.getAssetPackage(
          packageDef.gameType, 
          packageDef.theme, 
          packageDef.style
        );
        
        if (!existingPackage) {
          await this.createDefaultAssetPackage(packageDef);
          this.logger.info('Created default asset package', { name: packageDef.name });
        }
      } catch (error) {
        this.logger.warn('Failed to create default package', { packageName: packageDef.name, error });
      }
    }
    
    this.logger.info('Asset template library initialized');
  }

  /**
   * Get library analytics
   */
  async getAnalytics(): Promise<{
    totalAssets: number;
    totalVariations: number;
    assetsByCategory: Record<AssetCategory, number>;
    assetsByTheme: Record<AssetTheme, number>;
    mostUsedAssets: Array<{ id: string; name: string; uses: number }>;
    costSavings: number;
    hitRate: number;
  }> {
    const assetKeys = await this.cache.keys(`${AssetTemplateLibraryService.CACHE_PREFIX}:asset:*`);
    const assets = await Promise.all(
      assetKeys.map(key => this.cache.get<AssetTemplate>(key))
    );
    const validAssets = assets.filter(a => a !== null) as AssetTemplate[];

    const totalVariations = validAssets.reduce((sum, a) => sum + a.variations.length, 0);
    const totalCostSavings = validAssets.reduce((sum, a) => sum + a.usage.costSavings, 0);
    const totalUses = validAssets.reduce((sum, a) => sum + a.usage.totalUses, 0);

    // Category distribution
    const assetsByCategory = validAssets.reduce((counts, asset) => {
      counts[asset.category] = (counts[asset.category] || 0) + 1;
      return counts;
    }, {} as Record<AssetCategory, number>);

    // Theme distribution
    const assetsByTheme = validAssets.reduce((counts, asset) => {
      counts[asset.theme] = (counts[asset.theme] || 0) + 1;
      return counts;
    }, {} as Record<AssetTheme, number>);

    // Most used assets
    const mostUsedAssets = validAssets
      .sort((a, b) => b.usage.totalUses - a.usage.totalUses)
      .slice(0, 10)
      .map(a => ({
        id: a.id,
        name: a.name,
        uses: a.usage.totalUses
      }));

    // Hit rate (assets with uses vs total assets)
    const usedAssets = validAssets.filter(a => a.usage.totalUses > 0);
    const hitRate = validAssets.length > 0 ? (usedAssets.length / validAssets.length) * 100 : 0;

    return {
      totalAssets: validAssets.length,
      totalVariations,
      assetsByCategory,
      assetsByTheme,
      mostUsedAssets,
      costSavings: totalCostSavings,
      hitRate
    };
  }

  /**
   * Clean up unused assets
   */
  async cleanup(maxAge: number = 60 * 24 * 60 * 60 * 1000): Promise<number> {
    const assetKeys = await this.cache.keys(`${AssetTemplateLibraryService.CACHE_PREFIX}:asset:*`);
    let cleanedCount = 0;

    for (const key of assetKeys) {
      const asset = await this.cache.get<AssetTemplate>(key);
      if (!asset) continue;

      const age = Date.now() - asset.lastUpdated.getTime();
      const shouldClean = age > maxAge && asset.usage.totalUses === 0;

      if (shouldClean) {
        await this.cache.delete(key);
        cleanedCount++;
      }
    }

    this.logger.info('Asset library cleanup completed', { cleanedCount });
    return cleanedCount;
  }

  /**
   * Calculate how well an asset matches search criteria
   */
  private calculateAssetMatch(asset: AssetTemplate, criteria: AssetSearchCriteria): number {
    let score = 0;
    let maxScore = 0;

    // Category match (30% weight)
    maxScore += 30;
    if (criteria.category && asset.category === criteria.category) {
      score += 30;
    }

    // Type match (25% weight)
    maxScore += 25;
    if (criteria.type && asset.type === criteria.type) {
      score += 25;
    }

    // Style match (20% weight)
    maxScore += 20;
    if (criteria.style && asset.style === criteria.style) {
      score += 20;
    } else if (criteria.style && this.isStyleCompatible(criteria.style, asset.style)) {
      score += 10;
    }

    // Theme match (15% weight)
    maxScore += 15;
    if (criteria.theme && asset.theme === criteria.theme) {
      score += 15;
    }

    // Tag overlap (10% weight)
    maxScore += 10;
    if (criteria.tags && criteria.tags.length > 0) {
      const tagOverlap = criteria.tags.filter(tag => asset.tags.includes(tag)).length;
      score += (tagOverlap / criteria.tags.length) * 10;
    }

    return maxScore > 0 ? (score / maxScore) : 0;
  }

  /**
   * Check if styles are compatible
   */
  private isStyleCompatible(requested: AssetStyle, available: AssetStyle): boolean {
    const compatibilityMap: Record<AssetStyle, AssetStyle[]> = {
      pixel: ['retro'],
      vector: ['minimal', 'cartoon'],
      realistic: ['cartoon'],
      cartoon: ['realistic', 'vector'],
      minimal: ['vector'],
      retro: ['pixel']
    };

    return compatibilityMap[requested]?.includes(available) || false;
  }

  /**
   * Generate search key for caching
   */
  private generateSearchKey(criteria: AssetSearchCriteria): string {
    return [
      criteria.category || 'any',
      criteria.type || 'any',
      criteria.style || 'any',
      criteria.theme || 'any',
      (criteria.tags || []).sort().join(',') || 'none',
      criteria.quality || 'any'
    ].join('-');
  }

  /**
   * Create asset package for a game type
   */
  private async createAssetPackage(
    gameType: string, 
    theme?: AssetTheme, 
    style?: AssetStyle
  ): Promise<AssetPackage | null> {
    // Find default package definition
    const packageDef = AssetTemplateLibraryService.DEFAULT_PACKAGES.find(
      p => p.gameType === gameType && 
           (!theme || p.theme === theme) && 
           (!style || p.style === style)
    );

    if (!packageDef) return null;

    // Search for existing assets or create new ones
    const packageAssets: AssetTemplate[] = [];
    let totalCost = 0;

    for (const assetDef of packageDef.assets) {
      const existingAssets = await this.searchAssets({
        category: assetDef.category as AssetCategory,
        type: assetDef.type as AssetType,
        theme: packageDef.theme,
        style: packageDef.style
      }, 1);

      if (existingAssets.length > 0) {
        packageAssets.push(existingAssets[0]);
      } else {
        // Generate placeholder asset
        const newAsset = await this.createPlaceholderAsset(assetDef, packageDef);
        packageAssets.push(newAsset);
        totalCost += this.estimateAssetGenerationCost(assetDef.category as AssetCategory);
      }
    }

    return {
      id: this.generatePackageId(gameType, theme, style),
      name: packageDef.name,
      description: `Asset package for ${gameType} games`,
      gameType,
      assets: packageAssets,
      totalCost,
      theme: packageDef.theme,
      style: packageDef.style
    };
  }

  /**
   * Create default asset package
   */
  private async createDefaultAssetPackage(packageDef: any): Promise<void> {
    const packageAssets: AssetTemplate[] = [];
    
    for (const assetDef of packageDef.assets) {
      const placeholderAsset = await this.createPlaceholderAsset(assetDef, packageDef);
      packageAssets.push(placeholderAsset);
      
      // Store individual asset
      const cacheKey = `${AssetTemplateLibraryService.CACHE_PREFIX}:asset:${placeholderAsset.id}`;
      await this.cache.set(cacheKey, placeholderAsset, 24 * 3600); // 24 hours
    }
  }

  /**
   * Create placeholder asset for library initialization
   */
  private async createPlaceholderAsset(assetDef: any, packageDef: any): Promise<AssetTemplate> {
    const assetId = this.generateAssetId(assetDef.name, packageDef.gameType);
    
    return {
      id: assetId,
      name: assetDef.name,
      category: assetDef.category as AssetCategory,
      type: assetDef.type as AssetType,
      style: packageDef.style,
      theme: packageDef.theme,
      url: await this.assetService.generatePlaceholder(assetDef.category, assetDef.type),
      metadata: {
        dimensions: { width: 64, height: 64 },
        fileSize: 1024,
        format: 'png',
        quality: 'medium' as const,
        license: 'free' as const
      },
      variations: [],
      usage: {
        totalUses: 0,
        recentUses: 0,
        lastUsed: new Date(),
        gamesUsedIn: [],
        averageRating: 0,
        costSavings: 0
      },
      tags: [packageDef.gameType.toLowerCase(), packageDef.theme, packageDef.style],
      createdAt: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Generate actual asset using AI
   */
  private async generateAsset(request: AssetGenerationRequest): Promise<any> {
    // This would integrate with AI asset generation service
    // For now, return placeholder
    return {
      url: await this.assetService.generatePlaceholder(request.category, request.type),
      metadata: {
        dimensions: request.dimensions || { width: 64, height: 64 },
        fileSize: 2048,
        format: 'png',
        quality: request.quality || 'medium'
      }
    };
  }

  /**
   * Store generated asset in library
   */
  private async storeAsset(generatedAsset: any, request: AssetGenerationRequest): Promise<AssetTemplate> {
    const assetId = this.generateAssetId(request.description, request.gameType);
    
    const assetTemplate: AssetTemplate = {
      id: assetId,
      name: request.description,
      category: request.category,
      type: request.type,
      style: request.style || 'vector',
      theme: request.theme || 'modern',
      url: generatedAsset.url,
      metadata: {
        ...generatedAsset.metadata,
        license: 'free' as const
      },
      variations: [],
      usage: {
        totalUses: 0,
        recentUses: 0,
        lastUsed: new Date(),
        gamesUsedIn: [],
        averageRating: 0,
        costSavings: 0
      },
      tags: [request.gameType || 'general', request.theme || 'modern', request.style || 'vector'],
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    const cacheKey = `${AssetTemplateLibraryService.CACHE_PREFIX}:asset:${assetId}`;
    await this.cache.set(cacheKey, assetTemplate, 24 * 3600); // 24 hours

    return assetTemplate;
  }

  /**
   * Generate asset variation
   */
  private async generateAssetVariation(
    asset: AssetTemplate, 
    variationRequest: { name: string; description: string; parameters: Record<string, any> }
  ): Promise<AssetVariation> {
    // This would generate actual variation using AI
    // For now, return placeholder variation
    return {
      id: `${asset.id}-${variationRequest.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: variationRequest.name,
      description: variationRequest.description,
      url: asset.url, // Placeholder - would be actual variation
      parameters: variationRequest.parameters,
      generationCost: this.estimateAssetGenerationCost(asset.category),
      popularityScore: 0
    };
  }

  /**
   * Update asset in cache
   */
  private async updateAsset(asset: AssetTemplate): Promise<void> {
    const cacheKey = `${AssetTemplateLibraryService.CACHE_PREFIX}:asset:${asset.id}`;
    await this.cache.set(cacheKey, asset, 24 * 3600);
  }

  /**
   * Update asset usage statistics
   */
  private async updateUsageStats(assetId: string): Promise<void> {
    const asset = await this.getAssetWithVariations(assetId);
    if (!asset) return;

    asset.usage.totalUses++;
    asset.usage.recentUses++;
    asset.usage.lastUsed = new Date();

    await this.updateAsset(asset);
  }

  /**
   * Calculate parameter similarity
   */
  private calculateParameterSimilarity(params1: Record<string, any>, params2: Record<string, any>): number {
    const keys1 = Object.keys(params1);
    const keys2 = Object.keys(params2);
    const allKeys = new Set([...keys1, ...keys2]);
    
    if (allKeys.size === 0) return 1.0;

    let matches = 0;
    for (const key of allKeys) {
      if (params1[key] === params2[key]) {
        matches++;
      }
    }

    return matches / allKeys.size;
  }

  /**
   * Estimate asset generation cost
   */
  private estimateAssetGenerationCost(category: AssetCategory): number {
    const costs = {
      sprite: 10,
      background: 15,
      ui: 5,
      effect: 8,
      audio: 12,
      texture: 7
    };
    
    return costs[category] || 10;
  }

  /**
   * Generate unique asset ID
   */
  private generateAssetId(name: string, gameType?: string): string {
    const content = `${name}-${gameType || 'general'}-${Date.now()}`;
    return Buffer.from(content).toString('base64').substring(0, 16);
  }

  /**
   * Generate unique package ID
   */
  private generatePackageId(gameType: string, theme?: AssetTheme, style?: AssetStyle): string {
    return `pkg-${gameType}-${theme || 'any'}-${style || 'any'}`.toLowerCase();
  }
}