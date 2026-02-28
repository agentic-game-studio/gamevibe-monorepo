// GameVibe AI Game Template Caching Service
// Intelligent caching system for game templates and pre-generated variations

import { injectable, inject } from 'inversify';
import { CacheService } from './cache.js';
import { IntelligentCacheService } from './intelligent-cache.js';
import { GameEngine } from '@gamevibe/game-engine';
import { TYPES } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface CachedTemplate {
  id: string;
  name: string;
  type: string;
  complexity: 'simple' | 'medium' | 'complex';
  baseCode: string;
  variations: TemplateVariation[];
  metadata: TemplateMetadata;
  lastUpdated: Date;
  usage: TemplateUsageStats;
}

export interface TemplateVariation {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
  generatedCode: string;
  assets: Record<string, string>;
  complexity: 'simple' | 'medium' | 'complex';
  popularityScore: number;
  generationCost: number;
}

export interface TemplateMetadata {
  author: string;
  version: string;
  tags: string[];
  supportedFeatures: string[];
  minPlayerCount: number;
  maxPlayerCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface TemplateUsageStats {
  totalUses: number;
  recentUses: number;
  lastUsed: Date;
  popularVariations: string[];
  averageRating: number;
  costSavings: number;
}

export interface TemplateSearchCriteria {
  type?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  features?: string[];
  playerCount?: number;
  tags?: string[];
  minRating?: number;
}

export interface TemplateGenerationOptions {
  enableVariations: boolean;
  maxVariations: number;
  complexityLevels: ('simple' | 'medium' | 'complex')[];
  includePremiumFeatures: boolean;
}

@injectable()
export class GameTemplateCacheService {
  private logger = new Logger('GameTemplateCacheService');
  private static readonly CACHE_PREFIX = 'template_cache';
  private static readonly VARIATION_PREFIX = 'template_variation';
  private static readonly STATS_PREFIX = 'template_stats';
  
  // Popular game patterns for pre-generation
  private static readonly POPULAR_PATTERNS = [
    { type: 'PLATFORMER', features: ['jumping', 'collectibles'], complexity: 'simple' },
    { type: 'PLATFORMER', features: ['jumping', 'enemies', 'powerups'], complexity: 'medium' },
    { type: 'ENDLESS_RUNNER', features: ['running', 'obstacles'], complexity: 'simple' },
    { type: 'PUZZLE', features: ['matching', 'scoring'], complexity: 'simple' },
    { type: 'SHOOTER', features: ['shooting', 'enemies', 'scoring'], complexity: 'medium' },
    { type: 'RPG', features: ['exploration', 'inventory', 'levels'], complexity: 'complex' }
  ];

  constructor(
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.IntelligentCacheService) private intelligentCache: IntelligentCacheService,
    @inject(TYPES.GameEngine) private gameEngine: GameEngine
  ) {}

  /**
   * Get cached template that matches criteria, with fallback generation
   */
  async getTemplate(criteria: TemplateSearchCriteria): Promise<CachedTemplate | null> {
    // Try to find exact match first
    const exactMatch = await this.findExactTemplate(criteria);
    if (exactMatch) {
      await this.updateUsageStats(exactMatch.id);
      this.logger.info('Template cache hit (exact)', { templateId: exactMatch.id, type: criteria.type });
      return exactMatch;
    }

    // Try to find similar template
    const similarMatch = await this.findSimilarTemplate(criteria);
    if (similarMatch) {
      await this.updateUsageStats(similarMatch.id);
      this.logger.info('Template cache hit (similar)', { templateId: similarMatch.id, type: criteria.type });
      return similarMatch;
    }

    return null;
  }

