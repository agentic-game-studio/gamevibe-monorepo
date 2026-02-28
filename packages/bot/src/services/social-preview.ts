import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { AnalyticsService } from './analytics.js';
import { AssetService } from './asset.js';
import { Client } from 'discord.js';

export interface SocialPreviewCard {
  id: string;
  gameId: string;
  title: string;
  description: string;
  imageUrl: string;
  gifUrl?: string;
  metadata: SocialPreviewMetadata;
  createdAt: Date;
  expiresAt: Date;
}

export interface SocialPreviewMetadata {
  gameTitle: string;
  gameType: string;
  creatorName: string;
  creatorAvatar?: string;
  serverName: string;
  playCount: number;
  serverCount: number;
  rating?: number;
  tags: string[];
  dimensions: {
    width: number;
    height: number;
  };
  socialPlatform: 'twitter' | 'facebook' | 'discord' | 'generic';
  template: string;
}

export interface GameplayGIF {
  id: string;
  gameId: string;
  gifUrl: string;
  thumbnailUrl: string;
  duration: number;
  fileSize: number;
  frames: number;
  resolution: {
    width: number;
    height: number;
  };
  createdAt: Date;
  metadata: Record<string, any>;
}

export interface PreviewCardTemplate {
  name: string;
  platform: 'twitter' | 'facebook' | 'discord' | 'generic';
  dimensions: { width: number; height: number };
  elements: PreviewElement[];
}

export interface PreviewElement {
  type: 'text' | 'image' | 'background' | 'badge' | 'stat';
  position: { x: number; y: number };
  size: { width: number; height: number };
  style: Record<string, any>;
  content?: string;
  source?: string;
}

@injectable()
export class SocialPreviewService {
  private readonly CACHE_TTL = {
    PREVIEW_CARD: 3600, // 1 hour for preview cards
    GAMEPLAY_GIF: 7200, // 2 hours for gameplay GIFs
    TEMPLATES: 86400 // 24 hours for templates
  };

