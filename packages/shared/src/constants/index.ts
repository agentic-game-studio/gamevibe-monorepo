export const GAME_TYPES = ['platformer', 'puzzle', 'rpg', 'shooter', 'endless-runner', 'tower-defense', 'other'] as const;

export const PLAYER_COUNTS = ['1', '2', '2-4', '2-8', 'unlimited'] as const;

export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;

export const PREMIUM_TIERS = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
  ENTERPRISE: 3
} as const;

export const LIMITS = {
  FREE_GAMES_PER_MONTH: 3,
  BASIC_GAMES_PER_MONTH: 10,
  PRO_GAMES_PER_MONTH: 50,
  ENTERPRISE_GAMES_PER_MONTH: -1, // unlimited
  
  MAX_GAME_NAME_LENGTH: 100,
  MAX_GAME_DESCRIPTION_LENGTH: 500,
  MAX_PLAYERS_PER_SESSION: 100,
  
  CACHE_TTL_SECONDS: 3600, // 1 hour
  SESSION_TIMEOUT_MINUTES: 30
} as const;

export const ERROR_CODES = {
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_INPUT: 'INVALID_INPUT',
  GENERATION_FAILED: 'GENERATION_FAILED',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  SERVER_ERROR: 'SERVER_ERROR'
} as const;

export const DISCORD = {
  MAX_EMBED_TITLE: 256,
  MAX_EMBED_DESCRIPTION: 4096,
  MAX_EMBED_FIELDS: 25,
  MAX_EMBED_FIELD_NAME: 256,
  MAX_EMBED_FIELD_VALUE: 1024,
  MAX_BUTTONS_PER_ROW: 5,
  MAX_ACTION_ROWS: 5
} as const;