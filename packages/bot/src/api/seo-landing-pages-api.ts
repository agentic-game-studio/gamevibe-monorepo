import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { Container } from 'inversify';
import { SEOLandingPageService } from '../services/seo-landing-pages.js';
import { DatabaseService } from '../services/database.js';
import { AnalyticsService } from '../services/analytics.js';
import { TYPES } from '../types.js';
import { GameType } from '../generated/prisma/index.js';

export class SEOLandingPagesAPI {
  private seoService: SEOLandingPageService;
  private db: DatabaseService;
  private analytics: AnalyticsService;

  constructor(container: Container) {
    this.seoService = container.get<SEOLandingPageService>(TYPES.SEOLandingPageService);
    this.db = container.get<DatabaseService>(TYPES.DatabaseService);
    this.analytics = container.get<AnalyticsService>(TYPES.AnalyticsService);
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    // Parse URL
    const url = new URL(req.url!, `http://${req.headers.host}`);
    
    // Match SEO landing page routes
    const gamePageMatch = pathname.match(/^\/game\/([^\/]+)$/);
    const gamesListMatch = pathname.match(/^\/games\/?$/);
    const gameTypesMatch = pathname.match(/^\/games\/([^\/]+)$/);
    const sitemapMatch = pathname.match(/^\/sitemap\.xml$/);
    const robotsMatch = pathname.match(/^\/robots\.txt$/);
    
    // API routes for landing page management
    const generatePageMatch = pathname.match(/^\/api\/landing-pages\/generate\/([^\/]+)$/);
    const batchGenerateMatch = pathname.match(/^\/api\/landing-pages\/batch$/);
    const templatesMatch = pathname.match(/^\/api\/landing-pages\/templates$/);
    const metadataMatch = pathname.match(/^\/api\/landing-pages\/metadata\/([^\/]+)$/);

    if (gamePageMatch && req.method === 'GET') {
      await this.handleGameLandingPage(req, res, gamePageMatch[1], url);
      return true;
    } else if (gamesListMatch && req.method === 'GET') {
      await this.handleGamesListPage(req, res, url);
      return true;
    } else if (gameTypesMatch && req.method === 'GET') {
      await this.handleGameTypePage(req, res, gameTypesMatch[1], url);
      return true;
    } else if (sitemapMatch && req.method === 'GET') {
      await this.handleSitemap(req, res);
      return true;
    } else if (robotsMatch && req.method === 'GET') {
      await this.handleRobotsTxt(req, res);
      return true;
    } else if (generatePageMatch && req.method === 'POST') {
      await this.handleGeneratePage(req, res, generatePageMatch[1]);
      return true;
    } else if (batchGenerateMatch && req.method === 'POST') {
      await this.handleBatchGenerate(req, res);
      return true;
    } else if (templatesMatch && req.method === 'GET') {
      await this.handleGetTemplates(req, res);
      return true;
    } else if (metadataMatch && req.method === 'GET') {
      await this.handleGetMetadata(req, res, metadataMatch[1], url);
      return true;
    }

    return false;
  }

