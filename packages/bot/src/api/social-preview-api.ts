import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { Container } from 'inversify';
import { SocialPreviewService } from '../services/social-preview.js';
import { AnalyticsService } from '../services/analytics.js';
import { TYPES } from '../types.js';

export class SocialPreviewAPI {
  private socialPreviewService: SocialPreviewService;
  private analytics: AnalyticsService;

  constructor(container: Container) {
    this.socialPreviewService = container.get<SocialPreviewService>(TYPES.SocialPreviewService);
    this.analytics = container.get<AnalyticsService>(TYPES.AnalyticsService);
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    // Parse URL
    const url = new URL(req.url!, `http://${req.headers.host}`);
    
    // Match social preview API routes
    const previewCardMatch = pathname.match(/^\/api\/social-preview\/([^\/]+)\/card$/);
    const metadataMatch = pathname.match(/^\/api\/social-preview\/([^\/]+)\/metadata$/);
    const analyticsMatch = pathname.match(/^\/api\/social-preview\/([^\/]+)\/analytics$/);
    const gifMatch = pathname.match(/^\/api\/social-preview\/([^\/]+)\/gif$/);
    const shareUrlMatch = pathname.match(/^\/api\/social-preview\/([^\/]+)\/share-url$/);
    const trackShareMatch = pathname.match(/^\/api\/social-preview\/([^\/]+)\/track-share$/);
    const templatesMatch = pathname.match(/^\/api\/social-preview\/templates$/);

    if (previewCardMatch && req.method === 'GET') {
      await this.handleGetPreviewCard(req, res, previewCardMatch[1], url);
      return true;
    } else if (metadataMatch && req.method === 'GET') {
      await this.handleGetMetadata(req, res, metadataMatch[1], url);
      return true;
    } else if (analyticsMatch && req.method === 'GET') {
      await this.handleGetAnalytics(req, res, analyticsMatch[1], url);
      return true;
    } else if (gifMatch && req.method === 'GET') {
      await this.handleGetGIF(req, res, gifMatch[1]);
      return true;
    } else if (shareUrlMatch && req.method === 'GET') {
      await this.handleGetShareUrls(req, res, shareUrlMatch[1]);
      return true;
    } else if (trackShareMatch && req.method === 'POST') {
      await this.handleTrackShare(req, res, trackShareMatch[1]);
      return true;
    } else if (templatesMatch && req.method === 'GET') {
      await this.handleGetTemplates(req, res);
      return true;
    }

    return false;
  }

  private async handleGetPreviewCard(req: IncomingMessage, res: ServerResponse, gameId: string, url: URL): Promise<void> {
    try {
      const platform = url.searchParams.get('platform') || 'generic';
      const includeGIF = url.searchParams.get('gif') === 'true';

      const previewCard = await this.socialPreviewService.generatePreviewCard(
        gameId,
        platform as any,
        includeGIF
      );

      // Track preview view
      await this.analytics.track('social_preview_api_viewed', {
        gameId,
        platform,
        includeGIF,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer
      });

      this.sendResponse(res, 200, {
        success: true,
        data: previewCard
      });

    } catch (error) {
      console.error('Error in preview card API:', error);
      this.sendResponse(res, 404, {
        success: false,
        error: 'Game not found or preview generation failed'
      });
    }
  }

  private async handleGetMetadata(req: IncomingMessage, res: ServerResponse, gameId: string, url: URL): Promise<void> {
    try {
      const format = url.searchParams.get('format') || 'opengraph';

      let metadata;
      if (format === 'twitter') {
        metadata = await this.socialPreviewService.getTwitterCardMetadata(gameId);
      } else {
        metadata = await this.socialPreviewService.getOpenGraphMetadata(gameId);
      }

      this.sendResponse(res, 200, {
        success: true,
        data: metadata
      });

    } catch (error) {
      console.error('Error in metadata API:', error);
      this.sendResponse(res, 404, {
        success: false,
        error: 'Game not found or metadata generation failed'
      });
    }
  }

  private async handleGetAnalytics(req: IncomingMessage, res: ServerResponse, gameId: string, url: URL): Promise<void> {
    try {
      const timeframe = url.searchParams.get('timeframe') || 'week';

      const analyticsData = await this.socialPreviewService.getPreviewAnalytics(
        gameId,
        timeframe as any
      );

      this.sendResponse(res, 200, {
        success: true,
        data: analyticsData
      });

    } catch (error) {
      console.error('Error in analytics API:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: 'Failed to get analytics data'
      });
    }
  }

  private async handleGetGIF(req: IncomingMessage, res: ServerResponse, gameId: string): Promise<void> {
    try {
      const gameplayGIF = await this.socialPreviewService.getOrGenerateGameplayGIF(gameId);

      if (!gameplayGIF) {
        this.sendResponse(res, 404, {
          success: false,
          error: 'GIF not found and generation failed'
        });
        return;
      }

      this.sendResponse(res, 200, {
        success: true,
        data: gameplayGIF
      });

    } catch (error) {
      console.error('Error in GIF API:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: 'Failed to get or generate GIF'
      });
    }
  }

  private async handleGetShareUrls(req: IncomingMessage, res: ServerResponse, gameId: string): Promise<void> {
    try {
      const platforms = ['generic', 'twitter', 'facebook', 'discord'];

      const shareUrls = platforms.reduce((urls, platform) => {
        urls[platform] = this.socialPreviewService.generateShareableURL(gameId, platform);
        return urls;
      }, {} as Record<string, string>);

      this.sendResponse(res, 200, {
        success: true,
        data: shareUrls
      });

    } catch (error) {
      console.error('Error in share URL API:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: 'Failed to generate share URLs'
      });
    }
  }

  private async handleTrackShare(req: IncomingMessage, res: ServerResponse, gameId: string): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { platform, url, userId } = body;

      // Track the share event
      await this.analytics.track('social_preview_shared', {
        gameId,
        platform,
        url,
        userId,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer,
        timestamp: new Date().toISOString()
      });

      this.sendResponse(res, 200, {
        success: true,
        message: 'Share tracked successfully'
      });

    } catch (error) {
      console.error('Error tracking share:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: 'Failed to track share'
      });
    }
  }

  private async handleGetTemplates(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const templates = {
        twitter: {
          name: 'Twitter Card',
          dimensions: { width: 1200, height: 675 },
          features: ['summary_large_image', 'gif_support', 'auto_crop'],
          description: 'Optimized for Twitter sharing with large image display'
        },
        facebook: {
          name: 'Facebook Share',
          dimensions: { width: 1200, height: 630 },
          features: ['rich_description', 'metrics_display', 'action_buttons'],
          description: 'Rich preview cards for Facebook posts and shares'
        },
        discord: {
          name: 'Discord Embed',
          dimensions: { width: 800, height: 450 },
          features: ['native_styling', 'compact_layout', 'emoji_support'],
          description: 'Native Discord embed styling for server sharing'
        },
        generic: {
          name: 'Universal Card',
          dimensions: { width: 1200, height: 630 },
          features: ['cross_platform', 'opengraph_compatible', 'flexible_sizing'],
          description: 'Universal preview card compatible with all platforms'
        }
      };

      this.sendResponse(res, 200, {
        success: true,
        data: templates
      });

    } catch (error) {
      console.error('Error getting templates:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: 'Failed to get templates'
      });
    }
  }

  private async parseRequestBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
      req.on('error', reject);
    });
  }

  private sendResponse(res: ServerResponse, statusCode: number, data: any): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  }
}