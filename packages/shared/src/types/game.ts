export type GameType = 'platformer' | 'puzzle' | 'rpg' | 'shooter' | 'endless-runner' | 'tower-defense' | 'other';

export interface GameTemplate {
  id: string;
  name: string;
  type: GameType;
  structure: string;
  sections: Record<string, string>;
  defaultAssets?: string[];
}

export interface GameSpec {
  type: GameType;
  name: string;
  description: string;
  originalDescription: string;
  coreMechanics: string[];
  features: string[];
  playerCount: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface Game {
  id: string;
  shortId: string;
  serverId: string;
  creatorId: string;
  name: string;
  description: string;
  type: GameType;
  templateId?: string;
  code: string;
  assets: Record<string, any>;
  metadata: Record<string, any>;
  playCount: number;
  remixCount: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameSession {
  id: string;
  gameId: string;
  serverId: string;
  channelId: string;
  activePlayers: number;
  state: Record<string, any>;
  startedAt: Date;
  endedAt?: Date;
}

export interface GameGenerationRequest {
  description: string;
  serverId: string;
  userId: string;
  type?: GameType;
  playerCount?: string;
  context?: {
    serverName?: string;
    memberCount?: number;
  };
}

export interface GeneratedGame {
  id: string;
  shortId: string;
  name: string;
  description: string;
  type: GameType;
  code: string;
  playUrl: string;
  thumbnailUrl?: string;
  assets?: Record<string, string>;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}