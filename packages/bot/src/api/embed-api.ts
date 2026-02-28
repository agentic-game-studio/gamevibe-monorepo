import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { Container } from 'inversify';
import { EmbedService } from '../services/embed.js';
import { DatabaseService } from '../services/database.js';
import { TYPES } from '../types.js';

export class EmbedAPI {
  private embedService: EmbedService;
  private db: DatabaseService;

  constructor(container: Container) {
    this.embedService = container.get<EmbedService>(TYPES.EmbedService);
    this.db = container.get<DatabaseService>(TYPES.DatabaseService);
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    // Parse URL
    const url = new URL(req.url!, `http://${req.headers.host}`);
    
    // Match embed API routes
    const generateEmbedMatch = pathname.match(/^\/api\/embed\/([^\/]+)\/generate$/);
    const trackViewMatch = pathname.match(/^\/api\/embed\/([^\/]+)\/track\/view$/);
    const trackPlayMatch = pathname.match(/^\/api\/embed\/([^\/]+)\/track\/play$/);
    const getAnalyticsMatch = pathname.match(/^\/api\/embed\/([^\/]+)\/analytics$/);
    const getEmbedInfoMatch = pathname.match(/^\/api\/embed\/([^\/]+)\/info$/);
    const getGameEmbedsMatch = pathname.match(/^\/api\/embed\/game\/([^\/]+)$/);
    const getTemplatesMatch = pathname.match(/^\/api\/embed\/templates$/);
    const validateConfigMatch = pathname.match(/^\/api\/embed\/validate-config$/);

    if (generateEmbedMatch && req.method === 'POST') {
      await this.handleGenerateEmbed(req, res, generateEmbedMatch[1]);
      return true;
    } else if (trackViewMatch && req.method === 'POST') {
      await this.handleTrackView(req, res, trackViewMatch[1]);
      return true;
    } else if (trackPlayMatch && req.method === 'POST') {
      await this.handleTrackPlay(req, res, trackPlayMatch[1]);
      return true;
    } else if (getAnalyticsMatch && req.method === 'GET') {
      await this.handleGetAnalytics(req, res, getAnalyticsMatch[1], url);
      return true;
    } else if (getEmbedInfoMatch && req.method === 'GET') {
      await this.handleGetEmbedInfo(req, res, getEmbedInfoMatch[1]);
      return true;
    } else if (getGameEmbedsMatch && req.method === 'GET') {
      await this.handleGetGameEmbeds(req, res, getGameEmbedsMatch[1]);
      return true;
    } else if (getTemplatesMatch && req.method === 'GET') {
      await this.handleGetTemplates(req, res);
      return true;
    } else if (validateConfigMatch && req.method === 'POST') {
      await this.handleValidateConfig(req, res);
      return true;
    }

    return false;
  }

  private async handleGenerateEmbed(req: IncomingMessage, res: ServerResponse, gameId: string): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { config = {}, template, userId } = body;

      if (!userId) {
        this.sendResponse(res, 400, {
          success: false,
          error: 'userId is required'
        });
        return;
      }

      // Validate config if provided
      if (config && !this.embedService.validateEmbedConfig(config)) {
        this.sendResponse(res, 400, {
          success: false,
          error: 'Invalid embed configuration'
        });
        return;
      }

      const embedCode = await this.embedService.generateEmbedCode(
        gameId,
        config,
        userId,
        template
      );

