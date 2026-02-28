import { 
  VisualRequirements, 
  GenerationOptions, 
  GenerationResult, 
  GenerationJob,
  AssetManifest,
  AssetEntry,
  AssetType,
  StorageConfig,
  CacheConfig
} from './types/index.js';
import { BaseAssetGenerator } from './generators/base.js';
import { DalleGenerator } from './generators/dalle.js';
import { S3Storage } from './storage/s3.js';
import { AssetCache } from './storage/cache.js';
import { Logger } from '@gamevibe/shared';
import { nanoid } from 'nanoid';
import PQueue from 'p-queue';
import { ImageOptimizer } from './processors/optimizer.js';
import { SpriteSheetGenerator } from './processors/sprite-sheet.js';
import { ImageFormatter } from './processors/formatter.js';
import { AssetLibraryManager } from './library/manager.js';
import { AssetBrowser } from './library/browser.js';

export interface AssetGeneratorConfig {
  openaiApiKey?: string;
  stableDiffusionApiKey?: string;
  storage: StorageConfig;
  cache: CacheConfig;
  maxConcurrent?: number;
  defaultGenerator?: 'dalle' | 'stable-diffusion';
}

export class AssetGeneratorService {
  private generators: Map<string, BaseAssetGenerator> = new Map();
  private storage: S3Storage;
  private cache: AssetCache;
  private logger: Logger;
  private queue: PQueue;
  private defaultGenerator: string;
  private imageOptimizer: ImageOptimizer;
  private spriteSheetGenerator: SpriteSheetGenerator;
  private imageFormatter: ImageFormatter;
  private libraryManager: AssetLibraryManager;
  private assetBrowser: AssetBrowser;

  constructor(config: AssetGeneratorConfig, logger: Logger) {
    this.logger = logger;
    this.storage = new S3Storage(config.storage);
    this.cache = new AssetCache(config.cache, logger);
    this.queue = new PQueue({ concurrency: config.maxConcurrent || 3 });
    this.defaultGenerator = config.defaultGenerator || 'dalle';
    
    // Initialize processors
    this.imageOptimizer = new ImageOptimizer(logger);
    this.spriteSheetGenerator = new SpriteSheetGenerator(logger);
    this.imageFormatter = new ImageFormatter(logger);
    
    // Initialize library
    this.libraryManager = new AssetLibraryManager({
      storage: this.storage,
      cache: this.cache,
      logger
    });
    
    this.assetBrowser = new AssetBrowser({
      libraryManager: this.libraryManager,
      logger
    });

    // Initialize generators
    if (config.openaiApiKey) {
      this.generators.set('dalle', new DalleGenerator(config.openaiApiKey, logger));
    }

    if (config.stableDiffusionApiKey) {
      // Stable Diffusion generator would be added here
      // this.generators.set('stable-diffusion', new StableDiffusionGenerator(config.stableDiffusionApiKey, logger));
    }

    if (this.generators.size === 0) {
      throw new Error('No asset generators configured');
    }

    logger.info(`Asset generator service initialized with ${this.generators.size} generators`);
  }

