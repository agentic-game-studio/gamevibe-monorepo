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

    const gameSpec = await this.analyzeGameRequest(request.description, {
      type: request.type,
      playerCount: request.playerCount
    });

    const completeSpec: GameSpec = {
      ...gameSpec,
      originalDescription: request.description,
      playerCount: request.playerCount || gameSpec.playerCount || '1'
    };

    const template = await this.engine.selectTemplate(completeSpec);
    this.logger.info('Generating game code', { templateId: template?.id });

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
      type: completeSpec.type,
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
