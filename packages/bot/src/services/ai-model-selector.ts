// GameVibe AI Model Selector Service
// Intelligent AI model selection for cost optimization

import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface ModelSelectionCriteria {
  description: string;
  gameType: string;
  complexity: 'simple' | 'medium' | 'complex';
  playerCount: number;
  features: string[];
  userId: string;
  serverId: string;
  userTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  estimatedTokens?: number;
  budgetConstraints?: {
    maxCostCents: number;
    prioritizeSpeed: boolean;
  };
}

export interface ModelRecommendation {
  model: string;
  provider: 'minimax';
  estimatedCostCents: number;
  estimatedLatencyMs: number;
  confidenceScore: number; // 0-1, how well this model fits the task
  reasoning: string;
  fallbackModel?: string;
}

export interface ModelCapabilities {
  maxTokens: number;
  costPerToken: number; // in micro-cents
  avgLatencyMs: number;
  strengths: string[];
  weaknesses: string[];
  suitableFor: {
    complexity: ('simple' | 'medium' | 'complex' | 'enterprise')[];
    gameTypes: string[];
    features: string[];
    requiredTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  };
}

@injectable()
export class AIModelSelectorService {
  private logger = new Logger('AIModelSelectorService');
  // Model definitions with cost and capability data
  public static readonly MODELS: Record<string, ModelCapabilities> = {
    'MiniMax-M2.7-Lightning': {
      maxTokens: 8192,
      costPerToken: 0.01, // Very cheap - significantly less than Claude/GPT
      avgLatencyMs: 800,
      strengths: ['fast', 'very cost-effective', 'large context (128K)', 'coding capable', 'game logic generation'],
      weaknesses: ['limited rate limit (1000 prompts/5 hours)'],
      suitableFor: {
        complexity: ['simple', 'medium', 'complex'],
        gameTypes: ['PLATFORMER', 'ENDLESS_RUNNER', 'PUZZLE', 'RPG', 'SHOOTER', 'ADVENTURE', 'TOWER_DEFENSE', 'MULTIPLAYER'],
        features: ['basic-mechanics', 'advanced-features', 'physics', 'ai', 'multiplayer', 'procedural-generation'],
        requiredTier: 'FREE'
      }
    }
  };

  // Tier-based model access restrictions and budgets
  private static readonly TIER_CONSTRAINTS = {
    FREE: {
      allowedModels: ['MiniMax-M2.7-Lightning'],
      maxCostPerRequestCents: 5,
      prioritizeSpeed: true,
      defaultModel: 'MiniMax-M2.7-Lightning'
    },
    STARTER: {
      allowedModels: ['MiniMax-M2.7-Lightning'],
      maxCostPerRequestCents: 15,
      prioritizeSpeed: false,
      defaultModel: 'MiniMax-M2.7-Lightning'
    },
    PRO: {
      allowedModels: ['MiniMax-M2.7-Lightning'],
      maxCostPerRequestCents: 30,
      prioritizeSpeed: false,
      defaultModel: 'MiniMax-M2.7-Lightning'
    },
    ENTERPRISE: {
      allowedModels: ['MiniMax-M2.7-Lightning'],
      maxCostPerRequestCents: 100,
      prioritizeSpeed: false,
      defaultModel: 'MiniMax-M2.7-Lightning'
    }
  };

  constructor(
    @inject(TYPES.CreditService) private creditService: any
  ) {}

