import { Logger } from '../utils/logger.js';
import { GeneratedGame } from '@gamevibe/shared';

export interface IPFSConfig {
  pinataApiKey: string;
  pinataSecretKey: string;
}

export interface IPFSUploadResult {
  cid: string;
  ipfsUrl: string;
  gatewayUrl: string;
}

export class IPFSService {
  private logger = new Logger('IPFSService');
  private apiKey: string;
  private secretKey: string;
  private gateway = 'https://gateway.pinata.cloud/ipfs/';

  constructor(config: IPFSConfig) {
    this.apiKey = config.pinataApiKey;
    this.secretKey = config.pinataSecretKey;
  }

  async uploadGame(game: GeneratedGame): Promise<IPFSUploadResult> {
    const gameData = {
      id: game.id,
      shortId: game.shortId,
      name: game.name,
      description: game.description,
      type: game.type,
      code: game.code,
      thumbnailUrl: game.thumbnailUrl,
      assets: game.assets,
      playUrl: game.playUrl,
      createdAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(gameData, null, 2)], { type: 'application/json' });
    const file = new File([blob], `game-${game.shortId}.json`);

    const formData = new FormData();
    formData.append('file', file);

    const options = JSON.stringify({
      name: `game-${game.shortId}`,
      description: `GameVibe AI generated game: ${game.name}`,
      keyvalues: {
        type: game.type,
        creator: 'gamevibe'
      }
    });
    formData.append('pinataMetadata', options);

    try {
      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'pinata_api_key': this.apiKey,
          'pinata_secret_api_key': this.secretKey
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`IPFS upload failed: ${response.status} - ${error}`);
      }

      const result = await response.json() as {
        IpfsHash: string;
        PinSize: number;
        Timestamp: string;
      };

      const cid = result.IpfsHash;

      this.logger.info('Game uploaded to IPFS', { cid, size: result.PinSize });

      return {
        cid,
        ipfsUrl: `ipfs://${cid}`,
        gatewayUrl: `${this.gateway}${cid}`
      };

    } catch (error) {
      this.logger.error('Failed to upload to IPFS', { error });
      throw error;
    }
  }

  async getGame(cid: string): Promise<GeneratedGame | null> {
    try {
      const response = await fetch(`${this.gateway}${cid}`);
      if (!response.ok) return null;
      const data = await response.json() as GeneratedGame;
      return data;
    } catch (error) {
      this.logger.error('Failed to fetch from IPFS', { cid, error });
      return null;
    }
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.secretKey);
  }
}
