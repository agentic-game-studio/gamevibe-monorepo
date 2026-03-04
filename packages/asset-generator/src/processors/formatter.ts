import sharp from 'sharp';
import { AssetFormat } from '../types/index.js';
import { Logger } from '@gamevibe/shared';

export interface FormatConversionOptions {
  targetFormat: AssetFormat;
  quality?: number;
  preserveTransparency?: boolean;
  backgroundColor?: { r: number; g: number; b: number };
}

export class ImageFormatter {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async convertFormat(
    buffer: Buffer,
    options: FormatConversionOptions
  ): Promise<{
    buffer: Buffer;
    format: AssetFormat;
    hasAlpha: boolean;
  }> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const hasAlpha = (metadata.channels ?? 0) >= 2;

    let converted: Buffer;

    switch (options.targetFormat) {
      case 'webp':
        converted = await this.toWebP(image, options.quality, hasAlpha);
        break;
      
      case 'png':
        converted = await this.toPNG(image, hasAlpha);
        break;
      
      case 'svg':
        throw new Error('SVG conversion not supported - SVG should be generated, not converted');
      
      default:
        throw new Error(`Unsupported format: ${options.targetFormat}`);
    }

    this.logger.debug(
      `Converted image from ${metadata.format} to ${options.targetFormat}: ${buffer.length} -> ${converted.length} bytes`
    );

    return {
      buffer: converted,
      format: options.targetFormat,
      hasAlpha
    };
  }

  async batchConvert(
    buffers: Buffer[],
    options: FormatConversionOptions
  ): Promise<Array<{ buffer: Buffer; format: AssetFormat; hasAlpha: boolean }>> {
    return Promise.all(
      buffers.map(buffer => this.convertFormat(buffer, options))
    );
  }

  private async toWebP(
    image: sharp.Sharp,
    quality: number = 85,
    hasAlpha: boolean
  ): Promise<Buffer> {
    return image
      .webp({
        quality,
        lossless: false,
        nearLossless: hasAlpha,
        smartSubsample: true,
        effort: 6
      })
      .toBuffer();
  }

  private async toPNG(
    image: sharp.Sharp,
    hasAlpha: boolean
  ): Promise<Buffer> {
    return image
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: !hasAlpha, // Use palette for non-transparent images
        quality: 100,
        effort: 10
      })
      .toBuffer();
  }

  async ensureTransparency(buffer: Buffer): Promise<Buffer> {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Already has alpha channel
    if ((metadata.channels ?? 0) >= 2) {
      return buffer;
    }

    // Add alpha channel
    return image
      .ensureAlpha()
      .toBuffer();
  }

  async removeTransparency(
    buffer: Buffer,
    backgroundColor: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 }
  ): Promise<Buffer> {
    return sharp(buffer)
      .flatten({ background: backgroundColor })
      .toBuffer();
  }

  async detectFormat(buffer: Buffer): Promise<{
    format: string;
    mimeType: string;
    hasAlpha: boolean;
    isAnimated: boolean;
  }> {
    const metadata = await sharp(buffer).metadata();
    
    const formatMap: Record<string, string> = {
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      tiff: 'image/tiff'
    };

    return {
      format: metadata.format || 'unknown',
      mimeType: formatMap[metadata.format || ''] || 'application/octet-stream',
      hasAlpha: (metadata.channels ?? 0) >= 2,
      isAnimated: metadata.pages ? metadata.pages > 1 : false
    };
  }

  async normalizeImage(
    buffer: Buffer,
    targetFormat: AssetFormat = 'png'
  ): Promise<Buffer> {
    const { format } = await this.detectFormat(buffer);
    
    // If already in target format and not animated, return as-is
    if (format === targetFormat) {
      return buffer;
    }

    // Convert to target format
    const { buffer: normalized } = await this.convertFormat(buffer, {
      targetFormat,
      preserveTransparency: true
    });

    return normalized;
  }

  async createBase64DataUrl(buffer: Buffer): Promise<string> {
    const { mimeType } = await this.detectFormat(buffer);
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  }

  async getImageInfo(buffer: Buffer): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
    aspectRatio: number;
    hasAlpha: boolean;
    colorSpace: string;
    density?: number;
  }> {
    const metadata = await sharp(buffer).metadata();
    
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: buffer.length,
      aspectRatio: (metadata.width || 0) / (metadata.height || 1),
      hasAlpha: (metadata.channels ?? 0) >= 2,
      colorSpace: metadata.space || 'unknown',
      density: metadata.density
    };
  }
}