import { injectable, inject } from 'inversify';
import { Client, EmbedBuilder, TextChannel, Guild, GuildChannel } from 'discord.js';
import { TYPES } from '../types.js';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { AnalyticsService } from './analytics.js';

export interface ViralMoment {
  type: ViralMomentType;
  userId: string;
  serverId?: string;
  gameId?: string;
  metadata: Record<string, any>;
  magnitude: 'minor' | 'major' | 'legendary';
  timestamp: Date;
}

export type ViralMomentType = 
  | 'GAME_VIRAL_MILESTONE'
  | 'CREATOR_TIER_UPGRADE' 
  | 'ACHIEVEMENT_UNLOCKED'
  | 'SERVER_REFERRAL_MILESTONE'
  | 'CROSS_SERVER_VIRAL'
  | 'AMBASSADOR_PROMOTION'
  | 'CHALLENGE_LEGENDARY_WIN'
  | 'VIRAL_COEFFICIENT_SPIKE';

export interface NotificationConfig {
  enabled: boolean;
  channelId?: string;
  minMagnitude: 'minor' | 'major' | 'legendary';
  allowedTypes: ViralMomentType[];
  rateLimitMinutes: number;
}

@injectable()
export class ViralNotificationService {
  private readonly DEFAULT_CONFIG: NotificationConfig = {
    enabled: true,
    minMagnitude: 'major',
    allowedTypes: [
      'GAME_VIRAL_MILESTONE',
      'CREATOR_TIER_UPGRADE',
      'CROSS_SERVER_VIRAL',
      'AMBASSADOR_PROMOTION',
      'CHALLENGE_LEGENDARY_WIN'
    ],
    rateLimitMinutes: 10
  };

  constructor(
    @inject(TYPES.DiscordClient) private client: Client,
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService
  ) {}

  /**
   * Broadcast a viral moment to all appropriate servers
   */
  async broadcastViralMoment(moment: ViralMoment): Promise<number> {
    try {
      let broadcastCount = 0;

      // Get all servers where notifications are enabled
      const servers = await this.getNotificationServers();
      
      for (const server of servers) {
        const config = await this.getServerConfig(server.discordId);
        
        // Check if this moment should be broadcast to this server
        if (!this.shouldBroadcast(moment, config, server.discordId)) {
          continue;
        }

        // Check rate limiting
        if (await this.isRateLimited(server.discordId, moment.type)) {
          continue;
        }

        // Send notification
        const success = await this.sendNotification(server.discordId, moment, config);
        if (success) {
          broadcastCount++;
          await this.updateRateLimit(server.discordId, moment.type);
        }
      }

      // Track analytics
      await this.analytics.track('viral_moment_broadcast', {
        type: moment.type,
        magnitude: moment.magnitude,
        broadcastCount,
        userId: moment.userId,
        serverId: moment.serverId
      });

      console.log(`📢 Broadcast viral moment ${moment.type} to ${broadcastCount} servers`);
      return broadcastCount;

    } catch (error) {
      console.error('Error broadcasting viral moment:', error);
      return 0;
    }
  }

  /**
   * Send notification to a specific server
   */
  private async sendNotification(
    serverDiscordId: string,
    moment: ViralMoment,
    config: NotificationConfig
  ): Promise<boolean> {
    try {
      const guild = await this.client.guilds.fetch(serverDiscordId);
      if (!guild) return false;

      // Find notification channel
      const channel = await this.getNotificationChannel(guild, config);
      if (!channel) return false;

      // Create notification embed
      const embed = await this.createViralEmbed(moment);
      if (!embed) return false;

      // Send notification
      await channel.send({ embeds: [embed] });
      return true;

    } catch (error) {
      console.error(`Error sending notification to server ${serverDiscordId}:`, error);
      return false;
    }
  }