  private async handleGameLandingPage(req: IncomingMessage, res: ServerResponse, slug: string, url: URL): Promise<void> {
    try {
      // Extract shortId from slug (format: game-name-shortId)
      const shortId = slug.split('-').pop();
      
      if (!shortId) {
        this.sendNotFound(res, 'Invalid game URL format');
        return;
      }

      // Find game by shortId
      const game = await this.db.prisma.game.findUnique({
        where: { shortId },
        select: { id: true, name: true }
      });

      if (!game) {
        this.sendNotFound(res, 'Game not found');
        return;
      }

      // Get template from query params
      const template = url.searchParams.get('template') || 'gaming';
      const includeRelated = url.searchParams.get('related') !== 'false';
      const includeCreator = url.searchParams.get('creator') !== 'false';

      // Generate the landing page HTML
      const html = await this.seoService.generateLandingPageHTML(game.id, {
        includeRelated,
        includeCreatorInfo: includeCreator,
        customTemplate: template,
        optimizeFor: 'seo'
      });

      // Track page view
      await this.analytics.track('landing_page_viewed', {
        gameId: game.id,
        shortId,
        slug,
        template,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer,
        ip: this.getClientIP(req)
      });

      // Send HTML response with SEO headers
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=7200', // 1 hour client, 2 hours CDN
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block'
      });
      res.end(html);

    } catch (error: any) {
      console.error('Error serving game landing page:', error);
      this.sendError(res, 500, 'Failed to load game page');
    }
  }

  private async handleGamesListPage(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    try {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '24'), 100);
      const type = url.searchParams.get('type');
      const sort = url.searchParams.get('sort') || 'recent';

      // Get games based on filters
      const games = await this.db.prisma.game.findMany({
        where: type ? { type: type as GameType } : undefined,
        orderBy: sort === 'popular' ? 
          { playCount: 'desc' } : 
          { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      });

      const totalGames = await this.db.prisma.game.count({
        where: type ? { type: type as GameType } : undefined
      });

      // Generate games list HTML
      const html = this.generateGamesListHTML(games, {
        page,
        limit,
        total: totalGames,
        type,
        sort
      });

      // Track page view
      await this.analytics.track('games_list_viewed', {
        page,
        limit,
        type,
        sort,
        resultCount: games.length,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer
      });

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=3600' // 30 min client, 1 hour CDN
      });
      res.end(html);

    } catch (error: any) {
      console.error('Error serving games list page:', error);
      this.sendError(res, 500, 'Failed to load games list');
    }
  }

  private async handleGameTypePage(req: IncomingMessage, res: ServerResponse, gameType: string, url: URL): Promise<void> {
    try {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '24'), 100);

      // Get games of specific type
      const games = await this.db.prisma.game.findMany({
        where: { type: gameType as GameType },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      });

      const totalGames = await this.db.prisma.game.count({
        where: { type: gameType as GameType }
      });

      if (games.length === 0 && page === 1) {
        this.sendNotFound(res, `No ${gameType} games found`);
        return;
      }

      // Generate type-specific page HTML
      const html = this.generateGameTypeHTML(gameType, games, {
        page,
        limit,
        total: totalGames
      });

      // Track page view
      await this.analytics.track('game_type_page_viewed', {
        gameType,
        page,
        limit,
        resultCount: games.length,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer
      });

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=3600'
      });
      res.end(html);

    } catch (error: any) {
      console.error('Error serving game type page:', error);
      this.sendError(res, 500, 'Failed to load game type page');
    }
  }

  private async handleSitemap(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const sitemap = await this.seoService.generateSitemap();

      res.writeHead(200, {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400' // 24 hours
      });
      res.end(sitemap);

    } catch (error: any) {
      console.error('Error serving sitemap:', error);
      this.sendError(res, 500, 'Failed to generate sitemap');
    }
  }

  private async handleRobotsTxt(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const robotsTxt = `User-agent: *
Allow: /

# Sitemaps
Sitemap: ${process.env.WEB_RUNTIME_URL || 'http://localhost:3001'}/sitemap.xml

# Allow all game pages
Allow: /game/
Allow: /games/

# Disallow admin areas (if any)
Disallow: /admin/
Disallow: /api/

# Crawl delay (optional)
Crawl-delay: 1`;

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    });
    res.end(robotsTxt);
  }

  private async handleGeneratePage(req: IncomingMessage, res: ServerResponse, gameId: string): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { options = {} } = body;

      const landingPage = await this.seoService.generateLandingPage(gameId, options);

      res.writeHead(200, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify({
        success: true,
        data: landingPage
      }));

    } catch (error: any) {
      console.error('Error generating landing page:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate landing page'
      }));
    }
  }

  private async handleBatchGenerate(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { gameIds, options = {} } = body;

      if (!Array.isArray(gameIds) || gameIds.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'gameIds array is required'
        }));
        return;
      }

      if (gameIds.length > 50) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Maximum 50 games per batch'
        }));
        return;
      }

      const landingPages = await this.seoService.getBatchLandingPages(gameIds, options);

      res.writeHead(200, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify({
        success: true,
        data: {
          landingPages,
          generated: landingPages.length,
          requested: gameIds.length
        }
      }));

    } catch (error: any) {
      console.error('Error in batch generate:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error.message || 'Failed to batch generate landing pages'
      }));
    }
  }

  private async handleGetTemplates(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const templates = this.seoService.getLandingPageTemplates();

      res.writeHead(200, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify({
        success: true,
        data: templates
      }));

    } catch (error: any) {
      console.error('Error getting templates:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to get templates'
      }));
    }
  }

  private async handleGetMetadata(req: IncomingMessage, res: ServerResponse, gameId: string, url: URL): Promise<void> {
    try {
      const template = url.searchParams.get('template') || 'gaming';
      
      const landingPage = await this.seoService.generateLandingPage(gameId, {
        customTemplate: template,
        optimizeFor: 'seo'
      });

      res.writeHead(200, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify({
        success: true,
        data: {
          seo: landingPage.seo,
          url: landingPage.url,
          slug: landingPage.slug
        }
      }));

    } catch (error: any) {
      console.error('Error getting metadata:', error);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Game not found or metadata generation failed'
      }));
    }
  }

  private generateGamesListHTML(games: any[], pagination: any): string {
    const { page, limit, total, type, sort } = pagination;
    const totalPages = Math.ceil(total / limit);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${type ? `${type} Games` : 'All Games'} - GameVibe AI</title>
    <meta name="description" content="Browse ${type ? `${type} games` : 'all games'} created with AI on GameVibe AI. Play free browser games instantly.">
    <meta name="robots" content="index, follow">
</head>
<body>
    <header>
        <h1>${type ? `${type} Games` : 'All Games'}</h1>
        <p>Discover amazing AI-generated games</p>
    </header>
    
    <main>
        <div class="filters">
            <a href="/games" ${!type ? 'class="active"' : ''}>All Games</a>
            <a href="/games/puzzle" ${type === 'puzzle' ? 'class="active"' : ''}>Puzzle</a>
            <a href="/games/platformer" ${type === 'platformer' ? 'class="active"' : ''}>Platformer</a>
            <a href="/games/shooter" ${type === 'shooter' ? 'class="active"' : ''}>Shooter</a>
        </div>
        
        <div class="games-grid">
            ${games.map(game => `
                <article class="game-card">
                    <h3><a href="/game/${this.generateGameSlug(game.name, game.shortId)}">${game.name}</a></h3>
                    <p>${game.description.slice(0, 100)}...</p>
                    <div class="game-meta">
                        <span class="game-type">${game.type}</span>
                        <span class="play-count">${game._count.gamePlays} plays</span>
                    </div>
                </article>
            `).join('')}
        </div>
        
        ${totalPages > 1 ? `
        <nav class="pagination">
            ${page > 1 ? `<a href="?page=${page - 1}&sort=${sort}">Previous</a>` : ''}
            <span>Page ${page} of ${totalPages}</span>
            ${page < totalPages ? `<a href="?page=${page + 1}&sort=${sort}">Next</a>` : ''}
        </nav>
        ` : ''}
    </main>
</body>
</html>`;
  }

  private generateGameTypeHTML(gameType: string, games: any[], pagination: any): string {
    const { page, total } = pagination;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${gameType} Games - GameVibe AI</title>
    <meta name="description" content="Play ${gameType} games created with AI. Free browser-based ${gameType} games on GameVibe AI.">
</head>
<body>
    <header>
        <h1>${gameType} Games</h1>
        <p>${total} ${gameType} games available</p>
    </header>
    
    <main>
        <div class="games-grid">
            ${games.map(game => `
                <article class="game-card">
                    <h3><a href="/game/${this.generateGameSlug(game.name, game.shortId)}">${game.name}</a></h3>
                    <p>${game.description.slice(0, 100)}...</p>
                    <span class="play-count">${game._count.gamePlays} plays</span>
                </article>
            `).join('')}
        </div>
    </main>
</body>
</html>`;
  }

  private generateGameSlug(name: string, shortId: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    return `${slug}-${shortId}`;
  }

  private getClientIP(req: IncomingMessage): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.headers['x-real-ip'] as string ||
           req.socket.remoteAddress ||
           'unknown';
  }

  private sendNotFound(res: ServerResponse, message: string): void {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Not Found - GameVibe AI</title>
</head>
<body>
    <h1>404 - Page Not Found</h1>
    <p>${message}</p>
    <a href="/">Return to Home</a>
</body>
</html>`;

    res.writeHead(404, {
      'Content-Type': 'text/html; charset=utf-8'
    });
    res.end(html);
  }

  private sendError(res: ServerResponse, status: number, message: string): void {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - GameVibe AI</title>
</head>
<body>
    <h1>Error</h1>
    <p>${message}</p>
    <a href="/">Return to Home</a>
</body>
</html>`;

    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8'
    });
    res.end(html);
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
}