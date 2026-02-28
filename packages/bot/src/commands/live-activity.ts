import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { LiveActivityService, ActivityEvent, ActivityType } from '../services/live-activity.js';
import { AnalyticsService } from '../services/analytics.js';
import { TYPES } from '../types.js';

@injectable()
export class LiveActivityCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('live-activity')
    .setDescription('View real-time platform activity and engagement')
    .addSubcommand(subcommand =>
      subcommand
        .setName('feed')
        .setDescription('View recent activity feed')
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('Time period to show')
            .addChoices(
              { name: 'Last Hour', value: 'hour' },
              { name: 'Last Day', value: 'day' },
              { name: 'Last Week', value: 'week' }
            )
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Filter by activity type')
            .addChoices(
              { name: 'All Activities', value: 'all' },
              { name: 'Games Created', value: 'GAME_CREATED' },
              { name: 'Games Played', value: 'GAME_PLAYED' },
              { name: 'Achievements', value: 'ACHIEVEMENT_UNLOCKED' },
              { name: 'Viral Milestones', value: 'VIRAL_MILESTONE' },
              { name: 'Tier Upgrades', value: 'TIER_UPGRADED' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of activities to show (1-50)')
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View platform activity statistics')
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('Time period to analyze')
            .addChoices(
              { name: 'Last Hour', value: 'hour' },
              { name: 'Last Day', value: 'day' },
              { name: 'Last Week', value: 'week' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('trending')
        .setDescription('View trending activities and hot content')
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of trending items to show (1-20)')
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('live')
        .setDescription('View real-time live statistics')
    );

  constructor(
    @inject(TYPES.LiveActivityService) private liveActivityService: LiveActivityService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'feed':
          await this.handleFeed(interaction);
          break;
        case 'stats':
          await this.handleStats(interaction);
          break;
        case 'trending':
          await this.handleTrending(interaction);
          break;
        case 'live':
          await this.handleLive(interaction);
          break;
      }
    } catch (error) {
      console.error('Error in live activity command:', error);
      await interaction.reply({
        content: '❌ An error occurred while fetching activity data.',
        ephemeral: true
      });
    }
  }

  private async handleFeed(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const timeframe = interaction.options.getString('timeframe') as 'hour' | 'day' | 'week' || 'day';
    const typeFilter = interaction.options.getString('type');
    const limit = interaction.options.getInteger('limit') || 20;

    const options: any = {
      timeframe,
      limit,
      serverId: interaction.guildId || undefined
    };

    if (typeFilter && typeFilter !== 'all') {
      options.types = [typeFilter as ActivityType];
    }

    const activities = await this.liveActivityService.getActivityFeed(options);

    if (activities.length === 0) {
      const noActivityEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('📊 Live Activity Feed')
        .setDescription(`No activities found in the last ${timeframe}.`)
        .setFooter({ text: 'GameVibe AI • Live Activity' })
        .setTimestamp();

      await interaction.editReply({ embeds: [noActivityEmbed] });
      return;
    }

    const feedEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📊 Live Activity Feed - ${this.formatTimeframe(timeframe)}`)
      .setDescription(`Recent platform activity (${activities.length} activities)`)
      .setFooter({ text: 'GameVibe AI • Live Activity' })
      .setTimestamp();

    // Add activity items
    const activityItems = activities.slice(0, 15).map(activity => {
      const timeAgo = this.formatTimeAgo(activity.timestamp);
      const activityText = this.formatActivityText(activity);
      const emoji = this.getActivityEmoji(activity.type);
      
      return `${emoji} **${timeAgo}** - ${activityText}`;
    });

    feedEmbed.addFields({
      name: '🔄 Recent Activities',
      value: activityItems.join('\n') || 'No activities found',
      inline: false
    });

    // Add summary stats
    const uniqueUsers = new Set(activities.map(a => a.userId)).size;
    const uniqueGames = new Set(activities.map(a => a.gameId).filter(Boolean)).size;
    
    feedEmbed.addFields({
      name: '📈 Summary',
      value: `**${activities.length}** activities • **${uniqueUsers}** users • **${uniqueGames}** games`,
      inline: false
    });

    // Add navigation buttons
    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('live-activity-refresh')
          .setLabel('Refresh')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('live-activity-stats')
          .setLabel('View Stats')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('live-activity-trending')
          .setLabel('Trending')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔥')
      );

    await interaction.editReply({ 
      embeds: [feedEmbed],
      components: [buttons]
    });

    // Track analytics
    await this.analytics.track('live_activity_feed_viewed', {
      userId: interaction.user.id,
      serverId: interaction.guildId,
      timeframe,
      typeFilter,
      limit,
      activitiesFound: activities.length
    });
  }

  private async handleStats(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const timeframe = interaction.options.getString('timeframe') as 'hour' | 'day' | 'week' || 'day';
    const stats = await this.liveActivityService.getActivityStats(timeframe);

    const statsEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(`📈 Platform Statistics - ${this.formatTimeframe(timeframe)}`)
      .setDescription('Comprehensive activity analytics across GameVibe AI')
      .addFields(
        {
          name: '🎯 Overview',
          value: `**${stats.totalActivities}** total activities\n**${stats.activeUsers}** active users`,
          inline: true
        },
        {
          name: '📊 Engagement',
          value: `**${(stats.totalActivities / Math.max(stats.activeUsers, 1)).toFixed(1)}** activities per user\n**${Math.round(stats.totalActivities / this.getTimeframeDivisor(timeframe))}** per hour`,
          inline: true
        },
        {
          name: '⭐ Status',
          value: this.getActivityStatus(stats.totalActivities, timeframe),
          inline: true
        }
      )
      .setFooter({ text: 'GameVibe AI • Platform Statistics' })
      .setTimestamp();

    // Popular games
    if (stats.popularGames.length > 0) {
      const gamesList = stats.popularGames.slice(0, 5).map((game, index) => 
        `${index + 1}. **${game.gameTitle}** (${game.activityCount} activities)`
      ).join('\n');
      
      statsEmbed.addFields({
        name: '🎮 Popular Games',
        value: gamesList,
        inline: false
      });
    }

    // Top servers
    if (stats.topServers.length > 0) {
      const serversList = stats.topServers.slice(0, 5).map((server, index) => 
        `${index + 1}. **${server.serverName}** (${server.activityCount} activities)`
      ).join('\n');
      
      statsEmbed.addFields({
        name: '🏆 Most Active Servers',
        value: serversList,
        inline: false
      });
    }

    // Recent milestones
    if (stats.recentMilestones.length > 0) {
      const milestonesList = stats.recentMilestones.slice(0, 3).map(milestone => {
        const timeAgo = this.formatTimeAgo(milestone.timestamp);
        const text = this.formatActivityText(milestone);
        const emoji = this.getActivityEmoji(milestone.type);
        return `${emoji} ${text} (${timeAgo})`;
      }).join('\n');
      
      statsEmbed.addFields({
        name: '🎉 Recent Milestones',
        value: milestonesList,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [statsEmbed] });

    // Track analytics
    await this.analytics.track('live_activity_stats_viewed', {
      userId: interaction.user.id,
      serverId: interaction.guildId,
      timeframe,
      totalActivities: stats.totalActivities,
      activeUsers: stats.activeUsers
    });
  }

  private async handleTrending(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const limit = interaction.options.getInteger('limit') || 10;
    const trending = await this.liveActivityService.getTrendingActivities(limit);

    const trendingEmbed = new EmbedBuilder()
      .setColor(0xFF6B35)
      .setTitle('🔥 Trending Activities')
      .setDescription('Hot activities happening right now across the platform')
      .setFooter({ text: 'GameVibe AI • Trending Now' })
      .setTimestamp();

    if (trending.length === 0) {
      trendingEmbed.setDescription('No trending activities at the moment. Check back soon!');
    } else {
      const trendingList = trending.map((activity, index) => {
        const timeAgo = this.formatTimeAgo(activity.timestamp);
        const text = this.formatActivityText(activity);
        const emoji = this.getActivityEmoji(activity.type);
        const position = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
        
        return `${position} ${emoji} ${text} *${timeAgo}*`;
      }).join('\n');

      trendingEmbed.addFields({
        name: '📊 Top Trending',
        value: trendingList,
        inline: false
      });

      // Add trending stats
      const uniqueTypes = new Set(trending.map(t => t.type)).size;
      const avgAge = trending.reduce((sum, t) => {
        return sum + (Date.now() - new Date(t.timestamp).getTime());
      }, 0) / trending.length;

      trendingEmbed.addFields({
        name: '🎯 Trending Stats',
        value: `**${trending.length}** hot activities • **${uniqueTypes}** activity types • Average age: **${Math.round(avgAge / (60 * 1000))}** minutes`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [trendingEmbed] });

    // Track analytics
    await this.analytics.track('live_activity_trending_viewed', {
      userId: interaction.user.id,
      serverId: interaction.guildId,
      limit,
      trendingFound: trending.length
    });
  }

  private async handleLive(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const liveStats = await this.liveActivityService.getLiveStats();

    const liveEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🟢 Live Platform Stats')
      .setDescription('Real-time activity happening right now')
      .addFields(
        {
          name: '🎮 Active Games',
          value: `**${liveStats.activeGames}** games being played`,
          inline: true
        },
        {
          name: '👥 Active Players',
          value: `**${liveStats.activePlayers}** players online`,
          inline: true
        },
        {
          name: '⚡ Recent Activity',
          value: `**${liveStats.recentActivity}** in last 15 min`,
          inline: true
        }
      )
      .setFooter({ text: 'GameVibe AI • Live Stats • Updates every 2 minutes' })
      .setTimestamp();

    // Add status indicator
    const activity = liveStats.recentActivity;
    let statusColor = 0xED4245; // Red
    let statusText = '🔴 Low Activity';
    
    if (activity >= 20) {
      statusColor = 0x57F287; // Green
      statusText = '🟢 High Activity';
    } else if (activity >= 10) {
      statusColor = 0xFEE75C; // Yellow
      statusText = '🟡 Moderate Activity';
    }

    liveEmbed.setColor(statusColor);
    liveEmbed.addFields({
      name: '📊 Platform Status',
      value: statusText,
      inline: false
    });

    // Add top recent activity if available
    if (liveStats.topActivity) {
      const topActivityText = this.formatActivityText(liveStats.topActivity);
      const timeAgo = this.formatTimeAgo(liveStats.topActivity.timestamp);
      const emoji = this.getActivityEmoji(liveStats.topActivity.type);
      
      liveEmbed.addFields({
        name: '⭐ Latest Highlight',
        value: `${emoji} ${topActivityText} *${timeAgo}*`,
        inline: false
      });
    }

    // Add auto-refresh button
    const refreshButton = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('live-activity-refresh-live')
          .setLabel('Refresh Live Stats')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔄')
      );

    await interaction.editReply({ 
      embeds: [liveEmbed],
      components: [refreshButton]
    });

    // Track analytics
    await this.analytics.track('live_activity_live_viewed', {
      userId: interaction.user.id,
      serverId: interaction.guildId,
      activeGames: liveStats.activeGames,
      activePlayers: liveStats.activePlayers,
      recentActivity: liveStats.recentActivity
    });
  }

  private formatTimeframe(timeframe: string): string {
    const formats = {
      hour: 'Last Hour',
      day: 'Last 24 Hours',
      week: 'Last 7 Days'
    };
    return formats[timeframe as keyof typeof formats] || 'Recent';
  }

  private formatTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  private formatActivityText(activity: ActivityEvent): string {
    const userName = activity.metadata.userName || 'Someone';
    
    switch (activity.type) {
      case 'GAME_CREATED':
        return `${userName} created "${activity.metadata.gameTitle}"`;
      case 'GAME_PLAYED':
        return `${userName} played "${activity.metadata.gameTitle}"`;
      case 'ACHIEVEMENT_UNLOCKED':
        return `${userName} unlocked an achievement`;
      case 'TIER_UPGRADED':
        return `${userName} reached ${activity.metadata.newTier} tier`;
      case 'VIRAL_MILESTONE':
        return `${userName}'s game hit ${activity.metadata.milestone} plays`;
      case 'AMBASSADOR_PROMOTED':
        return `${userName} was promoted to ${activity.metadata.newRank}`;
      case 'CHALLENGE_COMPLETED':
        return `${userName} completed a challenge`;
      case 'GAME_SHARED':
        return `${userName} shared "${activity.metadata.gameTitle}"`;
      case 'REMIX_CREATED':
        return `${userName} created a game remix`;
      case 'MULTIPLAYER_SESSION':
        return `${userName} joined a multiplayer game`;
      case 'SERVER_JOINED':
        return `New server "${activity.metadata.serverName}" joined`;
      case 'CREDITS_EARNED':
        return `${userName} earned ${activity.metadata.amount} credits`;
      case 'REFERRAL_SUCCESS':
        return `${userName} successfully referred a new server`;
      default:
        return `${userName} had platform activity`;
    }
  }

  private getActivityEmoji(type: ActivityType): string {
    const emojis = {
      GAME_CREATED: '🎮',
      GAME_PLAYED: '🕹️',
      ACHIEVEMENT_UNLOCKED: '🏆',
      TIER_UPGRADED: '⭐',
      VIRAL_MILESTONE: '🚀',
      AMBASSADOR_PROMOTED: '🎖️',
      CHALLENGE_COMPLETED: '⚔️',
      GAME_SHARED: '📤',
      REMIX_CREATED: '🔄',
      MULTIPLAYER_SESSION: '👥',
      SERVER_JOINED: '🎉',
      CREDITS_EARNED: '💰',
      REFERRAL_SUCCESS: '🔗'
    };
    return emojis[type] || '📊';
  }

  private getTimeframeDivisor(timeframe: 'hour' | 'day' | 'week'): number {
    switch (timeframe) {
      case 'hour': return 1;
      case 'day': return 24;
      case 'week': return 168;
      default: return 24;
    }
  }

  private getActivityStatus(total: number, timeframe: 'hour' | 'day' | 'week'): string {
    const thresholds = {
      hour: { high: 50, medium: 20 },
      day: { high: 500, medium: 200 },
      week: { high: 2000, medium: 800 }
    };

    const threshold = thresholds[timeframe];
    
    if (total >= threshold.high) return '🟢 High Activity';
    if (total >= threshold.medium) return '🟡 Moderate Activity';
    return '🔴 Low Activity';
  }
}