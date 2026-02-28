import { injectable, inject } from 'inversify';
import { DatabaseService } from './database.js';
import { SocialPreviewService } from './social-preview.js';
import { AnalyticsService } from './analytics.js';
import { CacheService } from './cache.js';
import { TYPES } from '../types.js';

export interface SEOMetadata {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  ogUrl: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterSite?: string;
  structuredData: Record<string, any>;
  lastModified: Date;
}

export interface GameLandingPage {
  gameId: string;
  shortId: string;
  slug: string;
  url: string;
  title: string;
  description: string;
  content: {
    hero: {
      title: string;
      subtitle: string;
      backgroundImage: string;
      playButton: {
        text: string;
        url: string;
      };
    };
    about: {
      title: string;
      description: string;
      features: string[];
      gameType: string;
      difficulty: string;
      estimatedPlayTime: string;
    };
    screenshots: {
      url: string;
      alt: string;
      caption?: string;
    }[];
    creator: {
      name: string;
      id: string;
      bio?: string;
      totalGames: number;
      totalPlays: number;
    };
    stats: {
      playCount: number;
      averageRating: number;
      totalReviews: number;
      createdAt: Date;
      lastUpdated: Date;
    };
    relatedGames: {
      id: string;
      title: string;
      description: string;
      image: string;
      playCount: number;
    }[];
    breadcrumbs: {
      text: string;
      url: string;
    }[];
  };
  seo: SEOMetadata;
  generatedAt: Date;
  expiresAt: Date;
}

export interface LandingPageOptions {
  includeRelated?: boolean;
  includeCreatorInfo?: boolean;
  includeStats?: boolean;
  customTemplate?: string;
  optimizeFor?: 'speed' | 'seo' | 'engagement';
}

export interface LandingPageTemplate {
  name: string;
  description: string;
  heroLayout: 'full' | 'split' | 'minimal';
  contentSections: string[];
  seoOptimizations: string[];
  targetAudience: string;
  performanceScore: number;
}