      this.sendResponse(res, 200, {
        success: true,
        data: embedCode
      });

    } catch (error: any) {
      console.error('Error generating embed:', error);
      this.sendResponse(res, 404, {
        success: false,
        error: error.message || 'Failed to generate embed'
      });
    }
  }

  private async handleTrackView(req: IncomingMessage, res: ServerResponse, embedId: string): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { referrer, userAgent, ipAddress } = body;

      await this.embedService.trackEmbedView(embedId, referrer, userAgent, ipAddress);

      this.sendResponse(res, 200, {
        success: true,
        message: 'View tracked successfully'
      });

    } catch (error) {
      console.error('Error tracking embed view:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: 'Failed to track view'
      });
    }
  }

  private async handleTrackPlay(req: IncomingMessage, res: ServerResponse, embedId: string): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { userId, sessionData = {} } = body;

      await this.embedService.trackEmbedPlay(embedId, userId, sessionData);

      this.sendResponse(res, 200, {
        success: true,
        message: 'Play tracked successfully'
      });

    } catch (error) {
      console.error('Error tracking embed play:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: 'Failed to track play'
      });
    }
  }

  private async handleGetAnalytics(req: IncomingMessage, res: ServerResponse, embedId: string, url: URL): Promise<void> {
    try {
      const timeframe = url.searchParams.get('timeframe') || 'week';

      const analytics = await this.embedService.getEmbedAnalytics(
        embedId,
        timeframe as any
      );

      if (!analytics) {
        this.sendResponse(res, 404, {
          success: false,
          error: 'Embed not found'
        });
        return;
      }

      this.sendResponse(res, 200, {
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error getting embed analytics:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: 'Failed to get analytics'
      });
    }
  }

  private async handleGetEmbedInfo(req: IncomingMessage, res: ServerResponse, embedId: string): Promise<void> {
    try {
      // Get embed info from cache
      const analytics = await this.embedService.getEmbedAnalytics(embedId);
      
      if (!analytics) {
        this.sendResponse(res, 404, {
          success: false,
          error: 'Embed not found'
        });
        return;
      }

      // Get game details
      const game = await this.db.getGame(analytics.gameId);
      
      if (!game) {
        this.sendResponse(res, 404, {
          success: false,
          error: 'Game not found'
        });
        return;
      }

      this.sendResponse(res, 200, {
        success: true,
        data: {
          embedId,
          game: {
            id: game.id,
            shortId: game.shortId,
            name: game.name,
            description: game.description,
            type: game.type,
            creatorId: game.creatorId,
            playCount: game.playCount
          },
          analytics: {
            totalViews: analytics.totalViews,
            totalPlays: analytics.totalPlays,
            conversionRate: analytics.conversionRate,
            performanceScore: analytics.performanceScore
          }
        }
      });

    } catch (error) {
      console.error('Error getting embed info:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: 'Failed to get embed info'
      });
    }
  }

  private async handleGetGameEmbeds(req: IncomingMessage, res: ServerResponse, gameId: string): Promise<void> {
    try {
      const embeds = await this.embedService.getGameEmbeds(gameId);

      this.sendResponse(res, 200, {
        success: true,
        data: embeds
      });

    } catch (error) {
      console.error('Error getting game embeds:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: 'Failed to get game embeds'
      });
    }
  }

  private async handleGetTemplates(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const templates = this.embedService.getEmbedTemplates();

      // Add descriptions and use cases for each template
      const enrichedTemplates = {
        minimal: {
          ...templates.minimal,
          name: 'Minimal Embed',
          description: 'Clean, minimal embed perfect for sidebars or small spaces',
          useCases: ['Blog sidebars', 'Small widgets', 'Quick demos'],
          estimatedSize: '~50KB'
        },
        standard: {
          ...templates.standard,
          name: 'Standard Embed',
          description: 'Full-featured embed with all UI elements and branding',
          useCases: ['Blog posts', 'Portfolio pages', 'Game showcases'],
          estimatedSize: '~75KB'
        },
        showcase: {
          ...templates.showcase,
          name: 'Showcase Embed',
          description: 'Large, high-impact embed for featuring games prominently',
          useCases: ['Landing pages', 'Game galleries', 'Marketing pages'],
          estimatedSize: '~100KB'
        },
        blog: {
          ...templates.blog,
          name: 'Blog Embed',
          description: 'Optimized for blog content with balanced size and features',
          useCases: ['Blog articles', 'News posts', 'Reviews'],
          estimatedSize: '~65KB'
        },
        social: {
          ...templates.social,
          name: 'Social Media Embed',
          description: 'Compact embed optimized for social media sharing',
          useCases: ['Social posts', 'Forums', 'Chat embeds'],
          estimatedSize: '~45KB'
        }
      };

      this.sendResponse(res, 200, {
        success: true,
        data: enrichedTemplates
      });

    } catch (error) {
      console.error('Error getting templates:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: 'Failed to get templates'
      });
    }
  }

  private async handleValidateConfig(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { config } = body;

      const isValid = this.embedService.validateEmbedConfig(config);

      this.sendResponse(res, 200, {
        success: true,
        data: {
          valid: isValid,
          config: config
        }
      });

    } catch (error) {
      console.error('Error validating config:', error);
      this.sendResponse(res, 400, {
        success: false,
        error: 'Invalid request body'
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