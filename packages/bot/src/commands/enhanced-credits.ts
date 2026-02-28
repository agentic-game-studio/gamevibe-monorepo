// Enhanced Credits Command
// Shows both subscription credits and personal credits

import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { EnhancedCreditService } from '../services/enhanced-credit.js';
import { PersonalCreditService } from '../services/personal-credits.js';
import { formatNumber } from '@gamevibe/shared';

const CREATOR_TIER_EMOJIS = {
  BRONZE: '🥉',
  SILVER: '🥈', 
  GOLD: '🥇',
  DIAMOND: '💎'
};

const SUBSCRIPTION_TIER_EMOJIS = {
  FREE: '🆓',
  STARTER: '🚀',
  PRO: '⭐',
  ENTERPRISE: '👑'
};

@injectable()
export class EnhancedCreditsCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('credits')
    .setDescription('Manage your AI credits')
    .addSubcommand(sub =>
      sub.setName('balance')
        .setDescription('View your combined credit balance')
    )
    .addSubcommand(sub =>
      sub.setName('buy')
        .setDescription('Purchase additional AI credit packs')
    )
    .addSubcommand(sub =>
      sub.setName('usage')
        .setDescription('View your credit usage statistics')
        .addIntegerOption(option =>
          option.setName('days')
            .setDescription('Number of days to analyze (default: 30)')
            .setMinValue(1)
            .setMaxValue(90)
        )
    )
    .addSubcommand(sub =>
      sub.setName('earn')
        .setDescription('Learn how to earn free credits')
    ) as SlashCommandBuilder;

  constructor(
    @inject(TYPES.EnhancedCreditService) private creditService: EnhancedCreditService,
    @inject(TYPES.PersonalCreditService) private personalCreditService: PersonalCreditService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server!',
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'balance':
          await this.showCombinedBalance(interaction);
          break;
        case 'buy':
          await this.showCreditPacks(interaction);
          break;
        case 'usage':
          await this.showUsageStats(interaction);
          break;
        case 'earn':
          await this.showEarningGuide(interaction);
          break;
      }
    } catch (error) {
      console.error('Enhanced credits command error:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true
      });
    }
  }

  private async showCombinedBalance(interaction: CommandInteraction): Promise<void> {
    const balance = await this.creditService.getCombinedBalance(
      interaction.user.id,
      interaction.guildId!
    );

    const embed = new EmbedBuilder()
      .setTitle('💎 Your AI Credits')
      .setDescription('Combined balance from subscription and personal earnings')
      .setColor('#10b981')
      .setThumbnail(interaction.user.displayAvatarURL());

    // Subscription credits section
    embed.addFields([
      {
        name: `${SUBSCRIPTION_TIER_EMOJIS[balance.subscriptionTier as keyof typeof SUBSCRIPTION_TIER_EMOJIS]} Subscription Credits`,
        value: [
          `Balance: **${balance.subscriptionCredits.toLocaleString()}** credits`,
          `Tier: **${balance.subscriptionTier}**`,
          `Monthly: ${balance.monthlyAllotment.toLocaleString()} credits`,
          `Reset: <t:${Math.floor(balance.nextReset.getTime() / 1000)}:R>`
        ].join('\n'),
        inline: true
      }
    ]);

    // Personal credits section
    embed.addFields([
      {
        name: `${CREATOR_TIER_EMOJIS[balance.creatorTier as keyof typeof CREATOR_TIER_EMOJIS]} Personal Credits`,
        value: [
          `Balance: **${balance.personalCredits.toLocaleString()}** credits`,
          `Creator Tier: **${balance.creatorTier}**`,
          `Total Earned: ${balance.totalEarned.toLocaleString()} credits`,
          `Works in ALL servers!`
        ].join('\n'),
        inline: true
      }
    ]);

    // Total available
    embed.addFields([
      {
        name: '💰 Total Available',
        value: `**${balance.totalAvailable.toLocaleString()}** credits`,
        inline: false
      }
    ]);

    // Model access info
    const modelAccess = [
      `${balance.canUseModel('claude-haiku') ? '✅' : '❌'} Claude Haiku (FREE)`,
      `${balance.canUseModel('gpt-3.5-turbo') ? '✅' : '❌'} GPT-3.5 Turbo (2 credits)`,
      `${balance.canUseModel('claude-sonnet') ? '✅' : '❌'} Claude Sonnet (3 credits)`,
      `${balance.canUseModel('gpt-4-turbo') ? '✅' : '❌'} GPT-4 Turbo (10 credits)`,
      `${balance.canUseModel('claude-opus') ? '✅' : '❌'} Claude Opus (15 credits)`
    ];

    embed.addFields([
      {
        name: '🤖 Available AI Models',
        value: modelAccess.join('\n'),
        inline: false
      }
    ]);

    // Earning tip
    if (balance.personalCredits < 100) {
      embed.addFields([
        {
          name: '💡 Earn Free Credits',
          value: 'Create popular games, win challenges, and bring new servers to earn personal credits that work everywhere!',
          inline: false
        }
      ]);
    }

    // Action buttons
    const components = [];
    const row = new ActionRowBuilder<ButtonBuilder>();

    // Buy credits button (if not free tier)
    if (balance.subscriptionTier !== 'FREE') {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('credits:buy')
          .setLabel('Buy Credits')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💳')
      );
    }

    // Earn credits button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('credits:earn')
        .setLabel('How to Earn')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💰')
    );

    if (row.components.length > 0) {
      components.push(row);
    }

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true
    });
  }

  private async showEarningGuide(interaction: CommandInteraction): Promise<void> {
    const personalCredits = await this.personalCreditService.getPersonalCredits(interaction.user.id);
    
    const embed = new EmbedBuilder()
      .setTitle('💰 How to Earn Free Credits')
      .setDescription('Personal credits work across ALL Discord servers!')
      .setColor('#f59e0b')
      .setThumbnail(interaction.user.displayAvatarURL());

    // Current status
    embed.addFields([
      {
        name: 'Your Status',
        value: [
          `${CREATOR_TIER_EMOJIS[personalCredits.creatorTier]} Creator Tier: **${personalCredits.creatorTier}**`,
          `💎 Balance: **${personalCredits.balance.toLocaleString()}** credits`,
          `📈 Total Earned: **${personalCredits.totalEarned.toLocaleString()}** credits`,
          `🎯 Earning Bonus: **${((personalCredits.tierMultiplier - 1) * 100).toFixed(0)}%**`
        ].join('\n'),
        inline: false
      }
    ]);

    // Earning methods
    embed.addFields([
      {
        name: '🎮 Create Popular Games',
        value: [
          '• 1 credit per 10 plays',
          '• 10 credits at 100 plays',
          '• 100 credits at 1,000 plays',
          '• 1,000 credits at 10,000 plays!',
          '• 10,000 credits at 100,000 plays!!'
        ].join('\n'),
        inline: true
      },
      {
        name: '🌍 Cross-Server Reach',
        value: [
          '• 50 credits when game reaches 5 servers',
          '• 50 more credits every 10 servers',
          '• Games spread naturally when popular',
          '• Share your games to accelerate!'
        ].join('\n'),
        inline: true
      }
    ]);

    embed.addFields([
      {
        name: '🏰 Bring New Servers',
        value: [
          '• 100 credits when server installs bot',
          '• 500 credits for Starter subscription',
          '• 1,000 credits for Pro subscription',
          '• 2,500 credits for Enterprise!',
          '• Plus 10% monthly commission!'
        ].join('\n'),
        inline: true
      },
      {
        name: '⚔️ Win Challenges',
        value: [
          '• 20 credits per challenge won',
          '• 100 credits for tournaments',
          '• Create challenges to earn too',
          '• Daily challenges coming soon!'
        ].join('\n'),
        inline: true
      }
    ]);

    // Creator tiers
    embed.addFields([
      {
        name: '🏆 Creator Tier Benefits',
        value: [
          `${CREATOR_TIER_EMOJIS.BRONZE} **Bronze** (0+ earned): Base earnings`,
          `${CREATOR_TIER_EMOJIS.SILVER} **Silver** (1,000+ earned): 10% bonus + exclusive templates`,
          `${CREATOR_TIER_EMOJIS.GOLD} **Gold** (10,000+ earned): 25% bonus + custom branding`,
          `${CREATOR_TIER_EMOJIS.DIAMOND} **Diamond** (100,000+ earned): 50% bonus + lifetime perks!`
        ].join('\n'),
        inline: false
      }
    ]);

    // Next tier progress
    if (personalCredits.nextTierProgress.nextTier) {
      const progress = personalCredits.nextTierProgress;
      const percentage = (progress.progress / progress.required * 100).toFixed(1);
      
      embed.addFields([
        {
          name: '📊 Next Tier Progress',
          value: `${progress.progress.toLocaleString()} / ${progress.required.toLocaleString()} credits (${percentage}%) to ${CREATOR_TIER_EMOJIS[progress.nextTier as keyof typeof CREATOR_TIER_EMOJIS]} ${progress.nextTier}`,
          inline: false
        }
      ]);
    }

    // Tips
    embed.addFields([
      {
        name: '💡 Pro Tips',
        value: [
          '• Personal credits never expire',
          '• Use them for premium AI models anywhere',
          '• Higher tiers earn credits faster',
          '• Be active in multiple servers',
          '• Quality games get more plays!'
        ].join('\n'),
        inline: false
      }
    ]);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async showCreditPacks(interaction: CommandInteraction): Promise<void> {
    // This would show the credit purchase options
    // Reuse existing implementation with enhanced messaging
    await interaction.reply({
      content: 'Credit pack purchases coming soon!',
      ephemeral: true
    });
  }

  private async showUsageStats(interaction: CommandInteraction): Promise<void> {
    const days = interaction.options.getInteger('days') || 30;
    
    const stats = await this.creditService.getCreditStats(
      interaction.user.id,
      interaction.guildId!,
      days
    );

    const embed = new EmbedBuilder()
      .setTitle(`📊 Credit Usage (${days} days)`)
      .setDescription('Your subscription and personal credit usage')
      .setColor('#3b82f6')
      .setThumbnail(interaction.user.displayAvatarURL());

    // Subscription usage
    embed.addFields([
      {
        name: '💳 Subscription Credits Used',
        value: stats.subscription.totalCreditsUsed.toLocaleString(),
        inline: true
      },
      {
        name: '⭐ Personal Credits Used',
        value: stats.personal.totalSpent.toLocaleString(),
        inline: true
      },
      {
        name: '📈 Personal Credits Earned',
        value: stats.personal.totalEarned.toLocaleString(),
        inline: true
      }
    ]);

    // Combined stats
    embed.addFields([
      {
        name: '💰 Net Personal Credits',
        value: `${stats.combined.netCredits >= 0 ? '+' : ''}${stats.combined.netCredits.toLocaleString()}`,
        inline: true
      },
      {
        name: '📊 Personal Usage',
        value: `${stats.combined.percentPersonal.toFixed(1)}%`,
        inline: true
      },
      {
        name: '🎮 Total Credits Used',
        value: stats.combined.totalCreditsUsed.toLocaleString(),
        inline: true
      }
    ]);

    // Earning breakdown
    if (Object.keys(stats.personal.earningsByReason).length > 0) {
      const earningBreakdown = Object.entries(stats.personal.earningsByReason)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .map(([reason, amount]) => {
          const formattedReason = reason.replace(/_/g, ' ').toLowerCase()
            .replace(/\b\w/g, l => l.toUpperCase());
          return `• **${formattedReason}**: ${(amount as number).toLocaleString()} credits`;
        })
        .join('\n');

      embed.addFields([
        {
          name: '💎 Credits Earned By Source',
          value: earningBreakdown || 'No earnings yet',
          inline: false
        }
      ]);
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
}