  /**
   * Create viral moment embed
   */
  private async createViralEmbed(moment: ViralMoment): Promise<EmbedBuilder | null> {
    try {
      const user = await this.client.users.fetch(moment.userId).catch(() => null);
      const userName = user?.displayName || user?.username || 'Unknown Creator';

      let embed = new EmbedBuilder()
        .setTimestamp()
        .setFooter({ text: 'GameVibe AI • Viral Moment' });

      // Set color and icon based on magnitude
      switch (moment.magnitude) {
        case 'legendary':
          embed.setColor(0xFF6B35); // Bright orange
          break;
        case 'major':
          embed.setColor(0x5865F2); // Discord blue
          break;
        case 'minor':
          embed.setColor(0x57F287); // Green
          break;
      }

      // Create content based on moment type
      switch (moment.type) {
        case 'GAME_VIRAL_MILESTONE':
          return this.createGameViralEmbed(embed, userName, moment);
          
        case 'CREATOR_TIER_UPGRADE':
          return this.createTierUpgradeEmbed(embed, userName, moment);
          
        case 'ACHIEVEMENT_UNLOCKED':
          // Handle achievement notifications (implement if needed)
          return null;
          
        case 'CROSS_SERVER_VIRAL':
          return this.createCrossServerEmbed(embed, userName, moment);
          
        case 'AMBASSADOR_PROMOTION':
          return this.createAmbassadorEmbed(embed, userName, moment);
          
        case 'CHALLENGE_LEGENDARY_WIN':
          return this.createChallengeEmbed(embed, userName, moment);
          
        case 'VIRAL_COEFFICIENT_SPIKE':
          return this.createCoefficientEmbed(embed, userName, moment);
          
        default:
          return null;
      }

    } catch (error) {
      console.error('Error creating viral embed:', error);
      return null;
    }
  }

  /**
   * Create game viral milestone embed
   */
  private async createGameViralEmbed(
    embed: EmbedBuilder,
    userName: string,
    moment: ViralMoment
  ): Promise<EmbedBuilder> {
    const { gameTitle, playCount, milestone } = moment.metadata;
    
    let emoji = '🎮';
    let title = 'Game Going Viral!';
    
    if (playCount >= 100000) {
      emoji = '🏆';
      title = 'LEGENDARY Game Success!';
    } else if (playCount >= 10000) {
      emoji = '🚀';
      title = 'Game Goes MEGA Viral!';
    } else if (playCount >= 1000) {
      emoji = '🔥';
      title = 'Game Goes Viral!';
    }

    return embed
      .setTitle(`${emoji} ${title}`)
      .setDescription(
        `**${userName}** created an incredible game that just hit **${playCount.toLocaleString()} plays**!\n\n` +
        `🎯 **"${gameTitle}"** is captivating players across Discord!\n` +
        `🌟 This creator just earned **${milestone.reward} credits** for reaching this milestone!`
      )
      .addFields(
        {
          name: '🎮 Game Stats',
          value: `**${playCount.toLocaleString()}** total plays\n**${milestone.serverCount || 1}** servers reached`,
          inline: true
        },
        {
          name: '👨‍💻 Creator',
          value: `${userName}\nEarned **${milestone.reward}** credits!`,
          inline: true
        }
      );
  }

  /**
   * Create creator tier upgrade embed
   */
  private async createTierUpgradeEmbed(
    embed: EmbedBuilder,
    userName: string,
    moment: ViralMoment
  ): Promise<EmbedBuilder> {
    const { previousTier, newTier, totalEarned } = moment.metadata;
    
    const tierEmojis = {
      BRONZE: '🥉',
      SILVER: '🥈', 
      GOLD: '🥇',
      DIAMOND: '💎'
    };

    const tierColors = {
      BRONZE: 0xCD7F32,
      SILVER: 0xC0C0C0,
      GOLD: 0xFFD700,
      DIAMOND: 0xB9F2FF
    };

    embed.setColor(tierColors[newTier as keyof typeof tierColors] || 0x5865F2);

    return embed
      .setTitle(`${tierEmojis[newTier as keyof typeof tierEmojis]} Creator Tier Upgrade!`)
      .setDescription(
        `**${userName}** just achieved **${newTier} Creator Tier**!\n\n` +
        `🎉 Upgraded from ${tierEmojis[previousTier as keyof typeof tierEmojis]} ${previousTier} → ${tierEmojis[newTier as keyof typeof tierEmojis]} ${newTier}\n` +
        `💰 Total earnings: **${totalEarned.toLocaleString()} credits**`
      )
      .addFields(
        {
          name: '🚀 New Benefits',
          value: this.getTierBenefits(newTier),
          inline: false
        }
      );
  }