  /**
   * Main method to select the optimal AI model for a task with credit-based access
   */
  async selectOptimalModel(criteria: ModelSelectionCriteria): Promise<ModelRecommendation> {
    const estimatedTokens = criteria.estimatedTokens || 2000; // Default estimate
    
    // Get available models for user's tier and credit balance
    const availableModels = await this.creditService.getAvailableModels(criteria.userId, criteria.serverId);
    
    // Combine free and available models for selection
    const allAvailableModels = [...availableModels.freeModels, ...availableModels.availableModels];
    
    if (allAvailableModels.length === 0) {
      // Force fallback to Haiku if no other models available
      return this.buildCreditBasedRecommendation(criteria, 'MiniMax-M2.7-Lightning', estimatedTokens, 'No credits available for premium models');
    }

    // Score each available model
    const modelScores: Array<{
      model: string;
      score: number;
      isFree: boolean;
      recommendation: ModelRecommendation;
    }> = [];

    for (const modelName of allAvailableModels) {
      const modelCapabilities = AIModelSelectorService.MODELS[modelName];
      if (!modelCapabilities) continue;

      // Check if this model is suitable for the request complexity
      if (!this.isModelSuitableForComplexity(modelName, criteria.complexity)) {
        continue;
      }

      const score = this.calculateModelScore(criteria, modelName, modelCapabilities);
      const isFree = availableModels.freeModels.includes(modelName);
      const recommendation = this.buildCreditBasedRecommendation(criteria, modelName, estimatedTokens);

      modelScores.push({ model: modelName, score, isFree, recommendation });
    }

    // Sort by: free models first, then by score
    modelScores.sort((a, b) => {
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return b.score - a.score;
    });

    if (modelScores.length === 0) {
      // Ultimate fallback to Haiku
      return this.buildCreditBasedRecommendation(criteria, 'MiniMax-M2.7-Lightning', estimatedTokens, 'No suitable models available');
    }

    const bestRecommendation = modelScores[0].recommendation;

    // Add fallback model if available (prefer free models for fallback)
    const fallbackCandidates = modelScores.slice(1);
    if (fallbackCandidates.length > 0) {
      // Prefer free models for fallback
      const freeFallback = fallbackCandidates.find(m => m.isFree);
      bestRecommendation.fallbackModel = freeFallback?.model || fallbackCandidates[0].model;
    }

    this.logger.info('AI model selected', {
      selected: bestRecommendation.model,
      cost: bestRecommendation.estimatedCostCents,
      confidence: bestRecommendation.confidenceScore,
      tier: criteria.userTier,
      complexity: criteria.complexity
    });

    return bestRecommendation;
  }

  /**
   * Get model recommendations for batch processing
   */
  async selectForBatch(
    requests: ModelSelectionCriteria[],
    batchBudgetCents: number
  ): Promise<{
    assignments: Array<{ requestIndex: number; model: string; cost: number }>;
    totalCost: number;
    savings: number;
  }> {
    const assignments: Array<{ requestIndex: number; model: string; cost: number }> = [];
    let totalCost = 0;

    // Sort requests by complexity (simple first for batch optimization)
    const sortedRequests = requests.map((req, index) => ({ req, index }))
      .sort((a, b) => {
        const complexityOrder = { simple: 0, medium: 1, complex: 2 };
        return complexityOrder[a.req.complexity] - complexityOrder[b.req.complexity];
      });

    // Batch similar simple requests to the cheapest suitable model
    const simpleRequests = sortedRequests.filter(item => item.req.complexity === 'simple');
    const complexRequests = sortedRequests.filter(item => item.req.complexity !== 'simple');

    // Process simple requests with cheapest model
    if (simpleRequests.length > 0) {
      const cheapModel = 'MiniMax-M2.7-Lightning';
      const modelCapabilities = AIModelSelectorService.MODELS[cheapModel];
      
      for (const { req, index } of simpleRequests) {
        const cost = this.estimateCost(req, modelCapabilities);
        if (totalCost + cost <= batchBudgetCents) {
          assignments.push({ requestIndex: index, model: cheapModel, cost });
          totalCost += cost;
        }
      }
    }

    // Process complex requests individually
    for (const { req, index } of complexRequests) {
      if (totalCost >= batchBudgetCents) break;

      const recommendation = await this.selectOptimalModel({
        ...req,
        budgetConstraints: {
          maxCostCents: batchBudgetCents - totalCost,
          prioritizeSpeed: false
        }
      });

      assignments.push({
        requestIndex: index,
        model: recommendation.model,
        cost: recommendation.estimatedCostCents
      });
      totalCost += recommendation.estimatedCostCents;
    }

    // Calculate savings compared to using premium models for everything
    const premiumCost = requests.length * 25; // Opus cost estimate
    const savings = Math.max(0, premiumCost - totalCost);

    return { assignments, totalCost, savings };
  }

