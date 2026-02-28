import { injectable, inject } from 'inversify';
import { TwitterApi } from 'twitter-api-v2';
import { Logger } from '../utils/logger.js';
import { prisma } from '../utils/database.js';
import { BotConfig } from '@gamevibe/shared';
import { SocialPreviewService } from './social-preview.js';
import { TYPES } from '../types.js';
import { CacheService } from './cache.js';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { EmbedBuilder } from 'discord.js';
import { Client } from 'discord.js';

interface SocialMediaPost {
  platform: 'twitter' | 'instagram' | 'youtube';
  content: string;
  mediaUrls?: string[];
  hashtags?: string[];
  mentions?: string[];
  scheduledAt?: Date;
}

interface PostResult {
  success: boolean;
  platform: string;
  postId?: string;
  url?: string;
  error?: string;
}

interface AutoPostSettings {
  enabled: boolean;
  platforms: string[];
  triggers: {
    gameCreation: boolean;
    viralMilestone: boolean;
    weeklyHighlight: boolean;
    eventWinner: boolean;
  };
  templates: {
    gameCreation: string;
    viralMilestone: string;
    weeklyHighlight: string;
    eventWinner: string;
  };
}

@injectable()
export class SocialMediaService {
  private logger = new Logger('SocialMediaService');
  private twitterClient?: TwitterApi;
  private isConfigured = false;

  constructor(
    @inject(TYPES.Config) private config: BotConfig,
    @inject(TYPES.SocialPreviewService) private socialPreviewService: SocialPreviewService,
    @inject(TYPES.CacheService) private cacheService: CacheService,
    @inject(TYPES.DiscordClient) private discordClient: Client
  ) {
    this.initializeClients();
  }

  private initializeClients(): void {
    // Initialize Twitter client
    if (this.config.socialMedia?.twitter?.apiKey) {
      this.twitterClient = new TwitterApi({
        appKey: this.config.socialMedia.twitter.apiKey,
        appSecret: this.config.socialMedia.twitter.apiSecret,
        accessToken: this.config.socialMedia.twitter.accessToken,
        accessSecret: this.config.socialMedia.twitter.accessSecret,
      });
      this.isConfigured = true;
      this.logger.info('Twitter client initialized');
    }

    // TikTok integration temporarily disabled
    this.logger.info('TikTok integration not available');
  }

  /**
   * Auto-post game creation to social media
   */
  async autoPostGameCreation(
    gameId: string,
    creatorId: string,
    gameTitle: string,
    gameType: string,
    serverId: string
  ): Promise<PostResult[]> {
    try {
      // Get server's auto-post settings
      const settings = await this.getServerAutoPostSettings(serverId);
      if (!settings.enabled || !settings.triggers.gameCreation) {
        return [];
      }

      // Generate preview card and GIF
      const [previewCard, gameplayGif] = await Promise.all([
        this.socialPreviewService.generatePreviewCard(gameId, 'twitter'),
        this.socialPreviewService.generateGameplayGif(gameId),
      ]);

      // Prepare post content
      const shareUrl = `https://gamevibe.ai/game/${gameId}`;
      const content = this.formatPostContent(settings.templates.gameCreation, {
        title: gameTitle,
        type: gameType,
        creator: await this.getCreatorName(creatorId),
        url: shareUrl,
      });

      const hashtags = this.generateHashtags(gameType, ['GameVibeAI', 'AIGames', 'DiscordGames']);

      // Post to enabled platforms
      const results: PostResult[] = [];
      
      if (settings.platforms.includes('twitter') && this.twitterClient) {
        results.push(await this.postToTwitter(content, [previewCard], hashtags));
      }

      // TikTok posting temporarily disabled

      // Track analytics
      await this.trackSocialPost(gameId, results);

      return results;
    } catch (error) {
      this.logger.error('Failed to auto-post game creation:', error);
      return [];
    }
  }

  /**
   * Post viral milestone achievement
   */
  async postViralMilestone(
    gameId: string,
    milestone: string,
    stats: {
      plays: number;
      shares: number;
      serversReached: number;
    }
  ): Promise<PostResult[]> {
    try {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { creator: true },
      });

      if (!game) return [];

      const settings = await this.getServerAutoPostSettings(game.serverId);
      if (!settings.enabled || !settings.triggers.viralMilestone) {
        return [];
      }

      const content = this.formatPostContent(settings.templates.viralMilestone, {
        title: game.title,
        milestone,
        plays: stats.plays.toLocaleString(),
        shares: stats.shares.toLocaleString(),
        servers: stats.serversReached.toLocaleString(),
        creator: game.creator.username,
      });

      const media = await this.socialPreviewService.generatePreviewCard(gameId, 'generic');
      const hashtags = ['GameVibeAI', 'ViralGame', 'Milestone', game.type];

