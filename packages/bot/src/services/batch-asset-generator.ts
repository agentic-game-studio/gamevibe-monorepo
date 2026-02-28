// GameVibe AI Batch Asset Generator Service
// Optimized batch processing for AI asset generation to reduce API costs

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { CacheService } from './cache.js';
import { IntelligentCacheService } from './intelligent-cache.js';
import { AssetTemplateLibraryService, AssetGenerationRequest } from './asset-template-library.js';
import { AIServiceWrapper } from './ai-service-wrapper.js';
import { TYPES } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface BatchAssetRequest {
  id: string;
  gameId: string;
  userId: string;
  userTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  request: AssetGenerationRequest;
  callback?: (result: BatchAssetResult) => void;
  createdAt: Date;
  estimatedCost: number;
  timeout?: number;
}

export interface BatchAssetResult {
  requestId: string;
  success: boolean;
  assetUrl?: string;
  thumbnailUrl?: string;
  metadata?: any;
  actualCost: number;
  processingTime: number;
  error?: string;
  batchId?: string;
}

export interface AssetBatch {
  id: string;
  requests: BatchAssetRequest[];
  totalEstimatedCost: number;
  maxCostLimit: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  results: BatchAssetResult[];
  optimizations: BatchOptimization[];
}

export interface BatchOptimization {
  type: 'similarity_dedup' | 'style_consolidation' | 'bulk_pricing' | 'cache_reuse';
  description: string;
  costSavings: number;
  affectedRequests: string[];
}

export interface BatchProcessingOptions {
  maxBatchSize: number;
  maxWaitTime: number; // milliseconds
  maxCostPerBatch: number; // cents
  enableSimilarityDeduplication: boolean;
  enableStyleConsolidation: boolean;
  prioritizeByUserTier: boolean;
}

export interface BatchAnalytics {
  totalBatches: number;
  averageBatchSize: number;
  totalCostSavings: number;
  processingTimeReduction: number;
  cacheHitRate: number;
  optimizationBreakdown: Record<string, { count: number; savings: number }>;
  tierUsage: Record<string, number>;
}

@injectable()
export class BatchAssetGeneratorService extends EventEmitter {
  private logger = new Logger('BatchAssetGeneratorService');
  private requestQueue: BatchAssetRequest[] = [];
  private activeBatches: Map<string, AssetBatch> = new Map();
  private processingTimer?: NodeJS.Timeout;
  private isProcessing = false;
  
  private static readonly DEFAULT_OPTIONS: BatchProcessingOptions = {
    maxBatchSize: 10,
    maxWaitTime: 30000, // 30 seconds
    maxCostPerBatch: 100, // $1.00
    enableSimilarityDeduplication: true,
    enableStyleConsolidation: true,
    prioritizeByUserTier: true
  };

  private options: BatchProcessingOptions;

