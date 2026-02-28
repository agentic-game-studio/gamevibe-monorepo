import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { injectable, inject } from 'inversify';
import { SocialMediaService } from '../services/social-media.js';
import { Logger } from '../utils/logger.js';
import { TYPES } from '../types.js';
import { prisma } from '../utils/database.js';

@injectable()
export class SocialMediaCommand {
  private logger = new Logger('SocialMediaCommand');

  constructor(
    @inject(TYPES.SocialMediaService) private socialMediaService: SocialMediaService
  ) {}

  data = new SlashCommandBuilder()
    .setName('social-media')
    .setDescription('Manage social media auto-posting')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configure social media auto-posting')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('View current social media configuration')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable auto-posting')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Enable or disable auto-posting')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('platforms')
        .setDescription('Select which platforms to post to')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('triggers')
        .setDescription('Configure when to auto-post')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('templates')
        .setDescription('Customize post templates')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('analytics')
        .setDescription('View social media analytics')
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('Analytics timeframe')
            .addChoices(
              { name: 'Last 24 hours', value: '24h' },
              { name: 'Last 7 days', value: '7d' },
              { name: 'Last 30 days', value: '30d' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('schedule')
        .setDescription('Schedule a social media post')
        .addStringOption(option =>
          option
            .setName('platform')
            .setDescription('Platform to post to')
            .setRequired(true)
            .addChoices(
              { name: 'Twitter', value: 'twitter' },
              { name: 'TikTok', value: 'tiktok' }
            )
        )
        .addStringOption(option =>
          option
            .setName('content')
            .setDescription('Post content')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('Schedule time (e.g., "2h", "tomorrow 3pm")')
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

  async execute(interaction: CommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'setup':
        await this.handleSetup(interaction);
        break;
      case 'status':
        await this.handleStatus(interaction);
        break;
      case 'toggle':
        await this.handleToggle(interaction);
        break;
      case 'platforms':
        await this.handlePlatforms(interaction);
        break;
      case 'triggers':
        await this.handleTriggers(interaction);
        break;
      case 'templates':
        await this.handleTemplates(interaction);
        break;
      case 'analytics':
        await this.handleAnalytics(interaction);
        break;
      case 'schedule':
        await this.handleSchedule(interaction);
        break;
    }
  }

  private async handleSetup(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    if (!this.socialMediaService.isServiceConfigured()) {
      const embed = new EmbedBuilder()
        .setTitle('📢 Social Media Setup Required')
        .setDescription(
          'Social media integration is not configured on this bot instance.\n\n' +
          '**Required Configuration:**\n' +
          '• Twitter API credentials\n' +
          '• TikTok API credentials\n\n' +
          'Please contact the bot administrator to set up social media integration.'
        )
        .setColor(0xff0000)
        .setFooter({ text: 'Social media features require API credentials' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📢 Social Media Auto-Posting Setup')
      .setDescription(
        'Configure how GameVibe AI shares your games on social media!\n\n' +
        '**Quick Setup Options:**'
      )
      .setColor(0x00acee)
      .addFields(
        {
          name: '🌐 Platforms',
          value: 'Choose which social media platforms to post to',
          inline: false,
        },
        {
          name: '🎯 Triggers',
          value: 'Select when to automatically create posts',
          inline: false,
        },
        {
          name: '📝 Templates',
          value: 'Customize your post messages',
          inline: false,
        }
      )
      .setFooter({ text: 'Use the buttons below to configure each setting' });

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('social:platforms')
          .setLabel('Select Platforms')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🌐'),
        new ButtonBuilder()
          .setCustomId('social:triggers')
          .setLabel('Configure Triggers')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎯'),
        new ButtonBuilder()
          .setCustomId('social:templates')
          .setLabel('Edit Templates')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📝')
      );

    await interaction.reply({ embeds: [embed], components: [row] });
  }

  private async handleStatus(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const serverId = interaction.guildId!;
    const settings = await this.socialMediaService.getServerAutoPostSettings(serverId);

    const embed = new EmbedBuilder()
      .setTitle('📢 Social Media Configuration Status')
      .setColor(settings.enabled ? 0x00ff00 : 0xff0000)
      .addFields(
        {
          name: 'Status',
          value: settings.enabled ? '✅ Enabled' : '❌ Disabled',
          inline: true,
        },
        {
          name: 'Active Platforms',
          value: settings.platforms.length > 0 
            ? settings.platforms.map(p => `• ${p}`).join('\n')
            : 'None selected',
          inline: true,
        },
        {
          name: 'Auto-Post Triggers',
          value: Object.entries(settings.triggers)
            .filter(([_, enabled]) => enabled)
            .map(([trigger, _]) => `• ${this.formatTriggerName(trigger)}`)
            .join('\n') || 'None enabled',
          inline: false,
        }
      )
      .setTimestamp();

    // Add recent posts if any
    const recentPosts = await prisma.socialMediaPost.findMany({
      where: {
        game: {
          serverId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { game: true },
    });

    if (recentPosts.length > 0) {
      embed.addFields({
        name: '📊 Recent Posts',
        value: recentPosts.map(post => 
          `• ${post.platform}: "${post.game.title}" ${post.success ? '✅' : '❌'}`
        ).join('\n'),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleToggle(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    const enabled = interaction.options.getBoolean('enabled', true);
    const serverId = interaction.guildId!;

    await this.socialMediaService.updateServerAutoPostSettings(serverId, {
      enabled,
    });

    const embed = new EmbedBuilder()
      .setTitle('📢 Social Media Auto-Posting Updated')
      .setDescription(
        enabled
          ? '✅ **Auto-posting enabled!**\n\nGames will now be automatically shared on your configured social media platforms.'
          : '❌ **Auto-posting disabled!**\n\nGames will no longer be automatically shared on social media.'
      )
      .setColor(enabled ? 0x00ff00 : 0xff0000)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Track the change
    await prisma.analyticsEvent.create({
      data: {
        type: 'social_media_toggle',
        serverId,
        metadata: {
          enabled,
          userId: interaction.user.id,
        },
      },
    });
  }

  private async handlePlatforms(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    const serverId = interaction.guildId!;
    const settings = await this.socialMediaService.getServerAutoPostSettings(serverId);

    const embed = new EmbedBuilder()
      .setTitle('🌐 Select Social Media Platforms')
      .setDescription('Choose which platforms to auto-post to:')
      .setColor(0x00acee)
      .addFields({
        name: 'Currently Selected',
        value: settings.platforms.length > 0
          ? settings.platforms.map(p => `• ${p}`).join('\n')
          : 'None',
        inline: false,
      });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('social:select_platforms')
      .setPlaceholder('Select platforms')
      .setMinValues(0)
      .setMaxValues(2)
      .addOptions([
        {
          label: 'Twitter',
          description: 'Post game updates to Twitter/X',
          value: 'twitter',
          emoji: '🐦',
          default: settings.platforms.includes('twitter'),
        },
        {
          label: 'TikTok',
          description: 'Share gameplay videos on TikTok',
          value: 'tiktok',
          emoji: '🎵',
          default: settings.platforms.includes('tiktok'),
        },
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

    await interaction.reply({ embeds: [embed], components: [row] });
  }

  private async handleTriggers(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    const serverId = interaction.guildId!;
    const settings = await this.socialMediaService.getServerAutoPostSettings(serverId);

    const embed = new EmbedBuilder()
      .setTitle('🎯 Configure Auto-Post Triggers')
      .setDescription('Select when to automatically post to social media:')
      .setColor(0x00acee);

    const buttons = Object.entries(settings.triggers).map(([trigger, enabled]) => {
      return new ButtonBuilder()
        .setCustomId(`social:trigger:${trigger}`)
        .setLabel(this.formatTriggerName(trigger))
        .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji(this.getTriggerEmoji(trigger));
    });

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += 2) {
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(buttons.slice(i, i + 2));
      rows.push(row);
    }

    await interaction.reply({ embeds: [embed], components: rows });
  }

  private async handleTemplates(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    const embed = new EmbedBuilder()
      .setTitle('📝 Social Media Post Templates')
      .setDescription(
        'Customize your auto-post templates. Use these variables:\n\n' +
        '**Available Variables:**\n' +
        '• `{title}` - Game title\n' +
        '• `{type}` - Game type\n' +
        '• `{creator}` - Creator name\n' +
        '• `{url}` - Game URL\n' +
        '• `{plays}` - Play count\n' +
        '• `{shares}` - Share count\n' +
        '• `{servers}` - Servers reached\n\n' +
        'Select a template to edit:'
      )
      .setColor(0x00acee);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('social:select_template')
      .setPlaceholder('Choose a template to edit')
      .addOptions([
        {
          label: 'Game Creation',
          description: 'Posted when a new game is created',
          value: 'gameCreation',
          emoji: '🎮',
        },
        {
          label: 'Viral Milestone',
          description: 'Posted when a game goes viral',
          value: 'viralMilestone',
          emoji: '🔥',
        },
        {
          label: 'Weekly Highlight',
          description: 'Weekly top games summary',
          value: 'weeklyHighlight',
          emoji: '📊',
        },
        {
          label: 'Event Winner',
          description: 'Announces event winners',
          value: 'eventWinner',
          emoji: '🏆',
        },
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

    await interaction.reply({ embeds: [embed], components: [row] });
  }

  private async handleAnalytics(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const timeframe = interaction.options.getString('timeframe') as '24h' | '7d' | '30d' || '7d';
    const serverId = interaction.guildId!;

    const analytics = await this.socialMediaService.getSocialMediaAnalytics(serverId, timeframe);

    const embed = new EmbedBuilder()
      .setTitle('📊 Social Media Analytics')
      .setDescription(`Analytics for the last ${this.formatTimeframe(timeframe)}`)
      .setColor(0x00acee)
      .addFields(
        {
          name: '📨 Total Posts',
          value: analytics.totalPosts.toString(),
          inline: true,
        },
        {
          name: '🎯 Success Rate',
          value: `${analytics.successRate.toFixed(1)}%`,
          inline: true,
        },
        {
          name: '👀 Total Impressions',
          value: analytics.engagement.totalImpressions.toLocaleString(),
          inline: true,
        },
        {
          name: '👍 Engagement Rate',
          value: `${analytics.engagement.avgEngagementRate.toFixed(2)}%`,
          inline: true,
        }
      )
      .setTimestamp();

    // Platform breakdown
    if (Object.keys(analytics.platformBreakdown).length > 0) {
      embed.addFields({
        name: '🌐 Platform Breakdown',
        value: Object.entries(analytics.platformBreakdown)
          .map(([platform, count]) => `• ${platform}: ${count} posts`)
          .join('\n'),
        inline: false,
      });
    }

    // Top performing posts
    if (analytics.topPerformingPosts.length > 0) {
      embed.addFields({
        name: '🌟 Top Performing Posts',
        value: analytics.topPerformingPosts
          .slice(0, 3)
          .map((post, i) => 
            `${i + 1}. ${post.game.title} on ${post.platform} - ${(post.metrics?.engagements || 0).toLocaleString()} engagements`
          )
          .join('\n'),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleSchedule(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    const platform = interaction.options.getString('platform', true) as 'twitter' | 'tiktok';
    const content = interaction.options.getString('content', true);
    const timeStr = interaction.options.getString('time');
    const serverId = interaction.guildId!;

    // Parse scheduled time
    let scheduledAt = new Date();
    if (timeStr) {
      // Simple time parsing (can be enhanced)
      if (timeStr.includes('h')) {
        const hours = parseInt(timeStr);
        scheduledAt.setHours(scheduledAt.getHours() + hours);
      } else if (timeStr.includes('tomorrow')) {
        scheduledAt.setDate(scheduledAt.getDate() + 1);
      }
    }

    const scheduled = await this.socialMediaService.schedulePost(serverId, {
      platform,
      content,
      scheduledAt,
    });

    const embed = new EmbedBuilder()
      .setTitle('📅 Post Scheduled')
      .setDescription(
        `Your post has been scheduled for **${platform}**!\n\n` +
        `**Content:** ${content}\n` +
        `**Scheduled for:** ${scheduledAt.toLocaleString()}`
      )
      .setColor(0x00ff00)
      .setFooter({ text: `Post ID: ${scheduled.id}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  private formatTriggerName(trigger: string): string {
    const names: Record<string, string> = {
      gameCreation: 'New Game Created',
      viralMilestone: 'Viral Milestone Reached',
      weeklyHighlight: 'Weekly Highlights',
      eventWinner: 'Event Winners',
    };
    return names[trigger] || trigger;
  }

  private getTriggerEmoji(trigger: string): string {
    const emojis: Record<string, string> = {
      gameCreation: '🎮',
      viralMilestone: '🔥',
      weeklyHighlight: '📊',
      eventWinner: '🏆',
    };
    return emojis[trigger] || '📢';
  }

  private formatTimeframe(timeframe: string): string {
    const formats: Record<string, string> = {
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };
    return formats[timeframe] || timeframe;
  }
}