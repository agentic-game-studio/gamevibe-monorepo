import { 
  AssetType, 
  GenerationOptions, 
  GenerationResult, 
  VisualRequirements,
  AssetEntry 
} from '../types/index.js';

export abstract class BaseAssetGenerator {
  protected name: string;
  protected apiKey: string;
  protected maxRetries: number = 3;
  protected retryDelay: number = 1000;

  constructor(name: string, apiKey: string) {
    this.name = name;
    this.apiKey = apiKey;
  }

  abstract generateAssets(
    requirements: VisualRequirements,
    options?: GenerationOptions
  ): Promise<GenerationResult>;

  abstract generateSingleAsset(
    type: AssetType,
    prompt: string,
    options?: GenerationOptions
  ): Promise<AssetEntry>;

  abstract checkAvailability(): Promise<boolean>;

  abstract estimateCost(
    requirements: VisualRequirements,
    options?: GenerationOptions
  ): Promise<{ credits: number; dollarAmount: number }>;

  protected buildPrompt(
    basePrompt: string,
    style: string,
    colorScheme: string,
    negativePrompt?: string
  ): string { 
    const styleModifiers = this.getStyleModifiers(style);
    const colorModifiers = this.getColorModifiers(colorScheme);
    
    let fullPrompt = `${basePrompt}, ${styleModifiers}, ${colorModifiers}`;
    
    if (negativePrompt) {
      fullPrompt += ` --no ${negativePrompt}`;
    }
    
    return fullPrompt;
  }

  protected getStyleModifiers(style: string): string {
    const modifiers: Record<string, string> = {
      'pixel-art': '8-bit pixel art style, retro game aesthetic, low resolution',
      'cartoon': 'cartoon style, vibrant colors, clean lines, cel-shaded',
      'realistic': 'photorealistic, high detail, professional game art',
      'abstract': 'abstract art style, geometric shapes, modern design',
      'hand-drawn': 'hand-drawn illustration, sketch style, artistic'
    };
    
    return modifiers[style] || '';
  }

  protected getColorModifiers(colorScheme: string): string {
    const modifiers: Record<string, string> = {
      'vibrant': 'bright vivid colors, high saturation, energetic palette',
      'pastel': 'soft pastel colors, gentle tones, muted palette',
      'dark': 'dark moody colors, low key lighting, atmospheric',
      'monochrome': 'black and white, grayscale, monochromatic',
      'neon': 'neon colors, glowing effects, cyberpunk aesthetic'
    };
    
    return modifiers[colorScheme] || '';
  }

  protected async retry<T>(
    fn: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        await this.delay(this.retryDelay);
        return this.retry(fn, retries - 1);
      }
      throw error;
    }
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected generateAssetId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected getAssetDimensions(type: AssetType, size?: string): { width: number; height: number } {
    const dimensions: Record<string, { width: number; height: number }> = {
      'sprite-small': { width: 32, height: 32 },
      'sprite-medium': { width: 64, height: 64 },
      'sprite-large': { width: 128, height: 128 },
      'background': { width: 1920, height: 1080 },
      'ui': { width: 256, height: 256 },
      'effect': { width: 512, height: 512 },
      'tile': { width: 64, height: 64 }
    };

    const key = type === 'sprite' && size ? `${type}-${size}` : type;
    return dimensions[key] || { width: 256, height: 256 };
  }
}