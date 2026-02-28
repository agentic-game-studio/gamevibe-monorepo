// GameVibe AI Intelligent Caching Service
// Advanced caching system for cost optimization

import { injectable, inject } from 'inversify';
import { createHash } from 'crypto';
import { CacheService } from './cache.js';
import { TYPES } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface GameCacheKey {
  type: 'game' | 'asset' | 'template' | 'analysis';
  gameType: string;
  complexity: 'simple' | 'medium' | 'complex';
  playerCount: string;
  contentHash: string;
  features: string[];
}

export interface CacheMetadata {
  hitCount: number;
  lastAccessed: Date;
  costSaved: number; // Estimated cost saved by cache hit
  generationTime: number; // Original generation time in ms
  expiryTime: Date;
  tags: string[];
}

export interface IntelligentCacheOptions {
  ttl?: number;
  priority?: 'low' | 'medium' | 'high';
  costWeight?: number; // How expensive this item was to generate
  similarityThreshold?: number; // For semantic similarity matching
  tags?: string[];
}

@injectable()
export class IntelligentCacheService {
  private logger = new Logger('IntelligentCacheService');
  private static readonly CACHE_VERSIONS = {
    GAME: 'v2',
    ASSET: 'v1', 
    TEMPLATE: 'v1',
    ANALYSIS: 'v1'
  };

  // Cost estimates for different operations (in cents)
  private static readonly OPERATION_COSTS = {
    SIMPLE_GAME: 2,    // Haiku model
    MEDIUM_GAME: 8,    // Sonnet model  
    COMPLEX_GAME: 25,  // Opus model
    ASSET_GENERATION: 15, // DALL-E 3
    ANALYSIS: 1        // Quick analysis
  };

  // Cache duration based on content complexity and cost
  private static readonly DYNAMIC_TTL = {
    SIMPLE: 3600 * 2,    // 2 hours
    MEDIUM: 3600 * 6,    // 6 hours
    COMPLEX: 3600 * 24,  // 24 hours
    HIGH_COST: 3600 * 48 // 48 hours for expensive operations
  };

  constructor(
    @inject(TYPES.CacheService) private cache: CacheService
  ) {}

  /**
   * Generate intelligent cache key with semantic understanding
   */
  generateIntelligentKey(
    type: GameCacheKey['type'],
    content: any,
    options: Partial<GameCacheKey> = {}
  ): string {
    const gameType = options.gameType || this.extractGameType(content);
    const complexity = options.complexity || this.analyzeComplexity(content);
    const playerCount = options.playerCount || this.extractPlayerCount(content);
    const features = options.features || this.extractFeatures(content);
    
    // Create semantic content hash that captures meaning, not just text
    const contentHash = this.createSemanticHash(content, features);
    
    const key: GameCacheKey = {
      type,
      gameType,
      complexity,
      playerCount,
      contentHash,
      features: features.sort() // Normalize feature order
    };

    const version = IntelligentCacheService.CACHE_VERSIONS[type.toUpperCase() as keyof typeof IntelligentCacheService.CACHE_VERSIONS];
    return `intelligent:${version}:${type}:${gameType}:${complexity}:${playerCount}:${features.join(',')}:${contentHash}`;
  }

  /**
   * Store with intelligent caching policies
   */
  async setIntelligent<T>(
    key: string,
    value: T,
    options: IntelligentCacheOptions = {}
  ): Promise<void> {
    const metadata: CacheMetadata = {
      hitCount: 0,
      lastAccessed: new Date(),
      costSaved: 0,
      generationTime: options.costWeight || 0,
      expiryTime: new Date(Date.now() + (options.ttl || this.calculateDynamicTTL(options))),
      tags: options.tags || []
    };

    // Store the value with metadata
    const cacheEntry = {
      data: value,
      metadata,
      cachedAt: new Date(),
      priority: options.priority || 'medium'
    };

    await this.cache.set(key, cacheEntry, options.ttl || this.calculateDynamicTTL(options));
    
    // Store metadata separately for analytics
    await this.cache.set(`${key}:meta`, metadata, options.ttl || this.calculateDynamicTTL(options));

    this.logger.info(`Intelligent cache set: ${key}`, {
      priority: options.priority,
      ttl: options.ttl,
      tags: options.tags
    });
  }