@injectable()
export class SEOLandingPageService {
  private readonly baseUrl: string;
  private readonly cacheKeyPrefix = 'landing_page:';
  private readonly cacheTTL = 60 * 60; // 1 hour

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.SocialPreviewService) private socialPreviewService: SocialPreviewService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.CacheService) private cache: CacheService
  ) {
    this.baseUrl = process.env.WEB_RUNTIME_URL || 'http://localhost:3001';
  }

  /**
   * Generate a complete landing page for a game
   */
  async generateLandingPage(
    gameId: string,
    options: LandingPageOptions = {}
  ): Promise<GameLandingPage> {
    const cacheKey = `${this.cacheKeyPrefix}${gameId}:${JSON.stringify(options)}`;
    let landingPage = await this.cache.get<GameLandingPage>(cacheKey);

    if (!landingPage) {
      landingPage = await this.buildLandingPage(gameId, options);
      await this.cache.set(cacheKey, landingPage, this.cacheTTL);
    }

    // Track landing page generation
    await this.analytics.track('landing_page_generated', {
      gameId,
      options,
      cached: !!landingPage,
      timestamp: new Date().toISOString()
    });

    return landingPage;
  }

  /**
   * Generate SEO-optimized HTML for a game landing page
   */
  async generateLandingPageHTML(
    gameId: string,
    options: LandingPageOptions = {}
  ): Promise<string> {
    const landingPage = await this.generateLandingPage(gameId, options);
    return this.renderLandingPageHTML(landingPage);
  }

  /**
   * Get multiple landing pages (for sitemap generation)
   */
  async getBatchLandingPages(
    gameIds: string[],
    options: LandingPageOptions = {}
  ): Promise<GameLandingPage[]> {
    const landingPages: GameLandingPage[] = [];

    // Process in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < gameIds.length; i += batchSize) {
      const batch = gameIds.slice(i, i + batchSize);
      const batchPromises = batch.map(gameId => 
        this.generateLandingPage(gameId, options).catch(error => {
          console.error(`Error generating landing page for game ${gameId}:`, error);
          return null;
        })
      );

      const batchResults = await Promise.all(batchPromises);
      landingPages.push(...batchResults.filter(Boolean) as GameLandingPage[]);
    }

    return landingPages;
  }

  /**
   * Generate XML sitemap for all game landing pages
   */
  async generateSitemap(): Promise<string> {
    const cacheKey = 'sitemap:games';
    let sitemap = await this.cache.get<string>(cacheKey);

    if (!sitemap) {
      // Get all public games
      const games = await this.db.prisma.game.findMany({
        select: {
          id: true,
          shortId: true,
          name: true,
          createdAt: true,
          updatedAt: true
        },
        where: {
          // Add any visibility filters here
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const sitemapEntries = games.map(game => {
        const slug = this.generateGameSlug(game.name, game.shortId);
        const url = `${this.baseUrl}/game/${slug}`;
        const lastmod = game.updatedAt.toISOString().split('T')[0];
        
        return `
  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
      }).join('');

      sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${this.baseUrl}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${this.baseUrl}/games</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>${sitemapEntries}
</urlset>`;

      await this.cache.set(cacheKey, sitemap, 24 * 60 * 60); // 24 hours
    }

    return sitemap;
  }

  /**
   * Get available landing page templates
   */
  getLandingPageTemplates(): LandingPageTemplate[] {
    return [
      {
        name: 'gaming',
        description: 'Optimized for gaming audience with focus on gameplay and features',
        heroLayout: 'full',
        contentSections: ['hero', 'gameplay', 'features', 'creator', 'related'],
        seoOptimizations: ['game-specific keywords', 'gameplay metadata', 'gaming schema'],
        targetAudience: 'Gamers and game enthusiasts',
        performanceScore: 95
      },
      {
        name: 'educational',
        description: 'Focused on learning outcomes and educational value',
        heroLayout: 'split',
        contentSections: ['hero', 'learning', 'curriculum', 'educator', 'similar'],
        seoOptimizations: ['educational keywords', 'learning metadata', 'course schema'],
        targetAudience: 'Educators and students',
        performanceScore: 90
      },
      {
        name: 'casual',
        description: 'Light and approachable for casual players',
        heroLayout: 'minimal',
        contentSections: ['hero', 'quickplay', 'social', 'creator'],
        seoOptimizations: ['casual gaming', 'social metadata', 'entertainment schema'],
        targetAudience: 'Casual gamers and social players',
        performanceScore: 98
      },
      {
        name: 'showcase',
        description: 'Portfolio-style layout highlighting technical achievements',
        heroLayout: 'split',
        contentSections: ['hero', 'technical', 'development', 'creator', 'portfolio'],
        seoOptimizations: ['developer keywords', 'technical metadata', 'portfolio schema'],
        targetAudience: 'Developers and technical audience',
        performanceScore: 85
      }
    ];
  }

  /**
   * Validate and optimize SEO metadata
   */
  optimizeSEOMetadata(metadata: Partial<SEOMetadata>): SEOMetadata {
    const optimized: SEOMetadata = {
      title: this.optimizeTitle(metadata.title || ''),
      description: this.optimizeDescription(metadata.description || ''),
      keywords: this.optimizeKeywords(metadata.keywords || []),
      canonicalUrl: metadata.canonicalUrl || '',
      ogTitle: metadata.ogTitle || metadata.title || '',
      ogDescription: metadata.ogDescription || metadata.description || '',
      ogImage: metadata.ogImage || '',
      ogType: 'website',
      ogUrl: metadata.ogUrl || metadata.canonicalUrl || '',
      twitterCard: 'summary_large_image',
      twitterTitle: metadata.twitterTitle || metadata.title || '',
      twitterDescription: metadata.twitterDescription || metadata.description || '',
      twitterImage: metadata.twitterImage || metadata.ogImage || '',
      twitterSite: '@GameVibeAI',
      structuredData: metadata.structuredData || {},
      lastModified: new Date()
    };

    return optimized;
  }

  private async buildLandingPage(
    gameId: string,
    options: LandingPageOptions
  ): Promise<GameLandingPage> {
    // Get game data with related information
    const game = await this.db.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        creator: true,
        gamePlays: {
          select: { id: true },
          take: 1
        },
        _count: {
          select: {
            gamePlays: true
          }
        }
      }
    });

    if (!game) {
      throw new Error('Game not found');
    }

    // Generate slug and URLs
    const slug = this.generateGameSlug(game.name, game.shortId);
    const gameUrl = `${this.baseUrl}/game/${slug}`;
    const playUrl = `${this.baseUrl}/play/${game.shortId}`;

    // Get social preview for images
    const socialPreview = await this.socialPreviewService.generatePreviewCard(
      game.id,
      'generic',
      true
    );

    // Get creator stats if enabled
    let creatorStats = { totalGames: 0, totalPlays: 0 };
    if (options.includeCreatorInfo !== false) {
      creatorStats = await this.getCreatorStats(game.creatorId);
    }

    // Get related games if enabled
    let relatedGames: any[] = [];
    if (options.includeRelated !== false) {
      relatedGames = await this.getRelatedGames(game.id, game.type);
    }

    // Build structured data
    const structuredData = this.generateStructuredData(game, gameUrl, socialPreview);

    // Generate SEO metadata
    const seoMetadata = this.optimizeSEOMetadata({
      title: `${game.name} - Play Free AI-Generated Game | GameVibe AI`,
      description: `Play ${game.name}, an AI-generated ${game.type} game. ${game.description}. Created with GameVibe AI. Play now for free!`,
      keywords: this.generateGameKeywords(game),
      canonicalUrl: gameUrl,
      ogTitle: game.name,
      ogDescription: game.description,
      ogImage: socialPreview.imageUrl,
      ogUrl: gameUrl,
      twitterTitle: `🎮 ${game.name} - AI-Generated Game`,
      twitterDescription: `Play this ${game.type} game created with AI. ${game.description.slice(0, 100)}...`,
      twitterImage: socialPreview.imageUrl,
      structuredData
    });

    // Build content sections
    const content = {
      hero: {
        title: game.name,
        subtitle: `An AI-generated ${game.type} game`,
        backgroundImage: socialPreview.imageUrl,
        playButton: {
          text: 'Play Now',
          url: playUrl
        }
      },
      about: {
        title: 'About This Game',
        description: game.description,
        features: this.extractGameFeatures(game),
        gameType: game.type,
        difficulty: this.estimateGameDifficulty(game),
        estimatedPlayTime: this.estimatePlayTime(game)
      },
      screenshots: socialPreview.gifUrl ? [{
        url: socialPreview.gifUrl,
        alt: `${game.name} gameplay preview`,
        caption: 'Gameplay Preview'
      }] : [],
      creator: {
        name: game.creator?.name || 'Anonymous Creator',
        id: game.creatorId,
        bio: `Creator of ${creatorStats.totalGames} games with ${creatorStats.totalPlays} total plays`,
        totalGames: creatorStats.totalGames,
        totalPlays: creatorStats.totalPlays
      },
      stats: {
        playCount: game._count.gamePlays,
        averageRating: 4.5, // Placeholder - would need rating system
        totalReviews: 0, // Placeholder - would need review system
        createdAt: game.createdAt,
        lastUpdated: game.updatedAt
      },
      relatedGames,
      breadcrumbs: [
        { text: 'Home', url: this.baseUrl },
        { text: 'Games', url: `${this.baseUrl}/games` },
        { text: game.type, url: `${this.baseUrl}/games/${game.type.toLowerCase()}` },
        { text: game.name, url: gameUrl }
      ]
    };

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    return {
      gameId: game.id,
      shortId: game.shortId,
      slug,
      url: gameUrl,
      title: game.name,
      description: game.description,
      content,
      seo: seoMetadata,
      generatedAt: new Date(),
      expiresAt
    };
  }

  private renderLandingPageHTML(landingPage: GameLandingPage): string {
    const { content, seo } = landingPage;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${seo.title}</title>
    <meta name="description" content="${seo.description}">
    <meta name="keywords" content="${seo.keywords.join(', ')}">
    <link rel="canonical" href="${seo.canonicalUrl}">
    
    <!-- Open Graph -->
    <meta property="og:title" content="${seo.ogTitle}">
    <meta property="og:description" content="${seo.ogDescription}">
    <meta property="og:image" content="${seo.ogImage}">
    <meta property="og:url" content="${seo.ogUrl}">
    <meta property="og:type" content="${seo.ogType}">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="${seo.twitterCard}">
    <meta name="twitter:title" content="${seo.twitterTitle}">
    <meta name="twitter:description" content="${seo.twitterDescription}">
    <meta name="twitter:image" content="${seo.twitterImage}">
    ${seo.twitterSite ? `<meta name="twitter:site" content="${seo.twitterSite}">` : ''}
    
    <!-- Structured Data -->
    <script type="application/ld+json">
    ${JSON.stringify(seo.structuredData, null, 2)}
    </script>
    
    <!-- Preload critical resources -->
    <link rel="preload" href="${content.hero.backgroundImage}" as="image">
    
    <style>
        ${this.getInlineCSS()}
    </style>
</head>
<body>
    <main>
        <!-- Breadcrumbs -->
        <nav aria-label="Breadcrumb" class="breadcrumbs">
            ${content.breadcrumbs.map(crumb => 
                `<a href="${crumb.url}">${crumb.text}</a>`
            ).join(' > ')}
        </nav>
        
        <!-- Hero Section -->
        <section class="hero" style="background-image: url('${content.hero.backgroundImage}')">
            <div class="hero-content">
                <h1>${content.hero.title}</h1>
                <p class="subtitle">${content.hero.subtitle}</p>
                <a href="${content.hero.playButton.url}" class="play-button">
                    ${content.hero.playButton.text}
                </a>
            </div>
        </section>
        
        <!-- About Section -->
        <section class="about">
            <h2>${content.about.title}</h2>
            <p class="description">${content.about.description}</p>
            
            <div class="game-info">
                <div class="info-item">
                    <strong>Type:</strong> ${content.about.gameType}
                </div>
                <div class="info-item">
                    <strong>Difficulty:</strong> ${content.about.difficulty}
                </div>
                <div class="info-item">
                    <strong>Play Time:</strong> ${content.about.estimatedPlayTime}
                </div>
            </div>
            
            <ul class="features">
                ${content.about.features.map(feature => `<li>${feature}</li>`).join('')}
            </ul>
        </section>
        
        <!-- Screenshots -->
        ${content.screenshots.length > 0 ? `
        <section class="screenshots">
            <h2>Gameplay</h2>
            ${content.screenshots.map(screenshot => `
                <figure>
                    <img src="${screenshot.url}" alt="${screenshot.alt}" loading="lazy">
                    ${screenshot.caption ? `<figcaption>${screenshot.caption}</figcaption>` : ''}
                </figure>
            `).join('')}
        </section>
        ` : ''}
        
        <!-- Stats -->
        <section class="stats">
            <h2>Game Statistics</h2>
            <div class="stats-grid">
                <div class="stat">
                    <span class="stat-number">${content.stats.playCount.toLocaleString()}</span>
                    <span class="stat-label">Plays</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${content.stats.averageRating}/5</span>
                    <span class="stat-label">Rating</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${content.creator.totalGames}</span>
                    <span class="stat-label">Creator Games</span>
                </div>
            </div>
        </section>
        
        <!-- Creator Info -->
        <section class="creator">
            <h2>Created by ${content.creator.name}</h2>
            ${content.creator.bio ? `<p>${content.creator.bio}</p>` : ''}
        </section>
        
        <!-- Related Games -->
        ${content.relatedGames.length > 0 ? `
        <section class="related">
            <h2>Related Games</h2>
            <div class="games-grid">
                ${content.relatedGames.map(game => `
                    <article class="game-card">
                        <img src="${game.image}" alt="${game.title}" loading="lazy">
                        <h3>${game.title}</h3>
                        <p>${game.description.slice(0, 100)}...</p>
                        <span class="play-count">${game.playCount} plays</span>
                    </article>
                `).join('')}
            </div>
        </section>
        ` : ''}
    </main>
    
    <footer>
        <p>Powered by <a href="${this.baseUrl}">GameVibe AI</a> - Create games with artificial intelligence</p>
    </footer>
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

  private generateGameKeywords(game: any): string[] {
    const baseKeywords = [
      'ai generated game',
      'free online game',
      'browser game',
      'gamevibe ai',
      game.type.toLowerCase(),
      'indie game',
      'casual game'
    ];

    // Add game-specific keywords based on name and description
    const textKeywords = (game.name + ' ' + game.description)
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10);

    return [...baseKeywords, ...textKeywords];
  }

  private generateStructuredData(game: any, gameUrl: string, socialPreview: any): Record<string, any> {
    return {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      "name": game.name,
      "description": game.description,
      "url": gameUrl,
      "image": socialPreview.imageUrl,
      "dateCreated": game.createdAt.toISOString(),
      "dateModified": game.updatedAt.toISOString(),
      "genre": game.type,
      "gamePlatform": "Web Browser",
      "operatingSystem": "Any",
      "applicationCategory": "Game",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock"
      },
      "author": {
        "@type": "Person",
        "name": game.creator?.name || "Anonymous Creator"
      },
      "publisher": {
        "@type": "Organization",
        "name": "GameVibe AI",
        "url": this.baseUrl
      }
    };
  }

  private extractGameFeatures(game: any): string[] {
    const features = [
      `${game.type} gameplay`,
      'AI-generated content',
      'Free to play',
      'No download required'
    ];

    // Add features based on game metadata
    if (game.metadata?.features) {
      features.push(...game.metadata.features);
    }

    return features.slice(0, 6);
  }

  private estimateGameDifficulty(game: any): string {
    // Simple heuristic based on game type
    const difficulties = {
      'puzzle': 'Medium',
      'platformer': 'Easy',
      'shooter': 'Hard',
      'rpg': 'Medium',
      'adventure': 'Easy'
    };

    return difficulties[game.type.toLowerCase() as keyof typeof difficulties] || 'Medium';
  }

  private estimatePlayTime(game: any): string {
    // Simple heuristic based on game type
    const playTimes = {
      'puzzle': '10-15 minutes',
      'platformer': '5-10 minutes',
      'shooter': '3-8 minutes',
      'rpg': '15-30 minutes',
      'adventure': '10-20 minutes'
    };

    return playTimes[game.type.toLowerCase() as keyof typeof playTimes] || '5-15 minutes';
  }

  private async getCreatorStats(creatorId: string): Promise<{ totalGames: number; totalPlays: number }> {
    const stats = await this.db.prisma.user.findUnique({
      where: { discordUserId: creatorId },
      include: {
        _count: {
          select: {
            gamesCreated: true
          }
        },
        gamesCreated: {
          include: {
            _count: {
              select: {
                gamePlays: true
              }
            }
          }
        }
      }
    });

    if (!stats) {
      return { totalGames: 0, totalPlays: 0 };
    }

    const totalPlays = stats.gamesCreated.reduce(
      (sum, game) => sum + game._count.gamePlays,
      0
    );

    return {
      totalGames: stats._count.gamesCreated,
      totalPlays
    };
  }

  private async getRelatedGames(gameId: string, gameType: string, limit: number = 4): Promise<any[]> {
    const relatedGames = await this.db.prisma.game.findMany({
      where: {
        AND: [
          { id: { not: gameId } },
          { type: gameType }
        ]
      },
      include: {
        _count: {
          select: {
            gamePlays: true
          }
        }
      },
      orderBy: {
        gamePlays: {
          _count: 'desc'
        }
      },
      take: limit
    });

    return relatedGames.map(game => ({
      id: game.id,
      title: game.name,
      description: game.description,
      image: '', // Would need to generate social preview
      playCount: game._count.gamePlays
    }));
  }

  private optimizeTitle(title: string): string {
    if (!title) return 'AI-Generated Game | GameVibe AI';
    
    // Ensure title is under 60 characters for optimal SEO
    if (title.length <= 60) return title;
    
    return title.substring(0, 57) + '...';
  }

  private optimizeDescription(description: string): string {
    if (!description) return 'Play free AI-generated games created with GameVibe AI. No download required, play instantly in your browser.';
    
    // Ensure description is between 150-160 characters for optimal SEO
    if (description.length >= 150 && description.length <= 160) return description;
    
    if (description.length < 150) {
      return description + ' Play now for free on GameVibe AI.';
    }
    
    return description.substring(0, 157) + '...';
  }

  private optimizeKeywords(keywords: string[]): string[] {
    // Remove duplicates and limit to 15 keywords
    const uniqueKeywords = [...new Set(keywords)];
    return uniqueKeywords.slice(0, 15);
  }

  private getInlineCSS(): string {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
      .breadcrumbs { padding: 1rem; font-size: 0.9rem; }
      .breadcrumbs a { color: #6366f1; text-decoration: none; }
      .hero { min-height: 60vh; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; color: white; text-align: center; position: relative; }
      .hero::before { content: ''; position: absolute; inset: 0; background: rgba(0,0,0,0.4); }
      .hero-content { position: relative; z-index: 1; max-width: 600px; padding: 2rem; }
      .hero h1 { font-size: 3rem; margin-bottom: 0.5rem; }
      .subtitle { font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9; }
      .play-button { display: inline-block; background: #6366f1; color: white; padding: 1rem 2rem; border-radius: 0.5rem; text-decoration: none; font-weight: bold; font-size: 1.1rem; }
      .about, .stats, .creator, .related { padding: 3rem 1rem; max-width: 1200px; margin: 0 auto; }
      .about h2, .stats h2, .creator h2, .related h2 { font-size: 2rem; margin-bottom: 1.5rem; }
      .description { font-size: 1.1rem; margin-bottom: 2rem; color: #666; }
      .game-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 2rem 0; }
      .info-item { background: #f8fafc; padding: 1rem; border-radius: 0.5rem; }
      .features { list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.5rem; }
      .features li { padding: 0.5rem; background: #e0e7ff; border-radius: 0.25rem; }
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 2rem; text-align: center; }
      .stat-number { display: block; font-size: 2.5rem; font-weight: bold; color: #6366f1; }
      .stat-label { color: #666; }
      .games-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
      .game-card { background: #f8fafc; border-radius: 0.5rem; padding: 1.5rem; }
      .game-card img { width: 100%; height: 200px; object-fit: cover; border-radius: 0.25rem; margin-bottom: 1rem; }
      .game-card h3 { margin-bottom: 0.5rem; }
      .play-count { color: #666; font-size: 0.9rem; }
      footer { background: #1f2937; color: white; text-align: center; padding: 2rem; }
      footer a { color: #6366f1; }
      @media (max-width: 768px) { .hero h1 { font-size: 2rem; } .hero-content { padding: 1rem; } }
    `;
  }
}