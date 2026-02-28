import { injectable, inject } from 'inversify';
import { 
  AssetGeneratorService,
  VisualRequirements,
  GenerationOptions,
  AssetEntry,
  AssetType,
  AssetStyle,
  ColorScheme
} from '@gamevibe/asset-generator';
import { GameSpec } from '@gamevibe/shared';
import { TYPES } from '../types.js';
import { CacheService } from './cache.js';
import { Logger } from '../utils/logger.js';

@injectable()
export class AssetGeneratorServiceWrapper {
  private logger = new Logger('AssetGeneratorServiceWrapper');
  private assetGenerator: AssetGeneratorService;
  
  constructor(
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.Config) private config: any
  ) {
    // Initialize the asset generator with config
    this.assetGenerator = new AssetGeneratorService({
      openaiApiKey: config.openaiApiKey,
      storage: {
        bucket: config.assetsBucket || 'gamevibe-assets',
        region: config.awsRegion || 'us-east-1',
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
        cdnUrl: config.cdnUrl
      },
      cache: {
        redis: {
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password
        },
        ttl: {
          hot: 3600,      // 1 hour
          template: 86400, // 24 hours
          metadata: 7200   // 2 hours
        }
      },
      maxConcurrent: 3,
      defaultGenerator: 'dalle'
    }, this.logger);
  }

  async generateGameAssets(gameId: string, gameSpec: GameSpec): Promise<{
    assets: Record<string, string>;
    thumbnailUrl: string;
  }> {
    try {
      // Convert game spec to visual requirements
      const visualRequirements = this.buildVisualRequirements(gameId, gameSpec);
      
      // Check if we should use mock assets (for development)
      if (this.config.useMockAssets) {
        return this.generateMockAssets(gameSpec);
      }

      // Start asset generation job
      const job = await this.assetGenerator.generateGameAssets(
        gameId,
        visualRequirements,
        {
          quality: 'standard',
          variations: 1
        }
      );

      // Wait for job completion (with timeout)
      const completedJob = await this.waitForJob(job.id, 30000); // 30 second timeout
      
      if (!completedJob || completedJob.status !== 'completed') {
        throw new Error('Asset generation failed or timed out');
      }

      // Extract asset URLs
      const assetMap = this.buildAssetMap(completedJob.results?.assets || []);
      
      // Get thumbnail URL
      const thumbnailUrl = this.getThumbnailUrl(completedJob.results?.assets || [], gameSpec.type);

      return {
        assets: assetMap,
        thumbnailUrl
      };

    } catch (error) {
      this.logger.error('Failed to generate game assets:', error);
      // Fallback to placeholder assets
      return this.generatePlaceholderAssets(gameSpec);
    }
  }

  private buildVisualRequirements(gameId: string, gameSpec: GameSpec): VisualRequirements {
    // Map game type to visual style
    const styleMapping: Record<string, { style: AssetStyle; colorScheme: ColorScheme; theme: string }> = {
      platformer: { style: 'pixel-art', colorScheme: 'vibrant', theme: 'adventure' },
      puzzle: { style: 'cartoon', colorScheme: 'pastel', theme: 'casual' },
      rpg: { style: 'hand-drawn', colorScheme: 'dark', theme: 'fantasy' },
      shooter: { style: 'realistic', colorScheme: 'dark', theme: 'scifi' },
      'endless-runner': { style: 'cartoon', colorScheme: 'vibrant', theme: 'action' },
      'tower-defense': { style: 'cartoon', colorScheme: 'vibrant', theme: 'strategy' },
      other: { style: 'abstract', colorScheme: 'neon', theme: 'modern' }
    };

    const visual = styleMapping[gameSpec.type] || styleMapping.other;

    // Build sprite requirements based on game type
    const sprites = this.getSpriteRequirements(gameSpec);
    const backgrounds = this.getBackgroundRequirements(gameSpec);
    const ui = this.getUIRequirements(gameSpec);

    return {
      gameId,
      gameType: gameSpec.type,
      style: visual.style,
      colorScheme: visual.colorScheme,
      theme: visual.theme,
      description: gameSpec.description,
      sprites,
      backgrounds,
      ui
    };
  }

  private getSpriteRequirements(gameSpec: GameSpec) {
    const baseSprites = [
      {
        name: 'player',
        description: `Main player character for ${gameSpec.type} game`,
        size: 'medium' as const,
        animated: true,
        frameCount: 4,
        tags: ['player', 'hero', 'character']
      }
    ];

    // Add type-specific sprites
    switch (gameSpec.type) {
      case 'platformer':
        baseSprites.push(
          {
            name: 'enemy',
            description: 'Enemy character that moves and attacks',
            size: 'small' as const,
            animated: true,
            frameCount: 2,
            tags: ['enemy', 'obstacle']
          },
          {
            name: 'collectible',
            description: 'Coin or gem to collect',
            size: 'small' as const,
            animated: false,
            tags: ['item', 'collectible']
          }
        );
        break;
      
      case 'shooter':
        baseSprites.push(
          {
            name: 'enemy',
            description: 'Enemy spaceship or alien',
            size: 'medium' as const,
            animated: false,
            tags: ['enemy', 'target']
          },
          {
            name: 'projectile',
            description: 'Bullet or laser projectile',
            size: 'small' as const,
            animated: false,
            tags: ['weapon', 'projectile']
          }
        );
        break;
    }

    return baseSprites;
  }

  private getBackgroundRequirements(gameSpec: GameSpec) {
    const backgrounds = [
      {
        name: 'main-background',
        description: `${gameSpec.theme || gameSpec.type} themed game background`,
        parallax: gameSpec.type === 'platformer' || gameSpec.type === 'endless-runner',
        layers: gameSpec.type === 'platformer' ? 3 : 1
      }
    ];

    if (gameSpec.type === 'platformer' || gameSpec.type === 'rpg') {
      backgrounds.push({
        name: 'level2-background',
        description: 'Alternative background for second area',
        parallax: true,
        layers: 2
      });
    }

    return backgrounds;
  }

  private getUIRequirements(gameSpec: GameSpec) {
    return [
      {
        name: 'health-bar',
        type: 'healthbar' as const,
        description: 'Player health indicator'
      },
      {
        name: 'score-display',
        type: 'score' as const,
        description: 'Score counter display'
      },
      {
        name: 'play-button',
        type: 'button' as const,
        description: 'Start game button'
      }
    ];
  }

  private async waitForJob(jobId: string, timeout: number): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const job = await this.assetGenerator.getGenerationStatus(jobId);
      
      if (!job) {
        throw new Error('Job not found');
      }

      if (job.status === 'completed' || job.status === 'failed') {
        return job;
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Job timed out');
  }

  private buildAssetMap(assets: AssetEntry[]): Record<string, string> {
    const assetMap: Record<string, string> = {};

    for (const asset of assets) {
      // Use a consistent naming convention for game integration
      const key = `${asset.type}_${asset.name.replace(/\.[^.]+$/, '')}`;
      assetMap[key] = asset.url;

      // Also add thumbnail versions if available
      if (asset.thumbnailUrl) {
        assetMap[`${key}_thumb`] = asset.thumbnailUrl;
      }

      // Add size variants if available
      if (asset.metadata?.variants) {
        for (const [size, url] of Object.entries(asset.metadata.variants)) {
          assetMap[`${key}_${size}`] = url as string;
        }
      }
    }

    return assetMap;
  }

  private getThumbnailUrl(assets: AssetEntry[], gameType: string): string {
    // Try to find the main background thumbnail
    const backgroundThumb = assets.find(
      a => a.type === 'background' && a.thumbnailUrl
    )?.thumbnailUrl;

    if (backgroundThumb) return backgroundThumb;

    // Fall back to player sprite thumbnail
    const playerThumb = assets.find(
      a => a.type === 'sprite' && a.name.includes('player') && a.thumbnailUrl
    )?.thumbnailUrl;

    if (playerThumb) return playerThumb;

    // Use first available thumbnail
    const anyThumb = assets.find(a => a.thumbnailUrl)?.thumbnailUrl;
    if (anyThumb) return anyThumb;

    // Fallback to placeholder
    return `https://gamevibe.ai/assets/thumbnails/${gameType}-placeholder.png`;
  }

  private generateMockAssets(gameSpec: GameSpec): {
    assets: Record<string, string>;
    thumbnailUrl: string;
  } {
    const baseUrl = 'https://gamevibe.ai/assets/mock';
    
    return {
      assets: {
        sprite_player: `${baseUrl}/sprites/player.png`,
        sprite_enemy: `${baseUrl}/sprites/enemy.png`,
        sprite_collectible: `${baseUrl}/sprites/coin.png`,
        background_main: `${baseUrl}/backgrounds/${gameSpec.type}.png`,
        ui_health_bar: `${baseUrl}/ui/health.png`,
        ui_score_display: `${baseUrl}/ui/score.png`
      },
      thumbnailUrl: `${baseUrl}/thumbnails/${gameSpec.type}.png`
    };
  }

  private generatePlaceholderAssets(gameSpec: GameSpec): {
    assets: Record<string, string>;
    thumbnailUrl: string;
  } {
    const placeholderUrl = 'https://via.placeholder.com';
    
    return {
      assets: {
        sprite_player: `${placeholderUrl}/64x64/0088cc/ffffff?text=Player`,
        sprite_enemy: `${placeholderUrl}/64x64/cc0000/ffffff?text=Enemy`,
        sprite_collectible: `${placeholderUrl}/32x32/ffcc00/000000?text=Coin`,
        background_main: `${placeholderUrl}/800x600/333333/ffffff?text=${gameSpec.type}`,
        ui_health_bar: `${placeholderUrl}/200x20/00cc00/ffffff?text=Health`,
        ui_score_display: `${placeholderUrl}/100x30/000000/ffffff?text=Score`
      },
      thumbnailUrl: `${placeholderUrl}/400x300/666666/ffffff?text=${gameSpec.name}`
    };
  }

  async cleanup(): Promise<void> {
    await this.assetGenerator.cleanup();
  }
}