import { Router } from 'express';
import { Logger } from '../utils/logger.js';
import {
  GameGenerationRequestSchema,
  GameQuerySchema,
  GeneratedGameResponseSchema,
  APIError
} from '../types.js';

const router = Router();
const logger = new Logger('GamesRouter');

let generatorService: any = null;
let servicePromise: Promise<any> | null = null;

async function getGeneratorService() {
  if (generatorService) return generatorService;
  if (servicePromise) return servicePromise;

  servicePromise = (async () => {
    const { GameGeneratorService } = await import('../services/generator.js');
    generatorService = new GameGeneratorService({
      minimaxApiKey: process.env.MINIMAX_API_KEY || '',
      ipfs: process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY ? {
        pinataApiKey: process.env.PINATA_API_KEY,
        pinataSecretKey: process.env.PINATA_SECRET_KEY
      } : undefined
    });
    console.log('[GamesRouter] Generator service initialized');
    return generatorService;
  })();
  return servicePromise;
}

router.post('/generate', async (req, res, next) => {
  try {
    if (!process.env.MINIMAX_API_KEY) {
      throw new APIError('MINIMAX_API_KEY not configured.', 503, 'SERVICE_UNAVAILABLE');
    }

    const parseResult = GameGenerationRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new APIError('Invalid request: ' + parseResult.error.errors.map(e => e.message).join(', '), 400, 'VALIDATION_ERROR');
    }

    const { description, type, playerCount, bypassCache, creatorWallet, useAI } = parseResult.data;
    logger.info('Game generation requested', { description: description.slice(0, 50) + '...', type, useAI, hasWallet: !!creatorWallet });

    const genService = await getGeneratorService();

    // Set a timeout for game generation
    const generationTimeout = 300000; // 5 minutes for complex AI generation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Game generation timed out. Please try a simpler game description.')), generationTimeout);
    });

    const gamePromise = genService.generateGame({ description, type, playerCount, bypassCache, useAI }, creatorWallet);

    const game = await Promise.race([gamePromise, timeoutPromise]);

    const response = GeneratedGameResponseSchema.parse({ ...game, createdAt: new Date().toISOString() });
    res.status(201).json(response);
  } catch (error) {
    if (error instanceof APIError) {
      res.status(error.statusCode).json({ error: error.code, message: error.message });
      return;
    }

    // Handle timeout errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
      logger.error('Game generation timed out', { error: errorMessage });
      res.status(504).json({
        error: 'GENERATION_TIMEOUT',
        message: 'The game generation took too long. Please try a simpler game description like "simple platformer game" or "basic shooter".'
      });
      return;
    }

    // Handle other errors
    logger.error('Game generation error', { error });
    res.status(500).json({
      error: 'GENERATION_ERROR',
      message: errorMessage || 'Failed to generate game. Please try again.'
    });
  }
});

router.get('/:shortId', async (req, res, next) => {
  try {
    const { shortId } = req.params;
    if (!shortId || shortId.length < 6) {
      throw new APIError('Invalid game ID', 400, 'INVALID_ID');
    }
    res.status(404).json({ error: 'NOT_FOUND', message: 'Game not found' });
  } catch (error) {
    if (error instanceof APIError) {
      res.status(error.statusCode).json({ error: error.code, message: error.message });
      return;
    }
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const parseResult = GameQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw new APIError('Invalid query: ' + parseResult.error.errors.map(e => e.message).join(', '), 400, 'VALIDATION_ERROR');
    }
    res.json({ games: [], total: 0, page: parseResult.data.page, limit: parseResult.data.limit, totalPages: 0 });
  } catch (error) {
    if (error instanceof APIError) {
      res.status(error.statusCode).json({ error: error.code, message: error.message });
      return;
    }
    next(error);
  }
});

export { router as gamesRouter };
