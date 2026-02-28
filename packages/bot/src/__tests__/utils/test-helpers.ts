import { vi } from 'vitest';
import type { Client, ChatInputCommandInteraction } from 'discord.js';
import type { PrismaClient } from '../../generated/prisma/index.js';

// Mock Discord.js client
export const createMockClient = (): Client => ({
  user: { id: 'bot-123', username: 'TestBot' },
  login: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  emit: vi.fn(),
  guilds: {
    cache: new Map(),
  },
  users: {
    fetch: vi.fn().mockResolvedValue({ username: 'TestUser' }),
  },
  // Add other properties as needed
} as any);

// Mock interaction
export const createMockInteraction = (options = {}): ChatInputCommandInteraction => ({
  options: {
    getString: vi.fn(),
    getInteger: vi.fn(),
    getBoolean: vi.fn(),
    getUser: vi.fn(),
    get: vi.fn(),
  },
  user: {
    id: 'user-123',
    username: 'testuser',
    avatar: 'avatar-hash',
  },
  guild: {
    id: 'guild-123',
    name: 'Test Guild',
  },
  guildId: 'guild-123',
  reply: vi.fn(),
  deferReply: vi.fn(),
  editReply: vi.fn(),
  followUp: vi.fn(),
  ...options,
} as any);

// Mock Prisma client
export const createMockPrisma = (): PrismaClient => {
  const mockPrisma = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn((fn: any) => fn(mockPrisma)),
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  game: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  server: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  personalCredits: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  userPersonalCredits: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  creditBalance: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  creditTransaction: {
    create: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  personalCreditTransaction: {
    create: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  games: {
    count: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
  leaderboardEntry: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  achievement: {
    findMany: vi.fn(),
  },
  achievementProgress: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  } as any;
  
  return mockPrisma;
};

// Mock database service
export const createMockDatabase = () => {
  const mockPrisma = createMockPrisma();
  return {
    prisma: mockPrisma,
    // Add other DatabaseService methods as needed
    getUser: vi.fn(),
    getUserByDiscordId: vi.fn(),
    createUser: vi.fn(),
    upsertUser: vi.fn(),
    getGame: vi.fn(),
    createGame: vi.fn(),
    updateGame: vi.fn(),
    getServer: vi.fn(),
    createServer: vi.fn(),
    updateServer: vi.fn(),
  };
};

// Mock cache service
export const createMockCache = () => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  del: vi.fn(), // Add del method alias
  has: vi.fn(),
  clear: vi.fn(),
  keys: vi.fn(),
});

// Mock analytics service
export const createMockAnalytics = () => ({
  track: vi.fn(),
  identify: vi.fn(),
  page: vi.fn(),
  screen: vi.fn(),
  group: vi.fn(),
  alias: vi.fn(),
});

// Test data factories
export const createTestUser = (overrides = {}) => ({
  id: 'user-123',
  discordId: 'discord-123',
  username: 'testuser',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestGame = (overrides = {}) => ({
  id: 'game-123',
  title: 'Test Game',
  description: 'A test game',
  type: 'PLATFORMER',
  prompt: 'Create a platformer game',
  creatorId: 'user-123',
  serverId: 'server-123',
  shortId: 'ABC123',
  totalPlays: 0,
  shareCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestServer = (overrides = {}) => ({
  id: 'server-123',
  discordId: 'discord-server-123',
  name: 'Test Server',
  ownerId: 'owner-123',
  memberCount: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestSubscription = (overrides = {}) => ({
  id: 'sub-123',
  serverId: 'server-123',
  tier: 'PRO',
  status: 'active',
  stripeCustomerId: 'cus_123',
  stripeSubscriptionId: 'sub_123',
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper to setup common mocks
export const setupCommonMocks = () => {
  // Mock environment variables
  process.env.DISCORD_TOKEN = 'test-token';
  process.env.DISCORD_CLIENT_ID = 'test-client-id';
  process.env.DATABASE_URL = 'postgresql://test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  process.env.OPENAI_API_KEY = 'test-openai-key';
};

// Cleanup helper
export const cleanupMocks = () => {
  vi.clearAllMocks();
  vi.resetAllMocks();
};