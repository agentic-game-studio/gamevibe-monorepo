import { injectable, inject } from 'inversify';
import { DatabaseService } from './database.js';
import { AnalyticsService } from './analytics.js';
import { CacheService } from './cache.js';
import { PersonalCreditService } from './personal-credits.js';
import { TYPES } from '../types.js';

export interface EmbedConfig {
  width?: number;
  height?: number;
  theme?: 'light' | 'dark' | 'auto';
  showUI?: boolean;
  showStats?: boolean;
  showCreator?: boolean;
  autoplay?: boolean;
  customCSS?: string;
  backgroundColor?: string;
  borderRadius?: number;
  showBranding?: boolean;
}

export interface EmbedCode {
  gameId: string;
  shortId: string;
  embedId: string;
  iframeCode: string;
  directUrl: string;
  config: EmbedConfig;
  createdAt: Date;
  createdBy: string;
  analytics: {
    views: number;
    plays: number;
    lastAccessed: Date | null;
  };
}

export interface EmbedAnalytics {
  embedId: string;
  gameId: string;
  totalViews: number;
  totalPlays: number;
  uniqueVisitors: number;
  topReferrers: Array<{ domain: string; views: number; plays: number }>;
  dailyStats: Array<{ date: string; views: number; plays: number }>;
  performanceScore: number;
  conversionRate: number; // plays / views
  timeframe: string;
}

export interface EmbedTemplates {
  minimal: EmbedConfig;
  standard: EmbedConfig;
  showcase: EmbedConfig;
  blog: EmbedConfig;
  social: EmbedConfig;
}

