// GameVibe AI Progressive Enhancement Service
// Generate games in stages to reduce initial costs and provide faster results

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { CacheService } from './cache.js';
import { IntelligentCacheService } from './intelligent-cache.js';
import { AIServiceWrapper } from './ai-service-wrapper.js';
import { AssetTemplateLibraryService } from './asset-template-library.js';
import { GameTemplateCacheService } from './game-template-cache.js';
import { TYPES } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface EnhancementStage {
  id: string;
  name: string;
  description: string;
  priority: 'essential' | 'high' | 'medium' | 'low' | 'optional';
  dependencies: string[]; // Stage IDs that must complete first
  estimatedCost: number; // in cents
  estimatedTime: number; // in milliseconds
  features: EnhancementFeature[];
  userTierRequired: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  completed: boolean;
  result?: any;
  error?: string;
}

export interface EnhancementFeature {
  type: 'mechanic' | 'visual' | 'audio' | 'ui' | 'ai' | 'multiplayer';
  name: string;
  description: string;
  complexity: 'simple' | 'medium' | 'complex';
  impact: 'core' | 'enhancement' | 'polish';
}

export interface ProgressiveGameGeneration {
  id: string;
  gameId: string;
  userId: string;
  userTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  originalSpec: any;
  targetComplexity: 'simple' | 'medium' | 'complex';
  maxBudget: number; // in cents
  autoUpgrade: boolean;
  
  // Stage management
  stages: EnhancementStage[];
  completedStages: string[];
  currentStage?: string;
  nextStages: string[];
  
  // Current state
  baseGame: any; // Minimal viable game
  enhancedGame: any; // Current enhanced version
  finalGame?: any; // Fully enhanced version
  
  // Progress tracking
  status: 'initializing' | 'generating_base' | 'enhancing' | 'completed' | 'failed';
  progress: number; // 0-100
  totalCost: number;
  remainingBudget: number;
  
  // User preferences
  prioritizedFeatures: string[];
  disabledFeatures: string[];
  qualitySettings: QualitySettings;
  
  createdAt: Date;
  lastUpdated: Date;
  completedAt?: Date;
}

export interface QualitySettings {
  graphics: 'low' | 'medium' | 'high';
  audio: 'none' | 'basic' | 'enhanced';
  effects: 'minimal' | 'standard' | 'advanced';
  ai: 'basic' | 'smart' | 'advanced';
  responsiveness: 'standard' | 'optimized';
}

export interface EnhancementPlan {
  gameSpec: any;
  userTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  budget: number;
  preferences: {
    prioritizeSpeed: boolean;
    prioritizeQuality: boolean;
    prioritizeFeatures: string[];
    maxStages: number;
  };
  recommendedStages: EnhancementStage[];
  estimatedTimeline: { stage: string; eta: Date }[];
  budgetBreakdown: { stage: string; cost: number }[];
}

export interface StageResult {
  stageId: string;
  success: boolean;
  generatedContent?: any;
  actualCost: number;
  processingTime: number;
  qualityScore: number; // 0-1
  error?: string;
  metadata?: any;
}

@injectable()
export class ProgressiveEnhancementService extends EventEmitter {
  private logger = new Logger('ProgressiveEnhancementService');
  private activeGenerations: Map<string, ProgressiveGameGeneration> = new Map();
  
