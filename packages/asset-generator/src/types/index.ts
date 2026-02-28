import { z } from 'zod';

// Asset Types
export type AssetType = 'sprite' | 'background' | 'ui' | 'effect' | 'tile';
export type AssetFormat = 'png' | 'webp' | 'svg';
export type AssetStyle = 'pixel-art' | 'cartoon' | 'realistic' | 'abstract' | 'hand-drawn';
export type ColorScheme = 'vibrant' | 'pastel' | 'dark' | 'monochrome' | 'neon';

// Asset Entry
export interface AssetEntry {
  id: string;
  type: AssetType;
  name: string;
  url: string;
  thumbnailUrl?: string;
  dimensions: {
    width: number;
    height: number;
  };
  format: AssetFormat;
  sizeBytes: number;
  tags: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
}

// Generation Requirements
export interface VisualRequirements {
  gameId: string;
  gameType: string;
  style: AssetStyle;
  colorScheme: ColorScheme;
  theme: string;
  description: string;
  sprites: SpriteRequirement[];
  backgrounds: BackgroundRequirement[];
  ui?: UIRequirement[];
  effects?: EffectRequirement[];
}

export interface SpriteRequirement {
  name: string;
  description: string;
  size: 'small' | 'medium' | 'large';
  animated?: boolean;
  frameCount?: number;
  tags: string[];
}

export interface BackgroundRequirement {
  name: string;
  description: string;
  parallax?: boolean;
  layers?: number;
  time?: 'day' | 'night' | 'sunset' | 'any';
}

export interface UIRequirement {
  name: string;
  type: 'button' | 'panel' | 'icon' | 'healthbar' | 'score';
  description: string;
}

export interface EffectRequirement {
  name: string;
  type: 'particle' | 'explosion' | 'trail' | 'glow';
  description: string;
}

// Generation Options
export interface GenerationOptions {
  quality?: 'draft' | 'standard' | 'high';
  variations?: number;
  seed?: string;
  negativePrompt?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3';
  upscale?: boolean;
}

// Generator Response
export interface GenerationResult {
  success: boolean;
  assets: AssetEntry[];
  errors?: string[];
  cost?: {
    credits: number;
    dollarAmount: number;
  };
  duration: number;
}

// Job Status
export interface GenerationJob {
  id: string;
  gameId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalAssets: number;
  completedAssets: number;
  results?: GenerationResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Storage
export interface StorageConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  cdnUrl?: string;
}

// Cache
export interface CacheConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  ttl: {
    hot: number;      // Recently generated assets
    template: number; // Template cache
    metadata: number; // Asset metadata
  };
}

// Prompt Templates
export interface PromptTemplate {
  id: string;
  name: string;
  category: AssetType;
  basePrompt: string;
  styleModifiers: Record<AssetStyle, string>;
  colorModifiers: Record<ColorScheme, string>;
  negativePrompt?: string;
  parameters?: Record<string, any>;
}

// Asset Manifest (stored in database)
export const AssetManifestSchema = z.object({
  version: z.number(),
  generatedAt: z.date(),
  status: z.enum(['pending', 'generating', 'complete', 'failed']),
  generator: z.enum(['dalle', 'stable-diffusion', 'mock']),
  manifest: z.object({
    sprites: z.array(z.any()),
    backgrounds: z.array(z.any()),
    ui: z.array(z.any()),
    effects: z.array(z.any())
  }),
  metadata: z.object({
    style: z.string(),
    colorPalette: z.array(z.string()),
    theme: z.string(),
    totalAssets: z.number(),
    generationTime: z.number()
  })
});

export type AssetManifest = z.infer<typeof AssetManifestSchema>;