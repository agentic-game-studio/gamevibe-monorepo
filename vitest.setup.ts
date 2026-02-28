import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/gamevibe_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DISCORD_TOKEN = 'test-discord-token';
process.env.DISCORD_CLIENT_ID = 'test-client-id';
process.env.DISCORD_PUBLIC_KEY = 'test-public-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.OPENAI_API_KEY = 'test-openai-key';

// Global test utilities
global.testUtils = {
  // Generate random Discord IDs
  generateDiscordId: () => Math.floor(Math.random() * 1000000000000000000).toString(),
  
  // Generate random game data
  generateGameData: () => ({
    id: Math.random().toString(36).substring(2, 15),
    title: `Test Game ${Math.floor(Math.random() * 1000)}`,
    description: 'A test game for unit testing',
    type: 'PLATFORMER',
    serverId: Math.floor(Math.random() * 1000000000000000000).toString(),
    creatorId: Math.floor(Math.random() * 1000000000000000000).toString(),
    shortId: Math.random().toString(36).substring(2, 8).toUpperCase(),
  }),
  
  // Mock Discord interaction
  createMockInteraction: (options = {}) => ({
    id: Math.floor(Math.random() * 1000000000000000000).toString(),
    guildId: Math.floor(Math.random() * 1000000000000000000).toString(),
    channelId: Math.floor(Math.random() * 1000000000000000000).toString(),
    user: {
      id: Math.floor(Math.random() * 1000000000000000000).toString(),
      username: 'testuser',
      discriminator: '0001',
      avatar: null,
    },
    reply: vi.fn(),
    editReply: vi.fn(),
    deferReply: vi.fn(),
    followUp: vi.fn(),
    ...options,
  }),
};

// Setup test timeouts
beforeAll(() => {
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

// Clear mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  vi.resetModules();
});

// Mock external services
vi.mock('discord.js', () => ({
  Client: vi.fn(() => ({
    login: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
  })),
  REST: vi.fn(),
  Routes: {},
  SlashCommandBuilder: vi.fn(() => ({
    setName: vi.fn().mockReturnThis(),
    setDescription: vi.fn().mockReturnThis(),
    addStringOption: vi.fn().mockReturnThis(),
    addIntegerOption: vi.fn().mockReturnThis(),
    addBooleanOption: vi.fn().mockReturnThis(),
    addUserOption: vi.fn().mockReturnThis(),
    addChannelOption: vi.fn().mockReturnThis(),
    addRoleOption: vi.fn().mockReturnThis(),
    addSubcommand: vi.fn().mockReturnThis(),
    addSubcommandGroup: vi.fn().mockReturnThis(),
  })),
  EmbedBuilder: vi.fn(() => ({
    setTitle: vi.fn().mockReturnThis(),
    setDescription: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    addFields: vi.fn().mockReturnThis(),
    setFooter: vi.fn().mockReturnThis(),
    setTimestamp: vi.fn().mockReturnThis(),
    setThumbnail: vi.fn().mockReturnThis(),
    setImage: vi.fn().mockReturnThis(),
    setURL: vi.fn().mockReturnThis(),
    setAuthor: vi.fn().mockReturnThis(),
  })),
  ActionRowBuilder: vi.fn(() => ({
    addComponents: vi.fn().mockReturnThis(),
  })),
  ButtonBuilder: vi.fn(() => ({
    setCustomId: vi.fn().mockReturnThis(),
    setLabel: vi.fn().mockReturnThis(),
    setStyle: vi.fn().mockReturnThis(),
    setEmoji: vi.fn().mockReturnThis(),
    setDisabled: vi.fn().mockReturnThis(),
    setURL: vi.fn().mockReturnThis(),
  })),
  SelectMenuBuilder: vi.fn(() => ({
    setCustomId: vi.fn().mockReturnThis(),
    setPlaceholder: vi.fn().mockReturnThis(),
    addOptions: vi.fn().mockReturnThis(),
    setMinValues: vi.fn().mockReturnThis(),
    setMaxValues: vi.fn().mockReturnThis(),
  })),
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5,
  },
  ActivityType: {
    Playing: 0,
    Streaming: 1,
    Listening: 2,
    Watching: 3,
    Custom: 4,
    Competing: 5,
  },
  GatewayIntentBits: {
    Guilds: 1 << 0,
    GuildMembers: 1 << 1,
    GuildBans: 1 << 2,
    GuildEmojisAndStickers: 1 << 3,
    GuildIntegrations: 1 << 4,
    GuildWebhooks: 1 << 5,
    GuildInvites: 1 << 6,
    GuildVoiceStates: 1 << 7,
    GuildPresences: 1 << 8,
    GuildMessages: 1 << 9,
    GuildMessageReactions: 1 << 10,
    GuildMessageTyping: 1 << 11,
    DirectMessages: 1 << 12,
    DirectMessageReactions: 1 << 13,
    DirectMessageTyping: 1 << 14,
    MessageContent: 1 << 15,
    GuildScheduledEvents: 1 << 16,
    AutoModerationConfiguration: 1 << 20,
    AutoModerationExecution: 1 << 21,
  },
}));