  constructor(
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.IntelligentCacheService) private intelligentCache: IntelligentCacheService,
    @inject(TYPES.AssetTemplateLibraryService) private assetLibrary: AssetTemplateLibraryService,
    @inject(TYPES.AIServiceWrapper) private aiService: AIServiceWrapper,
    @inject(TYPES.Config) private config: any
  ) {
    super();
    
    this.options = {
      ...BatchAssetGeneratorService.DEFAULT_OPTIONS,
      ...config.batchProcessing
    };
    
    // Start processing timer
    this.startProcessingTimer();
    
    this.logger.info('Batch asset generator service initialized', { options: this.options });
  }

  /**
   * Queue an asset generation request for batch processing
   */
  async queueAssetGeneration(request: BatchAssetRequest): Promise<string> {
    // Check if similar asset already exists in library
    const existingAssets = await this.assetLibrary.searchAssets({
      category: request.request.category,
      type: request.request.type,
      style: request.request.style,
      theme: request.request.theme,
      gameType: request.request.gameType
    }, 1);

    if (existingAssets.length > 0) {
      // Return existing asset immediately
      const existingAsset = existingAssets[0];
      
      if (request.callback) {
        process.nextTick(() => {
          request.callback!({
            requestId: request.id,
            success: true,
            assetUrl: existingAsset.url,
            thumbnailUrl: existingAsset.thumbnail,
            metadata: existingAsset.metadata,
            actualCost: 0, // No cost for reused asset
            processingTime: 0,
            batchId: 'cache_hit'
          });
        });
      }

      this.logger.info('Asset request fulfilled from library cache', {
        requestId: request.id,
        assetId: existingAsset.id
      });

      return 'cache_hit';
    }

    // Add to queue
    this.requestQueue.push(request);
    this.sortQueue();

    this.logger.info('Asset generation request queued', {
      requestId: request.id,
      priority: request.priority,
      queueSize: this.requestQueue.length
    });

    // Emit event for monitoring
    this.emit('requestQueued', request);

    // Check if we should process immediately
    if (this.shouldProcessImmediately()) {
      await this.processBatches();
    }

    return request.id;
  }

  /**
   * Get status of a batch request
   */
  async getRequestStatus(requestId: string): Promise<{
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'not_found';
    position?: number;
    estimatedWaitTime?: number;
    result?: BatchAssetResult;
  }> {
    // Check if in queue
    const queueIndex = this.requestQueue.findIndex(r => r.id === requestId);
    if (queueIndex !== -1) {
      return {
        status: 'queued',
        position: queueIndex + 1,
        estimatedWaitTime: this.estimateWaitTime(queueIndex)
      };
    }

    // Check active batches
    for (const batch of this.activeBatches.values()) {
      const request = batch.requests.find(r => r.id === requestId);
      if (request) {
        const result = batch.results.find(r => r.requestId === requestId);
        return {
          status: batch.status as any,
          result
        };
      }
    }

    return { status: 'not_found' };
  }

  /**
   * Cancel a queued request
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    const index = this.requestQueue.findIndex(r => r.id === requestId);
    if (index !== -1) {
      const request = this.requestQueue.splice(index, 1)[0];
      this.logger.info('Asset generation request cancelled', { requestId });
      this.emit('requestCancelled', requestId);
      return true;
    }
    return false;
  }

  /**
   * Force process batches immediately
   */
  async processBatches(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    try {
      const batches = this.createOptimalBatches();
      
      for (const batch of batches) {
        await this.processBatch(batch);
      }
    } catch (error) {
      this.logger.error('Batch processing failed', { error });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get batch processing analytics
   */
  async getAnalytics(): Promise<BatchAnalytics> {
    const completedBatches = Array.from(this.activeBatches.values())
      .filter(b => b.status === 'completed');

    const totalBatches = completedBatches.length;
    const averageBatchSize = totalBatches > 0 
      ? completedBatches.reduce((sum, b) => sum + b.requests.length, 0) / totalBatches 
      : 0;

    const totalCostSavings = completedBatches.reduce((sum, batch) => 
      sum + batch.optimizations.reduce((batchSum, opt) => batchSum + opt.costSavings, 0), 0
    );

    const optimizationBreakdown = completedBatches.reduce((breakdown, batch) => {
      batch.optimizations.forEach(opt => {
        if (!breakdown[opt.type]) {
          breakdown[opt.type] = { count: 0, savings: 0 };
        }
        breakdown[opt.type].count++;
        breakdown[opt.type].savings += opt.costSavings;
      });
      return breakdown;
    }, {} as Record<string, { count: number; savings: number }>);

    const tierUsage = completedBatches.reduce((usage, batch) => {
      batch.requests.forEach(req => {
        usage[req.userTier] = (usage[req.userTier] || 0) + 1;
      });
      return usage;
    }, {} as Record<string, number>);

    // Calculate processing time reduction (estimate)
    const totalRequests = completedBatches.reduce((sum, b) => sum + b.requests.length, 0);
    const estimatedIndividualTime = totalRequests * 5000; // 5 seconds per request
    const actualBatchTime = completedBatches.reduce((sum, b) => {
      if (b.completedAt && b.startedAt) {
        return sum + (b.completedAt.getTime() - b.startedAt.getTime());
      }
      return sum;
    }, 0);
    const processingTimeReduction = totalRequests > 0 
      ? ((estimatedIndividualTime - actualBatchTime) / estimatedIndividualTime) * 100 
      : 0;

    return {
      totalBatches,
      averageBatchSize,
      totalCostSavings,
      processingTimeReduction,
      cacheHitRate: 0, // Would be calculated from cache analytics
      optimizationBreakdown,
      tierUsage
    };
  }

  /**
   * Update batch processing configuration
   */
  updateOptions(newOptions: Partial<BatchProcessingOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.logger.info('Batch processing options updated', { options: this.options });
  }

  /**
   * Clean up completed batches
   */
  async cleanup(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = Date.now() - maxAge;
    let cleanedCount = 0;

    for (const [batchId, batch] of this.activeBatches.entries()) {
      if (batch.status === 'completed' && batch.completedAt && 
          batch.completedAt.getTime() < cutoff) {
        this.activeBatches.delete(batchId);
        cleanedCount++;
      }
    }

    this.logger.info('Batch cleanup completed', { cleanedCount });
    return cleanedCount;
  }

  /**
   * Start the processing timer
   */
  private startProcessingTimer(): void {
    this.processingTimer = setInterval(async () => {
      if (!this.isProcessing && this.requestQueue.length > 0) {
        const oldestRequest = this.requestQueue[0];
        const waitTime = Date.now() - oldestRequest.createdAt.getTime();
        
        if (waitTime >= this.options.maxWaitTime) {
          await this.processBatches();
        }
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Sort queue by priority and user tier
   */
  private sortQueue(): void {
    this.requestQueue.sort((a, b) => {
      // Priority first
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by user tier if enabled
      if (this.options.prioritizeByUserTier) {
        const tierOrder = { ENTERPRISE: 0, PRO: 1, STARTER: 2, FREE: 3 };
        const tierDiff = tierOrder[a.userTier] - tierOrder[b.userTier];
        if (tierDiff !== 0) return tierDiff;
      }

      // Finally by creation time
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * Check if we should process immediately
   */
  private shouldProcessImmediately(): boolean {
    return (
      this.requestQueue.length >= this.options.maxBatchSize ||
      this.requestQueue.some(r => r.priority === 'urgent')
    );
  }

  /**
   * Create optimal batches from queue
   */
  private createOptimalBatches(): AssetBatch[] {
    const batches: AssetBatch[] = [];
    let currentBatch: BatchAssetRequest[] = [];
    let currentCost = 0;

    for (const request of this.requestQueue) {
      if (currentBatch.length >= this.options.maxBatchSize ||
          currentCost + request.estimatedCost > this.options.maxCostPerBatch) {
        
        if (currentBatch.length > 0) {
          batches.push(this.createBatch(currentBatch));
          currentBatch = [];
          currentCost = 0;
        }
      }

      currentBatch.push(request);
      currentCost += request.estimatedCost;
    }

    if (currentBatch.length > 0) {
      batches.push(this.createBatch(currentBatch));
    }

    // Clear processed requests from queue
    this.requestQueue = [];

    return batches;
  }

  /**
   * Create a batch object from requests
   */
  private createBatch(requests: BatchAssetRequest[]): AssetBatch {
    const batchId = this.generateBatchId();
    const totalCost = requests.reduce((sum, r) => sum + r.estimatedCost, 0);
    const maxPriority = requests.reduce((max, r) => {
      const priorityOrder = { urgent: 3, high: 2, medium: 1, low: 0 };
      return priorityOrder[r.priority] > priorityOrder[max] ? r.priority : max;
    }, 'low' as any);

    return {
      id: batchId,
      requests,
      totalEstimatedCost: totalCost,
      maxCostLimit: this.options.maxCostPerBatch,
      priority: maxPriority,
      status: 'pending',
      createdAt: new Date(),
      results: [],
      optimizations: []
    };
  }

  /**
   * Process a single batch
   */
  private async processBatch(batch: AssetBatch): Promise<void> {
    this.activeBatches.set(batch.id, batch);
    batch.status = 'processing';
    batch.startedAt = new Date();

    this.logger.info('Processing asset batch', {
      batchId: batch.id,
      requestCount: batch.requests.length,
      estimatedCost: batch.totalEstimatedCost
    });

    this.emit('batchStarted', batch);

    try {
      // Apply optimizations
      await this.applyBatchOptimizations(batch);

      // Process requests
      for (const request of batch.requests) {
        const result = await this.processAssetRequest(request, batch.id);
        batch.results.push(result);

        // Call callback if provided
        if (request.callback) {
          request.callback(result);
        }
      }

      batch.status = 'completed';
      batch.completedAt = new Date();

      this.logger.info('Batch processing completed', {
        batchId: batch.id,
        successCount: batch.results.filter(r => r.success).length,
        totalCost: batch.results.reduce((sum, r) => sum + r.actualCost, 0),
        optimizations: batch.optimizations.length
      });

      this.emit('batchCompleted', batch);

    } catch (error) {
      batch.status = 'failed';
      this.logger.error('Batch processing failed', { batchId: batch.id, error });
      this.emit('batchFailed', batch, error);
    }
  }

  /**
   * Apply batch optimizations
   */
  private async applyBatchOptimizations(batch: AssetBatch): Promise<void> {
    // Similarity deduplication
    if (this.options.enableSimilarityDeduplication) {
      const duplicates = this.findSimilarRequests(batch.requests);
      if (duplicates.length > 0) {
        batch.optimizations.push({
          type: 'similarity_dedup',
          description: `Found ${duplicates.length} similar requests that can share results`,
          costSavings: duplicates.length * 10, // Estimate 10 cents per duplicate
          affectedRequests: duplicates.map(d => d.id)
        });
      }
    }

    // Style consolidation
    if (this.options.enableStyleConsolidation) {
      const styleGroups = this.groupByStyle(batch.requests);
      if (styleGroups.size > 1) {
        const consolidationSavings = (styleGroups.size - 1) * 5; // 5 cents per style switch
        batch.optimizations.push({
          type: 'style_consolidation',
          description: `Consolidated ${styleGroups.size} different styles`,
          costSavings: consolidationSavings,
          affectedRequests: batch.requests.map(r => r.id)
        });
      }
    }

    // Bulk pricing optimization
    if (batch.requests.length >= 5) {
      const bulkSavings = batch.requests.length * 2; // 2 cents per request in bulk
      batch.optimizations.push({
        type: 'bulk_pricing',
        description: `Applied bulk pricing for ${batch.requests.length} requests`,
        costSavings: bulkSavings,
        affectedRequests: batch.requests.map(r => r.id)
      });
    }
  }

  /**
   * Process a single asset request
   */
  private async processAssetRequest(
    request: BatchAssetRequest, 
    batchId: string
  ): Promise<BatchAssetResult> {
    const startTime = Date.now();

    try {
      // Generate the asset (placeholder implementation)
      const assetTemplate = await this.assetLibrary.generateAndStoreAsset(request.request);
      
      const processingTime = Date.now() - startTime;
      const actualCost = this.calculateActualCost(request.request);

      return {
        requestId: request.id,
        success: true,
        assetUrl: assetTemplate.url,
        thumbnailUrl: assetTemplate.thumbnail,
        metadata: assetTemplate.metadata,
        actualCost,
        processingTime,
        batchId
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        requestId: request.id,
        success: false,
        actualCost: 0,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        batchId
      };
    }
  }

  /**
   * Find similar requests for deduplication
   */
  private findSimilarRequests(requests: BatchAssetRequest[]): BatchAssetRequest[] {
    const similar: BatchAssetRequest[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < requests.length; i++) {
      if (processed.has(requests[i].id)) continue;

      for (let j = i + 1; j < requests.length; j++) {
        if (processed.has(requests[j].id)) continue;

        if (this.areRequestsSimilar(requests[i], requests[j])) {
          similar.push(requests[j]);
          processed.add(requests[j].id);
        }
      }
    }

    return similar;
  }

  /**
   * Check if two requests are similar enough to deduplicate
   */
  private areRequestsSimilar(req1: BatchAssetRequest, req2: BatchAssetRequest): boolean {
    const r1 = req1.request;
    const r2 = req2.request;

    return (
      r1.category === r2.category &&
      r1.type === r2.type &&
      r1.style === r2.style &&
      r1.theme === r2.theme &&
      Math.abs((r1.dimensions?.width || 0) - (r2.dimensions?.width || 0)) <= 20 &&
      Math.abs((r1.dimensions?.height || 0) - (r2.dimensions?.height || 0)) <= 20
    );
  }

  /**
   * Group requests by style for consolidation
   */
  private groupByStyle(requests: BatchAssetRequest[]): Map<string, BatchAssetRequest[]> {
    const groups = new Map<string, BatchAssetRequest[]>();

    for (const request of requests) {
      const style = request.request.style || 'default';
      if (!groups.has(style)) {
        groups.set(style, []);
      }
      groups.get(style)!.push(request);
    }

    return groups;
  }

  /**
   * Calculate actual cost for asset generation
   */
  private calculateActualCost(request: AssetGenerationRequest): number {
    // Base cost by category
    const baseCosts = {
      sprite: 8,
      background: 12,
      ui: 4,
      effect: 6,
      audio: 10,
      texture: 5
    };

    let cost = baseCosts[request.category] || 8;

    // Quality multiplier
    const qualityMultipliers = { low: 0.7, medium: 1.0, high: 1.5 };
    cost *= qualityMultipliers[request.quality || 'medium'];

    // Variation multiplier
    if (request.variations && request.variations > 1) {
      cost *= 1 + (request.variations - 1) * 0.3;
    }

    return Math.ceil(cost);
  }

  /**
   * Estimate wait time for queued request
   */
  private estimateWaitTime(queuePosition: number): number {
    const avgProcessingTime = 10000; // 10 seconds per request
    const batchSize = this.options.maxBatchSize;
    
    const batchesAhead = Math.floor(queuePosition / batchSize);
    const positionInBatch = queuePosition % batchSize;
    
    return (batchesAhead * avgProcessingTime) + (positionInBatch * 1000);
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup on service shutdown
   */
  destroy(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
  }
}