import { z } from 'zod';

export const GameGenerationRequestSchema = z.object({
  description: z.string().min(10).max(500),
  type: z.enum(['platformer', 'puzzle', 'rpg', 'shooter', 'endless-runner', 'tower-defense', 'other']).optional(),
  playerCount: z.string().optional(),
  bypassCache: z.boolean().optional(),
  useAI: z.boolean().optional(),
  creatorWallet: z.string().optional(),
});

export const GameQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  type: z.enum(['platformer', 'puzzle', 'rpg', 'shooter', 'endless-runner', 'tower-defense', 'other']).optional(),
  creatorWallet: z.string().optional(),
});

export const GeneratedGameResponseSchema = z.object({
  id: z.string(),
  shortId: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.string(),
  code: z.string(),
  playUrl: z.string(),
  thumbnailUrl: z.string().optional(),
  assets: z.record(z.string()).optional(),
  ipfsCid: z.string().optional(),
  transactionHash: z.string().optional(),
  createdAt: z.string(),
});

export const GameListResponseSchema = z.object({
  games: z.array(GeneratedGameResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export type GameGenerationRequest = z.infer<typeof GameGenerationRequestSchema>;
export type GameQuery = z.infer<typeof GameQuerySchema>;
export type GeneratedGameResponse = z.infer<typeof GeneratedGameResponseSchema>;
export type GameListResponse = z.infer<typeof GameListResponseSchema>;

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'APIError';
  }
}