      const results: PostResult[] = [];
      
      if (settings.platforms.includes('twitter') && this.twitterClient) {
        results.push(await this.postToTwitter(content, [media], hashtags));
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to post viral milestone:', error);
      return [];
    }
  }

  /**
   * Post weekly game highlights
   */
  async postWeeklyHighlights(): Promise<PostResult[]> {
    try {
      // Get top games of the week
      const topGames = await prisma.game.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          plays: 'desc',
        },
        take: 3,
        include: {
          creator: true,
        },
      });

      if (topGames.length === 0) return [];

      // Get servers with auto-post enabled
      const enabledServers = await this.getServersWithAutoPost('weeklyHighlight');
      const results: PostResult[] = [];

      for (const serverId of enabledServers) {
        const settings = await this.getServerAutoPostSettings(serverId);
        
        const content = this.formatPostContent(settings.templates.weeklyHighlight, {
          games: topGames.map((g, i) => 
            `${i + 1}. ${g.title} by ${g.creator.username} (${g.plays} plays)`
          ).join('\n'),
          week: new Date().toLocaleDateString('en-US', { week: 'long' }),
        });

        if (settings.platforms.includes('twitter') && this.twitterClient) {
          results.push(await this.postToTwitter(content, [], 
            ['GameVibeAI', 'WeeklyHighlights', 'TopGames']
          ));
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to post weekly highlights:', error);
      return [];
    }
  }

  /**
   * Post to Twitter (public method for scheduler)
   */
  async postToTwitter(
    content: string,
    mediaUrls: string[],
    hashtags: string[]
  ): Promise<PostResult> {
    try {
      if (!this.twitterClient) {
        throw new Error('Twitter client not configured');
      }

      // Upload media if provided
      const mediaIds: string[] = [];
      for (const mediaUrl of mediaUrls) {
        const response = await fetch(mediaUrl);
        const buffer = await response.buffer();
        const mediaId = await this.twitterClient.v1.uploadMedia(buffer, {
          mimeType: response.headers.get('content-type') || 'image/png',
        });
        mediaIds.push(mediaId);
      }

      // Format content with hashtags
      const fullContent = `${content}\n\n${hashtags.map(tag => `#${tag}`).join(' ')}`;

      // Post tweet
      const tweet = await this.twitterClient.v2.tweet({
        text: fullContent.substring(0, 280), // Twitter character limit
        media: mediaIds.length > 0 ? { media_ids: mediaIds } : undefined,
      });

      const tweetUrl = `https://twitter.com/GameVibeAI/status/${tweet.data.id}`;

      this.logger.info(`Posted to Twitter: ${tweetUrl}`);

      return {
        success: true,
        platform: 'twitter',
        postId: tweet.data.id,
        url: tweetUrl,
      };
    } catch (error) {
      this.logger.error('Failed to post to Twitter:', error);
      return {
        success: false,
        platform: 'twitter',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * TikTok integration temporarily disabled
   */

  /**
   * Schedule a social media post
   */
  async schedulePost(
    serverId: string,
    post: SocialMediaPost
  ): Promise<{ id: string; scheduledAt: Date }> {
    const scheduledPost = await prisma.scheduledPost.create({
      data: {
        serverId,
        platform: post.platform,
        content: post.content,
        mediaUrls: post.mediaUrls || [],
        hashtags: post.hashtags || [],
        mentions: post.mentions || [],
        scheduledAt: post.scheduledAt || new Date(),
        status: 'pending',
      },
    });

    return {
      id: scheduledPost.id,
      scheduledAt: scheduledPost.scheduledAt,
    };
  }

  /**
   * Get server auto-post settings
   */
  async getServerAutoPostSettings(serverId: string): Promise<AutoPostSettings> {
    const cacheKey = `social:settings:${serverId}`;
    const cached = await this.cacheService.get<AutoPostSettings>(cacheKey);
    if (cached) return cached;

    const settings = await prisma.serverSettings.findUnique({
      where: { serverId },
    });

    const defaultSettings: AutoPostSettings = {
      enabled: false,
      platforms: [],
      triggers: {
        gameCreation: true,
        viralMilestone: true,
        weeklyHighlight: false,
        eventWinner: true,
      },
      templates: {
        gameCreation: '🎮 New game created! "{title}" - a {type} game by {creator}\n\nPlay now: {url}',
        viralMilestone: '🔥 {title} just hit {milestone}! {plays} plays across {servers} servers!\n\nCreated by {creator}',
        weeklyHighlight: '📊 This week\'s top games on GameVibe AI:\n\n{games}',
        eventWinner: '🏆 Congratulations to {winner} for winning {event} with "{game}"!',
      },
    };

    const autoPostSettings = settings?.socialMediaSettings as AutoPostSettings || defaultSettings;
    
    await this.cacheService.set(cacheKey, autoPostSettings, 300); // 5 min cache
    return autoPostSettings;
  }

  /**
   * Update server auto-post settings
   */
  async updateServerAutoPostSettings(
    serverId: string,
    settings: Partial<AutoPostSettings>
  ): Promise<void> {
    await prisma.serverSettings.upsert({
      where: { serverId },
      create: {
        serverId,
        socialMediaSettings: settings,
      },
      update: {
        socialMediaSettings: settings,
      },
    });

    // Clear cache
    await this.cacheService.delete(`social:settings:${serverId}`);
  }

  /**
   * Track social media post analytics
   */
  private async trackSocialPost(
    gameId: string,
    results: PostResult[]
  ): Promise<void> {
    for (const result of results) {
      await prisma.socialMediaPost.create({
        data: {
          gameId,
          platform: result.platform,
          postId: result.postId,
          url: result.url,
          success: result.success,
          error: result.error,
          metrics: {
            impressions: 0,
            engagements: 0,
            clicks: 0,
          },
        },
      });
    }
  }

  /**
   * Get social media analytics
   */
  async getSocialMediaAnalytics(
    serverId: string,
    timeframe: '24h' | '7d' | '30d' = '7d'
  ): Promise<{
    totalPosts: number;
    successRate: number;
    platformBreakdown: Record<string, number>;
    topPerformingPosts: any[];
    engagement: {
      totalImpressions: number;
      totalEngagements: number;
      avgEngagementRate: number;
    };
  }> {
    const since = new Date();
    switch (timeframe) {
      case '24h':
        since.setHours(since.getHours() - 24);
        break;
      case '7d':
        since.setDate(since.getDate() - 7);
        break;
      case '30d':
        since.setDate(since.getDate() - 30);
        break;
    }

    const posts = await prisma.socialMediaPost.findMany({
      where: {
        createdAt: { gte: since },
        game: {
          serverId,
        },
      },
      include: {
        game: true,
      },
    });

    const totalPosts = posts.length;
    const successfulPosts = posts.filter(p => p.success).length;
    const successRate = totalPosts > 0 ? (successfulPosts / totalPosts) * 100 : 0;

    const platformBreakdown: Record<string, number> = {};
    posts.forEach(post => {
      platformBreakdown[post.platform] = (platformBreakdown[post.platform] || 0) + 1;
    });

    const topPerformingPosts = posts
      .filter(p => p.success)
      .sort((a, b) => {
        const aEngagement = (a.metrics as any)?.engagements || 0;
        const bEngagement = (b.metrics as any)?.engagements || 0;
        return bEngagement - aEngagement;
      })
      .slice(0, 5);

    const totalImpressions = posts.reduce((sum, p) => 
      sum + ((p.metrics as any)?.impressions || 0), 0
    );
    const totalEngagements = posts.reduce((sum, p) => 
      sum + ((p.metrics as any)?.engagements || 0), 0
    );
    const avgEngagementRate = totalImpressions > 0 ? 
      (totalEngagements / totalImpressions) * 100 : 0;

    return {
      totalPosts,
      successRate,
      platformBreakdown,
      topPerformingPosts,
      engagement: {
        totalImpressions,
        totalEngagements,
        avgEngagementRate,
      },
    };
  }

  /**
   * Helper methods
   */
  private formatPostContent(template: string, values: Record<string, string>): string {
    let content = template;
    for (const [key, value] of Object.entries(values)) {
      content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return content;
  }

  private generateHashtags(gameType: string, additional: string[] = []): string[] {
    const typeHashtags: Record<string, string[]> = {
      PLATFORMER: ['Platformer', 'PlatformGame', 'JumpAndRun'],
      PUZZLE: ['PuzzleGame', 'BrainTeaser', 'PuzzleSolver'],
      RPG: ['RPGGame', 'RolePlayingGame', 'Adventure'],
      SHOOTER: ['ShooterGame', 'ActionGame', 'SpaceShooter'],
      ENDLESS_RUNNER: ['EndlessRunner', 'RunnerGame', 'HighScore'],
    };

    return [
      ...(typeHashtags[gameType] || []),
      ...additional,
    ];
  }

  private async getCreatorName(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { discordId: userId },
    });
    return user?.username || 'Unknown Creator';
  }

  private async getServersWithAutoPost(trigger: keyof AutoPostSettings['triggers']): Promise<string[]> {
    const settings = await prisma.serverSettings.findMany({
      where: {
        socialMediaSettings: {
          path: ['enabled'],
          equals: true,
        },
      },
    });

    return settings
      .filter(s => {
        const autoPost = s.socialMediaSettings as AutoPostSettings;
        return autoPost.triggers[trigger];
      })
      .map(s => s.serverId);
  }

  /**
   * Check if service is configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }
}