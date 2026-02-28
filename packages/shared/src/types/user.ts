export interface User {
  id: string;
  discordId: string;
  username: string;
  discriminator?: string;
  avatarUrl?: string;
  premiumTier: number;
  premiumExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Server {
  id: string;
  discordId: string;
  name: string;
  memberCount: number;
  premiumTier: number;
  premiumExpiresAt?: Date;
  settings: ServerSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServerSettings {
  maxGamesPerMonth?: number;
  allowedGameTypes?: string[];
  moderationEnabled?: boolean;
  customPrefix?: string;
  language?: string;
}

export interface LeaderboardEntry {
  id: string;
  gameId: string;
  userId: string;
  score: number;
  metadata: Record<string, any>;
  achievedAt: Date;
}