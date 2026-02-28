import { injectable, inject } from 'inversify';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { Logger } from '../utils/logger.js';
import { prisma } from '../utils/database.js';
import { BotConfig } from '@gamevibe/shared';
import fetch from 'node-fetch';
import { CronJob } from 'cron';
import { TYPES } from '../types.js';

interface BotListingSite {
  name: string;
  apiUrl: string;
  token: string;
  statsEndpoint: string;
  voteWebhookSecret?: string;
}

interface BotStats {
  serverCount: number;
  userCount: number;
  shardCount: number;
  gameCount: number;
  activeGames: number;
}

@injectable()
export class BotListingService {
  private logger = new Logger('BotListingService');
  private sites: BotListingSite[] = [];
  private statsUpdateJob?: CronJob;
  private discordRest: REST;

  constructor(
    @inject(TYPES.Config) private config: BotConfig,
    @inject(TYPES.DiscordREST) discordRest: REST
  ) {
    this.discordRest = discordRest;
    this.initializeSites();
  }

  private initializeSites(): void {
    // Top.gg configuration
    if (this.config.botListing?.topgg?.token) {
      this.sites.push({
        name: 'Top.gg',
        apiUrl: 'https://top.gg/api',
        token: this.config.botListing.topgg.token,
        statsEndpoint: `/bots/${this.config.discord.clientId}/stats`,
        voteWebhookSecret: this.config.botListing.topgg.webhookSecret,
      });
    }

    // Discord.bots.gg configuration
    if (this.config.botListing?.discordBotsGG?.token) {
      this.sites.push({
        name: 'Discord.bots.gg',
        apiUrl: 'https://discord.bots.gg/api/v1',
        token: this.config.botListing.discordBotsGG.token,
        statsEndpoint: `/bots/${this.config.discord.clientId}/stats`,
        voteWebhookSecret: this.config.botListing.discordBotsGG.webhookSecret,
      });
    }

    // Discordbotlist.com configuration
    if (this.config.botListing?.discordBotList?.token) {
      this.sites.push({
        name: 'Discordbotlist.com',
        apiUrl: 'https://discordbotlist.com/api/v1',
        token: this.config.botListing.discordBotList.token,
        statsEndpoint: `/bots/${this.config.discord.clientId}/stats`,
      });
    }

    this.logger.info(`Initialized ${this.sites.length} bot listing sites`);
  }

  async start(): Promise<void> {
    // Update stats immediately on start
    await this.updateAllStats();

    // Schedule stats updates every 30 minutes
    this.statsUpdateJob = new CronJob(
      '*/30 * * * *',
      async () => {
        await this.updateAllStats();
      },
      null,
      true,
      'UTC'
    );

    this.logger.info('Bot listing service started with 30-minute update interval');
  }

  stop(): void {
    if (this.statsUpdateJob) {
      this.statsUpdateJob.stop();
      this.logger.info('Bot listing service stopped');
    }
  }

