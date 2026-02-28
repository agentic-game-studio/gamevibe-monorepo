import { AssetEntry, AssetType } from '../types/index.js';
import { AssetLibraryManager, AssetSearchCriteria } from './manager.js';
import { Logger } from '@gamevibe/shared';

export interface AssetBrowserConfig {
  libraryManager: AssetLibraryManager;
  logger: Logger;
  pageSize?: number;
}

export interface BrowseOptions {
  gameId?: string;
  type?: AssetType;
  tags?: string[];
  sortBy?: 'name' | 'date' | 'size' | 'type';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  searchTerm?: string;
}

export interface BrowseResult {
  assets: AssetEntry[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalAssets: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  filters: {
    availableTypes: AssetType[];
    availableTags: string[];
  };
}

export class AssetBrowser {
  private libraryManager: AssetLibraryManager;
  private logger: Logger;
  private pageSize: number;
  private cache: Map<string, BrowseResult> = new Map();

  constructor(config: AssetBrowserConfig) {
    this.libraryManager = config.libraryManager;
    this.logger = config.logger;
    this.pageSize = config.pageSize || 20;
  }

  async browse(options: BrowseOptions = {}): Promise<BrowseResult> {
    const page = options.page || 1;
    const cacheKey = this.getCacheKey(options);

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Build search criteria
    const criteria: AssetSearchCriteria = {
      gameId: options.gameId,
      type: options.type,
      tags: options.tags,
      limit: this.pageSize,
      offset: (page - 1) * this.pageSize
    };

    // Search assets
    const { assets, total, hasMore } = await this.libraryManager.searchAssets(criteria);

    // Apply client-side filtering if search term provided
    let filteredAssets = assets;
    if (options.searchTerm) {
      const searchLower = options.searchTerm.toLowerCase();
      filteredAssets = assets.filter(asset =>
        asset.name.toLowerCase().includes(searchLower) ||
        asset.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Sort assets
    const sortedAssets = this.sortAssets(filteredAssets, options.sortBy, options.sortOrder);

    // Calculate pagination
    const totalPages = Math.ceil(total / this.pageSize);
    const pagination = {
      page,
      pageSize: this.pageSize,
      totalPages,
      totalAssets: total,
      hasNext: hasMore || page < totalPages,
      hasPrevious: page > 1
    };

    // Extract available filters
    const filters = this.extractFilters(assets);

    const result: BrowseResult = {
      assets: sortedAssets,
      pagination,
      filters
    };

    // Cache result
    this.cache.set(cacheKey, result);
    
    // Clear cache after 5 minutes
    setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

    return result;
  }

  async getAssetDetails(gameId: string, assetId: string): Promise<{
    asset: AssetEntry | null;
    related: AssetEntry[];
    collections: string[];
  }> {
    const asset = await this.libraryManager.getAsset(gameId, assetId);
    if (!asset) {
      return { asset: null, related: [], collections: [] };
    }

    // Find related assets (same type and style)
    const related = await this.findRelatedAssets(asset, gameId);

    // Find collections containing this asset
    const collections = await this.findAssetCollections(assetId);

    return { asset, related, collections };
  }

  async getAssetPreviewUrl(asset: AssetEntry): Promise<string> {
    // Return thumbnail if available, otherwise main URL
    return asset.thumbnailUrl || asset.url;
  }

  async getAssetDownloadUrl(asset: AssetEntry, variant?: string): Promise<string> {
    if (variant && asset.metadata?.variants?.[variant]) {
      return asset.metadata.variants[variant];
    }
    return asset.url;
  }

  formatAssetSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  formatAssetDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    return date.toLocaleDateString();
  }

  private sortAssets(
    assets: AssetEntry[],
    sortBy: BrowseOptions['sortBy'] = 'date',
    sortOrder: BrowseOptions['sortOrder'] = 'desc'
  ): AssetEntry[] {
    const sorted = [...assets];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'size':
          comparison = a.sizeBytes - b.sizeBytes;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }

  private extractFilters(assets: AssetEntry[]): BrowseResult['filters'] {
    const types = new Set<AssetType>();
    const tags = new Set<string>();

    for (const asset of assets) {
      types.add(asset.type);
      asset.tags.forEach(tag => tags.add(tag));
    }

    return {
      availableTypes: Array.from(types),
      availableTags: Array.from(tags).sort()
    };
  }

  private getCacheKey(options: BrowseOptions): string {
    return JSON.stringify({
      gameId: options.gameId,
      type: options.type,
      tags: options.tags,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      page: options.page,
      searchTerm: options.searchTerm
    });
  }

  private async findRelatedAssets(
    asset: AssetEntry,
    gameId: string,
    limit: number = 5
  ): Promise<AssetEntry[]> {
    const { assets } = await this.libraryManager.searchAssets({
      gameId,
      type: asset.type,
      tags: asset.tags,
      limit: limit + 1 // Get one extra to exclude current asset
    });

    return assets
      .filter(a => a.id !== asset.id)
      .slice(0, limit);
  }

  private async findAssetCollections(assetId: string): Promise<string[]> {
    // TODO: Implement collection search
    // This would query collections containing the asset
    return [];
  }

  async exportBrowseResults(
    options: BrowseOptions,
    format: 'csv' | 'json' = 'json'
  ): Promise<string> {
    const allAssets: AssetEntry[] = [];
    let page = 1;
    let hasMore = true;

    // Fetch all pages
    while (hasMore) {
      const result = await this.browse({ ...options, page });
      allAssets.push(...result.assets);
      hasMore = result.pagination.hasNext;
      page++;
    }

    if (format === 'json') {
      return JSON.stringify(allAssets, null, 2);
    }

    // CSV format
    const headers = ['ID', 'Name', 'Type', 'Size', 'Created', 'Tags'];
    const rows = allAssets.map(asset => [
      asset.id,
      asset.name,
      asset.type,
      this.formatAssetSize(asset.sizeBytes),
      asset.createdAt.toISOString(),
      asset.tags.join(', ')
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
  }
}