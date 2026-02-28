// GameVibe AI Game Remix Service
// Handles cloning and modifying existing games

import { injectable, inject } from 'inversify';
import { PrismaClient, GameType, RemixType, Game, GameRemix, GameVersion } from '../generated/prisma/index.js';
import { CacheService } from './cache.js';
import { GameGeneratorService } from './game-generator.js';
import { TYPES } from '../types.js';

export interface RemixGameParams {
  originalGameId: string;
  remixTitle?: string;
  remixDescription?: string;
  remixType: RemixType;
  modifications: GameModification[];
  creatorId: string;
  serverId: string;
}

export interface GameModification {
  type: 'style' | 'mechanics' | 'theme' | 'difficulty' | 'assets' | 'code';
  description: string;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
}

export interface RemixResult {
  remixedGame: Game;
  remix: GameRemix;
  version: GameVersion;
}

export interface GameBrowseOptions {
  gameType?: GameType;
  creatorId?: string;
  serverId?: string;
  isPublic?: boolean;
  minPlayCount?: number;
  sortBy?: 'popularity' | 'recent' | 'remixes' | 'plays';
  limit?: number;
  offset?: number;
}

@injectable()
export class GameRemixService {
  constructor(
    @inject(TYPES.DatabaseService) private prisma: PrismaClient,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.GameGeneratorService) private gameGenerator: GameGeneratorService
  ) {}

  /**
   * Create a remix of an existing game
   */
  async createRemix(params: RemixGameParams): Promise<RemixResult> {
    const { originalGameId, remixTitle, remixDescription, remixType, modifications, creatorId, serverId } = params;

    // Get the original game
    const originalGame = await this.prisma.game.findUnique({
      where: { id: originalGameId },
      include: { template: true }
    });

    if (!originalGame) {
      throw new Error('Original game not found');
    }

    if (!originalGame.isPublic) {
      throw new Error('Cannot remix private games');
    }

    // Apply modifications to the game
    const modifiedGame = await this.applyModifications(originalGame, modifications);

    // Create the new remixed game
    const remixedGame = await this.prisma.game.create({
      data: {
        shortId: this.generateShortId(),
        serverId,
        creatorId,
        name: remixTitle || `${originalGame.name} (Remix)`,
        description: remixDescription || `Remix of ${originalGame.name}`,
        type: originalGame.type,
        templateId: originalGame.templateId,
        code: modifiedGame.code,
        assets: modifiedGame.assets,
        metadata: {
          ...modifiedGame.metadata,
          isRemix: true,
          originalGameId,
          remixType,
          modifications: modifications.map(mod => ({
            type: mod.type,
            description: mod.description
          }))
        },
        isPublic: true
      }
    });

    // Create remix relationship
    const remix = await this.prisma.gameRemix.create({
      data: {
        originalGameId,
        remixGameId: remixedGame.id,
        remixType,
        title: remixTitle,
        description: remixDescription,
        changes: modifications,
        remixedByUserId: creatorId
      }
    });

    // Create initial version
    const version = await this.prisma.gameVersion.create({
      data: {
        gameId: remixedGame.id,
        remixId: remix.id,
        version: '1.0',
        title: remixedGame.name,
        description: remixedGame.description,
        code: remixedGame.code,
        assets: remixedGame.assets,
        metadata: remixedGame.metadata,
        changelog: `Initial remix from ${originalGame.name}`,
        changes: modifications,
        isLatest: true,
        createdByUserId: creatorId
      }
    });

    // Update original game's remix count
    await this.prisma.game.update({
      where: { id: originalGameId },
      data: { remixCount: { increment: 1 } }
    });

    // Clear relevant caches
    await this.cache.delete(`game:${originalGameId}`);
    await this.cache.delete(`trending_games`);

    console.log(`✅ Created remix ${remixedGame.id} from original game ${originalGameId}`);

    return { remixedGame, remix, version };
  }

  /**
   * Get games available for remixing
   */
  async browseGamesForRemix(options: GameBrowseOptions = {}): Promise<Game[]> {
    const {
      gameType,
      creatorId,
      serverId,
      isPublic = true,
      minPlayCount = 0,
      sortBy = 'popularity',
      limit = 20,
      offset = 0
    } = options;

    const cacheKey = `browse_games:${JSON.stringify(options)}`;
    const cached = await this.cache.get<Game[]>(cacheKey);
    if (cached) return cached;

    const where: any = {
      isPublic,
      playCount: { gte: minPlayCount }
    };

    if (gameType) where.type = gameType;
    if (creatorId) where.creatorId = creatorId;
    if (serverId) where.serverId = serverId;

    let orderBy: any = {};
    switch (sortBy) {
      case 'popularity':
        orderBy = [{ playCount: 'desc' }, { remixCount: 'desc' }];
        break;
      case 'recent':
        orderBy = { createdAt: 'desc' };
        break;
      case 'remixes':
        orderBy = { remixCount: 'desc' };
        break;
      case 'plays':
        orderBy = { playCount: 'desc' };
        break;
    }

    const games = await this.prisma.game.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include: {
        creator: { select: { username: true, avatarUrl: true } },
        _count: { select: { originalGameRemixes: true } }
      }
    });

    await this.cache.set(cacheKey, games, 300); // 5 minutes
    return games;
  }

  /**
   * Get remix information for a game
   */
  async getRemixInfo(gameId: string): Promise<GameRemix | null> {
    const cacheKey = `remix_info:${gameId}`;
    const cached = await this.cache.get<GameRemix | null>(cacheKey);
    if (cached !== undefined) return cached;

    const remix = await this.prisma.gameRemix.findUnique({
      where: { remixGameId: gameId },
      include: {
        originalGame: {
          select: { id: true, name: true, creator: { select: { username: true } } }
        },
        remixedBy: { select: { username: true, avatarUrl: true } }
      }
    });

    await this.cache.set(cacheKey, remix, 900); // 15 minutes
    return remix;
  }

  /**
   * Get all remixes of a game
   */
  async getGameRemixes(gameId: string, limit = 10, offset = 0): Promise<GameRemix[]> {
    const cacheKey = `game_remixes:${gameId}:${limit}:${offset}`;
    const cached = await this.cache.get<GameRemix[]>(cacheKey);
    if (cached) return cached;

    const remixes = await this.prisma.gameRemix.findMany({
      where: { originalGameId: gameId },
      orderBy: [{ popularity: 'desc' }, { remixedAt: 'desc' }],
      take: limit,
      skip: offset,
      include: {
        remixGame: {
          select: { id: true, shortId: true, name: true, description: true, playCount: true }
        },
        remixedBy: { select: { username: true, avatarUrl: true } }
      }
    });

    await this.cache.set(cacheKey, remixes, 600); // 10 minutes
    return remixes;
  }

  /**
   * Create a new version of a game
   */
  async createGameVersion(
    gameId: string,
    version: string,
    title: string,
    code: string,
    assets: any,
    metadata: any,
    changelog: string,
    createdByUserId: string,
    modifications: GameModification[] = []
  ): Promise<GameVersion> {
    // Mark previous versions as not latest
    await this.prisma.gameVersion.updateMany({
      where: { gameId, isLatest: true },
      data: { isLatest: false }
    });

    // Create new version
    const gameVersion = await this.prisma.gameVersion.create({
      data: {
        gameId,
        version,
        title,
        code,
        assets,
        metadata,
        changelog,
        changes: modifications,
        isLatest: true,
        createdByUserId
      }
    });

    // Update the main game with latest version
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        code,
        assets,
        metadata,
        updatedAt: new Date()
      }
    });

    // Clear caches
    await this.cache.delete(`game:${gameId}`);
    await this.cache.delete(`game_versions:${gameId}`);

    return gameVersion;
  }

  /**
   * Get version history for a game
   */
  async getGameVersions(gameId: string): Promise<GameVersion[]> {
    const cacheKey = `game_versions:${gameId}`;
    const cached = await this.cache.get<GameVersion[]>(cacheKey);
    if (cached) return cached;

    const versions = await this.prisma.gameVersion.findMany({
      where: { gameId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { username: true, avatarUrl: true } }
      }
    });

    await this.cache.set(cacheKey, versions, 900); // 15 minutes
    return versions;
  }

  /**
   * Get specific version details by ID
   */
  async getVersionById(versionId: string): Promise<GameVersion | null> {
    const cacheKey = `version_details:${versionId}`;
    const cached = await this.cache.get<GameVersion | null>(cacheKey);
    if (cached !== undefined) return cached;

    const version = await this.prisma.gameVersion.findUnique({
      where: { id: versionId },
      include: {
        createdBy: { select: { username: true, avatarUrl: true } },
        game: { select: { name: true, shortId: true, type: true } },
        remix: {
          include: {
            originalGame: { select: { name: true, creator: { select: { username: true } } } },
            remixedBy: { select: { username: true } }
          }
        }
      }
    });

    await this.cache.set(cacheKey, version, 900); // 15 minutes
    return version;
  }

  /**
   * Compare two versions and show differences
   */
  async compareVersions(versionId1: string, versionId2: string): Promise<{
    version1: GameVersion;
    version2: GameVersion; 
    differences: {
      type: string;
      field: string;
      oldValue: any;
      newValue: any;
      description: string;
    }[];
  } | null> {
    const [v1, v2] = await Promise.all([
      this.getVersionById(versionId1),
      this.getVersionById(versionId2)
    ]);

    if (!v1 || !v2) return null;

    const differences = [];

    // Compare titles
    if (v1.title !== v2.title) {
      differences.push({
        type: 'title',
        field: 'Title',
        oldValue: v1.title,
        newValue: v2.title,
        description: 'Game title was changed'
      });
    }

    // Compare descriptions
    if (v1.description !== v2.description) {
      differences.push({
        type: 'description',
        field: 'Description',
        oldValue: v1.description,
        newValue: v2.description,
        description: 'Game description was updated'
      });
    }

    // Compare modifications
    const v1Changes = (v1.changes as any[]) || [];
    const v2Changes = (v2.changes as any[]) || [];
    
    if (JSON.stringify(v1Changes) !== JSON.stringify(v2Changes)) {
      differences.push({
        type: 'modifications',
        field: 'Modifications',
        oldValue: v1Changes,
        newValue: v2Changes,
        description: 'Game modifications were changed'
      });
    }

    return { version1: v1, version2: v2, differences };
  }

  /**
   * Get remixes created by a specific user
   */
  async getRemixesByCreator(creatorId: string, limit = 10): Promise<GameRemix[]> {
    const cacheKey = `user_remixes:${creatorId}:${limit}`;
    const cached = await this.cache.get<GameRemix[]>(cacheKey);
    if (cached) return cached;

    const remixes = await this.prisma.gameRemix.findMany({
      where: { remixedByUserId: creatorId },
      orderBy: { remixedAt: 'desc' },
      take: limit,
      include: {
        originalGame: {
          select: { name: true, creator: { select: { username: true } } }
        },
        remixGame: {
          select: { 
            id: true,
            shortId: true,
            name: true,
            playCount: true,
            createdAt: true
          }
        },
        remixedBy: { select: { username: true, avatarUrl: true } }
      }
    });

    await this.cache.set(cacheKey, remixes, 600); // 10 minutes
    return remixes;
  }

  /**
   * Get comprehensive remix analytics
   */
  async getRemixAnalytics(timeframe: 'day' | 'week' | 'month' | 'all' = 'week'): Promise<{
    totalRemixes: number;
    totalPlays: number;
    avgPlaysPerRemix: number;
    totalCreators: number;
    topGameTypes: { type: string; count: number; percentage: number }[];
    topTemplates: { templateId: string; count: number; name: string }[];
    remixGrowth: { date: string; count: number }[];
    creatorLeaderboard: { username: string; remixes: number; totalPlays: number }[];
    popularOriginals: { game: any; remixCount: number }[];
  }> {
    const cacheKey = `remix_analytics:${timeframe}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    switch (timeframe) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'all':
        startDate = new Date('2020-01-01'); // Arbitrary old date
        break;
    }

    // Get remixes in timeframe
    const remixes = await this.prisma.gameRemix.findMany({
      where: {
        remixedAt: { gte: startDate }
      },
      include: {
        remixGame: true,
        originalGame: { 
          include: { 
            creator: { select: { username: true } },
            _count: { select: { originalGameRemixes: true } }
          } 
        },
        remixedBy: { select: { username: true } }
      }
    });

    const totalRemixes = remixes.length;
    const totalPlays = remixes.reduce((sum, remix) => sum + remix.remixGame.playCount, 0);
    const avgPlaysPerRemix = totalRemixes > 0 ? Math.round(totalPlays / totalRemixes) : 0;
    
    // Unique creators
    const uniqueCreators = new Set(remixes.map(r => r.remixedByUserId)).size;

    // Game type analysis
    const gameTypeCount: Record<string, number> = {};
    remixes.forEach(remix => {
      const type = remix.originalGame.type;
      gameTypeCount[type] = (gameTypeCount[type] || 0) + 1;
    });

    const topGameTypes = Object.entries(gameTypeCount)
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / totalRemixes) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Template analysis (if we track template usage)
    const templateCount: Record<string, number> = {};
    const topTemplates = Object.entries(templateCount)
      .map(([templateId, count]) => ({
        templateId,
        count,
        name: templateId // Would map to actual template names
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Growth over time (daily for the timeframe)
    const remixGrowth: { date: string; count: number }[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.ceil((now.getTime() - startDate.getTime()) / dayMs);
    
    for (let i = 0; i < Math.min(days, 30); i++) {
      const day = new Date(startDate.getTime() + i * dayMs);
      const dayStart = new Date(day.setHours(0, 0, 0, 0));
      const dayEnd = new Date(day.setHours(23, 59, 59, 999));
      
      const dayRemixes = remixes.filter(r => 
        r.remixedAt >= dayStart && r.remixedAt <= dayEnd
      );

      remixGrowth.push({
        date: dayStart.toISOString().split('T')[0],
        count: dayRemixes.length
      });
    }

    // Creator leaderboard
    const creatorStats: Record<string, { remixes: number; totalPlays: number }> = {};
    remixes.forEach(remix => {
      const username = remix.remixedBy?.username || 'Unknown';
      if (!creatorStats[username]) {
        creatorStats[username] = { remixes: 0, totalPlays: 0 };
      }
      creatorStats[username].remixes++;
      creatorStats[username].totalPlays += remix.remixGame.playCount;
    });

    const creatorLeaderboard = Object.entries(creatorStats)
      .map(([username, stats]) => ({ username, ...stats }))
      .sort((a, b) => b.remixes - a.remixes || b.totalPlays - a.totalPlays)
      .slice(0, 10);

    // Most remixed original games
    const originalGameCount: Record<string, { game: any; count: number }> = {};
    remixes.forEach(remix => {
      const gameId = remix.originalGame.id;
      if (!originalGameCount[gameId]) {
        originalGameCount[gameId] = { game: remix.originalGame, count: 0 };
      }
      originalGameCount[gameId].count++;
    });

    const popularOriginals = Object.values(originalGameCount)
      .map(({ game, count }) => ({ game, remixCount: count }))
      .sort((a, b) => b.remixCount - a.remixCount)
      .slice(0, 10);

    const analytics = {
      totalRemixes,
      totalPlays,
      avgPlaysPerRemix,
      totalCreators: uniqueCreators,
      topGameTypes,
      topTemplates,
      remixGrowth,
      creatorLeaderboard,
      popularOriginals
    };

    // Cache for different durations based on timeframe
    const cacheDuration = timeframe === 'day' ? 300 : timeframe === 'week' ? 900 : 3600; // 5min, 15min, 1hr
    await this.cache.set(cacheKey, analytics, cacheDuration);

    return analytics;
  }

  /**
   * Get trending remixes
   */
  async getTrendingRemixes(limit = 10): Promise<GameRemix[]> {
    const cacheKey = `trending_remixes:${limit}`;
    const cached = await this.cache.get<GameRemix[]>(cacheKey);
    if (cached) return cached;

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const remixes = await this.prisma.gameRemix.findMany({
      where: {
        remixedAt: { gte: oneWeekAgo }
      },
      orderBy: [
        { popularity: 'desc' },
        { forkCount: 'desc' },
        { remixedAt: 'desc' }
      ],
      take: limit,
      include: {
        remixGame: {
          select: { id: true, shortId: true, name: true, description: true, playCount: true }
        },
        originalGame: {
          select: { id: true, name: true, creator: { select: { username: true } } }
        },
        remixedBy: { select: { username: true, avatarUrl: true } }
      }
    });

    await this.cache.set(cacheKey, remixes, 1800); // 30 minutes
    return remixes;
  }

  // Private helper methods

  /**
   * Apply modifications to a game
   */
  private async applyModifications(originalGame: Game, modifications: GameModification[]): Promise<{
    code: string;
    assets: any;
    metadata: any;
  }> {
    let modifiedCode = originalGame.code;
    let modifiedAssets = { ...originalGame.assets };
    let modifiedMetadata = { ...originalGame.metadata };

    for (const modification of modifications) {
      switch (modification.type) {
        case 'style':
          modifiedCode = await this.applyStyleModification(modifiedCode, modification);
          break;
        case 'mechanics':
          modifiedCode = await this.applyMechanicsModification(modifiedCode, modification);
          break;
        case 'theme':
          modifiedCode = await this.applyThemeModification(modifiedCode, modification);
          modifiedAssets = await this.applyThemeToAssets(modifiedAssets, modification);
          break;
        case 'difficulty':
          modifiedCode = await this.applyDifficultyModification(modifiedCode, modification);
          break;
        case 'assets':
          modifiedAssets = await this.applyAssetModification(modifiedAssets, modification);
          break;
        case 'code':
          modifiedCode = await this.applyCodeModification(modifiedCode, modification);
          break;
      }
    }

    return {
      code: modifiedCode,
      assets: modifiedAssets,
      metadata: modifiedMetadata
    };
  }

  /**
   * Apply style modifications to game code
   */
  private async applyStyleModification(code: string, modification: GameModification): Promise<string> {
    // Apply style changes like color schemes, UI layout, visual effects
    let modifiedCode = code;

    if (modification.newValue?.colorScheme) {
      const { primary, secondary, background } = modification.newValue.colorScheme;
      // Replace color values in the code
      modifiedCode = modifiedCode
        .replace(/0x[0-9a-fA-F]{6}/g, (match) => {
          if (match.includes('0x4a90e2')) return primary;
          if (match.includes('0x50c878')) return secondary;
          if (match.includes('0x333333')) return background;
          return match;
        });
    }

    return modifiedCode;
  }

  /**
   * Apply mechanics modifications to game code
   */
  private async applyMechanicsModification(code: string, modification: GameModification): Promise<string> {
    // Apply gameplay mechanics changes
    let modifiedCode = code;

    if (modification.newValue?.jumpHeight && modification.oldValue?.jumpHeight) {
      const oldHeight = modification.oldValue.jumpHeight;
      const newHeight = modification.newValue.jumpHeight;
      modifiedCode = modifiedCode.replace(
        new RegExp(`jumpHeight\\s*=\\s*${oldHeight}`, 'g'),
        `jumpHeight = ${newHeight}`
      );
    }

    if (modification.newValue?.speed && modification.oldValue?.speed) {
      const oldSpeed = modification.oldValue.speed;
      const newSpeed = modification.newValue.speed;
      modifiedCode = modifiedCode.replace(
        new RegExp(`speed\\s*=\\s*${oldSpeed}`, 'g'),
        `speed = ${newSpeed}`
      );
    }

    return modifiedCode;
  }

  /**
   * Apply theme modifications to game code
   */
  private async applyThemeModification(code: string, modification: GameModification): Promise<string> {
    // Apply thematic changes to text, story, setting
    let modifiedCode = code;

    if (modification.newValue?.theme) {
      const { oldTheme, newTheme } = modification.newValue;
      
      // Replace theme-related text and variables
      const themeReplacements: Record<string, string> = {
        'forest': 'jungle',
        'knight': 'warrior',
        'castle': 'fortress',
        'medieval': 'ancient'
      };

      Object.entries(themeReplacements).forEach(([old, newVal]) => {
        modifiedCode = modifiedCode.replace(new RegExp(old, 'gi'), newVal);
      });
    }

    return modifiedCode;
  }

  /**
   * Apply theme changes to assets
   */
  private async applyThemeToAssets(assets: any, modification: GameModification): Promise<any> {
    // This would integrate with the asset generation service to create themed assets
    return { ...assets, themeModified: true, theme: modification.newValue?.theme };
  }

  /**
   * Apply difficulty modifications
   */
  private async applyDifficultyModification(code: string, modification: GameModification): Promise<string> {
    let modifiedCode = code;

    const { difficulty } = modification.newValue || {};
    
    if (difficulty === 'easy') {
      modifiedCode = modifiedCode
        .replace(/enemySpeed\s*=\s*\d+/g, 'enemySpeed = 100')
        .replace(/enemyDamage\s*=\s*\d+/g, 'enemyDamage = 10');
    } else if (difficulty === 'hard') {
      modifiedCode = modifiedCode
        .replace(/enemySpeed\s*=\s*\d+/g, 'enemySpeed = 300')
        .replace(/enemyDamage\s*=\s*\d+/g, 'enemyDamage = 30');
    }

    return modifiedCode;
  }

  /**
   * Apply asset modifications
   */
  private async applyAssetModification(assets: any, modification: GameModification): Promise<any> {
    const modifiedAssets = { ...assets };
    
    if (modification.newValue?.assetUpdates) {
      Object.assign(modifiedAssets, modification.newValue.assetUpdates);
    }

    return modifiedAssets;
  }

  /**
   * Apply direct code modifications
   */
  private async applyCodeModification(code: string, modification: GameModification): Promise<string> {
    let modifiedCode = code;

    if (modification.oldValue && modification.newValue) {
      modifiedCode = modifiedCode.replace(
        new RegExp(modification.oldValue, 'g'),
        modification.newValue
      );
    }

    return modifiedCode;
  }

  /**
   * Generate a short ID for games
   */
  private generateShortId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}