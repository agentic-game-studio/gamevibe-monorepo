import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { PersonalCreditService } from '../services/personal-credits.js';
import { DatabaseService } from '../services/database.js';
import { AnalyticsService } from '../services/analytics.js';
import { ServerReferralService } from '../services/server-referral.js';
import { TYPES } from '../types.js';
import { BotConfig } from '@gamevibe/shared';

@injectable()
export class ServerReferralCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('server-referral')
    .setDescription('Get your server referral link and track referrals')
    .addSubcommand(subcommand =>
      subcommand
        .setName('link')
        .setDescription('Get your server\'s unique referral link')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View your server referral statistics')
    );

  constructor(
    @inject(TYPES.PersonalCreditService) private personalCreditService: PersonalCreditService,
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.ServerReferralService) private serverReferralService: ServerReferralService,
    @inject(TYPES.Config) private config: BotConfig
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'link':
        await this.handleGetLink(interaction);
        break;
      case 'stats':
        await this.handleGetStats(interaction);
        break;
    }
  }

  private async handleGetLink(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    try {
      // Get or create server referral code using the service
      const referralCode = await this.serverReferralService.getOrCreateReferralCode(interaction.guildId);

      // Create bot invite link with referral tracking
      const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${this.config.discord.clientId}&permissions=8&scope=bot%20applications.commands&ref=${referralCode}`;

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🔗 Server Referral Link')
        .setDescription('Share this link to invite GameVibe AI to other servers and earn rewards!')
        .addFields(
          {
            name: '💰 Referral Rewards',
            value: '• **100 credits** when a server adds the bot\n• **500 credits** when they subscribe\n• **Monthly commission** from subscriptions',
            inline: false
          },
          {
            name: '📊 Your Referral Code',
            value: `\`${referralCode}\``,
            inline: true
          },
          {
            name: '🎯 Current Referrals',
            value: '0 servers', // Will be updated with actual data
            inline: true
          }
        )
        .setFooter({ text: 'Credits are awarded to the server owner' })
        .setTimestamp();

      // Create buttons
      const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Copy Invite Link')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📋')
            .setCustomId('copy-referral-link'),
          new ButtonBuilder()
            .setLabel('View Stats')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊')
            .setCustomId('view-referral-stats')
        );

      // Track analytics
      await this.analytics.trackEvent('referral_link_generated', {
        serverId: interaction.guildId,
        userId: interaction.user.id,
        referralCode
      });

      await interaction.editReply({
        content: `**Your Server Referral Link:**\n\`\`\`${inviteUrl}\`\`\``,
        embeds: [embed],
        components: [buttons]
      });

    } catch (error) {
      console.error('Error generating referral link:', error);
      await interaction.editReply({
        content: '❌ Failed to generate referral link. Please try again later.'
      });
    }
  }

  private async handleGetStats(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    try {
      // Get referral stats using the service
      const stats = await this.serverReferralService.getReferralStats(interaction.guildId);

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('📊 Server Referral Statistics')
        .setDescription(`Track your server's referral performance and earnings`)
        .addFields(
          {
            name: '🔗 Total Referrals',
            value: `${stats.totalReferrals} servers`,
            inline: true
          },
          {
            name: '💎 Subscribed',
            value: `${stats.subscribedReferrals} servers`,
            inline: true
          },
          {
            name: '💰 Total Earnings',
            value: `${stats.totalEarnings} credits`,
            inline: true
          },
          {
            name: '📈 Conversion Rate',
            value: `${stats.conversionRate.toFixed(1)}%`,
            inline: true
          },
          {
            name: '💸 Monthly Commission',
            value: `${stats.monthlyCommission} credits/month`,
            inline: true
          },
          {
            name: '🎯 Next Milestone',
            value: stats.nextMilestone ? 
              `${stats.nextMilestone.count} referrals (+${stats.nextMilestone.reward} credits)` :
              '🏆 All milestones achieved!',
            inline: true
          }
        )
        .setTimestamp();

      // Add recent referrals if any
      if (stats.recentReferrals && stats.recentReferrals.length > 0) {
        const recentReferrals = stats.recentReferrals
          .map(ref => {
            const status = ref.subscribedAt ? '💎' : '✅';
            return `${status} ${ref.serverName}`;
          })
          .join('\n');

        embed.addFields({
          name: '🆕 Recent Referrals',
          value: recentReferrals || 'No referrals yet',
          inline: false
        });
      }

      await interaction.editReply({
        embeds: [embed]
      });

      // Track analytics
      await this.analytics.trackEvent('referral_stats_viewed', {
        serverId: interaction.guildId,
        userId: interaction.user.id,
        totalReferrals: stats.totalReferrals,
        subscribedReferrals: stats.subscribedReferrals
      });

    } catch (error) {
      console.error('Error getting referral stats:', error);
      await interaction.editReply({
        content: '❌ Failed to get referral statistics. Please try again later.'
      });
    }
  }

}