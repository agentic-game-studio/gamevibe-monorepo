import sharp from 'sharp';
import { Logger } from '@gamevibe/shared';

export interface SpriteSheetOptions {
  frames: Buffer[];
  frameWidth: number;
  frameHeight: number;
  columns?: number;
  padding?: number;
  backgroundColor?: { r: number; g: number; b: number; alpha: number };
  format?: 'png' | 'webp';
}

export interface SpriteSheetResult {
  buffer: Buffer;
  metadata: {
    width: number;
    height: number;
    frameCount: number;
    frameWidth: number;
    frameHeight: number;
    columns: number;
    rows: number;
  };
  atlas: SpriteAtlas;
}

export interface SpriteAtlas {
  frames: Record<string, SpriteFrame>;
  meta: {
    app: string;
    version: string;
    image: string;
    format: string;
    size: { w: number; h: number };
    scale: string;
  };
}

export interface SpriteFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}

export class SpriteSheetGenerator {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async generateSpriteSheet(options: SpriteSheetOptions): Promise<SpriteSheetResult> {
    const {
      frames,
      frameWidth,
      frameHeight,
      columns = Math.ceil(Math.sqrt(frames.length)),
      padding = 0,
      backgroundColor = { r: 0, g: 0, b: 0, alpha: 0 },
      format = 'png'
    } = options;

    const frameCount = frames.length;
    const rows = Math.ceil(frameCount / columns);
    
    const sheetWidth = columns * (frameWidth + padding * 2);
    const sheetHeight = rows * (frameHeight + padding * 2);

    this.logger.debug(`Creating sprite sheet: ${sheetWidth}x${sheetHeight}, ${frameCount} frames in ${columns}x${rows} grid`);

    // Create base canvas
    let sheet = sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 4,
        background: backgroundColor
      }
    });

    // Prepare composite operations
    const compositeOperations: sharp.OverlayOptions[] = [];
    const atlas: SpriteAtlas = {
      frames: {},
      meta: {
        app: 'GameVibe Asset Generator',
        version: '1.0',
        image: 'spritesheet.' + format,
        format: format.toUpperCase(),
        size: { w: sheetWidth, h: sheetHeight },
        scale: '1'
      }
    };

    // Position each frame
    for (let i = 0; i < frameCount; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = col * (frameWidth + padding * 2) + padding;
      const y = row * (frameHeight + padding * 2) + padding;

      // Ensure frame is correct size
      const resizedFrame = await sharp(frames[i])
        .resize(frameWidth, frameHeight, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .toBuffer();

      compositeOperations.push({
        input: resizedFrame,
        left: x,
        top: y
      });

      // Add to atlas
      atlas.frames[`frame_${i}`] = {
        frame: { x, y, w: frameWidth, h: frameHeight },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
        sourceSize: { w: frameWidth, h: frameHeight }
      };
    }

    // Composite all frames
    sheet = sheet.composite(compositeOperations);

    // Generate final buffer
    let buffer: Buffer;
    if (format === 'webp') {
      buffer = await sheet.webp({ quality: 90, lossless: true }).toBuffer();
    } else {
      buffer = await sheet.png({ compressionLevel: 9 }).toBuffer();
    }

    return {
      buffer,
      metadata: {
        width: sheetWidth,
        height: sheetHeight,
        frameCount,
        frameWidth,
        frameHeight,
        columns,
        rows
      },
      atlas
    };
  }

  async extractFramesFromSheet(
    sheetBuffer: Buffer,
    frameWidth: number,
    frameHeight: number,
    frameCount?: number
  ): Promise<Buffer[]> {
    const sheet = sharp(sheetBuffer);
    const metadata = await sheet.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid sprite sheet');
    }

    const columns = Math.floor(metadata.width / frameWidth);
    const rows = Math.floor(metadata.height / frameHeight);
    const maxFrames = columns * rows;
    const framesToExtract = frameCount || maxFrames;

    const frames: Buffer[] = [];

    for (let i = 0; i < framesToExtract && i < maxFrames; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = col * frameWidth;
      const y = row * frameHeight;

      const frame = await sharp(sheetBuffer)
        .extract({
          left: x,
          top: y,
          width: frameWidth,
          height: frameHeight
        })
        .toBuffer();

      frames.push(frame);
    }

    this.logger.debug(`Extracted ${frames.length} frames from sprite sheet`);
    return frames;
  }

  async createAnimationStrip(
    frames: Buffer[],
    frameWidth: number,
    frameHeight: number,
    format: 'horizontal' | 'vertical' = 'horizontal'
  ): Promise<Buffer> {
    const frameCount = frames.length;
    
    const stripWidth = format === 'horizontal' ? frameWidth * frameCount : frameWidth;
    const stripHeight = format === 'vertical' ? frameHeight * frameCount : frameHeight;

    let strip = sharp({
      create: {
        width: stripWidth,
        height: stripHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    const compositeOperations: sharp.OverlayOptions[] = [];

    for (let i = 0; i < frameCount; i++) {
      const x = format === 'horizontal' ? i * frameWidth : 0;
      const y = format === 'vertical' ? i * frameHeight : 0;

      compositeOperations.push({
        input: frames[i],
        left: x,
        top: y
      });
    }

    return strip
      .composite(compositeOperations)
      .png()
      .toBuffer();
  }

  generateAtlasJSON(atlas: SpriteAtlas): string {
    return JSON.stringify(atlas, null, 2);
  }

  async optimizeSpriteSheet(
    buffer: Buffer,
    targetSize?: number
  ): Promise<Buffer> {
    const metadata = await sharp(buffer).metadata();
    
    if (!metadata.width || !metadata.height) {
      return buffer;
    }

    // If no target size or already smaller, just optimize compression
    if (!targetSize || buffer.length <= targetSize) {
      return sharp(buffer)
        .png({ 
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: true
        })
        .toBuffer();
    }

    // Try progressive quality reduction
    let quality = 95;
    let optimized = buffer;
    
    while (optimized.length > targetSize && quality > 60) {
      optimized = await sharp(buffer)
        .webp({ quality })
        .toBuffer();
      quality -= 5;
    }

    this.logger.debug(`Optimized sprite sheet from ${buffer.length} to ${optimized.length} bytes`);
    return optimized;
  }
}