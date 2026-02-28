import OpenAI from 'openai';
import axios from 'axios';
import { BaseAssetGenerator } from './base.js';
import { 
  AssetType, 
  AssetEntry, 
  GenerationOptions, 
  GenerationResult, 
  VisualRequirements,
  SpriteRequirement,
  BackgroundRequirement,
  UIRequirement,
  EffectRequirement,
  AssetFormat
} from '../types/index.js';
import { Logger } from '@gamevibe/shared';

export class DalleGenerator extends BaseAssetGenerator {
  private openai: OpenAI;
  private logger: Logger;
  private costPerImage = 0.04; // DALL-E 3 cost per image (1024x1024)

  constructor(apiKey: string, logger: Logger) {
    super('DALL-E 3', apiKey);
    this.openai = new OpenAI({ apiKey });
    this.logger = logger;
  }

  async generateAssets(
    requirements: VisualRequirements,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    const assets: AssetEntry[] = [];
    const errors: string[] = [];
    let totalCost = 0;

    try {
      // Generate sprites
      for (const sprite of requirements.sprites) {
        try {
          const asset = await this.generateSprite(
            requirements,
            sprite,
            options
          );
          assets.push(asset);
          totalCost += this.costPerImage;
        } catch (error) {
          errors.push(`Failed to generate sprite ${sprite.name}: ${error}`);
          this.logger.error('Sprite generation failed:', error);
        }
      }

      // Generate backgrounds
      for (const background of requirements.backgrounds) {
        try {
          const asset = await this.generateBackground(
            requirements,
            background,
            options
          );
          assets.push(asset);
          totalCost += this.costPerImage;
        } catch (error) {
          errors.push(`Failed to generate background ${background.name}: ${error}`);
          this.logger.error('Background generation failed:', error);
        }
      }

      // Generate UI elements
      if (requirements.ui) {
        for (const ui of requirements.ui) {
          try {
            const asset = await this.generateUIElement(
              requirements,
              ui,
              options
            );
            assets.push(asset);
            totalCost += this.costPerImage;
          } catch (error) {
            errors.push(`Failed to generate UI element ${ui.name}: ${error}`);
            this.logger.error('UI generation failed:', error);
          }
        }
      }

      return {
        success: assets.length > 0,
        assets,
        errors: errors.length > 0 ? errors : undefined,
        cost: {
          credits: assets.length,
          dollarAmount: totalCost
        },
        duration: Date.now() - startTime
      };
    } catch (error) {
      this.logger.error('Asset generation failed:', error);
      return {
        success: false,
        assets: [],
        errors: [`Generation failed: ${error}`],
        duration: Date.now() - startTime
      };
    }
  }

  async generateSingleAsset(
    type: AssetType,
    prompt: string,
    options?: GenerationOptions
  ): Promise<AssetEntry> {
    const size = this.getImageSize(type, options);
    const quality = options?.quality === 'high' ? 'hd' : 'standard';

    const response = await this.retry(() =>
      this.openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        quality,
        response_format: 'url'
      })
    );

    const imageUrl = response.data[0].url;
    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E');
    }

    // Download the image
    const imageBuffer = await this.downloadImage(imageUrl);
    const dimensions = this.getAssetDimensions(type);

    return {
      id: this.generateAssetId(),
      type,
      name: `${type}_${Date.now()}.png`,
      url: imageUrl, // This will be replaced with S3 URL
      dimensions,
      format: 'png' as AssetFormat,
      sizeBytes: imageBuffer.length,
      tags: [type, 'dalle-3', 'generated'],
      createdAt: new Date()
    };
  }

  private async generateSprite(
    requirements: VisualRequirements,
    sprite: SpriteRequirement,
    options?: GenerationOptions
  ): Promise<AssetEntry> {
    const basePrompt = `Game sprite of ${sprite.description} for a ${requirements.gameType} game`;
    const prompt = this.buildPrompt(
      basePrompt,
      requirements.style,
      requirements.colorScheme,
      'text, watermark, signature, border, frame'
    );

    const asset = await this.generateSingleAsset('sprite', prompt, options);
    asset.name = `${sprite.name}.png`;
    asset.tags = [...asset.tags, ...sprite.tags, sprite.size];
    
    return asset;
  }

  private async generateBackground(
    requirements: VisualRequirements,
    background: BackgroundRequirement,
    options?: GenerationOptions
  ): Promise<AssetEntry> {
    const timeOfDay = background.time || 'day';
    const basePrompt = `Game background scene: ${background.description}, ${timeOfDay} time, ${requirements.theme} theme`;
    const prompt = this.buildPrompt(
      basePrompt,
      requirements.style,
      requirements.colorScheme,
      'character, people, text, UI elements'
    );

    const asset = await this.generateSingleAsset('background', prompt, options);
    asset.name = `${background.name}.png`;
    asset.tags = [...asset.tags, requirements.theme, timeOfDay];
    
    return asset;
  }

  private async generateUIElement(
    requirements: VisualRequirements,
    ui: UIRequirement,
    options?: GenerationOptions
  ): Promise<AssetEntry> {
    const basePrompt = `Game UI ${ui.type}: ${ui.description}, clean design`;
    const prompt = this.buildPrompt(
      basePrompt,
      requirements.style,
      requirements.colorScheme,
      'text, numbers, letters'
    );

    const asset = await this.generateSingleAsset('ui', prompt, options);
    asset.name = `${ui.name}.png`;
    asset.tags = [...asset.tags, ui.type, 'interface'];
    
    return asset;
  }

  async checkAvailability(): Promise<boolean> {
    try {
      const response = await this.openai.models.retrieve('dall-e-3');
      return response.id === 'dall-e-3';
    } catch (error) {
      this.logger.error('DALL-E availability check failed:', error);
      return false;
    }
  }

  async estimateCost(
    requirements: VisualRequirements,
    options?: GenerationOptions
  ): Promise<{ credits: number; dollarAmount: number }> {
    let imageCount = requirements.sprites.length + requirements.backgrounds.length;
    
    if (requirements.ui) {
      imageCount += requirements.ui.length;
    }
    
    if (requirements.effects) {
      imageCount += requirements.effects.length;
    }

    const variations = options?.variations || 1;
    const totalImages = imageCount * variations;
    
    return {
      credits: totalImages,
      dollarAmount: totalImages * this.costPerImage
    };
  }

  private getImageSize(
    type: AssetType,
    options?: GenerationOptions
  ): '1024x1024' | '1792x1024' | '1024x1792' {
    if (options?.aspectRatio === '16:9' || type === 'background') {
      return '1792x1024';
    }
    if (options?.aspectRatio === '9:16') {
      return '1024x1792';
    }
    return '1024x1024';
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    return Buffer.from(response.data);
  }

  protected buildPrompt(
    basePrompt: string,
    style: string,
    colorScheme: string,
    negativePrompt?: string
  ): string {
    const styleModifiers = this.getStyleModifiers(style);
    const colorModifiers = this.getColorModifiers(colorScheme);
    
    let fullPrompt = `${basePrompt}, ${styleModifiers}, ${colorModifiers}, high quality game art`;
    
    // DALL-E 3 doesn't support negative prompts directly, 
    // but we can add "without" or "no" to the prompt
    if (negativePrompt) {
      fullPrompt += `, without ${negativePrompt}`;
    }
    
    // Ensure prompt doesn't exceed DALL-E 3's limit
    if (fullPrompt.length > 4000) {
      fullPrompt = fullPrompt.substring(0, 3997) + '...';
    }
    
    return fullPrompt;
  }
}