  private readonly GIF_SETTINGS = {
    DURATION: 5, // 5 seconds
    FPS: 10, // 10 frames per second
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB max
    RESOLUTION: {
      width: 640,
      height: 360
    }
  };

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.AssetService) private assetService: AssetService,
    @inject(TYPES.DiscordClient) private client: Client
  ) {}

  /**
   * Generate a social preview card for a game
   */
  async generatePreviewCard(
    gameId: string,
    platform: 'twitter' | 'facebook' | 'discord' | 'generic' = 'generic',
    includeGIF: boolean = false
  ): Promise<SocialPreviewCard> {
    const cacheKey = `preview_card:${gameId}:${platform}:${includeGIF}`;
    const cached = await this.cache.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Get game data
      const game = await this.getGameWithStats(gameId);
      if (!game) {
        throw new Error(`Game ${gameId} not found`);
      }

      // Get or generate gameplay GIF if requested
      let gifUrl: string | undefined;
      if (includeGIF) {
        const gif = await this.getOrGenerateGameplayGIF(gameId);
        gifUrl = gif?.gifUrl;
      }

      // Generate preview image
      const imageUrl = await this.generatePreviewImage(game, platform);

      // Create preview card
      const previewCard: SocialPreviewCard = {
        id: this.generatePreviewId(),
        gameId,
        title: this.generatePreviewTitle(game),
        description: this.generatePreviewDescription(game),
        imageUrl,
        gifUrl,
        metadata: {
          gameTitle: game.title,
          gameType: game.type,
          creatorName: game.metadata?.creatorName || 'Unknown Creator',
          creatorAvatar: game.metadata?.creatorAvatar,
          serverName: game.server?.name || 'Unknown Server',
          playCount: game.gameTracking?.totalPlays || 0,
          serverCount: game.gameTracking?.uniqueServers || 1,
          rating: this.calculateGameRating(game),
          tags: this.extractGameTags(game),
          dimensions: this.getPlatformDimensions(platform),
          socialPlatform: platform,
          template: this.getTemplateForPlatform(platform)
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };

      // Cache the preview card
      await this.cache.set(cacheKey, JSON.stringify(previewCard), this.CACHE_TTL.PREVIEW_CARD);

      // Track analytics
      await this.analytics.track('social_preview_generated', {
        gameId,
        platform,
        includeGIF,
        playCount: previewCard.metadata.playCount
      });

      return previewCard;

    } catch (error) {
      console.error('Error generating preview card:', error);
      throw error;
    }
  }

  /**
   * Generate or retrieve existing gameplay GIF
   */
  async getOrGenerateGameplayGIF(gameId: string): Promise<GameplayGIF | null> {
    const cacheKey = `gameplay_gif:${gameId}`;
    const cached = await this.cache.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Check if we already have a GIF for this game
      const existingGIF = await this.findExistingGameplayGIF(gameId);
      if (existingGIF) {
        await this.cache.set(cacheKey, JSON.stringify(existingGIF), this.CACHE_TTL.GAMEPLAY_GIF);
        return existingGIF;
      }

      // Generate new GIF
      const newGIF = await this.generateGameplayGIF(gameId);
      if (newGIF) {
        await this.cache.set(cacheKey, JSON.stringify(newGIF), this.CACHE_TTL.GAMEPLAY_GIF);
      }

      return newGIF;

    } catch (error) {
      console.error('Error getting/generating gameplay GIF:', error);
      return null;
    }
  }

  /**
   * Generate actual gameplay GIF (placeholder implementation)
   */
  private async generateGameplayGIF(gameId: string): Promise<GameplayGIF | null> {
    try {
      // This would integrate with the web runtime to capture gameplay
      // For now, we'll create a placeholder implementation
      
      const game = await this.getGameWithStats(gameId);
      if (!game) return null;

      // In a real implementation, this would:
      // 1. Launch the game in a headless browser
      // 2. Simulate gameplay interactions
      // 3. Record screen capture
      // 4. Convert to optimized GIF
      // 5. Upload to storage

      // Placeholder: Generate a static preview image as GIF
      const gifUrl = await this.generateStaticGamePreview(game);
      
      const gameplayGIF: GameplayGIF = {
        id: this.generateGIFId(),
        gameId,
        gifUrl,
        thumbnailUrl: gifUrl, // Same as GIF for now
        duration: this.GIF_SETTINGS.DURATION,
        fileSize: 2 * 1024 * 1024, // Placeholder 2MB
        frames: this.GIF_SETTINGS.DURATION * this.GIF_SETTINGS.FPS,
        resolution: this.GIF_SETTINGS.RESOLUTION,
        createdAt: new Date(),
        metadata: {
          generated: true,
          gameType: game.type,
          gameTitle: game.title
        }
      };

      // Store GIF metadata in database
      await this.storeGameplayGIF(gameplayGIF);

      return gameplayGIF;

    } catch (error) {
      console.error('Error generating gameplay GIF:', error);
      return null;
    }
  }

  /**
   * Generate preview image for social sharing
   */
  private async generatePreviewImage(game: any, platform: string): Promise<string> {
    try {
      // Get template for platform
      const template = await this.getPreviewTemplate(platform);
      
      // In a real implementation, this would use a service like Canvas or Puppeteer
      // to generate custom preview images with game data overlay
      
      // For now, return a placeholder or existing game image
      if (game.metadata?.thumbnailUrl) {
        return game.metadata.thumbnailUrl;
      }

      // Generate a simple text-based preview using the asset service
      const previewPrompt = `Create a vibrant game preview image for "${game.title}", a ${game.type} game. ` +
                           `Include the game title, type, and make it visually appealing for social media sharing.`;
      
      const assetResult = await this.assetService.generateAsset({
        type: 'background',
        prompt: previewPrompt,
        style: 'vibrant',
        dimensions: this.getPlatformDimensions(platform)
      });

      return assetResult.url;

    } catch (error) {
      console.error('Error generating preview image:', error);
      // Return a default placeholder image
      return this.getDefaultPreviewImage(platform);
    }
  }

  /**
   * Get OpenGraph metadata for a game
   */
  async getOpenGraphMetadata(gameId: string): Promise<Record<string, string>> {
    const previewCard = await this.generatePreviewCard(gameId, 'generic', true);
    
    return {
      'og:title': previewCard.title,
      'og:description': previewCard.description,
      'og:image': previewCard.imageUrl,
      'og:image:width': previewCard.metadata.dimensions.width.toString(),
      'og:image:height': previewCard.metadata.dimensions.height.toString(),
      'og:type': 'game',
      'og:site_name': 'GameVibe AI',
      'twitter:card': 'summary_large_image',
      'twitter:title': previewCard.title,
      'twitter:description': previewCard.description,
      'twitter:image': previewCard.imageUrl,
      'twitter:creator': `@${previewCard.metadata.creatorName}`,
      'game:type': previewCard.metadata.gameType,
      'game:plays': previewCard.metadata.playCount.toString(),
      'game:servers': previewCard.metadata.serverCount.toString()
    };
  }

  /**
   * Get Twitter Card metadata
   */
  async getTwitterCardMetadata(gameId: string): Promise<Record<string, string>> {
    const previewCard = await this.generatePreviewCard(gameId, 'twitter', true);
    
    return {
      'twitter:card': previewCard.gifUrl ? 'player' : 'summary_large_image',
      'twitter:title': previewCard.title,
      'twitter:description': previewCard.description,
      'twitter:image': previewCard.imageUrl,
      'twitter:player': previewCard.gifUrl || previewCard.imageUrl,
      'twitter:player:width': previewCard.metadata.dimensions.width.toString(),
      'twitter:player:height': previewCard.metadata.dimensions.height.toString(),
      'twitter:creator': `@${previewCard.metadata.creatorName}`
    };
  }

  /**
   * Generate shareable preview URL
   */
  generateShareableURL(gameId: string, platform: string = 'generic'): string {
    const baseUrl = process.env.WEB_RUNTIME_URL || 'http://localhost:3001';
    return `${baseUrl}/preview/${gameId}?platform=${platform}`;
  }

  /**
   * Get preview analytics
   */
  async getPreviewAnalytics(gameId: string, timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    views: number;
    shares: number;
    platforms: Record<string, number>;
    engagement: number;
  }> {
    try {
      // This would integrate with analytics service to get preview metrics
      const cacheKey = `preview_analytics:${gameId}:${timeframe}`;
      const cached = await this.cache.get<string>(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Placeholder analytics data
      const analytics = {
        views: Math.floor(Math.random() * 1000) + 100,
        shares: Math.floor(Math.random() * 50) + 10,
        platforms: {
          twitter: Math.floor(Math.random() * 30) + 5,
          facebook: Math.floor(Math.random() * 20) + 3,
          discord: Math.floor(Math.random() * 40) + 8,
          generic: Math.floor(Math.random() * 10) + 2
        },
        engagement: Math.random() * 0.15 + 0.05 // 5-20% engagement rate
      };

      await this.cache.set(cacheKey, JSON.stringify(analytics), 300); // 5 minutes

      return analytics;

    } catch (error) {
      console.error('Error getting preview analytics:', error);
      return {
        views: 0,
        shares: 0,
        platforms: {},
        engagement: 0
      };
    }
  }

  /**
   * Private helper methods
   */
  private async getGameWithStats(gameId: string): Promise<any> {
    return await this.db.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        gameTracking: true,
        server: {
          select: {
            name: true,
            discordId: true
          }
        }
      }
    });
  }

  private async findExistingGameplayGIF(gameId: string): Promise<GameplayGIF | null> {
    // This would query a GIFs table in the database
    // For now, return null to always generate new
    return null;
  }

  private async storeGameplayGIF(gif: GameplayGIF): Promise<void> {
    // This would store GIF metadata in database
    console.log(`Storing gameplay GIF metadata for game ${gif.gameId}`);
  }

  private async generateStaticGamePreview(game: any): Promise<string> {
    // Generate a static preview image that represents the game
    const prompt = `Create a game preview for "${game.title}", a ${game.type} game. ` +
                  `Make it look like a screenshot from gameplay with UI elements.`;
    
    try {
      const assetResult = await this.assetService.generateAsset({
        type: 'screenshot',
        prompt,
        style: 'game-ui',
        dimensions: this.GIF_SETTINGS.RESOLUTION
      });
      
      return assetResult.url;
    } catch (error) {
      console.error('Error generating static preview:', error);
      return this.getDefaultPreviewImage('generic');
    }
  }

  private async getPreviewTemplate(platform: string): Promise<PreviewCardTemplate> {
    // Return template configuration for the platform
    const templates = await this.getPreviewTemplates();
    return templates[platform] || templates['generic'];
  }

  private async getPreviewTemplates(): Promise<Record<string, PreviewCardTemplate>> {
    const cacheKey = 'preview_templates';
    const cached = await this.cache.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const templates = {
      twitter: {
        name: 'Twitter Card',
        platform: 'twitter',
        dimensions: { width: 1200, height: 675 },
        elements: []
      },
      facebook: {
        name: 'Facebook Share',
        platform: 'facebook', 
        dimensions: { width: 1200, height: 630 },
        elements: []
      },
      discord: {
        name: 'Discord Embed',
        platform: 'discord',
        dimensions: { width: 800, height: 450 },
        elements: []
      },
      generic: {
        name: 'Generic Social',
        platform: 'generic',
        dimensions: { width: 1200, height: 630 },
        elements: []
      }
    } as Record<string, PreviewCardTemplate>;

    await this.cache.set(cacheKey, JSON.stringify(templates), this.CACHE_TTL.TEMPLATES);
    return templates;
  }

  private generatePreviewTitle(game: any): string {
    const playCount = game.gameTracking?.totalPlays || 0;
    const serverCount = game.gameTracking?.uniqueServers || 1;
    
    return `🎮 ${game.title} - ${playCount} plays across ${serverCount} servers!`;
  }

  private generatePreviewDescription(game: any): string {
    const creator = game.metadata?.creatorName || 'Unknown Creator';
    const type = game.type;
    
    return `Amazing ${type} game created by ${creator}. ` +
           `${game.description || 'Experience this incredible game'} ` +
           `Play now on GameVibe AI!`;
  }

  private calculateGameRating(game: any): number {
    // Calculate a rating based on play count, server reach, etc.
    const plays = game.gameTracking?.totalPlays || 0;
    const servers = game.gameTracking?.uniqueServers || 1;
    const age = Date.now() - new Date(game.createdAt).getTime();
    const ageInDays = age / (1000 * 60 * 60 * 24);
    
    // Simple rating algorithm
    let rating = 3.0; // Base rating
    rating += Math.min(plays / 100, 1.5); // Up to 1.5 points for plays
    rating += Math.min(servers / 10, 0.5); // Up to 0.5 points for server reach
    rating -= Math.min(ageInDays / 30, 0.5); // Small penalty for age
    
    return Math.max(1.0, Math.min(5.0, rating));
  }

  private extractGameTags(game: any): string[] {
    const tags = [game.type];
    
    if (game.metadata?.tags) {
      tags.push(...game.metadata.tags);
    }
    
    // Add automatic tags based on stats
    const plays = game.gameTracking?.totalPlays || 0;
    if (plays > 1000) tags.push('Popular');
    if (plays > 100) tags.push('Trending');
    if ((game.gameTracking?.uniqueServers || 1) > 5) tags.push('Viral');
    
    return [...new Set(tags)];
  }

  private getPlatformDimensions(platform: string): { width: number; height: number } {
    const dimensions = {
      twitter: { width: 1200, height: 675 },
      facebook: { width: 1200, height: 630 },
      discord: { width: 800, height: 450 },
      generic: { width: 1200, height: 630 }
    };
    
    return dimensions[platform as keyof typeof dimensions] || dimensions.generic;
  }

  private getTemplateForPlatform(platform: string): string {
    return `${platform}-card-v1`;
  }

  private getDefaultPreviewImage(platform: string): string {
    return `https://via.placeholder.com/${this.getPlatformDimensions(platform).width}x${this.getPlatformDimensions(platform).height}/5865F2/FFFFFF?text=GameVibe+AI`;
  }

  private generatePreviewId(): string {
    return `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateGIFId(): string {
    return `gif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}