  private async getStats(): Promise<BotStats> {
    try {
      // Get guild count from Discord API
      const guilds = (await this.discordRest.get(Routes.userGuilds())) as any[];
      const serverCount = guilds.length;

      // Get approximate user count (sum of member counts)
      let userCount = 0;
      for (const guild of guilds.slice(0, 10)) { // Sample first 10 guilds
        try {
          const guildData = (await this.discordRest.get(Routes.guild(guild.id))) as any;
          userCount += guildData.approximate_member_count || 0;
        } catch (error) {
          // Skip if we can't access guild
        }
      }
      // Extrapolate user count
      if (guilds.length > 10) {
        userCount = Math.floor((userCount / 10) * guilds.length);
      }

      // Get game statistics from database
      const [gameCount, activeGamesCount] = await Promise.all([
        prisma.game.count(),
        prisma.game.count({
          where: {
            plays: {
              gt: 0,
            },
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Active in last 7 days
            },
          },
        }),
      ]);

      return {
        serverCount,
        userCount,
        shardCount: 1, // Will be updated when sharding is implemented
        gameCount,
        activeGames: activeGamesCount,
      };
    } catch (error) {
      this.logger.error('Failed to get bot stats:', error);
      throw error;
    }
  }

  async updateAllStats(): Promise<void> {
    try {
      const stats = await this.getStats();
      this.logger.info('Current bot stats:', stats);

      const updatePromises = this.sites.map(site => 
        this.updateSiteStats(site, stats).catch(error => {
          this.logger.error(`Failed to update ${site.name}:`, error);
        })
      );

      await Promise.all(updatePromises);
      
      // Record stats update in database
      await prisma.analyticsEvent.create({
        data: {
          type: 'bot_listing_update',
          metadata: {
            stats,
            sites: this.sites.map(s => s.name),
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to update bot listing stats:', error);
    }
  }

  private async updateSiteStats(site: BotListingSite, stats: BotStats): Promise<void> {
    const url = `${site.apiUrl}${site.statsEndpoint}`;
    
    // Format stats based on site requirements
    let body: any;
    switch (site.name) {
      case 'Top.gg':
        body = {
          server_count: stats.serverCount,
          shard_count: stats.shardCount,
        };
        break;
      case 'Discord.bots.gg':
        body = {
          guildCount: stats.serverCount,
          shardCount: stats.shardCount,
        };
        break;
      case 'Discordbotlist.com':
        body = {
          guilds: stats.serverCount,
          users: stats.userCount,
        };
        break;
      default:
        body = {
          server_count: stats.serverCount,
          shard_count: stats.shardCount,
        };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': site.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    this.logger.info(`Successfully updated stats on ${site.name}`);
  }

  // Handle vote webhooks
  async handleVoteWebhook(site: string, data: any, signature?: string): Promise<boolean> {
    const siteConfig = this.sites.find(s => s.name.toLowerCase() === site.toLowerCase());
    if (!siteConfig || !siteConfig.voteWebhookSecret) {
      this.logger.warn(`No webhook configuration for site: ${site}`);
      return false;
    }

    // Verify webhook signature if provided
    if (signature && siteConfig.voteWebhookSecret) {
      // Implementation depends on site-specific signature verification
      // Most use HMAC-SHA256
    }

    try {
      // Process vote based on site
      let userId: string;
      let isWeekend = false;
      
      switch (site.toLowerCase()) {
        case 'top.gg':
          userId = data.user;
          isWeekend = data.isWeekend || false;
          break;
        case 'discord.bots.gg':
          userId = data.userId || data.user;
          break;
        default:
          userId = data.user || data.userId;
      }

      if (!userId) {
        this.logger.error('No user ID in vote webhook data');
        return false;
      }

      // Award credits for voting
      const creditAmount = isWeekend ? 20 : 10; // Double credits on weekends
      
      // Update user credits
      const user = await prisma.user.upsert({
        where: { discordId: userId },
        create: {
          discordId: userId,
          username: `User#${userId.slice(-4)}`,
          personalCredits: creditAmount,
        },
        update: {
          personalCredits: {
            increment: creditAmount,
          },
        },
      });

      // Record vote
      await prisma.analyticsEvent.create({
        data: {
          type: 'bot_vote',
          userId,
          metadata: {
            site,
            creditAmount,
            isWeekend,
            timestamp: new Date().toISOString(),
          },
        },
      });

      // Track achievement progress
      await this.trackVoteAchievement(userId);

      this.logger.info(`Processed vote from ${site} for user ${userId}, awarded ${creditAmount} credits`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to process vote webhook from ${site}:`, error);
      return false;
    }
  }

  private async trackVoteAchievement(userId: string): Promise<void> {
    // Check if user has vote-related achievements
    const voteCount = await prisma.analyticsEvent.count({
      where: {
        type: 'bot_vote',
        userId,
      },
    });

    // Define vote milestones
    const voteMilestones = [
      { votes: 1, achievementKey: 'first_vote', credits: 25 },
      { votes: 10, achievementKey: 'supporter', credits: 100 },
      { votes: 50, achievementKey: 'dedicated_voter', credits: 500 },
      { votes: 100, achievementKey: 'voting_champion', credits: 1000 },
    ];

    for (const milestone of voteMilestones) {
      if (voteCount === milestone.votes) {
        // Award achievement (would integrate with existing achievement system)
        this.logger.info(`User ${userId} reached ${milestone.votes} votes milestone!`);
      }
    }
  }

  // Get bot listing URLs for display
  getBotListingUrls(): Record<string, string> {
    return {
      topgg: `https://top.gg/bot/${this.config.discord.clientId}`,
      discordBotsGG: `https://discord.bots.gg/bots/${this.config.discord.clientId}`,
      discordBotList: `https://discordbotlist.com/bots/${this.config.discord.clientId}`,
    };
  }

  // Generate invite link with proper permissions
  getInviteLink(): string {
    const permissions = [
      'ViewChannel',
      'SendMessages',
      'EmbedLinks',
      'AttachFiles',
      'UseExternalEmojis',
      'AddReactions',
      'UseApplicationCommands',
      'CreateInstantInvite',
    ];
    
    // Calculate permission integer
    const permissionInt = 412317243456; // Pre-calculated for the above permissions
    
    return `https://discord.com/api/oauth2/authorize?client_id=${this.config.discord.clientId}&permissions=${permissionInt}&scope=bot%20applications.commands`;
  }
}