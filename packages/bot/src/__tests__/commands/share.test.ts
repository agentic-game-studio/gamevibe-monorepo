import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShareCommand } from '../../commands/share.js';
import { createMockInteraction, createMockDatabase, createMockCache } from '../utils/test-helpers.js';
import type { ChatInputCommandInteraction } from 'discord.js';

describe('ShareCommand', () => {
  let command: ShareCommand;
  let mockInteraction: ChatInputCommandInteraction;
  let mockDb: any;
  let mockPersonalCreditService: any;
  let mockAnalyticsService: any;
  let mockAchievementService: any;
  let mockSocialPreviewService: any;
  let mockLiveActivityService: any;
  let mockEmbedService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mocks
    mockDb = createMockDatabase();
    mockPersonalCreditService = {
      trackContentShare: vi.fn().mockResolvedValue(undefined),
      earnCredits: vi.fn().mockResolvedValue({ 
        success: true, 
        creditsEarned: 1,
        newBalance: 101,
        message: 'Earned 1 credit for sharing' 
      }),
    };
    mockAnalyticsService = {
      track: vi.fn(),
    };
    mockAchievementService = {
      checkAndUnlockAchievements: vi.fn(),
      checkProgress: vi.fn().mockResolvedValue([]), // Return empty array
    };
    mockSocialPreviewService = {
      generatePreviewCard: vi.fn().mockResolvedValue({
        imageUrl: 'https://example.com/preview.png',
        gifUrl: 'https://example.com/preview.gif',
        metadata: { width: 1200, height: 630 },
      }),
      getShareUrl: vi.fn().mockResolvedValue('https://gamevibe.ai/game/ABC123'),
      generateShareableURL: vi.fn().mockReturnValue('https://gamevibe.ai/share/game/ABC123'),
    };
    mockLiveActivityService = {
      recordActivity: vi.fn(),
    };
    mockEmbedService = {
      generateEmbedCode: vi.fn().mockResolvedValue({
        id: 'embed-123',
        embedId: 'embed-123',
        code: '<iframe src="https://gamevibe.ai/embed/game-123"></iframe>',
        embedUrl: 'https://gamevibe.ai/embed/game-123',
        directUrl: 'https://gamevibe.ai/embed/game-123',
        config: {
          width: 800,
          height: 600,
        },
      }),
    };

    // Create command with mocks
    command = new ShareCommand(
      mockDb as any,
      mockPersonalCreditService as any,
      mockAnalyticsService as any,
      mockAchievementService as any,
      mockSocialPreviewService as any,
      mockLiveActivityService as any,
      mockEmbedService as any
    );

    // Create mock interaction
    mockInteraction = createMockInteraction({
      options: {
        get: vi.fn((name) => {
          switch (name) {
            case 'game-id':
              return { value: 'ABC123' };
            case 'message':
              return { value: 'Check out this game!' };
            case 'include-embed':
              return { value: false };
            case 'embed-template':
              return { value: null };
            default:
              return null;
          }
        }),
      },
    });
  });

  describe('execute', () => {
    it('should share a game successfully', async () => {
      const mockGame = {
        id: 'game-123',
        name: 'Test Game',
        title: 'Test Game',
        description: 'A test game',
        shortId: 'ABC123',
        type: 'PLATFORMER',
        prompt: 'Create a platformer',
        creatorId: '111111111',
        serverId: '222222222',
        totalPlays: 150,
        playCount: 150,
        shareCount: 25,
        metadata: { totalShares: 25 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.getGame.mockResolvedValue(mockGame);
      mockDb.updateGame.mockResolvedValue({ ...mockGame, shareCount: 26 });

      await command.execute(mockInteraction);

      // Verify services were called correctly
      expect(mockDb.getGame).toHaveBeenCalledWith('ABC123');
      expect(mockPersonalCreditService.trackContentShare).toHaveBeenCalledWith(
        'game-123',
        'guild-123',
        'user-123'
      );
      expect(mockAnalyticsService.track).toHaveBeenCalledWith('game_shared', expect.objectContaining({
        gameId: 'game-123',
        sharerId: 'user-123',
        serverId: 'guild-123',
        channelId: undefined,
        hasCustomMessage: true,
        socialPreviewGenerated: true,
        embedGenerated: false,
        embedTemplate: null,
        embedId: null,
      }));
      expect(mockLiveActivityService.recordActivity).toHaveBeenCalledWith(
        'GAME_SHARED',
        'user-123',
        expect.objectContaining({
          gameTitle: 'Test Game',
          gameType: 'PLATFORMER',
          serverId: 'guild-123',
          hasCustomMessage: true,
          previewGenerated: true,
          embedGenerated: false,
          embedTemplate: null,
        }),
        'guild-123',
        'game-123'
      );

      // Verify interaction response
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        })
      );
    });

    it('should handle game not found error', async () => {
      mockDb.getGame.mockResolvedValue(null);

      await command.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Game not found. Please check the game ID and try again.'
      });
    });

    it('should generate embed code when requested', async () => {
      const mockGame = {
        id: 'game-123',
        name: 'Test Game',
        title: 'Test Game',
        description: 'A test game',
        shortId: 'ABC123',
        type: 'PLATFORMER',
        prompt: 'Create a platformer',
        creatorId: '111111111',
        serverId: '222222222',
        totalPlays: 150,
        playCount: 150,
        shareCount: 25,
        metadata: { totalShares: 25 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.getGame.mockResolvedValue(mockGame);
      mockDb.updateGame.mockResolvedValue({ ...mockGame, shareCount: 26 });
      
      // Update mock interaction to include embed option
      mockInteraction.options.get = vi.fn((name) => {
        switch (name) {
          case 'game-id':
            return { value: 'ABC123' };
          case 'message':
            return { value: 'Check out this game!' };
          case 'include-embed':
            return { value: true };
          case 'embed-template':
            return { value: 'medium' };
          default:
            return null;
        }
      });

      await command.execute(mockInteraction);

      expect(mockEmbedService.generateEmbedCode).toHaveBeenCalledWith(
        'game-123',
        {}, // config
        'user-123', // createdBy
        'medium' // template
      );
    });

    it('should handle sharing without custom message', async () => {
      const mockGame = {
        id: 'game-123',
        name: 'Test Game',
        title: 'Test Game',
        description: 'A test game',
        shortId: 'ABC123',
        type: 'PLATFORMER',
        prompt: 'Create a platformer',
        creatorId: '111111111',
        serverId: '222222222',
        totalPlays: 50,
        playCount: 50,
        shareCount: 10,
        metadata: { totalShares: 10 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.getGame.mockResolvedValue(mockGame);
      mockDb.updateGame.mockResolvedValue({ ...mockGame, shareCount: 11 });
      
      // Update mock interaction to have no custom message
      mockInteraction.options.get = vi.fn((name) => {
        switch (name) {
          case 'game-id':
            return { value: 'ABC123' };
          case 'message':
            return null; // No custom message
          case 'include-embed':
            return { value: false };
          case 'embed-template':
            return null;
          default:
            return null;
        }
      });

      await command.execute(mockInteraction);

      // Verify response structure and content
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Game shared with rich preview card'),
          embeds: expect.any(Array),
          components: expect.any(Array),
        })
      );
    });
  });

  describe('data', () => {
    it('should have correct command structure', () => {
      const commandData = command.data.toJSON();
      
      expect(commandData.name).toBe('share');
      expect(commandData.description).toBe('Share a game and earn credits');
      expect(commandData.options).toHaveLength(4);
      expect(commandData.options[0]).toMatchObject({
        name: 'game-id',
        description: 'The game ID to share',
        type: 3, // STRING type
        required: true,
      });
      expect(commandData.options[1]).toMatchObject({
        name: 'message',
        description: 'Optional message to include with the share',
        type: 3, // STRING type
        required: false,
      });
      expect(commandData.options[2]).toMatchObject({
        name: 'include-embed',
        description: 'Generate embed code for website sharing',
        type: 5, // BOOLEAN type
        required: false,
      });
      expect(commandData.options[3]).toMatchObject({
        name: 'embed-template',
        description: 'Quick embed template (only used if include-embed is true)',
        type: 3, // STRING type
        required: false,
      });
    });
  });
});