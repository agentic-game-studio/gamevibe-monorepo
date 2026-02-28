import { Router, Request, Response } from 'express';
import { Container } from 'inversify';
import { SocialPreviewService } from '../services/social-preview.js';
import { AnalyticsService } from '../services/analytics.js';
import { TYPES } from '../types.js';

export function createSocialPreviewRoutes(container: Container): Router {
  const router = Router();
  const socialPreviewService = container.get<SocialPreviewService>(TYPES.SocialPreviewService);
  const analytics = container.get<AnalyticsService>(TYPES.AnalyticsService);

  /**
   * GET /api/social-preview/:gameId/card
   * Get preview card data for a game
   */
  router.get('/card/:gameId', async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const platform = req.query.platform as string || 'generic';
      const includeGIF = req.query.gif === 'true';

      const previewCard = await socialPreviewService.generatePreviewCard(
        gameId,
        platform as any,
        includeGIF
      );

      // Track preview view
      await analytics.track('social_preview_api_viewed', {
        gameId,
        platform,
        includeGIF,
        userAgent: req.get('User-Agent'),
        referrer: req.get('Referer')
      });

      res.json({
        success: true,
        data: previewCard
      });

    } catch (error) {
      console.error('Error in preview card API:', error);
      res.status(404).json({
        success: false,
        error: 'Game not found or preview generation failed'
      });
    }
  });

  /**
   * GET /api/social-preview/:gameId/metadata
   * Get OpenGraph and Twitter Card metadata for a game
   */
  router.get('/metadata/:gameId', async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const format = req.query.format as string || 'opengraph';

      let metadata;
      if (format === 'twitter') {
        metadata = await socialPreviewService.getTwitterCardMetadata(gameId);
      } else {
        metadata = await socialPreviewService.getOpenGraphMetadata(gameId);
      }

      res.json({
        success: true,
        data: metadata
      });

    } catch (error) {
      console.error('Error in metadata API:', error);
      res.status(404).json({
        success: false,
        error: 'Game not found or metadata generation failed'
      });
    }
  });

  /**
   * GET /api/social-preview/:gameId/analytics
   * Get preview analytics for a game
   */
  router.get('/analytics/:gameId', async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const timeframe = req.query.timeframe as string || 'week';

      const analyticsData = await socialPreviewService.getPreviewAnalytics(
        gameId,
        timeframe as any
      );

      res.json({
        success: true,
        data: analyticsData
      });

    } catch (error) {
      console.error('Error in analytics API:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analytics data'
      });
    }
  });

  /**
   * GET /api/social-preview/:gameId/gif
   * Get or generate gameplay GIF for a game
   */
  router.get('/gif/:gameId', async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;

      const gameplayGIF = await socialPreviewService.getOrGenerateGameplayGIF(gameId);

      if (!gameplayGIF) {
        return res.status(404).json({
          success: false,
          error: 'GIF not found and generation failed'
        });
      }

      res.json({
        success: true,
        data: gameplayGIF
      });

    } catch (error) {
      console.error('Error in GIF API:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get or generate GIF'
      });
    }
  });

  /**
   * GET /api/social-preview/:gameId/share-url
   * Get shareable URLs for a game
   */
  router.get('/share-url/:gameId', async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const platforms = ['generic', 'twitter', 'facebook', 'discord'];

      const shareUrls = platforms.reduce((urls, platform) => {
        urls[platform] = socialPreviewService.generateShareableURL(gameId, platform);
        return urls;
      }, {} as Record<string, string>);

      res.json({
        success: true,
        data: shareUrls
      });

    } catch (error) {
      console.error('Error in share URL API:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate share URLs'
      });
    }
  });

  /**
   * POST /api/social-preview/:gameId/track-share
   * Track when a preview is shared
   */
  router.post('/track-share/:gameId', async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const { platform, url, userId } = req.body;

      // Track the share event
      await analytics.track('social_preview_shared', {
        gameId,
        platform,
        url,
        userId,
        userAgent: req.get('User-Agent'),
        referrer: req.get('Referer'),
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Share tracked successfully'
      });

    } catch (error) {
      console.error('Error tracking share:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track share'
      });
    }
  });

  /**
   * GET /api/social-preview/templates
   * Get available preview templates
   */
  router.get('/templates', async (req: Request, res: Response) => {
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

      res.json({
        success: true,
        data: templates
      });

    } catch (error) {
      console.error('Error getting templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get templates'
      });
    }
  });

  return router;
}