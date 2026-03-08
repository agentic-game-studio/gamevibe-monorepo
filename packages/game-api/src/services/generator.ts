import { nanoid } from 'nanoid';
import {
  GeneratedGame,
  GameSpec,
  generateGameId
} from '@gamevibe/shared';
import { AIService } from '@gamevibe/ai-service';
import { GameEngine } from '@gamevibe/game-engine';
import { Logger } from '../utils/logger.js';
import { IPFSService } from './ipfs.js';
import { GameGenerationRequest } from '../types.js';

// Detect game type from description using keyword matching
function detectGameTypeFromDescription(description: string): string {
  const desc = description.toLowerCase();

  // Shooter keywords
  if (desc.includes('shoot') || desc.includes('space') || desc.includes('invader') ||
      desc.includes('galaga') || desc.includes('asteroid') || desc.includes('alien') ||
      desc.includes('bullet') || desc.includes('laser') || desc.includes('spaceship')) {
    return 'shooter';
  }

  // Endless runner keywords
  if (desc.includes('run') || desc.includes('runner') || desc.includes('endless') ||
      desc.includes('dash') || desc.includes('avoid')) {
    return 'endless-runner';
  }

  // Tower defense keywords
  if (desc.includes('tower') || desc.includes('defense') || desc.includes('defend') ||
      desc.includes('fortress') || desc.includes('base')) {
    return 'tower-defense';
  }

  // RPG/Adventure keywords
  if (desc.includes('rpg') || desc.includes('adventure') || desc.includes('explore') ||
      desc.includes('dungeon') || desc.includes('roguelike') || desc.includes('quest') ||
      desc.includes('dragon') || desc.includes('magic')) {
    return 'rpg';
  }

  // Puzzle keywords
  if (desc.includes('puzzle') || desc.includes('match') || desc.includes('gem') ||
      desc.includes('candy') || desc.includes('color') || desc.includes('tile') ||
      desc.includes('block') || desc.includes('connect')) {
    return 'puzzle';
  }

  // Platformer keywords (default for jump/collect)
  if (desc.includes('platform') || desc.includes('jump') || desc.includes('collect') ||
      desc.includes('coin') || desc.includes('hero') || desc.includes('level')) {
    return 'platformer';
  }

  return 'other';
}

export interface GameGeneratorConfig {
  minimaxApiKey: string;
  ipfs?: {
    pinataApiKey: string;
    pinataSecretKey: string;
  };
}

export class GameGeneratorService {
  private logger = new Logger('GameGenerator');
  private aiService: AIService;
  private engine: GameEngine;
  private ipfsService?: IPFSService;

  constructor(config: GameGeneratorConfig) {
    this.aiService = new AIService({ minimaxApiKey: config.minimaxApiKey });
    this.engine = new GameEngine();

    if (config.ipfs) {
      this.ipfsService = new IPFSService({
        pinataApiKey: config.ipfs.pinataApiKey,
        pinataSecretKey: config.ipfs.pinataSecretKey
      });
    }
  }

  async generateGame(
    request: GameGenerationRequest,
    creatorWallet?: string
  ): Promise<GeneratedGame & { ipfsCid?: string; transactionHash?: string }> {
    this.logger.info('Starting game generation', {
      description: request.description.slice(0, 50) + '...',
      type: request.type,
      playerCount: request.playerCount
    });

    // Detect type from description if not provided
    const detectedType = detectGameTypeFromDescription(request.description);
    this.logger.info('Detected game type from description', { detectedType });

    const gameSpec = await this.analyzeGameRequest(request.description, {
      type: request.type,
      playerCount: request.playerCount
    });

    // Use detected type to override AI's type guess (which may be wrong)
    const finalType = detectedType !== 'other' ? detectedType : (gameSpec.type || 'other');

    const completeSpec: GameSpec = {
      ...gameSpec,
      type: finalType,
      originalDescription: request.description,
      playerCount: request.playerCount || gameSpec.playerCount || '1'
    };

    const template = await this.engine.selectTemplate(completeSpec);
    this.logger.info('Generating game code', { templateId: template?.id, finalType });

    // Get game code from AI service (includes fallback if AI fails)
    const generatedCode = await this.aiService.generateGameCode(completeSpec, template);

    const compiled = await this.engine.compile(generatedCode, {
      includePhaserCDN: true,
      metadata: { name: completeSpec.name, description: completeSpec.description }
    });

    const gameId = await generateGameId();
    const shortId = nanoid(8);

    const game: GeneratedGame & { ipfsCid?: string; transactionHash?: string } = {
      id: gameId,
      shortId,
      name: completeSpec.name,
      description: completeSpec.description,
      type: finalType,
      code: compiled.code,
      playUrl: `https://gamevibe.ai/play/${shortId}`,
      thumbnailUrl: undefined
    };

    if (this.ipfsService && request.creatorWallet) {
      try {
        const ipfsResult = await this.ipfsService.uploadGame(game);
        game.ipfsCid = ipfsResult.cid;
        this.logger.info('Game uploaded to IPFS', { gameId, cid: ipfsResult.cid });
      } catch (ipfsError) {
        this.logger.warn('IPFS upload failed, continuing without IPFS', { error: ipfsError });
      }
    }

    this.logger.info('Game generated successfully', { gameId, shortId, type: game.type, hasIpfsCid: !!game.ipfsCid });
    return game;
  }

  private async analyzeGameRequest(description: string, context?: { type?: string; playerCount?: string }): Promise<GameSpec> {
    const result = await this.aiService.analyzeGameRequest(description, context);
    return {
      type: result.type || 'other',
      name: result.name || 'Untitled Game',
      description: result.description || description,
      originalDescription: description,
      coreMechanics: result.coreMechanics || [],
      features: result.features || [],
      playerCount: result.playerCount || '1',
      difficulty: result.difficulty || 'medium'
    };
  }

  async health(): Promise<boolean> {
    try {
      return await this.aiService.health();
    } catch {
      return false;
    }
  }
}
