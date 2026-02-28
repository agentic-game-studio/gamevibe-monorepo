import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageConfig, AssetEntry, AssetType } from '../types/index.js';
import { Readable } from 'stream';
import sharp from 'sharp';

export class S3Storage {
  private client: S3Client;
  private config: StorageConfig;
  private cdnUrl?: string;

  constructor(config: StorageConfig) {
    this.config = config;
    this.cdnUrl = config.cdnUrl;
    
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      endpoint: config.endpoint
    });
  }

  async uploadAsset(
    gameId: string,
    type: AssetType,
    name: string,
    buffer: Buffer,
    metadata?: Record<string, string>
  ): Promise<string> {
    const key = this.buildAssetKey(gameId, type, name);
    
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: buffer,
      ContentType: this.getContentType(name),
      Metadata: {
        gameId,
        assetType: type,
        ...metadata
      }
    });

    await this.client.send(command);
    
    return this.getAssetUrl(key);
  }

  async uploadProcessedAsset(
    gameId: string,
    type: AssetType,
    name: string,
    buffer: Buffer,
    options: {
      generateThumbnail?: boolean;
      optimize?: boolean;
      format?: 'png' | 'webp' | 'jpeg';
    } = {}
  ): Promise<{ url: string; thumbnailUrl?: string; size: number }> {
    let processedBuffer = buffer;
    let size = buffer.length;

    // Process image if needed
    if (options.optimize || options.format) {
      const image = sharp(buffer);
      
      if (options.format) {
        switch (options.format) {
          case 'webp':
            image.webp({ quality: 85 });
            break;
          case 'jpeg':
            image.jpeg({ quality: 90 });
            break;
          case 'png':
            image.png({ compressionLevel: 9 });
            break;
        }
      }

      processedBuffer = await image.toBuffer();
      size = processedBuffer.length;
    }

    // Upload main asset
    const url = await this.uploadAsset(gameId, type, name, processedBuffer);

    // Generate and upload thumbnail if requested
    let thumbnailUrl: string | undefined;
    if (options.generateThumbnail) {
      const thumbnail = await sharp(buffer)
        .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 80 })
        .toBuffer();

      const thumbnailName = `thumb_${name.replace(/\.[^.]+$/, '.webp')}`;
      thumbnailUrl = await this.uploadAsset(gameId, type, thumbnailName, thumbnail);
    }

    return { url, thumbnailUrl, size };
  }

  async downloadAsset(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key
    });

    const response = await this.client.send(command);
    
    if (!response.Body) {
      throw new Error('Asset not found');
    }

    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  async deleteAsset(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key
    });

    await this.client.send(command);
  }

  async assetExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  buildAssetKey(gameId: string, type: AssetType, name: string): string {
    const sanitizedName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `games/${gameId}/${type}s/${sanitizedName}`;
  }

  buildTemplateKey(type: AssetType, templateId: string, name: string): string {
    const sanitizedName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `templates/${type}s/${templateId}/${sanitizedName}`;
  }

  getAssetUrl(key: string): string {
    if (this.cdnUrl) {
      return `${this.cdnUrl}/${key}`;
    }
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  getAssetUrlFromEntry(entry: AssetEntry): string {
    return entry.url;
  }

  private getContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'gif': 'image/gif'
    };
    
    return mimeTypes[ext || 'png'] || 'application/octet-stream';
  }

  async cleanupGameAssets(gameId: string): Promise<void> {
    // This would need ListObjectsV2 and batch delete in production
    // For now, individual assets need to be tracked and deleted
    console.log(`Cleanup requested for game ${gameId} assets`);
  }
}