  /**
   * Analyze content to determine complexity automatically
   */
  analyzeComplexity(description: string, gameType: string): 'simple' | 'medium' | 'complex' {
    const complexityIndicators = {
      simple: ['basic', 'simple', 'easy', 'quick', 'minimal'],
      medium: ['physics', 'multiplayer', 'score', 'levels', 'power-up', 'enemy'],
      complex: ['ai', 'procedural', 'advanced', 'sophisticated', 'narrative', 'rpg elements', 'complex physics']
    };

    const lower = description.toLowerCase();
    let complexityScore = 0;

    // Check for complexity indicators
    complexityIndicators.complex.forEach(indicator => {
      if (lower.includes(indicator)) complexityScore += 3;
    });

    complexityIndicators.medium.forEach(indicator => {
      if (lower.includes(indicator)) complexityScore += 2;
    });

    complexityIndicators.simple.forEach(indicator => {
      if (lower.includes(indicator)) complexityScore += 1;
    });

    // Game type influences complexity
    const gameTypeComplexity = {
      'PUZZLE': 1,
      'ENDLESS_RUNNER': 1,
      'PLATFORMER': 2,
      'SHOOTER': 2,
      'RPG': 3,
      'MULTIPLAYER': 3
    };

    complexityScore += gameTypeComplexity[gameType as keyof typeof gameTypeComplexity] || 2;

    // Word count influences complexity
    const wordCount = description.split(/\s+/).length;
    if (wordCount > 50) complexityScore += 2;
    else if (wordCount > 25) complexityScore += 1;

    // Determine final complexity
    if (complexityScore <= 3) return 'simple';
    if (complexityScore <= 7) return 'medium';
    return 'complex';
  }

  /**
   * Get cost analysis for different model choices
   */
  async getCostAnalysis(criteria: ModelSelectionCriteria): Promise<{
    models: Array<{
      name: string;
      cost: number;
      quality: number;
      speed: number;
      suitable: boolean;
    }>;
    recommendation: string;
    potentialSavings: number;
  }> {
    const tierConstraints = AIModelSelectorService.TIER_CONSTRAINTS[criteria.userTier];
    const analysis = [];
    let cheapestSuitableCost = Number.MAX_SAFE_INTEGER;
    let recommendedModel = '';

    for (const modelName of tierConstraints.allowedModels) {
      const capabilities = AIModelSelectorService.MODELS[modelName];
      if (!capabilities) continue;

      const cost = this.estimateCost(criteria, capabilities);
      const quality = this.estimateQuality(criteria, capabilities);
      const speed = 1000 / capabilities.avgLatencyMs; // Speed score (higher is faster)
      const suitable = this.isModelSuitable(criteria, capabilities);

      analysis.push({
        name: modelName,
        cost,
        quality,
        speed,
        suitable
      });

      if (suitable && cost < cheapestSuitableCost) {
        cheapestSuitableCost = cost;
        recommendedModel = modelName;
      }
    }

    // Calculate potential savings vs most expensive suitable model
    const expensiveCosts = analysis.filter(m => m.suitable).map(m => m.cost);
    const maxCost = Math.max(...expensiveCosts);
    const potentialSavings = maxCost - cheapestSuitableCost;

    return {
      models: analysis,
      recommendation: recommendedModel,
      potentialSavings
    };
  }

  /**
   * Calculate a score for how well a model fits the criteria
   */
  private calculateModelScore(
    criteria: ModelSelectionCriteria,
    modelName: string,
    capabilities: ModelCapabilities
  ): number {
    let score = 0;

    // Complexity suitability (40% of score)
    if (capabilities.suitableFor.complexity.includes(criteria.complexity)) {
      score += 40;
    } else if (criteria.complexity === 'simple' && capabilities.suitableFor.complexity.includes('medium')) {
      score += 30; // Slightly suitable
    }

    // Game type suitability (30% of score)
    if (capabilities.suitableFor.gameTypes.includes(criteria.gameType)) {
      score += 30;
    }

    // Feature compatibility (20% of score)
    const featureMatches = criteria.features.filter(feature => 
      capabilities.suitableFor.features.some(suitable => suitable.includes(feature))
    );
    score += (featureMatches.length / Math.max(criteria.features.length, 1)) * 20;

    // Cost efficiency (10% of score)
    const estimatedCost = this.estimateCost(criteria, capabilities);
    const maxReasonableCost = 50; // 50 cents
    const costScore = Math.max(0, (maxReasonableCost - estimatedCost) / maxReasonableCost) * 10;
    score += costScore;

    // Bonus for user tier preferences
    const tierConstraints = AIModelSelectorService.TIER_CONSTRAINTS[criteria.userTier];
    if (tierConstraints.prioritizeSpeed && capabilities.avgLatencyMs < 1000) {
      score += 5;
    }

    return Math.min(100, score);
  }