  /**
   * Get with intelligent similarity matching
   */
  async getIntelligent<T>(key: string): Promise<T | null> {
    // Try exact match first
    const exactMatch = await this.cache.get<any>(key);
    if (exactMatch) {
      await this.updateHitStatistics(key, exactMatch.metadata?.costSaved || 0);
      return exactMatch.data;
    }

    // Try semantic similarity matching
    const similarKey = await this.findSimilarKey(key);
    if (similarKey) {
      const similarMatch = await this.cache.get<any>(similarKey);
      if (similarMatch) {
        await this.updateHitStatistics(similarKey, similarMatch.metadata?.costSaved || 0);
        this.logger.info(`Cache hit via similarity: ${key} -> ${similarKey}`);
        return similarMatch.data;
      }
    }

    return null;
  }

  /**
   * Invalidate cache by tags or patterns
   */
  async invalidate(pattern: string | string[]): Promise<number> {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    let deletedCount = 0;

    for (const pat of patterns) {
      // Get all keys matching pattern
      const keys = await this.cache.keys(`*${pat}*`);
      
      for (const key of keys) {
        await this.cache.delete(key);
        await this.cache.delete(`${key}:meta`);
        deletedCount++;
      }
    }

    this.logger.info(`Cache invalidated: ${deletedCount} entries for patterns: ${patterns.join(', ')}`);
    return deletedCount;
  }

  /**
   * Get comprehensive cache analytics
   */
  async getAnalytics(): Promise<{
    totalEntries: number;
    hitRate: number;
    costSavings: number;
    topKeys: Array<{ key: string; hits: number; savings: number }>;
    byComplexity: Record<string, { count: number; savings: number }>;
    byGameType: Record<string, { count: number; savings: number }>;
  }> {
    const allKeys = await this.cache.keys('intelligent:*');
    const metaKeys = allKeys.filter(key => key.endsWith(':meta'));
    
    let totalHits = 0;
    let totalSavings = 0;
    const keyStats: Array<{ key: string; hits: number; savings: number }> = [];
    const complexityStats: Record<string, { count: number; savings: number }> = {};
    const gameTypeStats: Record<string, { count: number; savings: number }> = {};

    for (const metaKey of metaKeys) {
      const metadata = await this.cache.get<CacheMetadata>(metaKey);
      if (metadata) {
        const baseKey = metaKey.replace(':meta', '');
        const keyParts = baseKey.split(':');
        
        totalHits += metadata.hitCount;
        totalSavings += metadata.costSaved;
        
        keyStats.push({
          key: baseKey,
          hits: metadata.hitCount,
          savings: metadata.costSaved
        });

        // Aggregate by complexity
        const complexity = keyParts[4] || 'unknown';
        if (!complexityStats[complexity]) {
          complexityStats[complexity] = { count: 0, savings: 0 };
        }
        complexityStats[complexity].count++;
        complexityStats[complexity].savings += metadata.costSaved;

        // Aggregate by game type
        const gameType = keyParts[3] || 'unknown';
        if (!gameTypeStats[gameType]) {
          gameTypeStats[gameType] = { count: 0, savings: 0 };
        }
        gameTypeStats[gameType].count++;
        gameTypeStats[gameType].savings += metadata.costSaved;
      }
    }

    const totalRequests = totalHits + metaKeys.length; // Rough estimate
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

    return {
      totalEntries: metaKeys.length,
      hitRate,
      costSavings: totalSavings,
      topKeys: keyStats.sort((a, b) => b.savings - a.savings).slice(0, 10),
      byComplexity: complexityStats,
      byGameType: gameTypeStats
    };
  }

  /**
   * Proactive cache warming for popular patterns
   */
  async warmCache(patterns: string[]): Promise<void> {
    this.logger.info('Starting proactive cache warming', { patterns });
    
    // This would be implemented to pre-generate common game patterns
    // For now, it's a placeholder for the architecture
    for (const pattern of patterns) {
      this.logger.info(`Warming cache for pattern: ${pattern}`);
      // TODO: Implement pattern-based pre-generation
    }
  }