  /**
   * Cache a template with intelligent variations
   */
  async cacheTemplate(
    template: any,
    options: TemplateGenerationOptions = {
      enableVariations: true,
      maxVariations: 5,
      complexityLevels: ['simple', 'medium'],
      includePremiumFeatures: false
    }
  ): Promise<CachedTemplate> {
    const templateId = this.generateTemplateId(template);
    
    const cachedTemplate: CachedTemplate = {
      id: templateId,
      name: template.name,
      type: template.type,
      complexity: this.analyzeTemplateComplexity(template),
      baseCode: template.code || '',
      variations: [],
      metadata: {
        author: template.author || 'system',
        version: template.version || '1.0',
        tags: template.tags || [],
        supportedFeatures: template.features || [],
        minPlayerCount: template.minPlayers || 1,
        maxPlayerCount: template.maxPlayers || 1,
        difficulty: template.difficulty || 'medium'
      },
      lastUpdated: new Date(),
      usage: {
        totalUses: 0,
        recentUses: 0,
        lastUsed: new Date(),
        popularVariations: [],
        averageRating: 0,
        costSavings: 0
      }
    };

    // Generate variations if enabled
    if (options.enableVariations) {
      cachedTemplate.variations = await this.generateTemplateVariations(
        template,
        options.maxVariations,
        options.complexityLevels,
        options.includePremiumFeatures
      );
    }

    // Cache the template
    const cacheKey = `${GameTemplateCacheService.CACHE_PREFIX}:${templateId}`;
    await this.intelligentCache.setIntelligent(cacheKey, cachedTemplate, {
      priority: 'high',
      costWeight: this.calculateTemplateCost(cachedTemplate),
      tags: [template.type, ...cachedTemplate.metadata.tags, `variations:${cachedTemplate.variations.length}`]
    });

    this.logger.info('Template cached with variations', {
      templateId,
      type: template.type,
      variations: cachedTemplate.variations.length,
      complexity: cachedTemplate.complexity
    });

    return cachedTemplate;
  }

  /**
   * Warm cache with popular game patterns
   */
  async warmCache(): Promise<void> {
    this.logger.info('Starting template cache warming');
    
    for (const pattern of GameTemplateCacheService.POPULAR_PATTERNS) {
      try {
        // Check if pattern already cached
        const existingTemplate = await this.getTemplate({
          type: pattern.type,
          features: pattern.features,
          complexity: pattern.complexity
        });

        if (!existingTemplate) {
          // Generate and cache new template for this pattern
          const baseTemplate = await this.gameEngine.selectTemplate({
            type: pattern.type,
            features: pattern.features,
            complexity: pattern.complexity
          } as any);

          await this.cacheTemplate(baseTemplate, {
            enableVariations: true,
            maxVariations: 3,
            complexityLevels: [pattern.complexity],
            includePremiumFeatures: false
          });

          this.logger.info('Warmed cache for pattern', { pattern });
        }
      } catch (error) {
        this.logger.warn('Failed to warm cache for pattern', { pattern, error });
      }
    }
  }

  /**
   * Get template variation that best matches specific parameters
   */
  async getVariation(templateId: string, parameters: Record<string, any>): Promise<TemplateVariation | null> {
    const template = await this.getCachedTemplate(templateId);
    if (!template) return null;

    // Find best matching variation
    let bestMatch: TemplateVariation | null = null;
    let bestScore = 0;

    for (const variation of template.variations) {
      const score = this.calculateParameterMatch(variation.parameters, parameters);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = variation;
      }
    }

    // Return variation if good enough match (>70%)
    if (bestMatch && bestScore > 0.7) {
      await this.updateVariationStats(templateId, bestMatch.id);
      return bestMatch;
    }

