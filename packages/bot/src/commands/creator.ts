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
import { ContentCreatorService } from '../services/content-creator.js';
import { Logger } from '../utils/logger.js';
import { TYPES } from '../types.js';
import { ContentType, CreatorStatus, CreatorTier } from '../generated/prisma/index.js';

@injectable()
export class CreatorCommand {
  private logger = new Logger('CreatorCommand');

  constructor(
    @inject(TYPES.ContentCreatorService) private contentCreatorService: ContentCreatorService
  ) {}

  data = new SlashCommandBuilder()
    .setName('creator')
    .setDescription('Content creator partnership program')
    .addSubcommand(subcommand =>
      subcommand
        .setName('apply')
        .setDescription('Apply for the creator partnership program')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check your creator partnership status')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('submit')
        .setDescription('Submit content for review')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Content title')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('url')
            .setDescription('Content URL (YouTube, Twitch, etc.)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Content type')
            .setRequired(true)
            .addChoices(
              { name: 'YouTube Video', value: 'YOUTUBE' },
              { name: 'Twitch Stream', value: 'TWITCH' },
              { name: 'TikTok Video', value: 'TIKTOK' },
              { name: 'Instagram Post', value: 'INSTAGRAM' },
              { name: 'Twitter Post', value: 'TWITTER' },
              { name: 'Blog Article', value: 'BLOG' },
              { name: 'Podcast Episode', value: 'PODCAST' }
            )
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Content description')
        )
        .addStringOption(option =>
          option
            .setName('thumbnail')
            .setDescription('Thumbnail URL')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View your creator statistics and earnings')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('leaderboard')
        .setDescription('View top creators leaderboard')
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of creators to show (default: 10)')
            .setMinValue(5)
            .setMaxValue(25)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('requirements')
        .setDescription('View creator program requirements and benefits')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('admin')
        .setDescription('Admin commands for managing creator applications')
        .addStringOption(option =>
          option
            .setName('action')
            .setDescription('Admin action')
            .setRequired(true)
            .addChoices(
              { name: 'List Pending Applications', value: 'list' },
              { name: 'Approve Application', value: 'approve' },
              { name: 'Reject Application', value: 'reject' }
            )
        )
        .addStringOption(option =>
          option
            .setName('application_id')
            .setDescription('Application ID (for approve/reject)')
        )
        .addStringOption(option =>
          option
            .setName('tier')
            .setDescription('Starting tier for approved creator')
            .addChoices(
              { name: 'Bronze', value: 'BRONZE' },
              { name: 'Silver', value: 'SILVER' },
              { name: 'Gold', value: 'GOLD' },
              { name: 'Platinum', value: 'PLATINUM' }
            )
        )
        .addStringOption(option =>
          option
            .setName('notes')
            .setDescription('Admin notes or rejection reason')
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands);

  async execute(interaction: CommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'apply':
        await this.handleApply(interaction);
        break;
      case 'status':
        await this.handleStatus(interaction);
        break;
      case 'submit':
        await this.handleSubmit(interaction);
        break;
      case 'stats':
        await this.handleStats(interaction);
        break;
      case 'leaderboard':
        await this.handleLeaderboard(interaction);
        break;
      case 'requirements':
        await this.handleRequirements(interaction);
        break;
      case 'admin':
        await this.handleAdmin(interaction);
        break;
    }
  }

