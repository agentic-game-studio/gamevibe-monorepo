import sharp from 'sharp';
import { AssetType } from '../types/index.js';
import { Logger } from '@gamevibe/shared';

export interface OptimizationOptions {
  quality?: number;
  format?: 'png' | 'webp' | 'jpeg';
  maxWidth?: number;
  maxHeight?: number;
  preserveAspectRatio?: boolean;
  generateSizes?: number[]; // e.g., [1, 2] for 1x and 2x
}

export class ImageOptimizer {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async optimizeImage(
    buffer: Buffer,
    assetType: AssetType,
    options: OptimizationOptions = {}
  ): Promise<{
    optimized: Buffer;
    metadata: {
      width: number;
      height: number;
      format: string;
      size: number;
      compressionRatio: number;
    };
  }> {
    const originalSize = buffer.length;
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Apply type-specific defaults
    const typeDefaults = this.getTypeDefaults(assetType);
    const finalOptions = { ...typeDefaults, ...options };

    // Resize if needed
    if (finalOptions.maxWidth || finalOptions.maxHeight) {
      image.resize({
        width: finalOptions.maxWidth,
        height: finalOptions.maxHeight,
        fit: finalOptions.preserveAspectRatio ? 'inside' : 'cover',
        withoutEnlargement: true
      });
    }

    // Convert format and optimize
    let optimized: Buffer;
    switch (finalOptions.format) {
      case 'webp':
        optimized = await image
          .webp({ quality: finalOptions.quality || 85, effort: 6 })
          .toBuffer();
        break;
      case 'jpeg':
        optimized = await image
          .jpeg({ quality: finalOptions.quality || 90, progressive: true })
          .toBuffer();
        break;
      case 'png':
      default:
        optimized = await image
          .png({ 
            compressionLevel: 9, 
            adaptiveFiltering: true,
            palette: assetType === 'sprite' // Use palette for sprites
          })
          .toBuffer();
    }

    const optimizedMetadata = await sharp(optimized).metadata();
    const compressionRatio = 1 - (optimized.length / originalSize);

    this.logger.debug(`Optimized ${assetType} image: ${originalSize} -> ${optimized.length} bytes (${(compressionRatio * 100).toFixed(1)}% reduction)`);

    return {
      optimized,
      metadata: {
        width: optimizedMetadata.width || metadata.width || 0,
        height: optimizedMetadata.height || metadata.height || 0,
        format: finalOptions.format || 'png',
        size: optimized.length,
        compressionRatio
      }
    };
  }

  async generateMultipleSizes(
    buffer: Buffer,
    assetType: AssetType,
    baseOptions: OptimizationOptions = {}
  ): Promise<Map<string, { buffer: Buffer; metadata: any }>> {
    const sizes = baseOptions.generateSizes || [1, 2];
    const results = new Map<string, { buffer: Buffer; metadata: any }>();

    const baseImage = sharp(buffer);
    const metadata = await baseImage.metadata();
    const baseWidth = metadata.width || 256;
    const baseHeight = metadata.height || 256;

    for (const scale of sizes) {
      const sizeKey = scale === 1 ? '1x' : `${scale}x`;
      
      const resized = await sharp(buffer)
        .resize({
          width: Math.round(baseWidth * scale),
          height: Math.round(baseHeight * scale),
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .toBuffer();

      const { optimized, metadata: optimizedMeta } = await this.optimizeImage(
        resized,
        assetType,
        baseOptions
      );

      results.set(sizeKey, {
        buffer: optimized,
        metadata: optimizedMeta
      });
    }

    return results;
  }

  async createThumbnail(
    buffer: Buffer,
    size: number = 256
  ): Promise<Buffer> {
    return sharp(buffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: 80 })
      .toBuffer();
  }

  async addWatermark(
    buffer: Buffer,
    watermarkText: string = 'GameVibe AI'
  ): Promise<Buffer> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const width = metadata.width || 256;
    const height = metadata.height || 256;

    // Create watermark SVG
    const watermarkSvg = Buffer.from(`
      <svg width="${width}" height="${height}">
        <text 
          x="${width - 10}" 
          y="${height - 10}" 
          font-family="Arial" 
          font-size="12" 
          fill="white" 
          fill-opacity="0.5" 
          text-anchor="end"
        >${watermarkText}</text>
      </svg>
    `);

    return image
      .composite([{
        input: watermarkSvg,
        top: 0,
        left: 0
      }])
      .toBuffer();
  }

  async extractColorPalette(
    buffer: Buffer,
    colorCount: number = 5
  ): Promise<string[]> {
    const { dominant } = await sharp(buffer).stats();
    
    // Simple dominant color extraction
    // In production, you'd use a proper color quantization algorithm
    const colors: string[] = [
      `rgb(${dominant.r}, ${dominant.g}, ${dominant.b})`
    ];

    // Generate variations (simplified)
    for (let i = 1; i < colorCount; i++) {
      const factor = 1 - (i * 0.15);
      colors.push(
        `rgb(${Math.round(dominant.r * factor)}, ${Math.round(dominant.g * factor)}, ${Math.round(dominant.b * factor)})`
      );
    }

    return colors;
  }

  private getTypeDefaults(assetType: AssetType): OptimizationOptions {
    const defaults: Record<AssetType, OptimizationOptions> = {
      sprite: {
        format: 'png',
        quality: 95,
        maxWidth: 512,
        maxHeight: 512
      },
      background: {
        format: 'webp',
        quality: 85,
        maxWidth: 1920,
        maxHeight: 1080
      },
      ui: {
        format: 'png',
        quality: 95,
        maxWidth: 512,
        maxHeight: 512
      },
      effect: {
        format: 'png',
        quality: 90,
        maxWidth: 512,
        maxHeight: 512
      },
      tile: {
        format: 'png',
        quality: 95,
        maxWidth: 128,
        maxHeight: 128
      }
    };

    return defaults[assetType] || {};
  }

  async validateImage(buffer: Buffer): Promise<{
    valid: boolean;
    error?: string;
    metadata?: sharp.Metadata;
  }> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        return { valid: false, error: 'Invalid image dimensions' };
      }

      if (metadata.width > 4096 || metadata.height > 4096) {
        return { valid: false, error: 'Image dimensions exceed maximum size (4096x4096)' };
      }

      const sizeInMB = buffer.length / (1024 * 1024);
      if (sizeInMB > 10) {
        return { valid: false, error: 'Image size exceeds 10MB limit' };
      }

      return { valid: true, metadata };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown validation error' 
      };
    }
  }
}