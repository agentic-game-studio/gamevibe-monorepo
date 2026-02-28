// GameVibe AI Cost Monitoring Service
// Comprehensive cost tracking, analytics, and optimization monitoring

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { IntelligentCacheService } from './intelligent-cache.js';
import { AIModelSelectorService } from './ai-model-selector.js';
import { GameTemplateCacheService } from './game-template-cache.js';
import { AssetTemplateLibraryService } from './asset-template-library.js';
import { BatchAssetGeneratorService } from './batch-asset-generator.js';
import { CommunityAssetPoolService } from './community-asset-pool.js';
import { ProgressiveEnhancementService } from './progressive-enhancement.js';
import { TYPES } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface CostMetric {
  id: string;
  timestamp: Date;
  userId: string;
  userTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  gameId?: string;
  operation: CostOperation;
  service: CostService;
  actualCost: number; // in cents
  estimatedCost: number; // in cents
  costSavings: number; // in cents
  currency: 'USD';
  metadata: CostMetricMetadata;
}

export interface CostMetricMetadata {
  gameType?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  modelUsed?: string;
  cacheHit?: boolean;
  batchSize?: number;
  stageCost?: boolean;
  optimizationApplied?: string[];
  processingTime?: number;
  qualityScore?: number;
}

export type CostOperation = 
  | 'game_generation' 
  | 'asset_generation' 
  | 'template_creation'
  | 'ai_analysis'
  | 'batch_processing'
  | 'progressive_enhancement'
  | 'community_download';

export type CostService = 
  | 'game_generator'
  | 'ai_service'
  | 'asset_generator'
  | 'intelligent_cache'
  | 'template_cache'
  | 'asset_library'
  | 'batch_processor'
  | 'community_pool'
  | 'progressive_enhancement';

export interface CostAlert {
  id: string;
  userId: string;  
  alertType: 'budget_exceeded' | 'unusual_spending' | 'optimization_opportunity' | 'cost_spike';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  currentCost: number;
  threshold: number;
  recommendations: string[];
  acknowledged: boolean;
  createdAt: Date;
  acknowledgedAt?: Date;
}

export interface BudgetConfig {
  userId: string;
  userTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  monthlyBudget: number; // in cents
  dailyBudget: number; // in cents
  perGameBudget: number; // in cents
  alertThresholds: {
    warning: number; // percentage (0-100)
    critical: number; // percentage (0-100)
  };
  autoDisable: boolean; // Disable services when budget exceeded
  notifications: {
    email: boolean;
    discord: boolean;
    dashboard: boolean;
  };
}

export interface CostDashboard {
  period: 'day' | 'week' | 'month' | 'year';
  summary: CostSummary;
  breakdown: CostBreakdown;
  trends: CostTrend[];
  savings: SavingsAnalysis;
  optimization: OptimizationMetrics;
  predictions: CostPrediction[];
  alerts: CostAlert[];
  recommendations: CostRecommendation[];
}

export interface CostSummary {
  totalCost: number;
  totalSavings: number;
  netCost: number;
  averageCostPerGame: number;
  averageCostPerUser: number;
  budgetUtilization: number; // percentage
  costEfficiencyScore: number; // 0-100
}

export interface CostBreakdown {
  byService: Record<CostService, { cost: number; savings: number; usage: number }>;
  byOperation: Record<CostOperation, { cost: number; count: number; avgCost: number }>;
  byUserTier: Record<string, { cost: number; users: number; avgCostPerUser: number }>;
  byGameType: Record<string, { cost: number; games: number; avgCostPerGame: number }>;
  byModel: Record<string, { cost: number; requests: number; avgCost: number }>;
}

export interface CostTrend {
  date: string;
  totalCost: number;
  totalSavings: number;
  operationCounts: Record<CostOperation, number>;
  efficiency: number;
}

export interface SavingsAnalysis {
  totalSavings: number;
  savingsByOptimization: Record<string, { amount: number; instances: number }>;
  cacheHitRate: number;
  batchProcessingSavings: number;
  communityAssetSavings: number;
  progressiveSavings: number;
  roi: number; // Return on optimization investment
}