  /**
   * Create cross-server viral embed
   */
  private async createCrossServerEmbed(
    embed: EmbedBuilder,
    userName: string,
    moment: ViralMoment
  ): Promise<EmbedBuilder> {
    const { gameTitle, serverCount, milestone } = moment.metadata;

    return embed
      .setTitle('🌐 Cross-Server Viral Success!')
      .setDescription(
        `**${userName}**'s game is spreading like wildfire across Discord!\n\n` +
        `🎮 **"${gameTitle}"** has now reached **${serverCount} servers**!\n` +
        `🎯 Earned **${milestone.reward} credits** for this viral milestone!`
      )
      .addFields(
        {
          name: '📊 Viral Stats',
          value: `**${serverCount}** servers reached\n**${milestone.totalPlays || 'Many'}** total plays`,
          inline: true
        },
        {
          name: '🏆 Achievement',
          value: `Cross-server milestone\n**+${milestone.reward}** credits`,
          inline: true
        }
      );
  }

  /**
   * Create ambassador promotion embed
   */
  private async createAmbassadorEmbed(
    embed: EmbedBuilder,
    userName: string,
    moment: ViralMoment
  ): Promise<EmbedBuilder> {
    const { previousRank, newRank, serverName } = moment.metadata;

    const rankEmojis = {
      APPRENTICE: '🔰',
      AMBASSADOR: '🎖️',
      SENIOR: '⭐',
      MASTER: '👑'
    };

    return embed
      .setTitle(`${rankEmojis[newRank as keyof typeof rankEmojis]} Ambassador Promotion!`)
      .setDescription(
        `**${userName}** has been promoted to **${newRank} Ambassador** in **${serverName}**!\n\n` +
        `🎉 Advanced from ${rankEmojis[previousRank as keyof typeof rankEmojis]} ${previousRank} → ${rankEmojis[newRank as keyof typeof rankEmojis]} ${newRank}\n` +
        `🌟 Outstanding community leadership recognized!`
      )
      .addFields(
        {
          name: '🏆 New Privileges',
          value: `• Enhanced credit multiplier\n• Higher activity recognition\n• Community leadership role`,
          inline: false
        }
      );
  }

  /**
   * Create challenge win embed
   */
  private async createChallengeEmbed(
    embed: EmbedBuilder,
    userName: string,
    moment: ViralMoment
  ): Promise<EmbedBuilder> {
    const { gameTitle, wager, challengeType } = moment.metadata;

    return embed
      .setTitle('⚔️ Legendary Challenge Victory!')
      .setDescription(
        `**${userName}** just won a high-stakes challenge!\n\n` +
        `🎮 Game: **"${gameTitle}"**\n` +
        `💰 Wager: **${wager} credits**\n` +
        `🏆 Challenge type: **${challengeType}**`
      )
      .addFields(
        {
          name: '💎 Epic Win',
          value: `Won **${wager}** credits in this legendary challenge!`,
          inline: false
        }
      );
  }

  /**
   * Create viral coefficient spike embed
   */
  private async createCoefficientEmbed(
    embed: EmbedBuilder,
    userName: string,
    moment: ViralMoment
  ): Promise<EmbedBuilder> {
    const { coefficient, previousCoefficient, timeframe } = moment.metadata;

    return embed
      .setTitle('📈 Viral Coefficient Spike!')
      .setDescription(
        `**${userName}**'s content is driving incredible viral growth!\n\n` +
        `📊 Viral coefficient jumped to **${coefficient.toFixed(2)}**\n` +
        `🚀 That's a **${((coefficient - previousCoefficient) * 100).toFixed(1)}%** increase!`
      )
      .addFields(
        {
          name: '🎯 Impact',
          value: `Each user is now bringing **${coefficient.toFixed(2)}** new users!\nMeasured over **${timeframe}**`,
          inline: false
        }
      );
  }

