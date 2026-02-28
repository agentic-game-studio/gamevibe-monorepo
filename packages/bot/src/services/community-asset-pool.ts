// GameVibe AI Community Asset Pool Service
// Community-driven asset sharing and reuse system

import { injectable, inject } from 'inversify';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { AssetTemplateLibraryService, AssetTemplate, AssetSearchCriteria } from './asset-template-library.js';
import { TYPES } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface CommunityAsset extends AssetTemplate {
  contributorId: string;
  contributorName: string;
  contributorTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  isPublic: boolean;
  isVerified: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderationNotes?: string;
  downloadCount: number;
  ratings: AssetRating[];
  averageRating: number;
  license: AssetLicense;
  attribution: string;
  costToGenerate: number;
  communityTags: string[];
  gameIds: string[]; // Games this asset has been used in
  reportCount: number;
  featuredUntil?: Date;
}

export interface AssetRating {
  userId: string;
  userName: string;
  rating: number; // 1-5 stars
  comment?: string;
  createdAt: Date;
  helpful: number; // Upvotes from other users
}

export interface AssetLicense {
  type: 'CC0' | 'CC_BY' | 'CC_BY_SA' | 'CC_BY_NC' | 'CUSTOM' | 'PROPRIETARY';
  requiresAttribution: boolean;
  allowsCommercialUse: boolean;
  allowsModification: boolean;
  customTerms?: string;
}

export interface ContributionReward {
  userId: string;
  assetId: string;
  rewardType: 'credits' | 'tier_boost' | 'featured' | 'badge';
  amount: number;
  description: string;
  awardedAt: Date;
  expiresAt?: Date;
}

export interface AssetContribution {
  assetTemplate: Omit<AssetTemplate, 'id' | 'createdAt' | 'lastUpdated'>;
  license: AssetLicense;
  tags: string[];
  description: string;
  isPublic: boolean;
}

export interface CommunitySearchCriteria extends AssetSearchCriteria {
  contributorId?: string;
  minRating?: number;
  maxDownloads?: number;
  minDownloads?: number;
  licenseType?: AssetLicense['type'];
  isVerified?: boolean;
  isFeatured?: boolean;
  sortBy?: 'popularity' | 'rating' | 'recent' | 'downloads';
  excludeContributor?: string;
}

export interface ModerationAction {
  assetId: string;
  moderatorId: string;
  action: 'approve' | 'reject' | 'flag' | 'feature' | 'unfeature';
  reason: string;
  notes?: string;
  timestamp: Date;
}

export interface CommunityAnalytics {
  totalAssets: number;
  totalContributors: number;
  totalDownloads: number;
  averageRating: number;
  topContributors: Array<{ userId: string; name: string; contributions: number; downloads: number }>;
  topAssets: Array<{ assetId: string; name: string; downloads: number; rating: number }>;
  recentActivity: Array<{ type: 'contribution' | 'download' | 'rating'; count: number; date: string }>;
  moderationQueue: number;
  costSavingsGenerated: number;
}