  // Default enhancement stages for different game types
  private static readonly STAGE_TEMPLATES = {
    PLATFORMER: [
      {
        id: 'base_mechanics',
        name: 'Core Mechanics',
        priority: 'essential' as const,
        features: [
          { type: 'mechanic' as const, name: 'Player Movement', complexity: 'simple' as const, impact: 'core' as const },
          { type: 'mechanic' as const, name: 'Basic Physics', complexity: 'simple' as const, impact: 'core' as const },
          { type: 'mechanic' as const, name: 'Level Boundaries', complexity: 'simple' as const, impact: 'core' as const }
        ]
      },
      {
        id: 'basic_visuals',
        name: 'Basic Graphics',
        priority: 'high' as const,
        dependencies: ['base_mechanics'],
        features: [
          { type: 'visual' as const, name: 'Player Sprite', complexity: 'simple' as const, impact: 'core' as const },
          { type: 'visual' as const, name: 'Platform Graphics', complexity: 'simple' as const, impact: 'core' as const },
          { type: 'visual' as const, name: 'Background', complexity: 'simple' as const, impact: 'enhancement' as const }
        ]
      },
      {
        id: 'game_objectives',
        name: 'Objectives & Scoring',
        priority: 'high' as const,
        dependencies: ['base_mechanics'],
        features: [
          { type: 'mechanic' as const, name: 'Collectibles', complexity: 'simple' as const, impact: 'core' as const },
          { type: 'mechanic' as const, name: 'Scoring System', complexity: 'simple' as const, impact: 'core' as const },
          { type: 'ui' as const, name: 'Score Display', complexity: 'simple' as const, impact: 'core' as const }
        ]
      },
      {
        id: 'enhanced_mechanics',
        name: 'Advanced Mechanics',
        priority: 'medium' as const,
        dependencies: ['base_mechanics', 'game_objectives'],
        features: [
          { type: 'mechanic' as const, name: 'Power-ups', complexity: 'medium' as const, impact: 'enhancement' as const },
          { type: 'mechanic' as const, name: 'Enemies', complexity: 'medium' as const, impact: 'enhancement' as const },
          { type: 'mechanic' as const, name: 'Multiple Levels', complexity: 'medium' as const, impact: 'core' as const }
        ]
      },
      {
        id: 'audio_enhancement',
        name: 'Audio & Sound',
        priority: 'medium' as const,
        dependencies: ['basic_visuals'],
        features: [
          { type: 'audio' as const, name: 'Sound Effects', complexity: 'simple' as const, impact: 'enhancement' as const },
          { type: 'audio' as const, name: 'Background Music', complexity: 'simple' as const, impact: 'polish' as const }
        ]
      },
      {
        id: 'visual_polish',
        name: 'Visual Polish',
        priority: 'low' as const,
        dependencies: ['basic_visuals', 'enhanced_mechanics'],
        features: [
          { type: 'visual' as const, name: 'Particle Effects', complexity: 'medium' as const, impact: 'polish' as const },
          { type: 'visual' as const, name: 'Animations', complexity: 'medium' as const, impact: 'enhancement' as const },
          { type: 'visual' as const, name: 'Improved Graphics', complexity: 'medium' as const, impact: 'polish' as const }
        ]
      }
    ]
  };