  /**
   * Extract game type from content using AI or heuristics
   */
  private extractGameType(content: any): string {
    if (typeof content === 'string') {
      const lower = content.toLowerCase();
      
      if (lower.includes('platform') || lower.includes('jump') || lower.includes('mario')) {
        return 'PLATFORMER';
      } else if (lower.includes('puzzle') || lower.includes('match') || lower.includes('tetris')) {
        return 'PUZZLE';
      } else if (lower.includes('shoot') || lower.includes('space') || lower.includes('laser')) {
        return 'SHOOTER';
      } else if (lower.includes('run') || lower.includes('endless') || lower.includes('temple run')) {
        return 'ENDLESS_RUNNER';
      } else if (lower.includes('rpg') || lower.includes('adventure') || lower.includes('quest')) {
        return 'RPG';
      }
    }
    
    return 'OTHER';
  }

  /**
   * Analyze content complexity for intelligent caching
   */
  analyzeComplexity(content: any): 'simple' | 'medium' | 'complex' {
    if (typeof content === 'string') {
      const wordCount = content.split(/\s+/).length;
      const complexWords = ['multiplayer', 'physics', 'AI', 'complex', 'advanced', 'procedural'];
      const hasComplexWords = complexWords.some(word => content.toLowerCase().includes(word));
      
      if (wordCount < 20 && !hasComplexWords) {
        return 'simple';
      } else if (wordCount < 50 && !hasComplexWords) {
        return 'medium';
      } else {
        return 'complex';
      }
    }
    
    return 'medium';
  }

  /**
   * Extract player count from content
   */
  private extractPlayerCount(content: any): string {
    if (typeof content === 'string') {
      const multiplayerMatch = content.match(/(\d+)\s*players?/i);
      if (multiplayerMatch) {
        return multiplayerMatch[1];
      }
      
      if (content.toLowerCase().includes('multiplayer')) {
        return '2-8'; // Default multiplayer range
      }
    }
    
    return '1';
  }

  /**
   * Extract semantic features from content
   */
  private extractFeatures(content: any): string[] {
    if (typeof content !== 'string') {
      return [];
    }

    const features: string[] = [];
    const lower = content.toLowerCase();

    // Movement features
    if (lower.includes('jump') || lower.includes('jumping')) features.push('jumping');
    if (lower.includes('run') || lower.includes('running')) features.push('running');
    if (lower.includes('fly') || lower.includes('flying')) features.push('flying');

    // Game mechanics
    if (lower.includes('score') || lower.includes('points')) features.push('scoring');
    if (lower.includes('level') || lower.includes('stages')) features.push('levels');
    if (lower.includes('power') || lower.includes('upgrade')) features.push('powerups');
    if (lower.includes('enemy') || lower.includes('enemies')) features.push('enemies');
    if (lower.includes('collect') || lower.includes('pickup')) features.push('collectibles');

    // Visual features
    if (lower.includes('pixel') || lower.includes('retro')) features.push('pixel-art');
    if (lower.includes('3d') || lower.includes('three-dimensional')) features.push('3d');
    if (lower.includes('colorful') || lower.includes('bright')) features.push('colorful');

    // Themes
    if (lower.includes('space') || lower.includes('alien')) features.push('space-theme');
    if (lower.includes('forest') || lower.includes('nature')) features.push('nature-theme');
    if (lower.includes('medieval') || lower.includes('knight')) features.push('medieval-theme');

    return features;
  }

