import { z } from 'zod';
import { GAME_TYPES, PLAYER_COUNTS, DIFFICULTY_LEVELS } from '../constants/index.js';

export const gameCreationSchema = z.object({
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be less than 500 characters')
    .regex(/^[a-zA-Z0-9\s,.'!?\-()]+$/, 'Description contains invalid characters'),
  
  type: z.enum(GAME_TYPES).optional(),
  
  playerCount: z.enum(PLAYER_COUNTS).optional(),
  
  difficulty: z.enum(DIFFICULTY_LEVELS).optional(),
  
  serverId: z.string()
    .regex(/^\d{17,19}$/, 'Invalid Discord server ID'),
  
  userId: z.string()
    .regex(/^\d{17,19}$/, 'Invalid Discord user ID')
});

export const validateGameName = (name: string): boolean => {
  return /^[a-zA-Z0-9\s\-_]+$/.test(name) && name.length >= 3 && name.length <= 100;
};

export const validateDiscordId = (id: string): boolean => {
  return /^\d{17,19}$/.test(id);
};

export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/\s+/g, ' '); // Normalize whitespace
};