@injectable()
export class EmbedService {
  private readonly baseUrl: string;
  private readonly templates: EmbedTemplates;

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.PersonalCreditService) private personalCreditService: PersonalCreditService
  ) {
    this.baseUrl = process.env.WEB_RUNTIME_URL || 'http://localhost:3001';
    this.templates = this.initializeTemplates();
  }

  private initializeTemplates(): EmbedTemplates {
    return {
      minimal: {
        width: 640,
        height: 480,
        theme: 'auto',
        showUI: false,
        showStats: false,
        showCreator: false,
        autoplay: false,
        showBranding: false,
        borderRadius: 8
      },
      standard: {
        width: 800,
        height: 600,
        theme: 'auto',
        showUI: true,
        showStats: true,
        showCreator: true,
        autoplay: false,
        showBranding: true,
        borderRadius: 12
      },
      showcase: {
        width: 1024,
        height: 768,
        theme: 'auto',
        showUI: true,
        showStats: true,
        showCreator: true,
        autoplay: true,
        showBranding: true,
        borderRadius: 16,
        backgroundColor: '#1a1a1a'
      },
      blog: {
        width: 700,
        height: 525,
        theme: 'light',
        showUI: true,
        showStats: false,
        showCreator: true,
        autoplay: false,
        showBranding: true,
        borderRadius: 8
      },
      social: {
        width: 600,
        height: 450,
        theme: 'auto',
        showUI: false,
        showStats: true,
        showCreator: false,
        autoplay: true,
        showBranding: false,
        borderRadius: 12
      }
    };
  }

  /**
   * Generate embed code for a game
   */
  async generateEmbedCode(
    gameId: string,
    config: Partial<EmbedConfig> = {},
    createdBy: string,
    template?: keyof EmbedTemplates
  ): Promise<EmbedCode> {
    // Get game details
    const game = await this.db.getGame(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    // Apply template if specified
    let finalConfig: EmbedConfig;
    if (template && this.templates[template]) {
      finalConfig = { ...this.templates[template], ...config };
    } else {
      finalConfig = { ...this.templates.standard, ...config };
    }

    // Generate unique embed ID
    const embedId = this.generateEmbedId();

    // Create embed URL with configuration
    const embedUrl = this.buildEmbedUrl(game.shortId, embedId, finalConfig);

    // Generate iframe code
    const iframeCode = this.generateIframeCode(embedUrl, finalConfig);

    // Store embed configuration in cache
    const cacheKey = `embed:${embedId}`;
    await this.cache.set(cacheKey, {
      gameId,
      shortId: game.shortId,
      config: finalConfig,
      createdBy,
      createdAt: new Date(),
      analytics: {
        views: 0,
        plays: 0,
        lastAccessed: null
      }
    }, 30 * 24 * 60 * 60); // 30 days

    // Track embed creation
    await this.analytics.track('embed_generated', {
      gameId,
      embedId,
      template: template || 'custom',
      createdBy,
      config: finalConfig
    });

    return {
      gameId,
      shortId: game.shortId,
      embedId,
      iframeCode,
      directUrl: embedUrl,
      config: finalConfig,
      createdAt: new Date(),
      createdBy,
      analytics: {
        views: 0,
        plays: 0,
        lastAccessed: null
      }
    };
  }

  /**
   * Track embed view
   */
  async trackEmbedView(
    embedId: string,
    referrer?: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    const cacheKey = `embed:${embedId}`;
    const embedData = await this.cache.get<any>(cacheKey);

    if (!embedData) {
      return; // Embed not found or expired
    }

    // Update view count
    embedData.analytics.views += 1;
    embedData.analytics.lastAccessed = new Date();

    await this.cache.set(cacheKey, embedData, 30 * 24 * 60 * 60);

    // Track analytics
    await this.analytics.track('embed_viewed', {
      embedId,
      gameId: embedData.gameId,
      referrer,
      userAgent,
      ipAddress,
      timestamp: new Date().toISOString()
    });

    // Update daily stats
    await this.updateDailyStats(embedId, 'view');
  }

  /**
   * Track embed play (game actually started)
   */
  async trackEmbedPlay(
    embedId: string,
    userId?: string,
    sessionData?: Record<string, any>
  ): Promise<void> {
    const cacheKey = `embed:${embedId}`;
    const embedData = await this.cache.get<any>(cacheKey);

    if (!embedData) {
      return;
    }

    // Update play count
    embedData.analytics.plays += 1;
    embedData.analytics.lastAccessed = new Date();

    await this.cache.set(cacheKey, embedData, 30 * 24 * 60 * 60);

    // Award credits to game creator for viral reach
    try {
      const game = await this.db.getGame(embedData.gameId);
      if (game) {
        await this.personalCreditService.earnCredits(
          game.creatorId,
          2, // 2 credits for external embed play
          'EMBED_PLAY' as any,
          {
            gameId: embedData.gameId,
            embedId,
            externalPlay: true
          }
        );
      }
    } catch (error) {
      console.error('Error awarding embed play credits:', error);
    }

    // Track analytics
    await this.analytics.track('embed_played', {
      embedId,
      gameId: embedData.gameId,
      userId,
      sessionData,
      timestamp: new Date().toISOString()
    });

    // Update daily stats
    await this.updateDailyStats(embedId, 'play');
  }

  /**
   * Get embed analytics
   */
  async getEmbedAnalytics(
    embedId: string,
    timeframe: 'day' | 'week' | 'month' | 'year' = 'week'
  ): Promise<EmbedAnalytics | null> {
    const cacheKey = `embed:${embedId}`;
    const embedData = await this.cache.get<any>(cacheKey);

    if (!embedData) {
      return null;
    }

    // Get analytics from cache or calculate
    const analyticsKey = `embed_analytics:${embedId}:${timeframe}`;
    let analytics = await this.cache.get<EmbedAnalytics>(analyticsKey);

    if (!analytics) {
      analytics = await this.calculateEmbedAnalytics(embedId, embedData, timeframe);
      await this.cache.set(analyticsKey, analytics, 5 * 60); // 5 minutes
    }

    return analytics;
  }

  /**
   * Get all embeds for a game
   */
  async getGameEmbeds(gameId: string): Promise<EmbedCode[]> {
    const cacheKey = `game_embeds:${gameId}`;
    let embeds = await this.cache.get<EmbedCode[]>(cacheKey);

    if (!embeds) {
      embeds = await this.findEmbedsByGame(gameId);
      await this.cache.set(cacheKey, embeds, 15 * 60); // 15 minutes
    }

    return embeds;
  }

  /**
   * Get embed templates
   */
  getEmbedTemplates(): EmbedTemplates {
    return this.templates;
  }

  /**
   * Validate embed configuration
   */
  validateEmbedConfig(config: Partial<EmbedConfig>): boolean {
    if (config.width && (config.width < 300 || config.width > 2000)) {
      return false;
    }
    if (config.height && (config.height < 200 || config.height > 1500)) {
      return false;
    }
    if (config.theme && !['light', 'dark', 'auto'].includes(config.theme)) {
      return false;
    }
    return true;
  }

  private generateEmbedId(): string {
    return `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private buildEmbedUrl(shortId: string, embedId: string, config: EmbedConfig): string {
    const params = new URLSearchParams({
      embed: '1',
      embedId,
      width: config.width?.toString() || '800',
      height: config.height?.toString() || '600',
      theme: config.theme || 'auto',
      showUI: config.showUI?.toString() || 'true',
      showStats: config.showStats?.toString() || 'true',
      showCreator: config.showCreator?.toString() || 'true',
      autoplay: config.autoplay?.toString() || 'false',
      showBranding: config.showBranding?.toString() || 'true'
    });

    if (config.backgroundColor) {
      params.set('bg', config.backgroundColor);
    }
    if (config.borderRadius) {
      params.set('radius', config.borderRadius.toString());
    }

    return `${this.baseUrl}/play/${shortId}?${params.toString()}`;
  }

  private generateIframeCode(embedUrl: string, config: EmbedConfig): string {
    const width = config.width || 800;
    const height = config.height || 600;
    const borderRadius = config.borderRadius || 12;

    return `<iframe 
  src="${embedUrl}" 
  width="${width}" 
  height="${height}" 
  frameborder="0" 
  allowfullscreen
  allow="gamepad; microphone; camera"
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
  style="border-radius: ${borderRadius}px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
  title="GameVibe AI - Interactive Game">
</iframe>`;
  }

  private async updateDailyStats(embedId: string, type: 'view' | 'play'): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const statsKey = `embed_daily:${embedId}:${today}`;
    
    const stats = await this.cache.get<any>(statsKey) || { views: 0, plays: 0 };
    stats[type === 'view' ? 'views' : 'plays'] += 1;
    
    await this.cache.set(statsKey, stats, 24 * 60 * 60); // 24 hours
  }

  private async calculateEmbedAnalytics(
    embedId: string,
    embedData: any,
    timeframe: string
  ): Promise<EmbedAnalytics> {
    // This would typically query the database for historical data
    // For now, we'll use the basic cached data
    const conversionRate = embedData.analytics.views > 0 
      ? (embedData.analytics.plays / embedData.analytics.views) * 100 
      : 0;

    const performanceScore = Math.min(100, Math.max(0, 
      (conversionRate * 0.6) + 
      (Math.min(embedData.analytics.views / 100, 1) * 0.4) * 100
    ));

    return {
      embedId,
      gameId: embedData.gameId,
      totalViews: embedData.analytics.views,
      totalPlays: embedData.analytics.plays,
      uniqueVisitors: Math.floor(embedData.analytics.views * 0.7), // Estimated
      topReferrers: [], // Would be populated from analytics data
      dailyStats: [], // Would be populated from daily stats
      performanceScore: Math.round(performanceScore),
      conversionRate: Math.round(conversionRate * 100) / 100,
      timeframe
    };
  }

  private async findEmbedsByGame(gameId: string): Promise<EmbedCode[]> {
    // In a real implementation, this would search through all embed cache entries
    // For now, return empty array as embeds are stored with unique IDs
    return [];
  }
}