  /**
   * Build a model recommendation object
   */
  private buildRecommendation(
    criteria: ModelSelectionCriteria,
    modelName: string,
    capabilities: ModelCapabilities,
    confidenceScore: number
  ): ModelRecommendation {
    const provider: 'minimax' = 'minimax';
    const estimatedCost = this.estimateCost(criteria, capabilities);
    
    let reasoning = `Selected ${modelName} for ${criteria.complexity} ${criteria.gameType} game. `;
    
    if (confidenceScore > 0.8) {
      reasoning += 'High confidence match based on model capabilities.';
    } else if (confidenceScore > 0.6) {
      reasoning += 'Good match with minor trade-offs.';
    } else {
      reasoning += 'Fallback choice within budget constraints.';
    }

    return {
      model: modelName,
      provider,
      estimatedCostCents: estimatedCost,
      estimatedLatencyMs: capabilities.avgLatencyMs,
      confidenceScore: confidenceScore / 100,
      reasoning
    };
  }

  /**
   * Estimate the cost for a request using a specific model
   */
  private estimateCost(criteria: ModelSelectionCriteria, capabilities: ModelCapabilities): number {
    // Base token estimate based on complexity
    const baseTokens = {
      simple: 1000,
      medium: 2500,
      complex: 4000
    };

    // Adjust for game type
    const gameTypeMultiplier = {
      'PUZZLE': 0.8,
      'ENDLESS_RUNNER': 0.9,
      'PLATFORMER': 1.0,
      'SHOOTER': 1.2,
      'RPG': 1.5
    };

    // Adjust for features
    let featureMultiplier = 1.0;
    if (criteria.features.includes('multiplayer')) featureMultiplier += 0.3;
    if (criteria.features.includes('physics')) featureMultiplier += 0.2;
    if (criteria.features.includes('ai')) featureMultiplier += 0.4;

    const estimatedTokens = baseTokens[criteria.complexity] * 
      (gameTypeMultiplier[criteria.gameType as keyof typeof gameTypeMultiplier] || 1.0) *
      featureMultiplier;

    // Convert to cost (capabilities.costPerToken is in micro-cents)
    return Math.ceil((estimatedTokens * capabilities.costPerToken) / 10); // Convert to cents
  }

  /**
   * Estimate quality score for a model on a task
   */
  private estimateQuality(criteria: ModelSelectionCriteria, capabilities: ModelCapabilities): number {
    let quality = 50; // Base quality

    // Higher token limits generally mean better quality
    quality += Math.min(30, capabilities.maxTokens / 200);

    // Model-specific quality adjustments
    if (capabilities.strengths.includes('highest quality')) quality += 20;
    if (capabilities.strengths.includes('good reasoning')) quality += 15;
    if (capabilities.strengths.includes('advanced features')) quality += 10;

    // Penalize if model has relevant weaknesses
    if (capabilities.weaknesses.includes('complex reasoning') && criteria.complexity === 'complex') {
      quality -= 15;
    }

    return Math.min(100, quality);
  }

