import { IncomingMessage, ServerResponse } from 'http';
import { Container } from 'inversify';
import { BotListingService } from '../services/bot-listing.js';
import { Logger } from '../utils/logger.js';
import { TYPES } from '../types.js';
import { BotConfig } from '@gamevibe/shared';
import crypto from 'crypto';

export class BotListingWebhooksAPI {
  private botListingService: BotListingService;
  private logger = new Logger('BotListingWebhooksAPI');
  private config: BotConfig;

  constructor(container: Container) {
    this.botListingService = container.get<BotListingService>(TYPES.BotListingService);
    this.config = container.get<BotConfig>(TYPES.Config);
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    // Handle bot listing webhook routes
    if (pathname === '/webhooks/topgg/vote' && req.method === 'POST') {
      await this.handleTopGGVote(req, res);
      return true;
    }

    if (pathname === '/webhooks/discordbotsgg/vote' && req.method === 'POST') {
      await this.handleDiscordBotsGGVote(req, res);
      return true;
    }

    if (pathname.startsWith('/webhooks/vote/') && req.method === 'POST') {
      const site = pathname.split('/').pop();
      if (site) {
        await this.handleGenericVote(req, res, site);
        return true;
      }
    }

    if (pathname === '/webhooks/test/vote' && req.method === 'POST') {
      await this.handleTestVote(req, res);
      return true;
    }

    return false;
  }

  private async handleTopGGVote(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseBody(req);
      
      // Verify webhook signature
      const signature = req.headers['x-dbl-signature'] as string;
      const webhookSecret = this.config.botListing?.topgg?.webhookSecret;

      if (!webhookSecret) {
        this.logger.error('Top.gg webhook secret not configured');
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Webhook not configured' }));
        return;
      }

      if (!signature) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'Missing signature' }));
        return;
      }

      const [timestamp, hash] = signature.split(' ');
      const payload = JSON.stringify(body);
      const computedHash = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      if (hash !== computedHash) {
        this.logger.warn('Invalid Top.gg webhook signature');
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      this.logger.info('Received Top.gg vote webhook:', body);
      const success = await this.botListingService.handleVoteWebhook('top.gg', body);
      
      res.statusCode = success ? 200 : 400;
      res.end(JSON.stringify({ success }));
    } catch (error) {
      this.logger.error('Error processing Top.gg vote:', error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  private async handleDiscordBotsGGVote(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseBody(req);
      
      // Discord.bots.gg uses Authorization header
      const authHeader = req.headers['authorization'] as string;
      const webhookSecret = this.config.botListing?.discordBotsGG?.webhookSecret;

      if (webhookSecret && authHeader !== webhookSecret) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      this.logger.info('Received Discord.bots.gg vote webhook:', body);
      const success = await this.botListingService.handleVoteWebhook('discord.bots.gg', body);
      
      res.statusCode = success ? 200 : 400;
      res.end(JSON.stringify({ success }));
    } catch (error) {
      this.logger.error('Error processing Discord.bots.gg vote:', error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  private async handleGenericVote(req: IncomingMessage, res: ServerResponse, site: string): Promise<void> {
    try {
      const body = await this.parseBody(req);
      
      this.logger.info(`Received vote webhook from ${site}:`, body);
      const success = await this.botListingService.handleVoteWebhook(site, body);
      
      res.statusCode = success ? 200 : 400;
      res.end(JSON.stringify({ success }));
    } catch (error) {
      this.logger.error(`Error processing vote from ${site}:`, error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  private async handleTestVote(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (process.env.NODE_ENV !== 'development') {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    try {
      const body = await this.parseBody(req);
      
      this.logger.info('Test vote webhook:', body);
      const success = await this.botListingService.handleVoteWebhook('test', body);
      
      res.statusCode = 200;
      res.end(JSON.stringify({ 
        success,
        message: 'Test vote processed',
        data: body,
      }));
    } catch (error) {
      this.logger.error('Error processing test vote:', error);
      res.statusCode = 500;
      res.end(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }));
    }
  }

  private parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
      req.on('error', reject);
    });
  }
}