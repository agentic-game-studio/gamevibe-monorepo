// GameVibe AI Service Wrapper with Intelligent Model Selection
// Combines AIService with cost-optimized model selection

import { injectable, inject } from 'inversify';
import { AIService } from '@gamevibe/ai-service';
import { AIModelSelectorService, ModelSelectionCriteria } from './ai-model-selector.js';
import { Logger } from '../utils/logger.js';
import { TYPES } from '../types.js';

export interface EnhancedGenerateOptions {
  description: string;
  gameType: string;
  userId: string;
  serverId: string;
  complexity?: 'simple' | 'medium' | 'complex';
  playerCount?: number;
  features?: string[];
  userTier?: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  estimatedTokens?: number;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CostOptimizedResponse {
  content: string;
  model: string;
  estimatedCostCents: number;
  actualCostCents: number;
  creditsDeducted: number;
  wasFallback: boolean;
  originalModel?: string;
  creditBalance?: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@injectable()
export class AIServiceWrapper {
  private logger = new Logger('AIServiceWrapper');

  constructor(
    @inject(TYPES.AIService) private aiService: AIService,
    @inject(TYPES.AIModelSelectorService) private modelSelector: AIModelSelectorService,
    @inject(TYPES.CreditService) private creditService: any
  ) {}

  /**
   * Generate game code with credit-based model selection and fallback
   */
  async generateGameCode(
    spec: any, 
    template: any, 
    userId: string,
    serverId: string,
    userTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE' = 'FREE'
  ): Promise<CostOptimizedResponse> {
    // Determine complexity and features from spec
    const complexity = this.modelSelector.analyzeComplexity(
      spec.description || spec.originalDescription || '',
      spec.type
    );
    
    const features = this.extractFeatures(spec);
    const estimatedTokens = this.estimateTokensForComplexity(complexity);
    
    // Get optimal model recommendation with credit checking
    const recommendation = await this.modelSelector.selectOptimalModel({
      description: spec.description || spec.originalDescription || '',
      gameType: spec.type,
      complexity,
      playerCount: parseInt(spec.playerCount) || 1,
      features,
      userId,
      serverId,
      userTier,
      estimatedTokens
    });

    let selectedModel = recommendation.model;
    let wasFallback = false;
    let originalModel = recommendation.model;
    
    // Check if we have sufficient credits for the selected model
    const creditCheck = await this.creditService.hasCredits(
      userId, serverId, selectedModel, estimatedTokens
    );

    // If insufficient credits, try fallback
    if (!creditCheck.hasCredits && recommendation.fallbackModel) {
      const fallbackCheck = await this.creditService.hasCredits(
        userId, serverId, recommendation.fallbackModel, estimatedTokens
      );
      
      if (fallbackCheck.hasCredits) {
        selectedModel = recommendation.fallbackModel;
        wasFallback = true;
        this.logger.info('Using fallback model due to insufficient credits', {
          original: originalModel,
          fallback: selectedModel,
          userId,
          serverId
        });
      } else {
        // Force fallback to Haiku if no other options
        selectedModel = 'claude-3-5-haiku-latest';
        wasFallback = true;
        this.logger.warn('Forcing fallback to Haiku - insufficient credits for all models', {
          original: originalModel,
          userId,
          serverId,
          balance: creditCheck.balance
        });
      }
    }

    this.logger.info('Selected AI model for game generation', {
      model: selectedModel,
      originalModel: wasFallback ? originalModel : undefined,
      complexity,
      estimatedCost: recommendation.estimatedCostCents,
      confidence: recommendation.confidenceScore,
      wasFallback,
      reasoning: recommendation.reasoning
    });

    // Generate with selected model
    try {
      const response = await this.aiService.generate({
        prompt: this.buildGameGenerationPrompt(spec, template),
        model: selectedModel,
        temperature: 0.7,
        maxTokens: this.getMaxTokensForComplexity(complexity)
      });

      // Calculate actual cost and deduct credits
      const actualTokens = response.usage?.totalTokens || estimatedTokens;
      const actualCostCents = this.calculateActualCost(response.usage, selectedModel);
      
      // Deduct credits (will be 0 for Haiku)
      const creditTransaction = await this.creditService.deductCredits(
        userId, serverId, selectedModel, actualTokens, 
        { 
          gameType: spec.type, 
          complexity, 
          wasFallback,
          originalModel: wasFallback ? originalModel : undefined
        }
      );

      const creditsDeducted = creditTransaction?.amount || 0;

      // Get updated balance
      const balanceAfter = await this.creditService.getCreditBalance(userId, serverId);

      return {
        content: response.content,
        model: selectedModel,
        estimatedCostCents: recommendation.estimatedCostCents,
        actualCostCents,
        creditsDeducted,
        wasFallback,
        originalModel: wasFallback ? originalModel : undefined,
        creditBalance: balanceAfter?.availableCredits || 0,
        usage: response.usage
      };

    } catch (error) {
      this.logger.error('AI generation failed', {
        model: selectedModel,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        serverId
      });
      throw error;
    }
  }

  /**
   * Analyze game request with cost-optimized model selection
   */
  async analyzeGameRequest(
    description: string, 
    userId: string,
    serverId: string,
    context?: any,
    userTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE' = 'FREE'
  ): Promise<any> {
    // Use simple analysis model for request analysis
    const complexity = this.modelSelector.analyzeComplexity(description, 'OTHER');
    
    const recommendation = await this.modelSelector.selectOptimalModel({
      description,
      gameType: 'OTHER',
      complexity: 'simple', // Analysis is always simple
      playerCount: 1,
      features: ['analysis'],
      userId,
      serverId,
      userTier
    });

    this.logger.info('Selected AI model for game request analysis', {
      model: recommendation.model,
      estimatedCost: recommendation.estimatedCostCents
    });

    const response = await this.aiService.analyze({
      prompt: this.buildAnalysisPrompt(description, context),
      model: recommendation.model,
      expectedFormat: 'json'
    });

    return response;
  }

  /**
   * Generate content with explicit model selection criteria
   */
  async generateWithCriteria(
    criteria: ModelSelectionCriteria,
    prompt: string,
    systemPrompt?: string
  ): Promise<CostOptimizedResponse> {
    const recommendation = await this.modelSelector.selectOptimalModel(criteria);

    this.logger.info('Generating content with selected model', {
      model: recommendation.model,
      estimatedCost: recommendation.estimatedCostCents,
      confidence: recommendation.confidenceScore
    });

    const response = await this.aiService.generate({
      prompt,
      model: recommendation.model,
      systemPrompt,
      temperature: 0.7,
      maxTokens: this.getMaxTokensForComplexity(criteria.complexity)
    });

    return {
      content: response.content,
      model: recommendation.model,
      estimatedCostCents: recommendation.estimatedCostCents,
      actualCostCents: this.calculateActualCost(response.usage, recommendation.model),
      usage: response.usage
    };
  }

  /**
   * Batch process multiple requests with cost optimization
   */
  async generateBatch(
    requests: Array<{ criteria: ModelSelectionCriteria; prompt: string; systemPrompt?: string }>,
    batchBudgetCents: number
  ): Promise<Array<CostOptimizedResponse | null>> {
    const criteriaList = requests.map(r => r.criteria);
    const batchPlan = await this.modelSelector.selectForBatch(criteriaList, batchBudgetCents);

    const results: Array<CostOptimizedResponse | null> = [];

    for (let i = 0; i < requests.length; i++) {
      const assignment = batchPlan.assignments.find(a => a.requestIndex === i);
      
      if (!assignment) {
        results.push(null); // Request not processed due to budget constraints
        continue;
      }

      try {
        const response = await this.aiService.generate({
          prompt: requests[i].prompt,
          model: assignment.model,
          systemPrompt: requests[i].systemPrompt,
          temperature: 0.7,
          maxTokens: this.getMaxTokensForComplexity(requests[i].criteria.complexity)
        });

        results.push({
          content: response.content,
          model: assignment.model,
          estimatedCostCents: assignment.cost,
          actualCostCents: this.calculateActualCost(response.usage, assignment.model),
          usage: response.usage
        });
      } catch (error) {
        this.logger.error('Batch request failed', { index: i, error });
        results.push(null);
      }
    }

    this.logger.info('Batch processing completed', {
      totalRequests: requests.length,
      processed: results.filter(r => r !== null).length,
      totalCost: batchPlan.totalCost,
      savings: batchPlan.savings
    });

    return results;
  }

  /**
   * Get cost analysis for a potential request
   */
  async getCostAnalysis(criteria: ModelSelectionCriteria) {
    return this.modelSelector.getCostAnalysis(criteria);
  }

  /**
   * Build game generation prompt
   */
  private buildGameGenerationPrompt(spec: any, template: any): string {
    const assets = template.assets || {};
    const assetUrls = Object.entries(assets)
      .map(([key, url]) => `${key}: ${url}`)
      .join('\n');

    return `Generate a complete Phaser 3 game based on the following specification:

Game Name: ${spec.name}
Description: ${spec.description}
Type: ${spec.type}
Player Count: ${spec.playerCount}

${spec.features?.length ? `Features: ${spec.features.join(', ')}` : ''}

Template: ${template.name}
${assetUrls ? `Available Assets:\n${assetUrls}` : ''}

Generate complete, working game code that can be run directly in a browser with Phaser 3.
Include proper game loop, player controls, scoring, and win/loss conditions.
Use the provided assets when available, or create placeholder graphics.

Return only the JavaScript code, no explanations.`;
  }

  /**
   * Build analysis prompt for game requests
   */
  private buildAnalysisPrompt(description: string, context?: any): string {
    return `Analyze the following game request and return structured information:

Request: ${description}
${context ? `Context: ${JSON.stringify(context)}` : ''}

Return a JSON object with:
{
  "name": "generated game name",
  "description": "refined description",
  "type": "PLATFORMER|SHOOTER|PUZZLE|RPG|ENDLESS_RUNNER|OTHER",
  "playerCount": "1|2-4|2-8",
  "features": ["list", "of", "key", "features"],
  "complexity": "simple|medium|complex",
  "estimatedDevelopmentTime": "in minutes"
}`;
  }

  /**
   * Extract features from game specification
   */
  private extractFeatures(spec: any): string[] {
    const features: string[] = [];
    
    if (spec.playerCount && parseInt(spec.playerCount) > 1) {
      features.push('multiplayer');
    }
    
    if (spec.features) {
      features.push(...spec.features);
    }
    
    // Extract from description
    const description = (spec.description || spec.originalDescription || '').toLowerCase();
    
    if (description.includes('physics')) features.push('physics');
    if (description.includes('ai') || description.includes('enemy')) features.push('ai');
    if (description.includes('3d')) features.push('3d');
    if (description.includes('score') || description.includes('points')) features.push('scoring');
    if (description.includes('level') || description.includes('stage')) features.push('levels');
    
    return [...new Set(features)]; // Remove duplicates
  }

  /**
   * Estimate tokens needed for complexity (for cost estimation)
   */
  private estimateTokensForComplexity(complexity: string): number {
    switch (complexity) {
      case 'simple': return 1000;
      case 'medium': return 2500;
      case 'complex': return 4000;
      default: return 2000;
    }
  }

  /**
   * Get max tokens based on complexity
   */
  private getMaxTokensForComplexity(complexity: string): number {
    switch (complexity) {
      case 'simple': return 2000;
      case 'medium': return 4000;
      case 'complex': return 6000;
      default: return 4000;
    }
  }

  /**
   * Calculate actual cost based on token usage and model
   */
  private calculateActualCost(usage: any, model: string): number {
    if (!usage) return 0;

    // Use cost data from AIModelSelectorService
    const modelCapabilities = AIModelSelectorService.MODELS[model];
    const costPerToken = modelCapabilities?.costPerToken || 3.0;
    return Math.ceil((usage.totalTokens * costPerToken) / 10); // Convert to cents
  }
}