  constructor(
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.IntelligentCacheService) private intelligentCache: IntelligentCacheService,
    @inject(TYPES.AIServiceWrapper) private aiService: AIServiceWrapper,
    @inject(TYPES.AssetTemplateLibraryService) private assetLibrary: AssetTemplateLibraryService,
    @inject(TYPES.GameTemplateCacheService) private templateCache: GameTemplateCacheService
  ) {
    super();
  }

  /**
   * Start progressive game generation
   */
  async startProgressiveGeneration(
    gameSpec: any,
    userId: string,
    userTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE',
    options: {
      maxBudget?: number;
      autoUpgrade?: boolean;
      prioritizedFeatures?: string[];
      qualitySettings?: Partial<QualitySettings>;
    } = {}
  ): Promise<string> {
    const generationId = this.generateId();
    
    // Create enhancement plan
    const plan = await this.createEnhancementPlan(gameSpec, userTier, options.maxBudget || 50);
    
    const generation: ProgressiveGameGeneration = {
      id: generationId,
      gameId: gameSpec.id || this.generateId(),
      userId,
      userTier,
      originalSpec: gameSpec,
      targetComplexity: this.analyzeComplexity(gameSpec),
      maxBudget: options.maxBudget || this.getDefaultBudget(userTier),
      autoUpgrade: options.autoUpgrade || false,
      
      stages: plan.recommendedStages,
      completedStages: [],
      nextStages: plan.recommendedStages.filter(s => s.dependencies.length === 0).map(s => s.id),
      
      baseGame: null,
      enhancedGame: null,
      
      status: 'initializing',
      progress: 0,
      totalCost: 0,
      remainingBudget: options.maxBudget || this.getDefaultBudget(userTier),
      
      prioritizedFeatures: options.prioritizedFeatures || [],
      disabledFeatures: [],
      qualitySettings: {
        graphics: 'medium',
        audio: 'basic',
        effects: 'standard',
        ai: 'basic',
        responsiveness: 'standard',
        ...options.qualitySettings
      },
      
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    this.activeGenerations.set(generationId, generation);
    
    // Start with base game generation
    this.processNextStage(generation);
    
    this.logger.info('Progressive game generation started', {
      generationId,
      gameType: gameSpec.type,
      userTier,
      stageCount: generation.stages.length,
      maxBudget: generation.maxBudget
    });

    return generationId;
  }

  /**
   * Get current generation status
   */
  async getGenerationStatus(generationId: string): Promise<ProgressiveGameGeneration | null> {
    return this.activeGenerations.get(generationId) || null;
  }

  /**
   * Get playable game at current stage
   */
  async getCurrentPlayableGame(generationId: string): Promise<any | null> {
    const generation = this.activeGenerations.get(generationId);
    if (!generation) return null;

    // Return the most complete version available
    return generation.enhancedGame || generation.baseGame;
  }

  /**
   * Request specific enhancement
   */
  async requestEnhancement(
    generationId: string,
    stageId: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<boolean> {
    const generation = this.activeGenerations.get(generationId);
    if (!generation) return false;

    // Find the stage
    const stage = generation.stages.find(s => s.id === stageId);
    if (!stage || stage.completed) return false;

    // Check if dependencies are met
    const dependenciesMet = stage.dependencies.every(depId => 
      generation.completedStages.includes(depId)
    );

    if (!dependenciesMet) {
      this.logger.warn('Enhancement dependencies not met', { generationId, stageId, dependencies: stage.dependencies });
      return false;
    }

    // Check budget
    if (generation.remainingBudget < stage.estimatedCost) {
      this.logger.warn('Insufficient budget for enhancement', { 
        generationId, 
        stageId, 
        cost: stage.estimatedCost, 
        remaining: generation.remainingBudget 
      });
      return false;
    }

    // Update priority and process
    stage.priority = priority as any;
    if (!generation.nextStages.includes(stageId)) {
      generation.nextStages.unshift(stageId); // Add to front for high priority
    }

    await this.processNextStage(generation);
    return true;
  }

  /**
   * Cancel generation
   */
  async cancelGeneration(generationId: string): Promise<boolean> {
    const generation = this.activeGenerations.get(generationId);
    if (!generation) return false;

    generation.status = 'failed';
    this.activeGenerations.delete(generationId);
    
    this.emit('generationCancelled', generationId);
    this.logger.info('Progressive generation cancelled', { generationId });
    
    return true;
  }

  /**
   * Update quality settings mid-generation
   */
  async updateQualitySettings(
    generationId: string,
    newSettings: Partial<QualitySettings>
  ): Promise<boolean> {
    const generation = this.activeGenerations.get(generationId);
    if (!generation) return false;

    generation.qualitySettings = { ...generation.qualitySettings, ...newSettings };
    generation.lastUpdated = new Date();

    // Re-plan remaining stages with new quality settings
    await this.replanRemainingStages(generation);

    this.logger.info('Quality settings updated', { generationId, newSettings });
    return true;
  }

  /**
   * Get generation analytics
   */
  async getAnalytics(): Promise<{
    activeGenerations: number;
    completedGenerations: number;
    averageCompletionTime: number;
    averageCostSavings: number;
    popularStages: Array<{ stageId: string; usage: number }>;
    userSatisfactionByStage: Record<string, number>;
  }> {
    // This would aggregate data from completed generations
    return {
      activeGenerations: this.activeGenerations.size,
      completedGenerations: 0, // Would be tracked in database
      averageCompletionTime: 0,
      averageCostSavings: 0,
      popularStages: [],
      userSatisfactionByStage: {}
    };
  }

  /**
   * Create enhancement plan for a game
   */
  private async createEnhancementPlan(
    gameSpec: any,
    userTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE',
    budget: number
  ): Promise<EnhancementPlan> {
    // Get stage templates for game type
    const stageTemplates = ProgressiveEnhancementService.STAGE_TEMPLATES[gameSpec.type as keyof typeof ProgressiveEnhancementService.STAGE_TEMPLATES] || 
                          ProgressiveEnhancementService.STAGE_TEMPLATES.PLATFORMER;

    // Create stages with cost estimates
    const stages: EnhancementStage[] = stageTemplates.map(template => ({
      ...template,
      id: `${gameSpec.id || 'game'}_${template.id}`,
      estimatedCost: this.estimateStageCost(template, gameSpec, userTier),
      estimatedTime: this.estimateStageTime(template, gameSpec),
      userTierRequired: this.getRequiredTierForStage(template),
      completed: false
    }));

    // Filter stages by user tier and budget
    const affordableStages = stages.filter(stage => 
      this.getTierLevel(userTier) >= this.getTierLevel(stage.userTierRequired) &&
      stage.estimatedCost <= budget
    );

    // Sort by priority and cost
    const prioritizedStages = this.prioritizeStages(affordableStages, budget);

    // Create timeline
    const timeline = this.createTimeline(prioritizedStages);

    // Create budget breakdown
    const budgetBreakdown = prioritizedStages.map(stage => ({
      stage: stage.name,
      cost: stage.estimatedCost
    }));

    return {
      gameSpec,
      userTier,
      budget,
      preferences: {
        prioritizeSpeed: userTier === 'FREE',
        prioritizeQuality: userTier === 'PRO' || userTier === 'ENTERPRISE',
        prioritizeFeatures: [],
        maxStages: this.getMaxStages(userTier)
      },
      recommendedStages: prioritizedStages,
      estimatedTimeline: timeline,
      budgetBreakdown
    };
  }

  /**
   * Process the next available stage
   */
  private async processNextStage(generation: ProgressiveGameGeneration): Promise<void> {
    if (generation.status === 'completed' || generation.status === 'failed') {
      return;
    }

    if (generation.nextStages.length === 0) {
      await this.completeGeneration(generation);
      return;
    }

    const stageId = generation.nextStages.shift()!;
    const stage = generation.stages.find(s => s.id === stageId);
    
    if (!stage) {
      this.logger.error('Stage not found', { generationId: generation.id, stageId });
      return;
    }

    generation.currentStage = stageId;
    generation.status = stage.priority === 'essential' ? 'generating_base' : 'enhancing';
    
    this.logger.info('Processing enhancement stage', {
      generationId: generation.id,
      stageId,
      stageName: stage.name,
      priority: stage.priority
    });

    this.emit('stageStarted', generation.id, stage);

    try {
      const result = await this.executeStage(generation, stage);
      
      if (result.success) {
        stage.completed = true;
        stage.result = result.generatedContent;
        generation.completedStages.push(stageId);
        generation.totalCost += result.actualCost;
        generation.remainingBudget -= result.actualCost;
        
        // Update game state
        if (stage.priority === 'essential' && !generation.baseGame) {
          generation.baseGame = result.generatedContent;
        } else {
          generation.enhancedGame = this.mergeGameContent(
            generation.enhancedGame || generation.baseGame,
            result.generatedContent
          );
        }

        // Update progress
        generation.progress = (generation.completedStages.length / generation.stages.length) * 100;
        
        // Add newly available stages
        this.updateAvailableStages(generation);
        
        this.emit('stageCompleted', generation.id, stage, result);
        
        // Continue with next stage if auto-upgrade is enabled
        if (generation.autoUpgrade || stage.priority === 'essential' || stage.priority === 'high') {
          setTimeout(() => this.processNextStage(generation), 1000);
        }
        
      } else {
        stage.error = result.error;
        this.logger.error('Stage processing failed', {
          generationId: generation.id,
          stageId,
          error: result.error
        });
        
        this.emit('stageFailed', generation.id, stage, result);
        
        // Continue with next stage (don't fail the whole generation)
        setTimeout(() => this.processNextStage(generation), 1000);
      }
      
    } catch (error) {
      stage.error = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Stage execution error', {
        generationId: generation.id,
        stageId,
        error
      });
      
      // Continue processing other stages
      setTimeout(() => this.processNextStage(generation), 1000);
    }

    generation.currentStage = undefined;
    generation.lastUpdated = new Date();
  }

  /**
   * Execute a single enhancement stage
   */
  private async executeStage(
    generation: ProgressiveGameGeneration,
    stage: EnhancementStage
  ): Promise<StageResult> {
    const startTime = Date.now();
    
    try {
      // Check if we can use cached results
      const cacheKey = this.generateStageCacheKey(generation, stage);
      const cached = await this.intelligentCache.getIntelligent(cacheKey);
      
      if (cached) {
        this.logger.info('Using cached stage result', {
          generationId: generation.id,
          stageId: stage.id
        });
        
        return {
          stageId: stage.id,
          success: true,
          generatedContent: cached,
          actualCost: 0, // No cost for cached content
          processingTime: Date.now() - startTime,
          qualityScore: 0.9 // Assume cached content is high quality
        };
      }

      // Generate content for this stage
      const content = await this.generateStageContent(generation, stage);
      
      // Cache the result
      await this.intelligentCache.setIntelligent(cacheKey, content, {
        priority: stage.priority === 'essential' ? 'high' : 'medium',
        costWeight: stage.estimatedCost,
        tags: [
          `stage:${stage.id}`,
          `game_type:${generation.originalSpec.type}`,
          `user_tier:${generation.userTier}`
        ]
      });

      const result: StageResult = {
        stageId: stage.id,
        success: true,
        generatedContent: content,
        actualCost: this.calculateActualStageCost(stage, content),
        processingTime: Date.now() - startTime,
        qualityScore: this.assessContentQuality(content, stage)
      };

      return result;

    } catch (error) {
      return {
        stageId: stage.id,
        success: false,
        actualCost: 0,
        processingTime: Date.now() - startTime,
        qualityScore: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate content for a specific stage
   */
  private async generateStageContent(
    generation: ProgressiveGameGeneration,
    stage: EnhancementStage
  ): Promise<any> {
    const features = stage.features;
    const gameSpec = generation.originalSpec;
    
    // Build prompt based on stage features
    const prompt = this.buildStagePrompt(generation, stage);
    
    // Use AI service to generate content
    const response = await this.aiService.generateWithCriteria(
      {
        description: prompt,
        gameType: gameSpec.type,
        complexity: this.getStageComplexity(stage),
        playerCount: parseInt(gameSpec.playerCount) || 1,
        features: features.map(f => f.name),
        userTier: generation.userTier
      },
      prompt,
      this.buildStageSystemPrompt(stage)
    );

    // Process and structure the generated content
    return this.processGeneratedContent(response.content, stage);
  }

  /**
   * Merge new content with existing game
   */
  private mergeGameContent(existingGame: any, newContent: any): any {
    if (!existingGame) return newContent;
    
    // Simple merge strategy - would be more sophisticated in real implementation
    return {
      ...existingGame,
      ...newContent,
      features: [...(existingGame.features || []), ...(newContent.features || [])],
      assets: { ...(existingGame.assets || {}), ...(newContent.assets || {}) }
    };
  }

  /**
   * Update available stages based on completed dependencies
   */
  private updateAvailableStages(generation: ProgressiveGameGeneration): void {
    const availableStages = generation.stages
      .filter(stage => 
        !stage.completed && 
        !generation.nextStages.includes(stage.id) &&
        stage.dependencies.every(depId => generation.completedStages.includes(depId)) &&
        generation.remainingBudget >= stage.estimatedCost
      )
      .map(stage => stage.id);

    generation.nextStages.push(...availableStages);
    
    // Sort by priority
    generation.nextStages.sort((a, b) => {
      const stageA = generation.stages.find(s => s.id === a)!;
      const stageB = generation.stages.find(s => s.id === b)!;
      const priorityOrder = { essential: 0, high: 1, medium: 2, low: 3, optional: 4 };
      return priorityOrder[stageA.priority] - priorityOrder[stageB.priority];
    });
  }

  /**
   * Complete the generation process
   */
  private async completeGeneration(generation: ProgressiveGameGeneration): Promise<void> {
    generation.status = 'completed';
    generation.completedAt = new Date();
    generation.finalGame = generation.enhancedGame || generation.baseGame;
    generation.progress = 100;

    // Cache the final result
    const finalCacheKey = `progressive_game:${generation.gameId}:final`;
    await this.cache.set(finalCacheKey, generation.finalGame, 24 * 3600);

    this.emit('generationCompleted', generation.id, generation);
    
    this.logger.info('Progressive generation completed', {
      generationId: generation.id,
      totalCost: generation.totalCost,
      completedStages: generation.completedStages.length,
      totalStages: generation.stages.length
    });

    // Clean up after some time
    setTimeout(() => {
      this.activeGenerations.delete(generation.id);
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  // Helper methods

  private analyzeComplexity(gameSpec: any): 'simple' | 'medium' | 'complex' {
    const features = gameSpec.features || [];
    const description = gameSpec.description || '';
    
    if (features.length <= 2 && description.length < 100) return 'simple';
    if (features.length <= 5 && description.length < 300) return 'medium';
    return 'complex';
  }

  private getDefaultBudget(userTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'): number {
    const budgets = { FREE: 25, STARTER: 50, PRO: 100, ENTERPRISE: 200 };
    return budgets[userTier];
  }

  private estimateStageCost(template: any, gameSpec: any, userTier: string): number {
    const baseCost = template.features.length * 5;
    const complexityMultiplier = { simple: 1, medium: 1.5, complex: 2.5 };
    const tierMultiplier = { FREE: 1, STARTER: 0.9, PRO: 0.8, ENTERPRISE: 0.7 };
    
    return Math.ceil(baseCost * complexityMultiplier[this.analyzeComplexity(gameSpec)] * 
                    tierMultiplier[userTier as keyof typeof tierMultiplier]);
  }

  private estimateStageTime(template: any, gameSpec: any): number {
    return template.features.length * 10000; // 10 seconds per feature
  }

  private getRequiredTierForStage(template: any): 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE' {
    if (template.priority === 'essential' || template.priority === 'high') return 'FREE';
    if (template.priority === 'medium') return 'STARTER';
    return 'PRO';
  }

  private getTierLevel(tier: string): number {
    const levels = { FREE: 0, STARTER: 1, PRO: 2, ENTERPRISE: 3 };
    return levels[tier as keyof typeof levels] || 0;
  }

  private getMaxStages(userTier: string): number {
    const maxStages = { FREE: 3, STARTER: 5, PRO: 8, ENTERPRISE: 12 };
    return maxStages[userTier as keyof typeof maxStages] || 3;
  }

  private prioritizeStages(stages: EnhancementStage[], budget: number): EnhancementStage[] {
    // Sort by priority, then by cost efficiency
    return stages.sort((a, b) => {
      const priorityOrder = { essential: 0, high: 1, medium: 2, low: 3, optional: 4 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Secondary sort by cost efficiency (features per cost)
      const efficiencyA = a.features.length / a.estimatedCost;
      const efficiencyB = b.features.length / b.estimatedCost;
      return efficiencyB - efficiencyA;
    });
  }

  private createTimeline(stages: EnhancementStage[]): Array<{ stage: string; eta: Date }> {
    let currentTime = new Date();
    
    return stages.map(stage => {
      currentTime = new Date(currentTime.getTime() + stage.estimatedTime);
      return {
        stage: stage.name,
        eta: new Date(currentTime)
      };
    });
  }

  private async replanRemainingStages(generation: ProgressiveGameGeneration): Promise<void> {
    // Recalculate costs and priorities based on new quality settings
    // This would update the remaining stages in the generation
    this.logger.info('Replanning remaining stages', { generationId: generation.id });
  }

  private generateStageCacheKey(generation: ProgressiveGameGeneration, stage: EnhancementStage): string {
    const keyData = {
      gameType: generation.originalSpec.type,
      stageId: stage.id,
      features: stage.features.map(f => f.name).sort(),
      quality: generation.qualitySettings,
      userTier: generation.userTier
    };
    
    const hash = Buffer.from(JSON.stringify(keyData)).toString('base64').substring(0, 16);
    return `progressive_stage:${hash}`;
  }

  private buildStagePrompt(generation: ProgressiveGameGeneration, stage: EnhancementStage): string {
    const gameSpec = generation.originalSpec;
    const completedFeatures = generation.completedStages
      .map(stageId => generation.stages.find(s => s.id === stageId))
      .filter(s => s)
      .flatMap(s => s!.features.map(f => f.name));

    return `Enhance the ${gameSpec.type} game "${gameSpec.name}" by implementing the ${stage.name} stage.

Game Description: ${gameSpec.description}
Current Features: ${completedFeatures.join(', ')}
Target Features for this stage: ${stage.features.map(f => f.name).join(', ')}

Quality Settings:
- Graphics: ${generation.qualitySettings.graphics}
- Audio: ${generation.qualitySettings.audio}
- Effects: ${generation.qualitySettings.effects}

Generate the code for these specific features only. Build upon the existing game foundation.`;
  }

  private buildStageSystemPrompt(stage: EnhancementStage): string {
    return `You are enhancing a game in the "${stage.name}" stage. Focus only on implementing the specified features:
${stage.features.map(f => `- ${f.name}: ${f.description}`).join('\n')}

Provide clean, modular code that can be integrated with existing game components. Return only the JavaScript code for these specific enhancements.`;
  }

  private getStageComplexity(stage: EnhancementStage): 'simple' | 'medium' | 'complex' {
    const avgComplexity = stage.features.reduce((sum, f) => {
      const complexity = { simple: 1, medium: 2, complex: 3 };
      return sum + complexity[f.complexity];
    }, 0) / stage.features.length;

    if (avgComplexity <= 1.5) return 'simple';
    if (avgComplexity <= 2.5) return 'medium';
    return 'complex';
  }

  private processGeneratedContent(content: string, stage: EnhancementStage): any {
    // Process and structure the AI-generated content
    // This would parse the code and create structured game data
    return {
      code: content,
      features: stage.features.map(f => f.name),
      stage: stage.name,
      timestamp: new Date()
    };
  }

  private calculateActualStageCost(stage: EnhancementStage, content: any): number {
    // Calculate actual cost based on generated content
    return Math.ceil(stage.estimatedCost * 0.9); // Assume 10% cost savings from optimization
  }

  private assessContentQuality(content: any, stage: EnhancementStage): number {
    // Assess the quality of generated content (0-1 score)
    // This would analyze code quality, completeness, etc.
    return 0.85; // Placeholder
  }

  private generateId(): string {
    return `prog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}