  private async handleApply(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    const userId = interaction.user.id;
    
    // Check if user already has an application
    const status = await this.contentCreatorService.getCreatorStatus(userId);
    
    if (status.hasPartnership) {
      let message = '';
      switch (status.status) {
        case CreatorStatus.PENDING:
          message = '⏰ You already have a pending application. Please wait for review.';
          break;
        case CreatorStatus.APPROVED:
          message = '✅ You are already an approved creator partner!';
          break;
        case CreatorStatus.SUSPENDED:
          message = '⚠️ Your creator partnership is currently suspended.';
          break;
        case CreatorStatus.INACTIVE:
          message = '💤 Your creator partnership is inactive. Contact support to reactivate.';
          break;
        default:
          message = '❌ You have already applied. You can reapply after addressing feedback.';
      }
      
      await interaction.reply({ content: message, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎬 Creator Partnership Application')
      .setDescription(
        'Welcome to the GameVibe AI Creator Partnership Program!\n\n' +
        '**Benefits:**\n' +
        '• Earn commission on referrals (10%+ revenue share)\n' +
        '• Exclusive early access to new features\n' +
        '• Personal credit bonuses and tier upgrades\n' +
        '• Custom referral codes and landing pages\n' +
        '• Priority support and direct feedback\n\n' +
        '**Requirements:**\n' +
        '• Active content creator on YouTube, Twitch, TikTok, or similar\n' +
        '• Minimum 1K subscribers/followers\n' +
        '• Regular content creation schedule\n' +
        '• Genuine interest in AI-generated gaming\n\n' +
        'Click the button below to start your application!'
      )
      .setColor(0x00acee)
      .setFooter({ text: 'Application takes 2-3 minutes to complete' });

    const button = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('creator:start_application')
          .setLabel('Start Application')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📝')
      );

    await interaction.reply({ embeds: [embed], components: [button] });
  }

  private async handleStatus(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const status = await this.contentCreatorService.getCreatorStatus(userId);

    if (!status.hasPartnership) {
      const embed = new EmbedBuilder()
        .setTitle('Creator Partnership Status')
        .setDescription(
          'You have not applied for the creator partnership program yet.\n\n' +
          'Use `/creator apply` to start your application!'
        )
        .setColor(0x999999);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const partnership = status.partnership;
    const statusEmoji = this.getStatusEmoji(status.status!);
    const tierEmoji = this.getTierEmoji(status.tier!);

    const embed = new EmbedBuilder()
      .setTitle('🎬 Creator Partnership Status')
      .setColor(this.getStatusColor(status.status!))
      .addFields(
        {
          name: 'Status',
          value: `${statusEmoji} ${status.status}`,
          inline: true,
        },
        {
          name: 'Tier',
          value: status.status === CreatorStatus.APPROVED ? `${tierEmoji} ${status.tier}` : 'N/A',
          inline: true,
        },
        {
          name: 'Applied',
          value: new Date(partnership.appliedAt).toLocaleDateString(),
          inline: true,
        }
      );

    if (status.status === CreatorStatus.APPROVED) {
      embed.addFields(
        {
          name: 'Total Earnings',
          value: `$${(partnership.totalEarnings / 100).toFixed(2)}`,
          inline: true,
        },
        {
          name: 'This Month',
          value: `$${(partnership.currentMonthEarnings / 100).toFixed(2)}`,
          inline: true,
        },
        {
          name: 'Commission Rate',
          value: `${(partnership.commissionRate * 100).toFixed(1)}%`,
          inline: true,
        },
        {
          name: 'Content Submitted',
          value: partnership.content.length.toString(),
          inline: true,
        },
        {
          name: 'Total Views',
          value: partnership.content.reduce((sum: number, c: any) => sum + c.views, 0).toLocaleString(),
          inline: true,
        }
      );

      if (partnership.content.length > 0) {
        const recentContent = partnership.content.slice(0, 3);
        const contentList = recentContent.map((c: any) => 
          `• [${c.title}](${c.contentUrl}) - ${c.views.toLocaleString()} views`
        ).join('\n');

        embed.addFields({
          name: 'Recent Content',
          value: contentList || 'No content submitted yet',
          inline: false,
        });
      }
    }

    if (partnership.adminNotes) {
      embed.addFields({
        name: 'Notes',
        value: partnership.adminNotes,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleSubmit(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const title = interaction.options.getString('title', true);
    const url = interaction.options.getString('url', true);
    const type = interaction.options.getString('type', true) as ContentType;
    const description = interaction.options.getString('description');
    const thumbnail = interaction.options.getString('thumbnail');

    // Validate URL format
    try {
      new URL(url);
    } catch {
      await interaction.editReply({ content: '❌ Invalid URL format. Please provide a valid content URL.' });
      return;
    }

    const result = await this.contentCreatorService.submitContent(userId, {
      title,
      contentType: type,
      platform: this.getPlatformFromType(type),
      contentUrl: url,
      description: description || undefined,
      thumbnailUrl: thumbnail || undefined,
    });

    if (result.success) {
      const embed = new EmbedBuilder()
        .setTitle('✅ Content Submitted Successfully!')
        .setDescription(
          `Your content "${title}" has been submitted for review.\n\n` +
          `**Content ID:** ${result.contentId}\n` +
          `**Type:** ${type}\n` +
          `**URL:** [View Content](${url})\n\n` +
          'Your content will be reviewed and verified by our team. ' +
          'You will start earning commissions once it\'s approved!'
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({ content: `❌ ${result.message}` });
    }
  }

  private async handleStats(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const stats = await this.contentCreatorService.getCreatorStats(userId);

    if (!stats) {
      await interaction.editReply({ 
        content: '❌ You must be an approved creator to view statistics. Use `/creator apply` to get started!' 
      });
      return;
    }

    const tierEmoji = this.getTierEmoji(stats.tier);

    const embed = new EmbedBuilder()
      .setTitle('📊 Creator Statistics')
      .setColor(0x00acee)
      .addFields(
        {
          name: 'Current Tier',
          value: `${tierEmoji} ${stats.tier}`,
          inline: true,
        },
        {
          name: 'Commission Rate',
          value: `${(stats.commissionRate * 100).toFixed(1)}%`,
          inline: true,
        },
        {
          name: 'Total Earnings',
          value: `$${(stats.totalEarnings / 100).toFixed(2)}`,
          inline: true,
        },
        {
          name: 'This Month',
          value: `$${(stats.currentMonthEarnings / 100).toFixed(2)}`,
          inline: true,
        },
        {
          name: 'Content Pieces',
          value: stats.totalContent.toString(),
          inline: true,
        },
        {
          name: 'Total Views',
          value: stats.totalViews.toLocaleString(),
          inline: true,
        },
        {
          name: 'Conversions',
          value: stats.totalConversions.toString(),
          inline: true,
        },
        {
          name: 'Avg. Engagement',
          value: stats.averageEngagement.toFixed(1),
          inline: true,
        }
      );

    if (stats.nextTierRequirement) {
      embed.addFields({
        name: 'Next Tier Requirements',
        value: stats.nextTierRequirement,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleLeaderboard(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const limit = interaction.options.getInteger('limit') || 10;
    const leaderboard = await this.contentCreatorService.getCreatorLeaderboard(limit);

    if (leaderboard.length === 0) {
      await interaction.editReply({ content: 'No approved creators found.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🏆 Creator Leaderboard')
      .setDescription(`Top ${leaderboard.length} content creators`)
      .setColor(0xffd700);

    const leaderboardText = leaderboard.map(creator => {
      const tierEmoji = this.getTierEmoji(creator.tier);
      const medal = this.getMedalEmoji(creator.rank);
      return `${medal} **${creator.displayName || creator.username}** ${tierEmoji}\n` +
             `💰 $${(creator.totalEarnings / 100).toFixed(2)} • 👀 ${creator.totalViews.toLocaleString()} views • 📝 ${creator.contentCount} content`;
    }).join('\n\n');

    embed.setDescription(`Top ${leaderboard.length} content creators\n\n${leaderboardText}`);

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleRequirements(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    const embed = new EmbedBuilder()
      .setTitle('🎬 Creator Partnership Program')
      .setDescription('Join GameVibe AI\'s creator partnership program and monetize your content!')
      .setColor(0x00acee)
      .addFields(
        {
          name: '📋 Requirements',
          value: 
            '• Active content creator (YouTube, Twitch, TikTok, etc.)\n' +
            '• Minimum 1,000 subscribers/followers\n' +
            '• Regular content creation schedule\n' +
            '• English-speaking audience (primarily)\n' +
            '• Gaming or technology content focus',
          inline: false,
        },
        {
          name: '💰 Benefits',
          value:
            '• **10%+ revenue share** on referrals\n' +
            '• **Early access** to new features\n' +
            '• **Personal credit bonuses** and tier upgrades\n' +
            '• **Custom referral codes** and landing pages\n' +
            '• **Priority support** and feedback',
          inline: false,
        },
        {
          name: '🏆 Creator Tiers',
          value:
            '🥉 **Bronze** - Entry level (10% commission)\n' +
            '🥈 **Silver** - 50K+ views (12% commission)\n' +
            '🥇 **Gold** - 100K+ views (15% commission)\n' +
            '💎 **Platinum** - 500K+ views (18% commission)\n' +
            '💠 **Diamond** - 1M+ views (20% commission)',
          inline: false,
        },
        {
          name: '📈 Earning Opportunities',
          value:
            '• **Subscription referrals** - Earn when viewers subscribe\n' +
            '• **User signups** - Commission on new user registrations\n' +
            '• **Content bonuses** - Performance-based rewards\n' +
            '• **Tier upgrades** - Unlock higher commission rates',
          inline: false,
        }
      )
      .setFooter({ text: 'Ready to join? Use /creator apply to get started!' });

    await interaction.reply({ embeds: [embed] });
  }

  private async handleAdmin(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    // Check if user has admin permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ 
        content: '❌ You need Administrator permissions to use admin commands.', 
        ephemeral: true 
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const action = interaction.options.getString('action', true);
    const applicationId = interaction.options.getString('application_id');
    const tier = interaction.options.getString('tier') as CreatorTier;
    const notes = interaction.options.getString('notes');

    switch (action) {
      case 'list':
        await this.handleAdminList(interaction);
        break;
      case 'approve':
        if (!applicationId) {
          await interaction.editReply({ content: '❌ Application ID is required for approval.' });
          return;
        }
        await this.handleAdminApprove(interaction, applicationId, tier || CreatorTier.BRONZE, notes);
        break;
      case 'reject':
        if (!applicationId) {
          await interaction.editReply({ content: '❌ Application ID is required for rejection.' });
          return;
        }
        await this.handleAdminReject(interaction, applicationId, notes);
        break;
    }
  }

  private async handleAdminList(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;    const applications = await this.contentCreatorService.getPendingApplications();

    if (applications.length === 0) {
      await interaction.editReply({ content: 'No pending applications found.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Pending Creator Applications')
      .setColor(0xffa500)
      .setDescription(`${applications.length} applications awaiting review`);

    const fields = applications.slice(0, 10).map(app => ({
      name: `${app.username} (${app.id})`,
      value: 
        `**Platform:** ${app.primaryPlatform}\n` +
        `**Subscribers:** ${app.totalSubscribers.toLocaleString()}\n` +
        `**Applied:** ${new Date(app.appliedAt).toLocaleDateString()}\n` +
        `**Bio:** ${app.bio?.substring(0, 100) || 'No bio provided'}${app.bio?.length > 100 ? '...' : ''}`,
      inline: false,
    }));

    embed.addFields(fields);

    if (applications.length > 10) {
      embed.setFooter({ text: `Showing first 10 of ${applications.length} applications` });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleAdminApprove(
    interaction: CommandInteraction, 
    applicationId: string, 
    tier: CreatorTier,
    notes?: string
  ) {
    const result = await this.contentCreatorService.approveApplication(
      applicationId,
      interaction.user.id,
      tier,
      0.10, // 10% default commission
      notes || undefined
    );

    const embed = new EmbedBuilder()
      .setTitle(result.success ? '✅ Application Approved' : '❌ Approval Failed')
      .setDescription(result.message)
      .setColor(result.success ? 0x00ff00 : 0xff0000);

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleAdminReject(
    interaction: CommandInteraction, 
    applicationId: string, 
    reason?: string
  ) {
    const result = await this.contentCreatorService.rejectApplication(
      applicationId,
      interaction.user.id,
      reason || undefined
    );

    const embed = new EmbedBuilder()
      .setTitle(result.success ? '❌ Application Rejected' : '❌ Rejection Failed')
      .setDescription(result.message)
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [embed] });
  }

  private getStatusEmoji(status: CreatorStatus): string {
    switch (status) {
      case CreatorStatus.PENDING: return '⏰';
      case CreatorStatus.APPROVED: return '✅';
      case CreatorStatus.SUSPENDED: return '⚠️';
      case CreatorStatus.REJECTED: return '❌';
      case CreatorStatus.INACTIVE: return '💤';
      default: return '❓';
    }
  }

  private getTierEmoji(tier: CreatorTier): string {
    switch (tier) {
      case CreatorTier.BRONZE: return '🥉';
      case CreatorTier.SILVER: return '🥈';
      case CreatorTier.GOLD: return '🥇';
      case CreatorTier.PLATINUM: return '💎';
      case CreatorTier.DIAMOND: return '💠';
      default: return '❓';
    }
  }

  private getMedalEmoji(rank: number): string {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `**#${rank}**`;
    }
  }

  private getStatusColor(status: CreatorStatus): number {
    switch (status) {
      case CreatorStatus.PENDING: return 0xffa500; // Orange
      case CreatorStatus.APPROVED: return 0x00ff00; // Green
      case CreatorStatus.SUSPENDED: return 0xff0000; // Red
      case CreatorStatus.REJECTED: return 0x999999; // Gray
      case CreatorStatus.INACTIVE: return 0x666666; // Dark gray
      default: return 0x999999;
    }
  }

  private getPlatformFromType(type: ContentType): string {
    switch (type) {
      case ContentType.YOUTUBE: return 'YouTube';
      case ContentType.TWITCH: return 'Twitch';
      case ContentType.TIKTOK: return 'TikTok';
      case ContentType.INSTAGRAM: return 'Instagram';
      case ContentType.TWITTER: return 'Twitter';
      case ContentType.DISCORD: return 'Discord';
      case ContentType.BLOG: return 'Blog';
      case ContentType.PODCAST: return 'Podcast';
      default: return 'Other';
    }
  }
}