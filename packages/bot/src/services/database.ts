import { injectable } from 'inversify';
import { PrismaClient } from '../generated/client.js';
import { User, Server, Game, GameSession, LeaderboardEntry, GameType } from '@gamevibe/shared';

@injectable()
export class DatabaseService {
  private _prisma: PrismaClient;
  
  constructor() {
    this._prisma = new PrismaClient();
  }

  get prisma(): PrismaClient {
    return this._prisma;
  }
  
  // User operations
  async getUser(discordId: string): Promise<User | null> {
    const user = await this._prisma.user.findUnique({
      where: { discordId }
    });
    
    return user ? this.transformUser(user) : null;
  }

  async getUserByDiscordId(discordId: string): Promise<User | null> {
    return this.getUser(discordId);
  }
  
  async createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user = await this._prisma.user.create({
      data: {
        discordId: data.discordId,
        username: data.username,
        discriminator: data.discriminator,
        avatarUrl: data.avatarUrl,
        premiumTier: data.premiumTier,
        premiumExpiresAt: data.premiumExpiresAt
      }
    });
    
    return this.transformUser(user);
  }
  
  async upsertUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user = await this._prisma.user.upsert({
      where: { discordId: data.discordId },
      create: {
        discordId: data.discordId,
        username: data.username,
        discriminator: data.discriminator,
        avatarUrl: data.avatarUrl,
        premiumTier: data.premiumTier,
        premiumExpiresAt: data.premiumExpiresAt
      },
      update: {
        username: data.username,
        discriminator: data.discriminator,
        avatarUrl: data.avatarUrl,
        premiumTier: data.premiumTier,
        premiumExpiresAt: data.premiumExpiresAt
      }
    });
    
    return this.transformUser(user);
  }
  
  // Server operations
  async getServer(discordId: string): Promise<Server | null> {
    const server = await this._prisma.server.findUnique({
      where: { discordId }
    });
    
    return server ? this.transformServer(server) : null;
  }
  
  async upsertServer(data: {
    discordId: string;
    name: string;
    memberCount: number;
  }): Promise<Server> {
    const server = await this._prisma.server.upsert({
      where: { discordId: data.discordId },
      create: {
        discordId: data.discordId,
        name: data.name,
        memberCount: data.memberCount,
        premiumTier: 0,
        settings: {}
      },
      update: {
        name: data.name,
        memberCount: data.memberCount
      }
    });
    
    return this.transformServer(server);
  }
  
  // Game operations
  async createGame(data: {
    shortId: string;
    serverId: string;
    creatorId: string;
    name: string;
    description: string;
    type: GameType;
    templateId?: string;
    code: string;
    assets?: Record<string, any>;
    metadata?: Record<string, any>;
    isPublic?: boolean;
  }): Promise<Game> {
    // Get server and creator IDs from discord IDs
    const server = await this._prisma.server.findUnique({ where: { discordId: data.serverId } });
    const creator = await this._prisma.user.findUnique({ where: { discordId: data.creatorId } });
    
    if (!server || !creator) {
      throw new Error('Server or creator not found');
    }
    
    const game = await this._prisma.game.create({
      data: {
        shortId: data.shortId,
        serverId: server.id,
        creatorId: creator.id,
        name: data.name,
        description: data.description,
        type: data.type.toUpperCase().replace('-', '_') as any,
        templateId: data.templateId,
        code: data.code,
        assets: data.assets || {},
        metadata: data.metadata || {},
        isPublic: data.isPublic ?? true
      }
    });
    
    return this.transformGame(game);
  }
  
  async getGame(shortId: string): Promise<Game | null> {
    const game = await this._prisma.game.findUnique({
      where: { shortId },
      include: {
        server: true,
        creator: true
      }
    });
    
    return game ? this.transformGame(game) : null;
  }
  
  async incrementPlayCount(gameIdOrShortId: string): Promise<void> {
    // Try to find by shortId first (most common case from Discord buttons)
    const game = await this._prisma.game.findFirst({
      where: {
        OR: [
          { shortId: gameIdOrShortId },
          { id: gameIdOrShortId }
        ]
      }
    });
    
    if (game) {
      await this._prisma.game.update({
        where: { id: game.id },
        data: { playCount: { increment: 1 } }
      });
    }
  }
  
  // Game session operations
  async createGameSession(data: {
    gameId: string;
    serverId: string;
    channelId: string;
    activePlayers?: number;
  }): Promise<GameSession> {
    const session = await this._prisma.gameSession.create({
      data: {
        gameId: data.gameId,
        serverId: data.serverId,
        channelId: data.channelId,
        activePlayers: data.activePlayers || 1
      }
    });
    
    return this.transformGameSession(session);
  }
  
  async endGameSession(sessionId: string): Promise<void> {
    await this._prisma.gameSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() }
    });
  }
  
  // Leaderboard operations
  async addLeaderboardEntry(data: {
    gameId: string;
    userId: string;
    score: number;
    metadata?: Record<string, any>;
  }): Promise<LeaderboardEntry> {
    const entry = await this._prisma.leaderboardEntry.upsert({
      where: {
        gameId_userId: {
          gameId: data.gameId,
          userId: data.userId
        }
      },
      create: {
        gameId: data.gameId,
        userId: data.userId,
        score: data.score,
        metadata: data.metadata || {}
      },
      update: {
        score: data.score,
        metadata: data.metadata || {},
        achievedAt: new Date()
      }
    });
    
    return this.transformLeaderboardEntry(entry);
  }
  
  async getLeaderboard(gameId: string, limit = 10): Promise<LeaderboardEntry[]> {
    const entries = await this._prisma.leaderboardEntry.findMany({
      where: { gameId },
      orderBy: { score: 'desc' },
      take: limit,
      include: {
        user: true
      }
    });
    
    return entries.map((entry: any) => this.transformLeaderboardEntry(entry));
  }
  
  // Health check
  async raw(query: string): Promise<any> {
    if (query === 'SELECT 1') {
      return await this._prisma.$queryRaw`SELECT 1`;
    }
    throw new Error('Only health check queries supported');
  }
  
  // Cleanup
  async disconnect(): Promise<void> {
    await this._prisma.$disconnect();
  }
  
  // Transform Prisma models to application types
  private transformUser(user: any): User {
    return {
      id: user.id,
      discordId: user.discordId,
      username: user.username,
      discriminator: user.discriminator,
      avatarUrl: user.avatarUrl,
      premiumTier: user.premiumTier,
      premiumExpiresAt: user.premiumExpiresAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
  
  private transformServer(server: any): Server {
    return {
      id: server.id,
      discordId: server.discordId,
      name: server.name,
      memberCount: server.memberCount,
      premiumTier: server.premiumTier,
      premiumExpiresAt: server.premiumExpiresAt,
      settings: typeof server.settings === 'string' ? JSON.parse(server.settings) : server.settings,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt
    };
  }
  
  private transformGame(game: any): Game {
    return {
      id: game.id,
      shortId: game.shortId,
      serverId: game.server?.discordId || game.serverId,
      creatorId: game.creator?.discordId || game.creatorId,
      name: game.name,
      description: game.description,
      type: game.type.toLowerCase().replace('_', '-') as GameType,
      templateId: game.templateId,
      code: game.code,
      assets: typeof game.assets === 'string' ? JSON.parse(game.assets) : game.assets,
      metadata: typeof game.metadata === 'string' ? JSON.parse(game.metadata) : game.metadata,
      playCount: game.playCount,
      remixCount: game.remixCount,
      isPublic: game.isPublic,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt
    };
  }
  
  private transformGameSession(session: any): GameSession {
    return {
      id: session.id,
      gameId: session.gameId,
      serverId: session.serverId,
      channelId: session.channelId,
      activePlayers: session.activePlayers,
      state: typeof session.state === 'string' ? JSON.parse(session.state) : session.state,
      startedAt: session.startedAt,
      endedAt: session.endedAt
    };
  }
  
  private transformLeaderboardEntry(entry: any): LeaderboardEntry {
    return {
      id: entry.id,
      gameId: entry.gameId,
      userId: entry.user?.discordId || entry.userId,
      score: entry.score,
      metadata: typeof entry.metadata === 'string' ? JSON.parse(entry.metadata) : entry.metadata,
      achievedAt: entry.achievedAt
    };
  }
}