  /**
   * Get tier benefits description
   */
  private getTierBenefits(tier: string): string {
    const benefits = {
      BRONZE: '• 1x earning multiplier\n• Basic creator features',
      SILVER: '• 1.1x earning multiplier\n• Monthly bonus: 50 credits\n• Priority queue access',
      GOLD: '• 1.25x earning multiplier\n• Monthly bonus: 200 credits\n• Custom branding\n• Exclusive templates',
      DIAMOND: '• 1.5x earning multiplier\n• Monthly bonus: 1000 credits\n• Lifetime Pro access\n• Early feature access'
    };
    
    return benefits[tier as keyof typeof benefits] || '• Enhanced creator privileges';
  }

  /**
   * Get servers with notifications enabled
   */
  private async getNotificationServers(): Promise<Array<{ discordId: string }>> {
    return await this.db.prisma.server.findMany({
      select: { discordId: true },
      where: {
        // Only active servers that bot is still in
        discordId: {
          in: Array.from(this.client.guilds.cache.keys())
        }
      }
    });
  }

  /**
   * Get server notification configuration
   */
  async getServerConfig(serverDiscordId: string): Promise<NotificationConfig> {
    const cacheKey = `viral_notification_config:${serverDiscordId}`;
    const cached = await this.cache.get<string>(cacheKey);
    
    if (cached) {
      return { ...this.DEFAULT_CONFIG, ...JSON.parse(cached) };
    }

    // Get from database or return default
    const server = await this.db.prisma.server.findUnique({
      where: { discordId: serverDiscordId },
      select: { settings: true }
    });

    const config = server?.settings ? 
      (server.settings as any)?.viralNotifications || this.DEFAULT_CONFIG :
      this.DEFAULT_CONFIG;

    // Cache for 1 hour
    await this.cache.set(cacheKey, JSON.stringify(config), 3600);
    
    return { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if moment should be broadcast to server
   */
  private shouldBroadcast(
    moment: ViralMoment,
    config: NotificationConfig,
    serverDiscordId: string
  ): boolean {
    // Check if notifications are enabled
    if (!config.enabled) return false;

    // Check magnitude threshold
    const magnitudes = ['minor', 'major', 'legendary'];
    if (magnitudes.indexOf(moment.magnitude) < magnitudes.indexOf(config.minMagnitude)) {
      return false;
    }

    // Check if moment type is allowed
    if (!config.allowedTypes.includes(moment.type)) return false;

    // Don't broadcast user's own moments to their server (avoid spam)
    if (moment.serverId === serverDiscordId) return false;

    return true;
  }

  /**
   * Check rate limiting
   */
  private async isRateLimited(serverDiscordId: string, momentType: ViralMomentType): Promise<boolean> {
    const config = await this.getServerConfig(serverDiscordId);
    const key = `rate_limit:${serverDiscordId}:${momentType}`;
    
    const lastSent = await this.cache.get<string>(key);
    if (!lastSent) return false;

    const lastSentTime = new Date(lastSent);
    const now = new Date();
    const minutesSince = (now.getTime() - lastSentTime.getTime()) / (1000 * 60);

    return minutesSince < config.rateLimitMinutes;
  }

  /**
   * Update rate limit tracking
   */
  private async updateRateLimit(serverDiscordId: string, momentType: ViralMomentType): Promise<void> {
    const config = await this.getServerConfig(serverDiscordId);
    const key = `rate_limit:${serverDiscordId}:${momentType}`;
    const ttl = config.rateLimitMinutes * 60;
    
    await this.cache.set(key, new Date().toISOString(), ttl);
  }

  /**
   * Get notification channel for server
   */
  private async getNotificationChannel(guild: Guild, config: NotificationConfig): Promise<TextChannel | null> {
    try {
      // Try configured channel first
      if (config.channelId) {
        const channel = await guild.channels.fetch(config.channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          return channel as TextChannel;
        }
      }

      // Fallback to general/announcements channels
      const fallbackNames = ['general', 'announcements', 'gamevibe', 'games', 'bot-updates'];
      
      for (const name of fallbackNames) {
        const channel = guild.channels.cache.find(ch => 
          ch.name.toLowerCase().includes(name) && ch.isTextBased()
        );
        
        if (channel && this.canSendMessages(channel as GuildChannel)) {
          return channel as TextChannel;
        }
      }

      // Last resort: first text channel we can send to
      const textChannels = guild.channels.cache.filter(ch => 
        ch.isTextBased() && this.canSendMessages(ch as GuildChannel)
      );
      
      return textChannels.first() as TextChannel || null;

    } catch (error) {
      console.error('Error finding notification channel:', error);
      return null;
    }
  }

  /**
   * Check if bot can send messages to channel
   */
  private canSendMessages(channel: GuildChannel): boolean {
    try {
      const permissions = channel.permissionsFor(this.client.user!);
      return permissions ? permissions.has(['SendMessages', 'EmbedLinks']) : false;
    } catch {
      return false;
    }
  }

  /**
   * Configure server notification settings
   */
  async configureServerNotifications(
    serverDiscordId: string,
    config: Partial<NotificationConfig>
  ): Promise<void> {
    const currentConfig = await this.getServerConfig(serverDiscordId);
    const newConfig = { ...currentConfig, ...config };

    // Update in database
    const currentServer = await this.db.prisma.server.findUnique({
      where: { discordId: serverDiscordId },
      select: { settings: true }
    });
    
    await this.db.prisma.server.update({
      where: { discordId: serverDiscordId },
      data: {
        settings: {
          ...(currentServer?.settings as any || {}),
          viralNotifications: newConfig
        }
      }
    });

    // Clear cache
    const cacheKey = `viral_notification_config:${serverDiscordId}`;
    await this.cache.delete(cacheKey);
  }

  /**
   * Quick method to trigger common viral moments
   */
  async triggerGameViralMilestone(
    userId: string,
    gameId: string,
    gameTitle: string,
    playCount: number,
    serverCount: number = 1
  ): Promise<void> {
    // Determine milestone and magnitude
    let magnitude: 'minor' | 'major' | 'legendary' = 'minor';
    let reward = 0;

    if (playCount >= 100000) {
      magnitude = 'legendary';
      reward = 10000;
    } else if (playCount >= 10000) {
      magnitude = 'major';
      reward = 1000;
    } else if (playCount >= 1000) {
      magnitude = 'major';
      reward = 100;
    } else if (playCount >= 100) {
      magnitude = 'minor';
      reward = 10;
    }

    if (reward > 0) {
      await this.broadcastViralMoment({
        type: 'GAME_VIRAL_MILESTONE',
        userId,
        gameId,
        metadata: {
          gameTitle,
          playCount,
          serverCount,
          milestone: { plays: playCount, reward }
        },
        magnitude,
        timestamp: new Date()
      });
    }
  }

  /**
   * Trigger creator tier upgrade notification
   */
  async triggerCreatorTierUpgrade(
    userId: string,
    previousTier: string,
    newTier: string,
    totalEarned: number
  ): Promise<void> {
    const magnitude = newTier === 'DIAMOND' ? 'legendary' : 
                     newTier === 'GOLD' ? 'major' : 'minor';

    await this.broadcastViralMoment({
      type: 'CREATOR_TIER_UPGRADE',
      userId,
      metadata: {
        previousTier,
        newTier,
        totalEarned
      },
      magnitude,
      timestamp: new Date()
    });
  }
}