  async generateGameAssets(
    gameId: string,
    requirements: VisualRequirements,
    options?: GenerationOptions
  ): Promise<GenerationJob> {
    const jobId = nanoid();
    const job: GenerationJob = {
      id: jobId,
      gameId,
      status: 'pending',
      progress: 0,
      totalAssets: this.countRequiredAssets(requirements),
      completedAssets: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store job in cache
    await this.cache.setGenerationJob(job);

    // Start async generation
    this.processGenerationJob(job, requirements, options).catch(error => {
      this.logger.error(`Generation job ${jobId} failed:`, error);
    });

    return job;
  }

  private async processGenerationJob(
    job: GenerationJob,
    requirements: VisualRequirements,
    options?: GenerationOptions
  ): Promise<void> {
    try {
      // Update job status
      job.status = 'processing';
      await this.cache.updateGenerationJob(job.id, { status: 'processing' });

      // Check cache first
      const cachedManifest = await this.cache.getManifest(job.gameId);
      if (cachedManifest && cachedManifest.status === 'complete') {
        job.status = 'completed';
        job.results = {
          success: true,
          assets: this.extractAssetsFromManifest(cachedManifest),
          duration: 0
        };
        await this.cache.updateGenerationJob(job.id, job);
        return;
      }

      // Select generator
      const generator = this.selectGenerator();
      if (!generator) {
        throw new Error('No available generator');
      }

      // Generate assets
      const result = await generator.generateAssets(requirements, options);

      // Process and upload assets
      const uploadedAssets = await this.uploadAssets(job.gameId, result.assets);

      // Create manifest
      const manifest: AssetManifest = {
        version: 1,
        generatedAt: new Date(),
        status: 'complete',
        generator: this.defaultGenerator as any,
        manifest: {
          sprites: uploadedAssets.filter(a => a.type === 'sprite'),
          backgrounds: uploadedAssets.filter(a => a.type === 'background'),
          ui: uploadedAssets.filter(a => a.type === 'ui'),
          effects: uploadedAssets.filter(a => a.type === 'effect')
        },
        metadata: {
          style: requirements.style,
          colorPalette: [], // Could extract from generated images
          theme: requirements.theme,
          totalAssets: uploadedAssets.length,
          generationTime: result.duration
        }
      };

      // Cache manifest and warm asset cache
      await this.cache.setManifest(job.gameId, manifest);
      await this.cache.warmCache(job.gameId, uploadedAssets);

      // Update job
      job.status = 'completed';
      job.completedAssets = uploadedAssets.length;
      job.progress = 100;
      job.results = {
        ...result,
        assets: uploadedAssets
      };
      await this.cache.updateGenerationJob(job.id, job);

      this.logger.info(`Generation job ${job.id} completed with ${uploadedAssets.length} assets`);

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      await this.cache.updateGenerationJob(job.id, job);
      throw error;
    }
  }

  private async uploadAssets(gameId: string, assets: AssetEntry[]): Promise<AssetEntry[]> {
    const uploadedAssets: AssetEntry[] = [];

    for (const asset of assets) {
      try {
        // Download from temporary URL (DALL-E URL)
        const response = await fetch(asset.url);
        const buffer = Buffer.from(await response.arrayBuffer());

        // Optimize image before upload
        const { optimized, metadata } = await this.imageOptimizer.optimizeImage(
          buffer,
          asset.type,
          {
            format: asset.type === 'sprite' ? 'png' : 'webp',
            preserveAspectRatio: true
          }
        );

        // Generate multiple sizes for sprites
        let sizeVariants: Map<string, { buffer: Buffer; metadata: any }> | undefined;
        if (asset.type === 'sprite') {
          sizeVariants = await this.imageOptimizer.generateMultipleSizes(
            buffer,
            asset.type,
            { generateSizes: [1, 2] }
          );
        }

        // Upload main asset
        const mainKey = this.storage.buildAssetKey(gameId, asset.type, asset.name);
        const url = await this.storage.uploadAsset(
          gameId,
          asset.type,
          asset.name,
          optimized,
          {
            originalSize: buffer.length.toString(),
            optimizedSize: optimized.length.toString(),
            compressionRatio: metadata.compressionRatio.toFixed(2)
          }
        );

        // Generate and upload thumbnail
        const thumbnail = await this.imageOptimizer.createThumbnail(buffer, 256);
        const thumbnailName = `thumb_${asset.name.replace(/\.[^.]+$/, '.webp')}`;
        const thumbnailUrl = await this.storage.uploadAsset(
          gameId,
          asset.type,
          thumbnailName,
          thumbnail
        );

        // Upload size variants if available
        const variants: Record<string, string> = {};
        if (sizeVariants) {
          for (const [size, { buffer: variantBuffer }] of sizeVariants.entries()) {
            const variantName = `${asset.name.replace(/\.[^.]+$/, '')}_${size}.${metadata.format}`;
            const variantUrl = await this.storage.uploadAsset(
              gameId,
              asset.type,
              variantName,
              variantBuffer
            );
            variants[size] = variantUrl;
          }
        }

        // Update asset with S3 URLs
        const uploadedAsset: AssetEntry = {
          ...asset,
          url,
          thumbnailUrl,
          dimensions: {
            width: metadata.width,
            height: metadata.height
          },
          format: metadata.format as any,
          sizeBytes: optimized.length,
          metadata: {
            ...asset.metadata,
            variants,
            compressionRatio: metadata.compressionRatio
          }
        };

        uploadedAssets.push(uploadedAsset);
        
        // Add to library
        await this.libraryManager.addAsset(gameId, uploadedAsset);
      } catch (error) {
        this.logger.error(`Failed to upload asset ${asset.name}:`, error);
      }
    }

    return uploadedAssets;
  }

  async getGenerationStatus(jobId: string): Promise<GenerationJob | null> {
    return this.cache.getGenerationJob(jobId);
  }

  async getGameAssets(gameId: string): Promise<AssetManifest | null> {
    // Check cache first
    const cached = await this.cache.getManifest(gameId);
    if (cached) return cached;

    // TODO: Check database if not in cache
    return null;
  }

  async regenerateAssets(
    gameId: string,
    assetIds: string[],
    requirements: VisualRequirements,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const generator = this.selectGenerator();
    if (!generator) {
      throw new Error('No available generator');
    }

    const assets: AssetEntry[] = [];
    const errors: string[] = [];
    
    // Filter requirements to only regenerate specified assets
    const filteredRequirements: VisualRequirements = {
      ...requirements,
      sprites: requirements.sprites.filter(s => assetIds.includes(s.name)),
      backgrounds: requirements.backgrounds.filter(b => assetIds.includes(b.name)),
      ui: requirements.ui?.filter(u => assetIds.includes(u.name)),
      effects: requirements.effects?.filter(e => assetIds.includes(e.name))
    };

    const result = await generator.generateAssets(filteredRequirements, options);
    
    if (result.success && result.assets.length > 0) {
      const uploadedAssets = await this.uploadAssets(gameId, result.assets);
      
      // Update cache
      await this.cache.warmCache(gameId, uploadedAssets);
      
      return {
        ...result,
        assets: uploadedAssets
      };
    }

    return result;
  }

  async generateSingleAsset(
    type: AssetType,
    prompt: string,
    options?: GenerationOptions
  ): Promise<AssetEntry> {
    const generator = this.selectGenerator();
    if (!generator) {
      throw new Error('No available generator');
    }

    return generator.generateSingleAsset(type, prompt, options);
  }

  async estimateCost(
    requirements: VisualRequirements,
    options?: GenerationOptions
  ): Promise<{ credits: number; dollarAmount: number }> {
    const generator = this.selectGenerator();
    if (!generator) {
      throw new Error('No available generator');
    }

    return generator.estimateCost(requirements, options);
  }

  private selectGenerator(): BaseAssetGenerator | undefined {
    // For now, return the default generator
    return this.generators.get(this.defaultGenerator);
  }

  private countRequiredAssets(requirements: VisualRequirements): number {
    let count = requirements.sprites.length + requirements.backgrounds.length;
    
    if (requirements.ui) {
      count += requirements.ui.length;
    }
    
    if (requirements.effects) {
      count += requirements.effects.length;
    }
    
    return count;
  }

  private extractAssetsFromManifest(manifest: AssetManifest): AssetEntry[] {
    return [
      ...manifest.manifest.sprites,
      ...manifest.manifest.backgrounds,
      ...manifest.manifest.ui,
      ...manifest.manifest.effects
    ];
  }

  async getCacheStats() {
    return this.cache.getCacheStats();
  }

  // Library access methods
  getLibraryManager(): AssetLibraryManager {
    return this.libraryManager;
  }

  getAssetBrowser(): AssetBrowser {
    return this.assetBrowser;
  }

  async browseAssets(options: Parameters<AssetBrowser['browse']>[0]) {
    return this.assetBrowser.browse(options);
  }

  async getAssetDetails(gameId: string, assetId: string) {
    return this.assetBrowser.getAssetDetails(gameId, assetId);
  }

  async createAssetCollection(
    name: string,
    assets: AssetEntry[],
    metadata: Parameters<AssetLibraryManager['createCollection']>[2]
  ) {
    return this.libraryManager.createCollection(name, assets, metadata);
  }

  async createAssetTemplate(
    name: string,
    type: AssetType,
    baseAsset: AssetEntry,
    parameters: Parameters<AssetLibraryManager['createTemplate']>[3]
  ) {
    return this.libraryManager.createTemplate(name, type, baseAsset, parameters);
  }

  async cleanup(): Promise<void> {
    await this.cache.disconnect();
  }
}