  /**
   * Check if a model is suitable for the given criteria
   */
  private isModelSuitable(criteria: ModelSelectionCriteria, capabilities: ModelCapabilities): boolean {
    // Check complexity suitability
    if (!capabilities.suitableFor.complexity.includes(criteria.complexity)) {
      // Allow medium/complex models for simpler tasks
      if (criteria.complexity === 'simple' && !capabilities.suitableFor.complexity.includes('medium')) {
        return false;
      }
      // Don't allow simple models for complex tasks
      if (criteria.complexity === 'complex' && !capabilities.suitableFor.complexity.includes('complex')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find the cheapest model from a list
   */
  private findCheapestModel(modelNames: string[]): string {
    let cheapestModel = modelNames[0];
    let lowestCost = Number.MAX_SAFE_INTEGER;

    for (const modelName of modelNames) {
      const capabilities = AIModelSelectorService.MODELS[modelName];
      if (capabilities && capabilities.costPerToken < lowestCost) {
        lowestCost = capabilities.costPerToken;
        cheapestModel = modelName;
      }
    }

    return cheapestModel;
  }

  /**
   * Check if a model is suitable for a given complexity level
   */
  private isModelSuitableForComplexity(modelName: string, complexity: 'simple' | 'medium' | 'complex'): boolean {
    const modelCapabilities = AIModelSelectorService.MODELS[modelName];
    if (!modelCapabilities) return false;

    return modelCapabilities.suitableFor.complexity.includes(complexity);
  }

  /**
   * Build a credit-based recommendation with cost calculation
   */
  private buildCreditBasedRecommendation(
    criteria: ModelSelectionCriteria,
    modelName: string,
    estimatedTokens: number,
    reason?: string
  ): ModelRecommendation {
    const modelCapabilities = AIModelSelectorService.MODELS[modelName];
    if (!modelCapabilities) {
      throw new Error(`Model capabilities not found for ${modelName}`);
    }

    // Calculate cost based on actual token pricing
    const costPerToken = modelCapabilities.costPerToken / 100; // Convert to cents
    const estimatedCostCents = Math.ceil(estimatedTokens * costPerToken);

    // Calculate confidence score based on complexity match
    let confidenceScore = 0.5;
    if (modelCapabilities.suitableFor.complexity.includes(criteria.complexity)) {
      confidenceScore += 0.3;
    }
    if (modelCapabilities.suitableFor.gameTypes?.includes(criteria.gameType)) {
      confidenceScore += 0.2;
    }

    // Determine provider
    const provider: 'minimax' = 'minimax';

    // Build reasoning
    const reasoningParts = [
      `Selected ${modelName} for ${criteria.complexity} ${criteria.gameType} game`,
      `Estimated cost: ${estimatedCostCents} credits (${estimatedTokens} tokens)`
    ];
    
    if (reason) {
      reasoningParts.push(reason);
    }

    if (modelName === 'MiniMax-M2.7-Lightning') {
      reasoningParts.push('Using free tier model');
    }

    return {
      model: modelName,
      provider,
      estimatedCostCents,
      estimatedLatencyMs: modelCapabilities.avgLatencyMs,
      confidenceScore: Math.min(1.0, confidenceScore),
      reasoning: reasoningParts.join('. ')
    };
  }

  /**
   * Get the best fallback model for a given tier when credits are insufficient
   */
  async getBestFallbackModel(
    userId: string,
    serverId: string,
    originalModel: string,
    complexity: 'simple' | 'medium' | 'complex'
  ): Promise<string> {
    const availableModels = await this.creditService.getAvailableModels(userId, serverId);
    
    // Always return Haiku as fallback if no other models available
    if (availableModels.availableModels.length === 0) {
      return 'MiniMax-M2.7-Lightning';
    }

    // Find suitable models for the complexity
    const suitableModels = availableModels.availableModels.filter(model => {
      const capabilities = AIModelSelectorService.MODELS[model];
      return capabilities && capabilities.suitableFor.complexity.includes(complexity);
    });

    // Return cheapest suitable model, or Haiku if none found
    if (suitableModels.length === 0) {
      return 'MiniMax-M2.7-Lightning';
    }

    // Return the cheapest suitable model
    return suitableModels.reduce((cheapest, current) => {
      const currentCost = AIModelSelectorService.MODELS[current]?.costPerToken || Infinity;
      const cheapestCost = AIModelSelectorService.MODELS[cheapest]?.costPerToken || Infinity;
      return currentCost < cheapestCost ? current : cheapest;
    });
  }

  /**
   * Estimate cost for a request with specific model capabilities
   */
  private estimateCost(criteria: ModelSelectionCriteria, modelCapabilities: ModelCapabilities): number {
    const estimatedTokens = criteria.estimatedTokens || 2000;
    return Math.ceil(estimatedTokens * (modelCapabilities.costPerToken / 100));
  }
}