    return null;
  }

  /**
   * Add new variation to existing template
   */
  async addVariation(
    templateId: string,
    variation: Omit<TemplateVariation, 'id' | 'popularityScore'>
  ): Promise<void> {
    const template = await this.getCachedTemplate(templateId);
    if (!template) return;

    const newVariation: TemplateVariation = {
      ...variation,
      id: this.generateVariationId(templateId, variation.name),
      popularityScore: 0
    };

    template.variations.push(newVariation);
    template.lastUpdated = new Date();

    // Re-cache template
    const cacheKey = `${GameTemplateCacheService.CACHE_PREFIX}:${templateId}`;
    await this.intelligentCache.setIntelligent(cacheKey, template, {
      priority: 'high',
      costWeight: this.calculateTemplateCost(template),
      tags: [template.type, ...template.metadata.tags, `variations:${template.variations.length}`]
    });

    this.logger.info('Added variation to template', {
      templateId,
      variationId: newVariation.id,
      totalVariations: template.variations.length
    });
  }

  /**
   * Get analytics for template usage and performance
   */
  async getAnalytics(): Promise<{
    totalTemplates: number;
    totalVariations: number;
    cacheHitRate: number;
    costSavings: number;
    popularTemplates: Array<{ id: string; name: string; uses: number }>;
    topGameTypes: Array<{ type: string; count: number }>;
  }> {
    const allTemplateKeys = await this.cache.keys(`${GameTemplateCacheService.CACHE_PREFIX}:*`);
    const templates = await Promise.all(
      allTemplateKeys.map(key => this.cache.get<CachedTemplate>(key))
    );
    const validTemplates = templates.filter(t => t !== null) as CachedTemplate[];

    const totalVariations = validTemplates.reduce((sum, t) => sum + t.variations.length, 0);
    const totalUses = validTemplates.reduce((sum, t) => sum + t.usage.totalUses, 0);
    const totalCostSavings = validTemplates.reduce((sum, t) => sum + t.usage.costSavings, 0);

    // Calculate cache hit rate (templates with > 0 uses vs total templates)
    const usedTemplates = validTemplates.filter(t => t.usage.totalUses > 0);
    const cacheHitRate = validTemplates.length > 0 ? (usedTemplates.length / validTemplates.length) * 100 : 0;

    // Popular templates
    const popularTemplates = validTemplates
      .sort((a, b) => b.usage.totalUses - a.usage.totalUses)
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        name: t.name,
        uses: t.usage.totalUses
      }));

    // Top game types
    const gameTypeCounts = validTemplates.reduce((counts, t) => {
      counts[t.type] = (counts[t.type] || 0) + t.usage.totalUses;
      return counts;
    }, {} as Record<string, number>);

    const topGameTypes = Object.entries(gameTypeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return {
      totalTemplates: validTemplates.length,
      totalVariations,
      cacheHitRate,
      costSavings: totalCostSavings,
      popularTemplates,
      topGameTypes
    };
  }

  /**
   * Clean up old and unused templates
   */
  async cleanup(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const allTemplateKeys = await this.cache.keys(`${GameTemplateCacheService.CACHE_PREFIX}:*`);
    let cleanedCount = 0;

    for (const key of allTemplateKeys) {
      const template = await this.cache.get<CachedTemplate>(key);
      if (!template) continue;

      const age = Date.now() - template.lastUpdated.getTime();
      const shouldClean = age > maxAge && template.usage.totalUses === 0;

      if (shouldClean) {
        await this.cache.delete(key);
        cleanedCount++;
      }
    }

    this.logger.info('Template cache cleanup completed', { cleanedCount });
    return cleanedCount;
  }

  /**
   * Find exact template match
   */
  private async findExactTemplate(criteria: TemplateSearchCriteria): Promise<CachedTemplate | null> {
    const searchKey = this.generateSearchKey(criteria);
    const cacheKey = `${GameTemplateCacheService.CACHE_PREFIX}:${searchKey}`;
    
    return this.cache.get<CachedTemplate>(cacheKey);
  }

  /**
   * Find similar template using intelligent matching
   */
  private async findSimilarTemplate(criteria: TemplateSearchCriteria): Promise<CachedTemplate | null> {
    const allTemplateKeys = await this.cache.keys(`${GameTemplateCacheService.CACHE_PREFIX}:*`);
    let bestMatch: CachedTemplate | null = null;
    let bestScore = 0;

    for (const key of allTemplateKeys) {
      const template = await this.cache.get<CachedTemplate>(key);
      if (!template) continue;

      const score = this.calculateTemplateMatch(template, criteria);
      if (score > bestScore && score > 0.6) { // 60% similarity threshold
        bestScore = score;
        bestMatch = template;
      }
    }

    return bestMatch;
  }

  /**
   * Generate template variations for different use cases
   */
  private async generateTemplateVariations(
    baseTemplate: any,
    maxVariations: number,
    complexityLevels: ('simple' | 'medium' | 'complex')[],
    includePremiumFeatures: boolean
  ): Promise<TemplateVariation[]> {
    const variations: TemplateVariation[] = [];
    
    // Define common variations
    const variationPatterns = [
      { name: 'Speed Variant', params: { speed: 1.5, difficulty: 'easy' } },
      { name: 'Challenge Mode', params: { speed: 1.0, difficulty: 'hard', enemies: 'more' } },
      { name: 'Casual Mode', params: { speed: 0.8, difficulty: 'easy', powerups: 'more' } },
      { name: 'Retro Style', params: { graphics: 'pixel', colors: 'limited' } },
      { name: 'Modern Style', params: { graphics: 'smooth', effects: 'particles' } }
    ];

    for (let i = 0; i < Math.min(maxVariations, variationPatterns.length); i++) {
      const pattern = variationPatterns[i];
      const complexity = complexityLevels[i % complexityLevels.length];
      
      try {
        const variation: TemplateVariation = {
          id: this.generateVariationId(baseTemplate.id, pattern.name),
          name: pattern.name,
          description: `${pattern.name} variation of ${baseTemplate.name}`,
          parameters: pattern.params,
          generatedCode: await this.generateVariationCode(baseTemplate, pattern.params),
          assets: {},
          complexity,
          popularityScore: 0,
          generationCost: this.estimateVariationCost(complexity)
        };

        variations.push(variation);
      } catch (error) {
        this.logger.warn('Failed to generate template variation', { pattern: pattern.name, error });
      }
    }

    return variations;
  }

  /**
   * Generate variation code based on base template and parameters
   */
  private async generateVariationCode(baseTemplate: any, parameters: Record<string, any>): Promise<string> {
    // This would integrate with the game engine to modify the base template
    // For now, return the base code with parameter comments
    let code = baseTemplate.code || baseTemplate.baseCode || '';
    
    // Add parameter modifications as comments for now
    const paramComments = Object.entries(parameters)
      .map(([key, value]) => `// ${key}: ${value}`)
      .join('\n');
    
    return `${paramComments}\n${code}`;
  }

  /**
   * Calculate how well a template matches search criteria
   */
  private calculateTemplateMatch(template: CachedTemplate, criteria: TemplateSearchCriteria): number {
    let score = 0;
    let maxScore = 0;

    // Type match (40% weight)
    maxScore += 40;
    if (criteria.type && template.type === criteria.type) {
      score += 40;
    }

    // Complexity match (20% weight)
    maxScore += 20;
    if (criteria.complexity && template.complexity === criteria.complexity) {
      score += 20;
    } else if (criteria.complexity && this.isComplexityCompatible(criteria.complexity, template.complexity)) {
      score += 10;
    }

    // Feature overlap (30% weight)
    maxScore += 30;
    if (criteria.features && criteria.features.length > 0) {
      const featureOverlap = criteria.features.filter(f => 
        template.metadata.supportedFeatures.includes(f)
      ).length;
      score += (featureOverlap / criteria.features.length) * 30;
    }

    // Player count compatibility (10% weight)
    maxScore += 10;
    if (criteria.playerCount) {
      if (criteria.playerCount >= template.metadata.minPlayerCount && 
          criteria.playerCount <= template.metadata.maxPlayerCount) {
        score += 10;
      }
    }

    return maxScore > 0 ? (score / maxScore) : 0;
  }

  /**
   * Calculate parameter similarity between variations
   */
  private calculateParameterMatch(params1: Record<string, any>, params2: Record<string, any>): number {
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
   * Check if complexity levels are compatible
   */
  private isComplexityCompatible(requested: string, available: string): boolean {
    const complexityOrder = { simple: 0, medium: 1, complex: 2 };
    return complexityOrder[available as keyof typeof complexityOrder] >= 
           complexityOrder[requested as keyof typeof complexityOrder];
  }

  /**
   * Generate unique template ID
   */
  private generateTemplateId(template: any): string {
    const content = `${template.type}-${template.name}-${JSON.stringify(template.features || [])}`;
    return Buffer.from(content).toString('base64').substring(0, 16);
  }

  /**
   * Generate unique variation ID
   */
  private generateVariationId(templateId: string, variationName: string): string {
    return `${templateId}-${variationName.toLowerCase().replace(/\s+/g, '-')}`;
  }

  /**
   * Generate search key for exact matching
   */
  private generateSearchKey(criteria: TemplateSearchCriteria): string {
    return [
      criteria.type || 'any',
      criteria.complexity || 'any',
      (criteria.features || []).sort().join(','),
      criteria.playerCount || 'any'
    ].join('-');
  }

  /**
   * Analyze template complexity
   */
  private analyzeTemplateComplexity(template: any): 'simple' | 'medium' | 'complex' {
    const features = template.features || [];
    const codeLength = (template.code || '').length;
    
    if (features.length <= 2 && codeLength < 1000) return 'simple';
    if (features.length <= 4 && codeLength < 3000) return 'medium';
    return 'complex';
  }

  /**
   * Calculate template cost based on variations and complexity
   */
  private calculateTemplateCost(template: CachedTemplate): number {
    const baseCost = template.complexity === 'simple' ? 5 : template.complexity === 'medium' ? 15 : 30;
    const variationCost = template.variations.reduce((sum, v) => sum + v.generationCost, 0);
    return baseCost + variationCost;
  }

  /**
   * Estimate variation generation cost
   */
  private estimateVariationCost(complexity: 'simple' | 'medium' | 'complex'): number {
    switch (complexity) {
      case 'simple': return 2;
      case 'medium': return 5;
      case 'complex': return 10;
      default: return 5;
    }
  }

  /**
   * Get cached template by ID
   */
  private async getCachedTemplate(templateId: string): Promise<CachedTemplate | null> {
    const cacheKey = `${GameTemplateCacheService.CACHE_PREFIX}:${templateId}`;
    return this.cache.get<CachedTemplate>(cacheKey);
  }

  /**
   * Update template usage statistics
   */
  private async updateUsageStats(templateId: string): Promise<void> {
    const template = await this.getCachedTemplate(templateId);
    if (!template) return;

    template.usage.totalUses++;
    template.usage.recentUses++;
    template.usage.lastUsed = new Date();

    const cacheKey = `${GameTemplateCacheService.CACHE_PREFIX}:${templateId}`;
    await this.cache.set(cacheKey, template);
  }

  /**
   * Update variation usage statistics
   */
  private async updateVariationStats(templateId: string, variationId: string): Promise<void> {
    const template = await this.getCachedTemplate(templateId);
    if (!template) return;

    const variation = template.variations.find(v => v.id === variationId);
    if (variation) {
      variation.popularityScore++;
      
      // Update popular variations list
      template.usage.popularVariations = template.variations
        .sort((a, b) => b.popularityScore - a.popularityScore)
        .slice(0, 5)
        .map(v => v.id);

      const cacheKey = `${GameTemplateCacheService.CACHE_PREFIX}:${templateId}`;
      await this.cache.set(cacheKey, template);
    }
  }
}