export interface OptimizationMetrics {
  cacheEfficiency: number;
  batchUtilization: number;
  modelOptimization: number;
  communityReuseRate: number;
  progressiveAdoption: number;
  overallOptimizationScore: number;
}

export interface CostPrediction {
  period: string;
  predictedCost: number;
  confidence: number; // 0-1
  factors: string[];
  recommendations: string[];
}

export interface CostRecommendation {
  id: string;
  type: 'budget' | 'optimization' | 'tier_upgrade' | 'feature_usage';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  potentialSavings: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  actionUrl?: string;
}

export interface CostExport {
  format: 'csv' | 'json' | 'pdf';
  period: { start: Date; end: Date };
  userId?: string;
  includeDetails: boolean;
  includeCharts: boolean;
}

@injectable()
export class CostMonitoringService extends EventEmitter {
  private logger = new Logger('CostMonitoringService');
  private metrics: Map<string, CostMetric[]> = new Map(); // In-memory buffer
  private budgetConfigs: Map<string, BudgetConfig> = new Map();
  private activeAlerts: Map<string, CostAlert[]> = new Map();
  
  // Service references for analytics
  private readonly services: Record<string, any> = {};

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.IntelligentCacheService) private intelligentCache: IntelligentCacheService,
    @inject(TYPES.AIModelSelectorService) private modelSelector: AIModelSelectorService,
    @inject(TYPES.GameTemplateCacheService) private templateCache: GameTemplateCacheService,
    @inject(TYPES.AssetTemplateLibraryService) private assetLibrary: AssetTemplateLibraryService,
    @inject(TYPES.BatchAssetGeneratorService) private batchProcessor: BatchAssetGeneratorService,
    @inject(TYPES.CommunityAssetPoolService) private communityPool: CommunityAssetPoolService,
    @inject(TYPES.ProgressiveEnhancementService) private progressiveService: ProgressiveEnhancementService
  ) {
    super();
    
    // Store service references for analytics
    this.services = {
      intelligentCache: this.intelligentCache,
      modelSelector: this.modelSelector,
      templateCache: this.templateCache,
      assetLibrary: this.assetLibrary,
      batchProcessor: this.batchProcessor,
      communityPool: this.communityPool,
      progressiveService: this.progressiveService
    };
    
    // Start periodic tasks
    this.startPeriodicTasks();
    
    this.logger.info('Cost monitoring service initialized');
  }

  /**
   * Record a cost metric
   */
  async recordCost(
    userId: string,
    userTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE',
    operation: CostOperation,
    service: CostService,
    actualCost: number,
    estimatedCost: number = actualCost,
    metadata: CostMetricMetadata = {}
  ): Promise<string> {
    const metricId = this.generateMetricId();
    const costSavings = Math.max(0, estimatedCost - actualCost);
    
    const metric: CostMetric = {
      id: metricId,
      timestamp: new Date(),
      userId,
      userTier,
      gameId: metadata.gameType ? `${metadata.gameType}_${Date.now()}` : undefined,
      operation,
      service,
      actualCost,
      estimatedCost,
      costSavings,
      currency: 'USD',
      metadata
    };

    // Store in memory buffer
    if (!this.metrics.has(userId)) {
      this.metrics.set(userId, []);
    }
    this.metrics.get(userId)!.push(metric);

    // Store in database asynchronously
    this.storeCostMetric(metric).catch(error => {
      this.logger.error('Failed to store cost metric', { metricId, error });
    });

    // Check budget and trigger alerts if needed
    await this.checkBudgetAlerts(userId, actualCost);

    // Emit event for real-time updates
    this.emit('costRecorded', metric);

    this.logger.debug('Cost metric recorded', {
      metricId,
      userId,
      operation,
      service,
      actualCost,
      costSavings
    });

    return metricId;
  }

  /**
   * Get cost dashboard for user or system-wide
   */
  async getCostDashboard(
    period: 'day' | 'week' | 'month' | 'year',
    userId?: string
  ): Promise<CostDashboard> {
    const cacheKey = `cost_dashboard:${period}:${userId || 'system'}`;
    
    // Check cache first
    const cached = await this.cache.get<CostDashboard>(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate dashboard data
    const dashboard = await this.calculateDashboard(period, userId);
    
    // Cache result
    const ttl = period === 'day' ? 300 : period === 'week' ? 1800 : 3600; // 5min, 30min, 1hour
    await this.cache.set(cacheKey, dashboard, ttl);

    return dashboard;
  }

  /**
   * Set budget configuration for user
   */
  async setBudgetConfig(userId: string, config: Omit<BudgetConfig, 'userId'>): Promise<void> {
    const budgetConfig: BudgetConfig = {
      userId,
      ...config
    };

    this.budgetConfigs.set(userId, budgetConfig);
    
    // Store in database
    await this.storeBudgetConfig(budgetConfig);

    this.logger.info('Budget configuration updated', { userId, monthlyBudget: config.monthlyBudget });
  }

  /**
   * Get user's current cost alerts
   */
  async getCostAlerts(userId: string, unacknowledgedOnly: boolean = false): Promise<CostAlert[]> {
    const userAlerts = this.activeAlerts.get(userId) || [];
    
    if (unacknowledgedOnly) {
      return userAlerts.filter(alert => !alert.acknowledged);
    }
    
    return userAlerts;
  }

  /**
   * Acknowledge a cost alert
   */
  async acknowledgeCostAlert(alertId: string, userId: string): Promise<boolean> {
    const userAlerts = this.activeAlerts.get(userId) || [];
    const alert = userAlerts.find(a => a.id === alertId);
    
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();

    // Update in database
    await this.updateAlertInDatabase(alert);

    this.logger.info('Cost alert acknowledged', { alertId, userId });
    return true;
  }

  /**
   * Get cost optimization recommendations
   */
  async getOptimizationRecommendations(userId: string): Promise<CostRecommendation[]> {
    const userMetrics = await this.getUserMetrics(userId, 'month');
    const recommendations: CostRecommendation[] = [];

    // Analyze usage patterns and generate recommendations
    
    // Cache hit rate recommendation
    const cacheAnalytics = await this.intelligentCache.getAnalytics();
    if (cacheAnalytics.hitRate < 60) {
      recommendations.push({
        id: 'improve-cache-usage',
        type: 'optimization',
        priority: 'high',
        title: 'Improve Cache Hit Rate',
        description: `Your cache hit rate is ${cacheAnalytics.hitRate.toFixed(1)}%. Optimizing your game descriptions could improve caching.`,
        potentialSavings: Math.ceil(cacheAnalytics.costSavings * 0.4),
        effort: 'low',
        impact: 'high'
      });
    }

    // Batch processing recommendation
    const batchMetrics = userMetrics.filter(m => m.operation === 'asset_generation');
    if (batchMetrics.length > 10 && batchMetrics.filter(m => m.metadata.batchSize).length < 3) {
      recommendations.push({
        id: 'use-batch-processing',
        type: 'optimization',
        priority: 'medium',
        title: 'Use Batch Asset Generation',
        description: 'You generate many assets individually. Batch processing could save 20-30% on costs.',
        potentialSavings: Math.ceil(batchMetrics.reduce((sum, m) => sum + m.actualCost, 0) * 0.25),
        effort: 'low',
        impact: 'medium'
      });
    }

    // Community assets recommendation
    const assetMetrics = userMetrics.filter(m => m.operation === 'asset_generation');
    if (assetMetrics.length > 5) {
      const communityAnalytics = await this.communityPool.getAnalytics();
      if (communityAnalytics.totalAssets > 100) {
        recommendations.push({
          id: 'use-community-assets',
          type: 'optimization',
          priority: 'medium',
          title: 'Explore Community Assets',
          description: `${communityAnalytics.totalAssets} community assets available. Using existing assets could eliminate generation costs.`,
          potentialSavings: Math.ceil(assetMetrics.reduce((sum, m) => sum + m.actualCost, 0) * 0.4),
          effort: 'low',
          impact: 'medium'
        });
      }
    }

    // Tier upgrade recommendation
    const monthlySpend = userMetrics.reduce((sum, m) => sum + m.actualCost, 0);
    const currentConfig = this.budgetConfigs.get(userId);
    if (currentConfig && monthlySpend > currentConfig.monthlyBudget * 0.8) {
      const nextTier = this.getNextTier(currentConfig.userTier);
      if (nextTier) {
        recommendations.push({
          id: 'tier-upgrade',
          type: 'tier_upgrade',
          priority: 'high',
          title: `Upgrade to ${nextTier}`,
          description: `You're using ${(monthlySpend / currentConfig.monthlyBudget * 100).toFixed(1)}% of your budget. Upgrading offers better rates and higher limits.`,
          potentialSavings: Math.ceil(monthlySpend * 0.15), // 15% savings from better rates
          effort: 'low',
          impact: 'high'
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 2, medium: 1, low: 0 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Export cost data
   */
  async exportCostData(config: CostExport): Promise<Buffer> {
    const metrics = await this.getMetricsForPeriod(config.period, config.userId);
    
    switch (config.format) {
      case 'csv':
        return this.exportToCsv(metrics, config);
      case 'json':
        return Buffer.from(JSON.stringify(metrics, null, 2));
      case 'pdf':
        return this.exportToPdf(metrics, config);
      default:
        throw new Error('Unsupported export format');
    }
  }

  /**
   * Get real-time cost stream for websocket
   */
  getRealtimeCostStream(userId?: string) {
    const stream = new EventEmitter();
    
    const handleCostRecorded = (metric: CostMetric) => {
      if (!userId || metric.userId === userId) {
        stream.emit('cost', {
          timestamp: metric.timestamp,
          operation: metric.operation,
          service: metric.service,
          cost: metric.actualCost,
          savings: metric.costSavings
        });
      }
    };

    this.on('costRecorded', handleCostRecorded);
    
    // Cleanup listener when stream is closed
    stream.on('close', () => {
      this.off('costRecorded', handleCostRecorded);
    });

    return stream;
  }

  /**
   * Get system-wide cost analytics
   */
  async getSystemAnalytics(): Promise<{
    totalUsers: number;
    totalCosts: number;
    totalSavings: number;
    optimizationEffectiveness: Record<string, number>;
    topCostDrivers: Array<{ service: string; cost: number; percentage: number }>;
    servicePerformance: Record<string, { cost: number; efficiency: number; satisfaction: number }>;
  }> {
    const allMetrics = await this.getAllMetrics('month');
    
    const totalUsers = new Set(allMetrics.map(m => m.userId)).size;
    const totalCosts = allMetrics.reduce((sum, m) => sum + m.actualCost, 0);
    const totalSavings = allMetrics.reduce((sum, m) => sum + m.costSavings, 0);

    // Calculate optimization effectiveness
    const optimizationEffectiveness = {
      intelligentCaching: await this.calculateCacheEffectiveness(),
      batchProcessing: await this.calculateBatchEffectiveness(),
      communityAssets: await this.calculateCommunityEffectiveness(),
      progressiveEnhancement: await this.calculateProgressiveEffectiveness()
    };

    // Top cost drivers
    const costByService = allMetrics.reduce((acc, m) => {
      acc[m.service] = (acc[m.service] || 0) + m.actualCost;
      return acc;
    }, {} as Record<string, number>);
    
    const topCostDrivers = Object.entries(costByService)
      .map(([service, cost]) => ({
        service,
        cost,
        percentage: (cost / totalCosts) * 100
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    return {
      totalUsers,
      totalCosts,
      totalSavings,
      optimizationEffectiveness,
      topCostDrivers,
      servicePerformance: {} // Would be calculated from service-specific metrics
    };
  }

  // Private methods

  private async calculateDashboard(period: 'day' | 'week' | 'month' | 'year', userId?: string): Promise<CostDashboard> {
    const metrics = await this.getMetricsForPeriod(this.getPeriodRange(period), userId);
    
    // Calculate summary
    const totalCost = metrics.reduce((sum, m) => sum + m.actualCost, 0);
    const totalSavings = metrics.reduce((sum, m) => sum + m.costSavings, 0);
    const gameCount = new Set(metrics.map(m => m.gameId).filter(Boolean)).size;
    const userCount = userId ? 1 : new Set(metrics.map(m => m.userId)).size;
    
    const summary: CostSummary = {
      totalCost,
      totalSavings,
      netCost: totalCost - totalSavings,
      averageCostPerGame: gameCount > 0 ? totalCost / gameCount : 0,
      averageCostPerUser: userCount > 0 ? totalCost / userCount : 0,
      budgetUtilization: userId ? await this.calculateBudgetUtilization(userId, totalCost) : 0,
      costEfficiencyScore: this.calculateEfficiencyScore(totalCost, totalSavings)
    };

    // Calculate breakdown
    const breakdown = this.calculateCostBreakdown(metrics);
    
    // Calculate trends
    const trends = this.calculateCostTrends(metrics, period);
    
    // Calculate savings analysis
    const savings = await this.calculateSavingsAnalysis(metrics);
    
    // Calculate optimization metrics
    const optimization = await this.calculateOptimizationMetrics();
    
    // Generate predictions
    const predictions = this.generateCostPredictions(trends);
    
    // Get active alerts
    const alerts = userId ? (this.activeAlerts.get(userId) || []) : [];
    
    // Get recommendations
    const recommendations = userId ? await this.getOptimizationRecommendations(userId) : [];

    return {
      period,
      summary,
      breakdown,
      trends,
      savings,
      optimization,
      predictions,
      alerts,
      recommendations
    };
  }

  private calculateCostBreakdown(metrics: CostMetric[]): CostBreakdown {
    // Initialize breakdown structure
    const breakdown: CostBreakdown = {
      byService: {} as any,
      byOperation: {} as any,
      byUserTier: {} as any,
      byGameType: {} as any,
      byModel: {} as any
    };

    // Calculate breakdowns
    for (const metric of metrics) {
      // By service
      if (!breakdown.byService[metric.service]) {
        breakdown.byService[metric.service] = { cost: 0, savings: 0, usage: 0 };
      }
      breakdown.byService[metric.service].cost += metric.actualCost;
      breakdown.byService[metric.service].savings += metric.costSavings;
      breakdown.byService[metric.service].usage++;

      // By operation
      if (!breakdown.byOperation[metric.operation]) {
        breakdown.byOperation[metric.operation] = { cost: 0, count: 0, avgCost: 0 };
      }
      breakdown.byOperation[metric.operation].cost += metric.actualCost;
      breakdown.byOperation[metric.operation].count++;

      // By user tier
      if (!breakdown.byUserTier[metric.userTier]) {
        breakdown.byUserTier[metric.userTier] = { cost: 0, users: 0, avgCostPerUser: 0 };
      }
      breakdown.byUserTier[metric.userTier].cost += metric.actualCost;

      // By game type
      if (metric.metadata.gameType) {
        if (!breakdown.byGameType[metric.metadata.gameType]) {
          breakdown.byGameType[metric.metadata.gameType] = { cost: 0, games: 0, avgCostPerGame: 0 };
        }
        breakdown.byGameType[metric.metadata.gameType].cost += metric.actualCost;
      }

      // By model
      if (metric.metadata.modelUsed) {
        if (!breakdown.byModel[metric.metadata.modelUsed]) {
          breakdown.byModel[metric.metadata.modelUsed] = { cost: 0, requests: 0, avgCost: 0 };
        }
        breakdown.byModel[metric.metadata.modelUsed].cost += metric.actualCost;
        breakdown.byModel[metric.metadata.modelUsed].requests++;
      }
    }

    // Calculate averages
    Object.values(breakdown.byOperation).forEach(op => {
      op.avgCost = op.count > 0 ? op.cost / op.count : 0;
    });

    Object.values(breakdown.byModel).forEach(model => {
      model.avgCost = model.requests > 0 ? model.cost / model.requests : 0;
    });

    return breakdown;
  }

  private calculateCostTrends(metrics: CostMetric[], period: string): CostTrend[] {
    // Group metrics by date
    const dateGroups = new Map<string, CostMetric[]>();
    
    for (const metric of metrics) {
      const dateKey = this.getDateKey(metric.timestamp, period);
      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey)!.push(metric);
    }

    // Calculate trends
    return Array.from(dateGroups.entries()).map(([date, dateMetrics]) => {
      const totalCost = dateMetrics.reduce((sum, m) => sum + m.actualCost, 0);
      const totalSavings = dateMetrics.reduce((sum, m) => sum + m.costSavings, 0);
      
      const operationCounts = dateMetrics.reduce((acc, m) => {
        acc[m.operation] = (acc[m.operation] || 0) + 1;
        return acc;
      }, {} as Record<CostOperation, number>);

      const efficiency = totalCost > 0 ? (totalSavings / (totalCost + totalSavings)) * 100 : 0;

      return {
        date,
        totalCost,
        totalSavings,
        operationCounts,
        efficiency
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }

  private async calculateSavingsAnalysis(metrics: CostMetric[]): Promise<SavingsAnalysis> {
    const totalSavings = metrics.reduce((sum, m) => sum + m.costSavings, 0);
    
    // Savings by optimization type
    const savingsByOptimization: Record<string, { amount: number; instances: number }> = {};
    
    for (const metric of metrics) {
      if (metric.metadata.cacheHit) {
        savingsByOptimization['cache_hit'] = savingsByOptimization['cache_hit'] || { amount: 0, instances: 0 };
        savingsByOptimization['cache_hit'].amount += metric.costSavings;
        savingsByOptimization['cache_hit'].instances++;
      }
      
      if (metric.metadata.batchSize && metric.metadata.batchSize > 1) {
        savingsByOptimization['batch_processing'] = savingsByOptimization['batch_processing'] || { amount: 0, instances: 0 };
        savingsByOptimization['batch_processing'].amount += metric.costSavings;
        savingsByOptimization['batch_processing'].instances++;
      }
    }

    // Get analytics from services
    const cacheAnalytics = await this.intelligentCache.getAnalytics();
    const batchAnalytics = await this.batchProcessor.getAnalytics();
    const communityAnalytics = await this.communityPool.getAnalytics();

    return {
      totalSavings,
      savingsByOptimization,
      cacheHitRate: cacheAnalytics.hitRate,
      batchProcessingSavings: batchAnalytics.totalCostSavings,
      communityAssetSavings: communityAnalytics.costSavingsGenerated,
      progressiveSavings: 0, // Would be calculated from progressive service
      roi: totalSavings > 0 ? (totalSavings / (totalSavings + metrics.reduce((sum, m) => sum + m.actualCost, 0))) * 100 : 0
    };
  }

  private async calculateOptimizationMetrics(): Promise<OptimizationMetrics> {
    const cacheAnalytics = await this.intelligentCache.getAnalytics();
    const batchAnalytics = await this.batchProcessor.getAnalytics();
    const communityAnalytics = await this.communityPool.getAnalytics();

    const cacheEfficiency = cacheAnalytics.hitRate;
    const batchUtilization = batchAnalytics.averageBatchSize / 10 * 100; // Assuming max batch size of 10
    const modelOptimization = 75; // Would be calculated from model selector analytics
    const communityReuseRate = communityAnalytics.hitRate;
    const progressiveAdoption = 50; // Would be calculated from progressive service usage

    const overallOptimizationScore = (
      cacheEfficiency * 0.25 +
      batchUtilization * 0.2 +
      modelOptimization * 0.2 +
      communityReuseRate * 0.2 +
      progressiveAdoption * 0.15
    );

    return {
      cacheEfficiency,
      batchUtilization,
      modelOptimization,
      communityReuseRate,
      progressiveAdoption,
      overallOptimizationScore
    };
  }

  private generateCostPredictions(trends: CostTrend[]): CostPrediction[] {
    if (trends.length < 3) return [];

    // Simple linear regression for cost prediction
    const recentTrends = trends.slice(-7); // Last 7 data points
    const avgGrowthRate = this.calculateGrowthRate(recentTrends);
    const lastCost = recentTrends[recentTrends.length - 1]?.totalCost || 0;

    return [
      {
        period: 'next_week',
        predictedCost: Math.ceil(lastCost * (1 + avgGrowthRate)),
        confidence: 0.7,
        factors: ['Historical trend', 'Seasonal patterns'],
        recommendations: avgGrowthRate > 0.1 ? ['Consider optimization strategies'] : []
      }
    ];
  }

  private async checkBudgetAlerts(userId: string, costToAdd: number): Promise<void> {
    const config = this.budgetConfigs.get(userId);
    if (!config) return;

    const currentSpend = await this.getCurrentSpend(userId, 'month');
    const newSpend = currentSpend + costToAdd;
    const budgetUtilization = (newSpend / config.monthlyBudget) * 100;

    // Check thresholds
    if (budgetUtilization >= config.alertThresholds.critical) {
      await this.createCostAlert(userId, 'budget_exceeded', 'critical', 
        'Critical Budget Alert', 
        `You've used ${budgetUtilization.toFixed(1)}% of your monthly budget.`,
        newSpend, config.monthlyBudget);
    } else if (budgetUtilization >= config.alertThresholds.warning) {
      await this.createCostAlert(userId, 'budget_exceeded', 'medium',
        'Budget Warning',
        `You've used ${budgetUtilization.toFixed(1)}% of your monthly budget.`,
        newSpend, config.monthlyBudget);
    }
  }

  private async createCostAlert(
    userId: string,
    alertType: CostAlert['alertType'],
    severity: CostAlert['severity'],
    title: string,
    message: string,
    currentCost: number,
    threshold: number
  ): Promise<void> {
    const alert: CostAlert = {
      id: this.generateAlertId(),
      userId,
      alertType,
      severity,
      title,
      message,
      currentCost,
      threshold,
      recommendations: this.getAlertRecommendations(alertType),
      acknowledged: false,
      createdAt: new Date()
    };

    // Store alert
    if (!this.activeAlerts.has(userId)) {
      this.activeAlerts.set(userId, []);
    }
    this.activeAlerts.get(userId)!.push(alert);

    // Store in database
    await this.storeAlertInDatabase(alert);

    // Emit event
    this.emit('costAlert', alert);

    this.logger.warn('Cost alert created', { userId, alertType, severity, currentCost, threshold });
  }

  // Helper methods
  private startPeriodicTasks(): void {
    // Flush metrics to database every 5 minutes
    setInterval(() => {
      this.flushMetricsToDatabase();
    }, 5 * 60 * 1000);

    // Clean up old alerts every hour
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 60 * 60 * 1000);
  }

  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getPeriodRange(period: string): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now);
    
    switch (period) {
      case 'day':
        start.setDate(now.getDate() - 1);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return { start, end: now };
  }

  private getDateKey(date: Date, period: string): string {
    switch (period) {
      case 'day':
        return date.toISOString().split('T')[0];
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'year':
        return date.getFullYear().toString();
      default:
        return date.toISOString().split('T')[0];
    }
  }

  private calculateEfficiencyScore(totalCost: number, totalSavings: number): number {
    if (totalCost === 0) return 100;
    return Math.min(100, (totalSavings / (totalCost + totalSavings)) * 100);
  }

  private calculateGrowthRate(trends: CostTrend[]): number {
    if (trends.length < 2) return 0;
    
    const first = trends[0].totalCost;
    const last = trends[trends.length - 1].totalCost;
    
    if (first === 0) return 0;
    return (last - first) / first / trends.length;
  }

  private getNextTier(currentTier: string): string | null {
    const tiers = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];
    const currentIndex = tiers.indexOf(currentTier);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  }

  private getAlertRecommendations(alertType: CostAlert['alertType']): string[] {
    switch (alertType) {
      case 'budget_exceeded':
        return ['Review recent usage', 'Consider optimization features', 'Upgrade tier if needed'];
      case 'unusual_spending':
        return ['Check for bulk operations', 'Verify usage patterns'];
      case 'optimization_opportunity':
        return ['Enable intelligent caching', 'Use batch processing', 'Explore community assets'];
      default:
        return [];
    }
  }

  // Database operations (would need actual implementation)
  private async storeCostMetric(metric: CostMetric): Promise<void> {
    // Store in database
    this.logger.debug('Storing cost metric', { metricId: metric.id });
  }

  private async storeBudgetConfig(config: BudgetConfig): Promise<void> {
    // Store in database
    this.logger.debug('Storing budget config', { userId: config.userId });
  }

  private async storeAlertInDatabase(alert: CostAlert): Promise<void> {
    // Store in database
    this.logger.debug('Storing cost alert', { alertId: alert.id });
  }

  private async updateAlertInDatabase(alert: CostAlert): Promise<void> {
    // Update in database
    this.logger.debug('Updating cost alert', { alertId: alert.id });
  }

  private async getUserMetrics(userId: string, period: string): Promise<CostMetric[]> {
    // Get from database
    return this.metrics.get(userId) || [];
  }

  private async getMetricsForPeriod(period: { start: Date; end: Date }, userId?: string): Promise<CostMetric[]> {
    // Get from database with date filtering
    const allMetrics = userId ? (this.metrics.get(userId) || []) : 
                      Array.from(this.metrics.values()).flat();
    
    return allMetrics.filter(m => 
      m.timestamp >= period.start && m.timestamp <= period.end
    );
  }

  private async getAllMetrics(period: string): Promise<CostMetric[]> {
    // Get all metrics from database
    return Array.from(this.metrics.values()).flat();
  }

  private async getCurrentSpend(userId: string, period: string): Promise<number> {
    const metrics = await this.getUserMetrics(userId, period);
    return metrics.reduce((sum, m) => sum + m.actualCost, 0);
  }

  private async calculateBudgetUtilization(userId: string, totalCost: number): Promise<number> {
    const config = this.budgetConfigs.get(userId);
    if (!config) return 0;
    return (totalCost / config.monthlyBudget) * 100;
  }

  private async calculateCacheEffectiveness(): Promise<number> {
    const analytics = await this.intelligentCache.getAnalytics();
    return analytics.hitRate;
  }

  private async calculateBatchEffectiveness(): Promise<number> {
    const analytics = await this.batchProcessor.getAnalytics();
    return analytics.processingTimeReduction;
  }

  private async calculateCommunityEffectiveness(): Promise<number> {
    const analytics = await this.communityPool.getAnalytics();
    return analytics.hitRate;
  }

  private async calculateProgressiveEffectiveness(): Promise<number> {
    // Would get analytics from progressive service
    return 0;
  }

  private async flushMetricsToDatabase(): Promise<void> {
    // Flush buffered metrics to database
    for (const [userId, userMetrics] of this.metrics.entries()) {
      for (const metric of userMetrics) {
        await this.storeCostMetric(metric);
      }
    }
    
    // Clear buffer
    this.metrics.clear();
  }

  private async cleanupOldAlerts(): Promise<void> {
    // Remove acknowledged alerts older than 7 days
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    for (const [userId, alerts] of this.activeAlerts.entries()) {
      const filteredAlerts = alerts.filter(alert => 
        !alert.acknowledged || alert.acknowledgedAt! > cutoff
      );
      this.activeAlerts.set(userId, filteredAlerts);
    }
  }

  private exportToCsv(metrics: CostMetric[], config: CostExport): Buffer {
    // Generate CSV export
    const csvData = 'timestamp,user,operation,service,cost,savings\n' +
      metrics.map(m => `${m.timestamp.toISOString()},${m.userId},${m.operation},${m.service},${m.actualCost},${m.costSavings}`).join('\n');
    
    return Buffer.from(csvData);
  }

  private exportToPdf(metrics: CostMetric[], config: CostExport): Buffer {
    // Generate PDF export (would use a PDF library)
    return Buffer.from('PDF export not implemented');
  }
}