@injectable()
export class CommunityAssetPoolService {
  private logger = new Logger('CommunityAssetPoolService');
  private static readonly CACHE_PREFIX = 'community_assets';
  private static readonly FEATURED_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  // Reward structure for contributions
  private static readonly CONTRIBUTION_REWARDS = {
    FIRST_CONTRIBUTION: { credits: 10, description: 'First asset contribution' },
    HIGH_RATING: { credits: 5, description: 'Asset rated 4+ stars' },
    POPULAR_ASSET: { credits: 15, description: 'Asset downloaded 100+ times' },
    QUALITY_CONTRIBUTOR: { tierBoost: 30, description: '10+ approved assets' },
    COMMUNITY_CHAMPION: { badge: 'champion', description: '50+ downloads generated' }
  };

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.AssetTemplateLibraryService) private assetLibrary: AssetTemplateLibraryService
  ) {}

  /**
   * Contribute an asset to the community pool
   */
  async contributeAsset(
    contributorId: string,
    contributorName: string,
    contributorTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE',
    contribution: AssetContribution
  ): Promise<string> {
    // Create community asset
    const assetId = this.generateAssetId();
    const communityAsset: CommunityAsset = {
      ...contribution.assetTemplate,
      id: assetId,
      contributorId,
      contributorName,
      contributorTier,
      isPublic: contribution.isPublic,
      isVerified: false,
      moderationStatus: 'pending',
      downloadCount: 0,
      ratings: [],
      averageRating: 0,
      license: contribution.license,
      attribution: this.generateAttribution(contributorName, contribution.license),
      costToGenerate: this.estimateGenerationCost(contribution.assetTemplate),
      communityTags: contribution.tags,
      gameIds: [],
      reportCount: 0,
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    // Store in database
    await this.storeCommunityAsset(communityAsset);

    // Cache for quick access
    const cacheKey = `${CommunityAssetPoolService.CACHE_PREFIX}:${assetId}`;
    await this.cache.set(cacheKey, communityAsset, 24 * 3600);

    // Check for first contribution reward
    const contributorAssets = await this.getContributorAssets(contributorId);
    if (contributorAssets.length === 1) {
      await this.awardContributionReward(contributorId, assetId, 'FIRST_CONTRIBUTION');
    }

    this.logger.info('Asset contributed to community pool', {
      assetId,
      contributorId,
      category: contribution.assetTemplate.category,
      isPublic: contribution.isPublic
    });

    return assetId;
  }

  /**
   * Search community assets
   */
  async searchCommunityAssets(
    criteria: CommunitySearchCriteria,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ assets: CommunityAsset[]; total: number }> {
    const cacheKey = this.generateSearchCacheKey(criteria, limit, offset);
    
    // Check cache first
    const cached = await this.cache.get<{ assets: CommunityAsset[]; total: number }>(cacheKey);
    if (cached) {
      this.logger.info('Community asset search cache hit', { criteria, resultCount: cached.assets.length });
      return cached;
    }

    // Search database
    const results = await this.searchDatabase(criteria, limit, offset);

    // Filter by rating and verification status
    const filteredAssets = results.assets.filter(asset => {
      if (criteria.minRating && asset.averageRating < criteria.minRating) return false;
      if (criteria.isVerified !== undefined && asset.isVerified !== criteria.isVerified) return false;
      if (criteria.contributorId && asset.contributorId !== criteria.contributorId) return false;
      if (criteria.excludeContributor && asset.contributorId === criteria.excludeContributor) return false;
      if (criteria.licenseType && asset.license.type !== criteria.licenseType) return false;
      return asset.moderationStatus === 'approved';
    });

    // Sort results
    if (criteria.sortBy) {
      filteredAssets.sort((a, b) => {
        switch (criteria.sortBy) {
          case 'popularity':
            return b.downloadCount - a.downloadCount;
          case 'rating':
            return b.averageRating - a.averageRating;
          case 'recent':
            return b.createdAt.getTime() - a.createdAt.getTime();
          case 'downloads':
            return b.downloadCount - a.downloadCount;
          default:
            return 0;
        }
      });
    }

    const result = {
      assets: filteredAssets.slice(0, limit),
      total: filteredAssets.length
    };

    // Cache the results
    await this.cache.set(cacheKey, result, 30 * 60); // 30 minutes

    this.logger.info('Community asset search completed', {
      criteria,
      resultCount: result.assets.length,
      total: result.total
    });

    return result;
  }

  /**
   * Download/use a community asset
   */
  async downloadAsset(assetId: string, userId: string, gameId?: string): Promise<CommunityAsset | null> {
    const asset = await this.getCommunityAsset(assetId);
    if (!asset || asset.moderationStatus !== 'approved') {
      return null;
    }

    // Update download count and usage stats
    asset.downloadCount++;
    asset.usage.totalUses++;
    asset.usage.lastUsed = new Date();
    
    if (gameId && !asset.gameIds.includes(gameId)) {
      asset.gameIds.push(gameId);
    }

    // Update in database and cache
    await this.updateCommunityAsset(asset);

    // Track usage for cost savings
    await this.trackCostSavings(userId, asset.costToGenerate);

    // Check for popularity rewards
    if (asset.downloadCount === 100) {
      await this.awardContributionReward(asset.contributorId, assetId, 'POPULAR_ASSET');
    }

    this.logger.info('Community asset downloaded', {
      assetId,
      userId,
      gameId,
      downloadCount: asset.downloadCount
    });

    return asset;
  }

  /**
   * Rate a community asset
   */
  async rateAsset(
    assetId: string,
    userId: string,
    userName: string,
    rating: number,
    comment?: string
  ): Promise<boolean> {
    const asset = await this.getCommunityAsset(assetId);
    if (!asset || asset.contributorId === userId) {
      return false; // Can't rate your own assets
    }

    // Check if user already rated
    const existingRatingIndex = asset.ratings.findIndex(r => r.userId === userId);
    
    const newRating: AssetRating = {
      userId,
      userName,
      rating: Math.max(1, Math.min(5, rating)), // Clamp to 1-5
      comment,
      createdAt: new Date(),
      helpful: 0
    };

    if (existingRatingIndex !== -1) {
      // Update existing rating
      asset.ratings[existingRatingIndex] = newRating;
    } else {
      // Add new rating
      asset.ratings.push(newRating);
    }

    // Recalculate average rating
    asset.averageRating = asset.ratings.reduce((sum, r) => sum + r.rating, 0) / asset.ratings.length;

    // Update asset
    await this.updateCommunityAsset(asset);

    // Check for high rating reward
    if (asset.averageRating >= 4.0 && asset.ratings.length >= 3) {
      await this.awardContributionReward(asset.contributorId, assetId, 'HIGH_RATING');
    }

    this.logger.info('Asset rated', {
      assetId,
      userId,
      rating,
      newAverageRating: asset.averageRating
    });

    return true;
  }

  /**
   * Report an asset for inappropriate content
   */
  async reportAsset(
    assetId: string,
    reporterId: string,
    reason: string,
    details?: string
  ): Promise<boolean> {
    const asset = await this.getCommunityAsset(assetId);
    if (!asset) return false;

    asset.reportCount++;
    
    // Auto-flag if too many reports
    if (asset.reportCount >= 5 && asset.moderationStatus !== 'flagged') {
      asset.moderationStatus = 'flagged';
      asset.moderationNotes = `Auto-flagged due to ${asset.reportCount} reports`;
    }

    await this.updateCommunityAsset(asset);

    // Store report in database
    await this.storeAssetReport(assetId, reporterId, reason, details);

    this.logger.warn('Asset reported', {
      assetId,
      reporterId,
      reason,
      totalReports: asset.reportCount
    });

    return true;
  }

  /**
   * Moderate an asset (admin/moderator action)
   */
  async moderateAsset(
    assetId: string,
    moderatorId: string,
    action: ModerationAction['action'],
    reason: string,
    notes?: string
  ): Promise<boolean> {
    const asset = await this.getCommunityAsset(assetId);
    if (!asset) return false;

    // Apply moderation action
    switch (action) {
      case 'approve':
        asset.moderationStatus = 'approved';
        asset.isVerified = true;
        break;
      case 'reject':
        asset.moderationStatus = 'rejected';
        break;
      case 'flag':
        asset.moderationStatus = 'flagged';
        break;
      case 'feature':
        asset.featuredUntil = new Date(Date.now() + CommunityAssetPoolService.FEATURED_DURATION);
        break;
      case 'unfeature':
        asset.featuredUntil = undefined;
        break;
    }

    asset.moderationNotes = notes;
    await this.updateCommunityAsset(asset);

    // Log moderation action
    const moderationAction: ModerationAction = {
      assetId,
      moderatorId,
      action,
      reason,
      notes,
      timestamp: new Date()
    };
    await this.storeModerationAction(moderationAction);

    this.logger.info('Asset moderated', { assetId, action, moderatorId, reason });
    return true;
  }

  /**
   * Get featured assets
   */
  async getFeaturedAssets(limit: number = 10): Promise<CommunityAsset[]> {
    const cacheKey = `${CommunityAssetPoolService.CACHE_PREFIX}:featured:${limit}`;
    
    const cached = await this.cache.get<CommunityAsset[]>(cacheKey);
    if (cached) return cached;

    // Get assets with featuredUntil date in the future
    const allAssets = await this.getAllApprovedAssets();
    const now = new Date();
    
    const featuredAssets = allAssets
      .filter(asset => asset.featuredUntil && asset.featuredUntil > now)
      .sort((a, b) => b.downloadCount - a.downloadCount)
      .slice(0, limit);

    await this.cache.set(cacheKey, featuredAssets, 60 * 60); // 1 hour
    return featuredAssets;
  }

  /**
   * Get community analytics
   */
  async getAnalytics(): Promise<CommunityAnalytics> {
    const cacheKey = `${CommunityAssetPoolService.CACHE_PREFIX}:analytics`;
    
    const cached = await this.cache.get<CommunityAnalytics>(cacheKey);
    if (cached) return cached;

    const allAssets = await this.getAllAssets();
    const approvedAssets = allAssets.filter(a => a.moderationStatus === 'approved');

    // Calculate analytics
    const totalAssets = approvedAssets.length;
    const totalContributors = new Set(approvedAssets.map(a => a.contributorId)).size;
    const totalDownloads = approvedAssets.reduce((sum, a) => sum + a.downloadCount, 0);
    const averageRating = approvedAssets.length > 0 
      ? approvedAssets.reduce((sum, a) => sum + a.averageRating, 0) / approvedAssets.length 
      : 0;

    // Top contributors
    const contributorStats = new Map<string, { name: string; contributions: number; downloads: number }>();
    for (const asset of approvedAssets) {
      const stats = contributorStats.get(asset.contributorId) || {
        name: asset.contributorName,
        contributions: 0,
        downloads: 0
      };
      stats.contributions++;
      stats.downloads += asset.downloadCount;
      contributorStats.set(asset.contributorId, stats);
    }

    const topContributors = Array.from(contributorStats.entries())
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 10);

    // Top assets
    const topAssets = approvedAssets
      .sort((a, b) => b.downloadCount - a.downloadCount)
      .slice(0, 10)
      .map(a => ({
        assetId: a.id,
        name: a.name,
        downloads: a.downloadCount,
        rating: a.averageRating
      }));

    // Cost savings
    const costSavingsGenerated = approvedAssets.reduce((sum, asset) => 
      sum + (asset.downloadCount * asset.costToGenerate), 0
    );

    const analytics: CommunityAnalytics = {
      totalAssets,
      totalContributors,
      totalDownloads,
      averageRating,
      topContributors,
      topAssets,
      recentActivity: [], // Would be calculated from recent database activity
      moderationQueue: allAssets.filter(a => a.moderationStatus === 'pending').length,
      costSavingsGenerated
    };

    await this.cache.set(cacheKey, analytics, 60 * 60); // 1 hour
    return analytics;
  }

  /**
   * Get assets by contributor
   */
  async getContributorAssets(contributorId: string): Promise<CommunityAsset[]> {
    const cacheKey = `${CommunityAssetPoolService.CACHE_PREFIX}:contributor:${contributorId}`;
    
    const cached = await this.cache.get<CommunityAsset[]>(cacheKey);
    if (cached) return cached;

    const allAssets = await this.getAllAssets();
    const contributorAssets = allAssets.filter(a => a.contributorId === contributorId);

    await this.cache.set(cacheKey, contributorAssets, 30 * 60); // 30 minutes
    return contributorAssets;
  }

  /**
   * Clean up old reports and temporary data
   */
  async cleanup(maxAge: number = 90 * 24 * 60 * 60 * 1000): Promise<number> {
    // This would clean up old reports, expired features, etc.
    // Implementation would depend on database structure
    this.logger.info('Community asset pool cleanup initiated');
    return 0;
  }

  // Private helper methods

  private async getCommunityAsset(assetId: string): Promise<CommunityAsset | null> {
    const cacheKey = `${CommunityAssetPoolService.CACHE_PREFIX}:${assetId}`;
    
    let asset = await this.cache.get<CommunityAsset>(cacheKey);
    if (!asset) {
      asset = await this.loadAssetFromDatabase(assetId);
      if (asset) {
        await this.cache.set(cacheKey, asset, 24 * 3600);
      }
    }
    
    return asset;
  }

  private async updateCommunityAsset(asset: CommunityAsset): Promise<void> {
    asset.lastUpdated = new Date();
    
    // Update in database
    await this.storeAssetInDatabase(asset);
    
    // Update cache
    const cacheKey = `${CommunityAssetPoolService.CACHE_PREFIX}:${asset.id}`;
    await this.cache.set(cacheKey, asset, 24 * 3600);
    
    // Invalidate related caches
    await this.invalidateSearchCaches();
  }

  private generateAttribution(contributorName: string, license: AssetLicense): string {
    if (!license.requiresAttribution) return '';
    
    switch (license.type) {
      case 'CC_BY':
        return `Created by ${contributorName} (CC BY)`;
      case 'CC_BY_SA':
        return `Created by ${contributorName} (CC BY-SA)`;
      case 'CC_BY_NC':
        return `Created by ${contributorName} (CC BY-NC)`;
      default:
        return `Created by ${contributorName}`;
    }
  }

  private estimateGenerationCost(asset: Omit<AssetTemplate, 'id' | 'createdAt' | 'lastUpdated'>): number {
    // Estimate cost based on asset complexity
    const baseCosts = {
      sprite: 10,
      background: 15,
      ui: 5,
      effect: 8,
      audio: 12,
      texture: 7
    };
    
    let cost = baseCosts[asset.category] || 10;
    
    // Adjust for quality and complexity
    if (asset.metadata.quality === 'high') cost *= 1.5;
    if (asset.variations.length > 0) cost += asset.variations.length * 3;
    
    return Math.ceil(cost);
  }

  private async awardContributionReward(
    userId: string,
    assetId: string,
    rewardType: keyof typeof CommunityAssetPoolService.CONTRIBUTION_REWARDS
  ): Promise<void> {
    const rewardConfig = CommunityAssetPoolService.CONTRIBUTION_REWARDS[rewardType];
    
    const reward: ContributionReward = {
      userId,
      assetId,
      rewardType: 'credits', // Would be determined by rewardConfig
      amount: (rewardConfig as any).credits || 0,
      description: rewardConfig.description,
      awardedAt: new Date()
    };

    await this.storeContributionReward(reward);
    
    this.logger.info('Contribution reward awarded', {
      userId,
      assetId,
      rewardType,
      reward: reward.amount
    });
  }

  private generateAssetId(): string {
    return `community_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSearchCacheKey(criteria: CommunitySearchCriteria, limit: number, offset: number): string {
    const keyParts = [
      'search',
      criteria.category || 'any',
      criteria.type || 'any',
      criteria.style || 'any',
      criteria.theme || 'any',
      criteria.minRating || 'any',
      criteria.licenseType || 'any',
      criteria.sortBy || 'none',
      limit.toString(),
      offset.toString()
    ];
    
    return `${CommunityAssetPoolService.CACHE_PREFIX}:${keyParts.join(':')}`;
  }

  // Database operations (would need actual implementation)
  private async storeCommunityAsset(asset: CommunityAsset): Promise<void> {
    // Store in database
    this.logger.debug('Storing community asset in database', { assetId: asset.id });
  }

  private async storeAssetInDatabase(asset: CommunityAsset): Promise<void> {
    // Update asset in database
    this.logger.debug('Updating community asset in database', { assetId: asset.id });
  }

  private async loadAssetFromDatabase(assetId: string): Promise<CommunityAsset | null> {
    // Load from database
    this.logger.debug('Loading community asset from database', { assetId });
    return null; // Would return actual asset
  }

  private async searchDatabase(
    criteria: CommunitySearchCriteria,
    limit: number,
    offset: number
  ): Promise<{ assets: CommunityAsset[]; total: number }> {
    // Database search implementation
    return { assets: [], total: 0 };
  }

  private async getAllAssets(): Promise<CommunityAsset[]> {
    // Get all assets from database
    return [];
  }

  private async getAllApprovedAssets(): Promise<CommunityAsset[]> {
    const allAssets = await this.getAllAssets();
    return allAssets.filter(a => a.moderationStatus === 'approved');
  }

  private async storeAssetReport(
    assetId: string,
    reporterId: string,
    reason: string,
    details?: string
  ): Promise<void> {
    // Store report in database
    this.logger.debug('Storing asset report', { assetId, reporterId, reason });
  }

  private async storeModerationAction(action: ModerationAction): Promise<void> {
    // Store moderation action in database
    this.logger.debug('Storing moderation action', { action });
  }

  private async storeContributionReward(reward: ContributionReward): Promise<void> {
    // Store reward in database
    this.logger.debug('Storing contribution reward', { reward });
  }

  private async trackCostSavings(userId: string, savedAmount: number): Promise<void> {
    // Track cost savings for analytics
    this.logger.debug('Tracking cost savings', { userId, savedAmount });
  }

  private async invalidateSearchCaches(): Promise<void> {
    // Invalidate search result caches
    const searchKeys = await this.cache.keys(`${CommunityAssetPoolService.CACHE_PREFIX}:search:*`);
    for (const key of searchKeys) {
      await this.cache.delete(key);
    }
  }
}