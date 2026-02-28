import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { ViralNotificationService, NotificationConfig, ViralMomentType } from '../services/viral-notifications.js';
import { AnalyticsService } from '../services/analytics.js';
import { TYPES } from '../types.js';

@injectable()
export class ViralNotificationsCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('viral-notifications')
    .setDescription('Configure viral achievement notifications for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('View current notification settings')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable viral notifications')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to send notifications to (optional)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable viral notifications')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('configure')
        .setDescription('Configure notification settings')
        .addStringOption(option =>
          option
            .setName('magnitude')
            .setDescription('Minimum magnitude to notify about')
            .setRequired(true)
            .addChoices(
              { name: 'Minor (all achievements)', value: 'minor' },
              { name: 'Major (significant achievements)', value: 'major' },
              { name: 'Legendary (extraordinary achievements)', value: 'legendary' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('cooldown')
            .setDescription('Minutes between notifications of same type (1-60)')
            .setMinValue(1)
            .setMaxValue(60)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('test')
        .setDescription('Send a test notification to see how they look')
    );

  constructor(
    @inject(TYPES.ViralNotificationService) private viralNotificationService: ViralNotificationService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'status':
          await this.handleStatus(interaction);
          break;
        case 'enable':
          await this.handleEnable(interaction);
          break;
        case 'disable':
          await this.handleDisable(interaction);
          break;
        case 'configure':
          await this.handleConfigure(interaction);
          break;
        case 'test':
          await this.handleTest(interaction);
          break;
      }
    } catch (error) {
      console.error('Error in viral notifications command:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true
      });
    }
  }

  private async handleStatus(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const config = await this.getServerConfig(interaction.guildId!);
    
    const statusEmbed = new EmbedBuilder()
      .setColor(config.enabled ? 0x57F287 : 0xED4245)
      .setTitle('📢 Viral Notifications Status')
      .setDescription('Current notification settings for this server')
      .addFields(
        {
          name: '🔔 Status',
          value: config.enabled ? '✅ **Enabled**' : '❌ **Disabled**',
          inline: true
        },
        {
          name: '📊 Minimum Magnitude',
          value: `**${config.minMagnitude.charAt(0).toUpperCase() + config.minMagnitude.slice(1)}**`,
          inline: true
        },
        {
          name: '⏱️ Rate Limit',
          value: `**${config.rateLimitMinutes}** minutes`,
          inline: true
        },
        {
          name: '📺 Channel',
          value: config.channelId ? `<#${config.channelId}>` : '*Auto-detect*',
          inline: true
        },
        {
          name: '🎯 Notification Types',
          value: this.formatNotificationTypes(config.allowedTypes),
          inline: false
        }
      )
      .setFooter({
        text: config.enabled ? 
          'Notifications will appear when creators achieve viral moments!' :
          'Enable notifications to celebrate viral achievements in your server'
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [statusEmbed] });

    // Track analytics
    await this.analytics.track('viral_notifications_status_viewed', {
      serverId: interaction.guildId,
      userId: interaction.user.id,
      enabled: config.enabled
    });
  }

  private async handleEnable(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const channel = interaction.options.getChannel('channel');
    
    const configUpdate: Partial<NotificationConfig> = {
      enabled: true
    };

    if (channel) {
      configUpdate.channelId = channel.id;
    }

    await this.viralNotificationService.configureServerNotifications(
      interaction.guildId!,
      configUpdate
    );

    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Viral Notifications Enabled!')
      .setDescription(
        'Your server will now receive notifications when creators achieve viral moments!\n\n' +
        '🎉 **What you\'ll see:**\n' +
        '• Games hitting viral play milestones\n' +
        '• Creator tier upgrades\n' +
        '• Cross-server viral achievements\n' +
        '• Ambassador promotions\n' +
        '• Legendary challenge wins'
      )
      .addFields(
        {
          name: '📺 Notification Channel',
          value: channel ? `Notifications will be sent to ${channel}` : 'Will auto-detect the best channel',
          inline: false
        },
        {
          name: '⚙️ Next Steps',
          value: 'Use `/viral-notifications configure` to customize notification settings',
          inline: false
        }
      )
      .setFooter({ text: 'GameVibe AI • Viral Notifications' })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

    // Track analytics
    await this.analytics.track('viral_notifications_enabled', {
      serverId: interaction.guildId,
      userId: interaction.user.id,
      channelId: channel?.id
    });
  }

  private async handleDisable(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    await this.viralNotificationService.configureServerNotifications(
      interaction.guildId!,
      { enabled: false }
    );

    const disabledEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🔕 Viral Notifications Disabled')
      .setDescription(
        'Viral achievement notifications have been disabled for this server.\n\n' +
        '💡 You can re-enable them anytime with `/viral-notifications enable`'
      )
      .setFooter({ text: 'GameVibe AI • Viral Notifications' })
      .setTimestamp();

    await interaction.editReply({ embeds: [disabledEmbed] });

    // Track analytics
    await this.analytics.track('viral_notifications_disabled', {
      serverId: interaction.guildId,
      userId: interaction.user.id
    });
  }

  private async handleConfigure(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const magnitude = interaction.options.getString('magnitude', true) as 'minor' | 'major' | 'legendary';
    const cooldown = interaction.options.getInteger('cooldown');

    const configUpdate: Partial<NotificationConfig> = {
      minMagnitude: magnitude
    };

    if (cooldown) {
      configUpdate.rateLimitMinutes = cooldown;
    }

    await this.viralNotificationService.configureServerNotifications(
      interaction.guildId!,
      configUpdate
    );

    const configEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('⚙️ Notification Settings Updated!')
      .setDescription('Your viral notification preferences have been saved.')
      .addFields(
        {
          name: '📊 Minimum Magnitude',
          value: `**${magnitude.charAt(0).toUpperCase() + magnitude.slice(1)}**\n${this.getMagnitudeDescription(magnitude)}`,
          inline: false
        }
      )
      .setFooter({ text: 'GameVibe AI • Viral Notifications' })
      .setTimestamp();

    if (cooldown) {
      configEmbed.addFields({
        name: '⏱️ Rate Limit',
        value: `**${cooldown}** minutes between notifications of the same type`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [configEmbed] });

    // Track analytics
    await this.analytics.track('viral_notifications_configured', {
      serverId: interaction.guildId,
      userId: interaction.user.id,
      magnitude,
      cooldown
    });
  }

  private async handleTest(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    // Create a test viral moment
    await this.viralNotificationService.broadcastViralMoment({
      type: 'GAME_VIRAL_MILESTONE',
      userId: interaction.user.id,
      serverId: interaction.guildId!,
      gameId: 'test-game-123',
      metadata: {
        gameTitle: 'Epic Adventure Quest',
        playCount: 1000,
        serverCount: 5,
        milestone: { plays: 1000, reward: 100 }
      },
      magnitude: 'major' as const,
      timestamp: new Date()
    });

    const testEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🧪 Test Notification Sent!')
      .setDescription(
        'A test viral achievement notification has been sent to demonstrate how they look.\n\n' +
        '📢 Check your notification channel to see the result!'
      )
      .setFooter({ text: 'GameVibe AI • Test Notification' })
      .setTimestamp();

    await interaction.editReply({ embeds: [testEmbed] });

    // Track analytics
    await this.analytics.track('viral_notifications_test_sent', {
      serverId: interaction.guildId,
      userId: interaction.user.id
    });
  }

  private async getServerConfig(serverId: string): Promise<NotificationConfig> {
    return this.viralNotificationService.getServerConfig(serverId);
  }

  private formatNotificationTypes(types: ViralMomentType[]): string {
    const typeNames = {
      GAME_VIRAL_MILESTONE: '🎮 Game viral milestones',
      CREATOR_TIER_UPGRADE: '⭐ Creator tier upgrades',
      ACHIEVEMENT_UNLOCKED: '🏆 Achievement unlocks',
      SERVER_REFERRAL_MILESTONE: '🔗 Referral milestones',
      CROSS_SERVER_VIRAL: '🌐 Cross-server viral spread',
      AMBASSADOR_PROMOTION: '🎖️ Ambassador promotions',
      CHALLENGE_LEGENDARY_WIN: '⚔️ Legendary challenge wins',
      VIRAL_COEFFICIENT_SPIKE: '📈 Viral coefficient spikes'
    };

    return types.map(type => typeNames[type]).join('\n');
  }

  private getMagnitudeDescription(magnitude: string): string {
    const descriptions = {
      minor: 'All achievements and milestones',
      major: 'Significant achievements only',
      legendary: 'Only extraordinary achievements'
    };

    return descriptions[magnitude as keyof typeof descriptions] || '';
  }
}