  /**
   * Create semantic hash that captures meaning
   */
  private createSemanticHash(content: any, features: string[]): string {
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    
    // Normalize content by removing common variations
    const normalized = contentStr
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();

    // Include features in hash for semantic similarity
    const semanticString = `${normalized}|${features.join('|')}`;
    
    return createHash('sha256')
      .update(semanticString)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Find similar cache keys using semantic matching
   */
  private async findSimilarKey(targetKey: string): Promise<string | null> {
    const keyParts = targetKey.split(':');
    if (keyParts.length < 6) return null;

    const [, version, type, gameType, complexity, playerCount] = keyParts;
    
    // Look for keys with same type and game type but potentially different features
    const pattern = `intelligent:${version}:${type}:${gameType}:*`;
    const candidateKeys = await this.cache.keys(pattern);

    for (const candidateKey of candidateKeys) {
      if (candidateKey === targetKey) continue;
      
      const candidateParts = candidateKey.split(':');
      if (candidateParts.length < 6) continue;

      // Check if complexity and player count are compatible
      const candidateComplexity = candidateParts[4];
      const candidatePlayerCount = candidateParts[5];

      // Allow some flexibility in matching
      const complexityMatch = this.isComplexityCompatible(complexity, candidateComplexity);
      const playerCountMatch = this.isPlayerCountCompatible(playerCount, candidatePlayerCount);

      if (complexityMatch && playerCountMatch) {
        // Check feature similarity
        const targetFeatures = keyParts[6]?.split(',') || [];
        const candidateFeatures = candidateParts[6]?.split(',') || [];
        
        const similarity = this.calculateFeatureSimilarity(targetFeatures, candidateFeatures);
        if (similarity > 0.7) { // 70% feature similarity threshold
          return candidateKey;
        }
      }
    }

    return null;
  }

  /**
   * Check if complexity levels are compatible for cache sharing
   */
  private isComplexityCompatible(target: string, candidate: string): boolean {
    // Simple games can use medium or complex cached results
    if (target === 'simple') return true;
    
    // Medium games can use complex cached results
    if (target === 'medium' && (candidate === 'medium' || candidate === 'complex')) return true;
    
    // Complex games need exact match
    if (target === 'complex' && candidate === 'complex') return true;
    
    return false;
  }

  /**
   * Check if player counts are compatible
   */
  private isPlayerCountCompatible(target: string, candidate: string): boolean {
    // Single player games are interchangeable
    if (target === '1' && candidate === '1') return true;
    
    // Multiplayer games with similar counts are compatible
    if (target !== '1' && candidate !== '1') return true;
    
    return false;
  }

  /**
   * Calculate feature similarity between two feature sets
   */
  private calculateFeatureSimilarity(features1: string[], features2: string[]): number {
    if (features1.length === 0 && features2.length === 0) return 1.0;
    if (features1.length === 0 || features2.length === 0) return 0.0;

    const set1 = new Set(features1);
    const set2 = new Set(features2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate dynamic TTL based on content complexity and cost
   */
  private calculateDynamicTTL(options: IntelligentCacheOptions): number {
    const costWeight = options.costWeight || 0;
    const priority = options.priority || 'medium';

    // High-cost items get longer cache duration
    if (costWeight > 20) return IntelligentCacheService.DYNAMIC_TTL.HIGH_COST;
    if (costWeight > 10) return IntelligentCacheService.DYNAMIC_TTL.COMPLEX;
    if (costWeight > 5) return IntelligentCacheService.DYNAMIC_TTL.MEDIUM;
    
    // Priority-based TTL
    if (priority === 'high') return IntelligentCacheService.DYNAMIC_TTL.COMPLEX;
    if (priority === 'low') return IntelligentCacheService.DYNAMIC_TTL.SIMPLE;
    
    return IntelligentCacheService.DYNAMIC_TTL.MEDIUM;
  }

  /**
   * Update hit statistics for cache analytics
   */
  private async updateHitStatistics(key: string, costSaved: number): Promise<void> {
    const metaKey = `${key}:meta`;
    const metadata = await this.cache.get<CacheMetadata>(metaKey);
    
    if (metadata) {
      metadata.hitCount++;
      metadata.lastAccessed = new Date();
      metadata.costSaved += costSaved;
      
      await this.cache.set(metaKey, metadata);
    }
  }

  /**
   * Estimate cost savings for different operations
   */
  static estimateCostSavings(complexity: string, type: string): number {
    const costs = IntelligentCacheService.OPERATION_COSTS;
    
    if (type === 'asset') return costs.ASSET_GENERATION;
    if (type === 'analysis') return costs.ANALYSIS;
    
    switch (complexity) {
      case 'simple': return costs.SIMPLE_GAME;
      case 'medium': return costs.MEDIUM_GAME;
      case 'complex': return costs.COMPLEX_GAME;
      default: return costs.MEDIUM_GAME;
    }
  }
}