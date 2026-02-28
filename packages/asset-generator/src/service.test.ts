import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetGeneratorService } from './service.js';
import { Logger } from '@gamevibe/shared';
import { VisualRequirements } from './types/index.js';

// Mock ioredis
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      setex: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
      pipeline: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([]),
      }),
    })),
  };
});

// Mock @aws-sdk/client-s3
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
}));

// Mock openai
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    images: {
      generate: vi.fn().mockResolvedValue({
        data: [{ url: 'https://example.com/generated-image.png' }],
      }),
    },
  })),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: () => 'test-id-123',
}));

describe('AssetGeneratorService', () => {
  let service: AssetGeneratorService;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    } as any;
  });

  it('should throw error if no generators are configured', () => {
    expect(() => {
      new AssetGeneratorService({
        storage: {
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret'
        },
        cache: {
          redis: {
            host: 'localhost',
            port: 6379
          },
          ttl: {
            hot: 3600,
            template: 86400,
            metadata: 7200
          }
        }
      }, mockLogger);
    }).toThrow('No asset generators configured');
  });

  it('should initialize with OpenAI generator', () => {
    const service = new AssetGeneratorService({
      openaiApiKey: 'test-api-key',
      storage: {
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret'
      },
      cache: {
        redis: {
          host: 'localhost',
          port: 6379
        },
        ttl: {
          hot: 3600,
          template: 86400,
          metadata: 7200
        }
      }
    }, mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Asset generator service initialized with 1 generators'
    );
  });

  it('should create a generation job', async () => {
    const service = new AssetGeneratorService({
      openaiApiKey: 'test-api-key',
      storage: {
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret'
      },
      cache: {
        redis: {
          host: 'localhost',
          port: 6379
        },
        ttl: {
          hot: 3600,
          template: 86400,
          metadata: 7200
        }
      }
    }, mockLogger);

    const requirements: VisualRequirements = {
      gameId: 'test-game-123',
      gameType: 'platformer',
      style: 'pixel-art',
      colorScheme: 'vibrant',
      theme: 'fantasy',
      description: 'A fantasy platformer game',
      sprites: [
        {
          name: 'player',
          description: 'Main character sprite',
          size: 'medium',
          tags: ['hero', 'character']
        }
      ],
      backgrounds: [
        {
          name: 'forest',
          description: 'Enchanted forest background',
          parallax: true
        }
      ]
    };

    const job = await service.generateGameAssets('test-game-123', requirements);

    expect(job).toMatchObject({
      gameId: 'test-game-123',
      status: 'processing',
      progress: 0,
      totalAssets: 2,
      completedAssets: 0
    });
    expect(job.id).toBeDefined();
  });

  it('should estimate generation cost', async () => {
    const service = new AssetGeneratorService({
      openaiApiKey: 'test-api-key',
      storage: {
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret'
      },
      cache: {
        redis: {
          host: 'localhost',
          port: 6379
        },
        ttl: {
          hot: 3600,
          template: 86400,
          metadata: 7200
        }
      }
    }, mockLogger);

    const requirements: VisualRequirements = {
      gameId: 'test-game-123',
      gameType: 'platformer',
      style: 'pixel-art',
      colorScheme: 'vibrant',
      theme: 'fantasy',
      description: 'A fantasy platformer game',
      sprites: [
        { name: 'player', description: 'Player sprite', size: 'medium', tags: [] },
        { name: 'enemy', description: 'Enemy sprite', size: 'small', tags: [] }
      ],
      backgrounds: [
        { name: 'level1', description: 'First level background' }
      ],
      ui: [
        { name: 'health-bar', type: 'healthbar', description: 'Player health bar' }
      ]
    };

    const cost = await service.estimateCost(requirements);

    expect(cost).toEqual({
      credits: 4, // 2 sprites + 1 background + 1 UI
      dollarAmount: 0.16 // $0.04 per image
    });
  });
});