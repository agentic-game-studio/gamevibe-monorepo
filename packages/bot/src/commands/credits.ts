// GameVibe AI Credits Command
// Handles Discord user credit management and purchases

import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ButtonInteraction
} from 'discord.js';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { CreditService } from '../services/credit.js';
import { AI_CREDIT_PRICING } from '../config/subscription-tiers.js';

@injectable()
export class CreditsCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('credits')
    .setDescription('Manage your AI credits')
    .addSubcommand(sub =>
      sub.setName('balance')
        .setDescription('View your current credit balance and usage stats')
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
    ) as SlashCommandBuilder;

  constructor(
    @inject(TYPES.CreditService) private creditService: CreditService
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
          await this.showCreditBalance(interaction);
          break;
        case 'buy':
          await this.showCreditPacks(interaction);
          break;
        case 'usage':
          await this.showUsageStats(interaction);
          break;
      }
    } catch (error) {
      console.error('Credits command error:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing your request. Please try again.',
        ephemeral: true
      });
    }
  }

  private async showCreditBalance(interaction: CommandInteraction): Promise<void> {
    const balance = await this.creditService.getCreditBalance(
      interaction.user.id, 
      interaction.guildId!
    );

    if (!balance) {
      await interaction.reply({
        content: '❌ Unable to retrieve your credit balance. Please try again.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('💎 Your AI Credits')
      .setDescription('Current balance and tier information')
      .setColor(this.getTierColor(balance.tier))
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields([
        {
          name: '💰 Available Credits',
          value: `**${balance.availableCredits.toLocaleString()}** credits`,
          inline: true
        },
        {
          name: '🎯 Current Tier',
          value: this.formatTier(balance.tier),
          inline: true
        },
        {
          name: '📅 Monthly Allotment',
          value: `${balance.monthlyAllotment.toLocaleString()} credits`,
          inline: true
        },
        {
          name: '♻️ Rollover Credits',
          value: `${balance.rolloverCredits.toLocaleString()} credits`,
          inline: true
        },
        {
          name: '🔄 Next Reset',
          value: `<t:${Math.floor(balance.nextReset.getTime() / 1000)}:R>`,
          inline: true
        },
        {
          name: '📊 Usage Summary',
          value: `Total used: ${balance.totalCredits.toLocaleString()} credits`,
          inline: true
        }
      ]);

    // Add model pricing information
    const modelPricing = Object.entries(AI_CREDIT_PRICING)
      .filter(([key]) => !key.includes('credit_packs'))
      .map(([model, price]) => {
        const formattedModel = this.formatModelName(model);
        const costPer1k = (price as number / 100).toFixed(2);
        return `• **${formattedModel}**: ${costPer1k}¢/1k tokens`;
      })
      .join('\n');

    embed.addFields([{
      name: '🤖 Model Pricing',
      value: modelPricing
    }]);

    // Add warning if low credits
    if (balance.availableCredits < 100) {
      embed.addFields([{
        name: '⚠️ Low Credit Warning',
        value: 'Your credit balance is running low! Consider purchasing more credits or upgrading your subscription tier.',
        inline: false
      }]);
    }

    const components = [];

    // Add buy credits button if not free tier
    if (balance.tier !== 'FREE') {
      const buyButton = new ButtonBuilder()
        .setCustomId('credits:buy')
        .setLabel('Buy More Credits')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💳');
      
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buyButton));
    }

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true
    });
  }

  private async showCreditPacks(interaction: CommandInteraction): Promise<void> {
    const balance = await this.creditService.getCreditBalance(
      interaction.user.id, 
      interaction.guildId!
    );

    if (!balance) {
      await interaction.reply({
        content: '❌ Unable to retrieve your credit balance. Please try again.',
        ephemeral: true
      });
      return;
    }

    if (balance.tier === 'FREE') {
      await interaction.reply({
        content: '❌ Credit purchases are only available for paid subscription tiers. Use `/subscription upgrade` to get started!',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('💎 Purchase AI Credit Packs')
      .setDescription('Get additional credits for premium AI models')
      .setColor('#10b981')
      .setThumbnail(interaction.user.displayAvatarURL());

    const creditPacks = AI_CREDIT_PRICING.credit_packs;
    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();
    let buttonCount = 0;

    for (const [packSize, packInfo] of Object.entries(creditPacks)) {
      const { credits, price_cents, popular } = packInfo as any;
      const costPerCredit = (price_cents / credits).toFixed(3);
      
      embed.addFields([{
        name: `${popular ? '⭐ ' : ''}${this.formatPackName(packSize)} - $${(price_cents / 100).toFixed(2)}`,
        value: `• **${credits.toLocaleString()}** credits\n• ${costPerCredit}¢ per credit${popular ? '\n• **Most Popular!**' : ''}`,
        inline: true
      }]);

      const style = popular ? ButtonStyle.Success : ButtonStyle.Primary;
      const button = new ButtonBuilder()
        .setCustomId(`credits:purchase:${packSize}`)
        .setLabel(`$${(price_cents / 100).toFixed(2)}`)
        .setStyle(style);

      if (popular) {
        button.setEmoji('⭐');
      }

      currentRow.addComponents(button);
      buttonCount++;

      // Discord allows max 5 buttons per row
      if (buttonCount >= 5) {
        components.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
        buttonCount = 0;
      }
    }

    // Add remaining buttons
    if (buttonCount > 0) {
      components.push(currentRow);
    }

    embed.addFields([{
      name: '💡 Credit Usage Tips',
      value: '• Use **Claude Haiku** (FREE) for simple games\n• Upgrade to **GPT-3.5** for better quality\n• Reserve **Sonnet/GPT-4** for complex games\n• **Opus** for enterprise-level games',
      inline: false
    }]);

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true
    });
  }

  private async showUsageStats(interaction: CommandInteraction): Promise<void> {
    const days = interaction.options.getInteger('days') || 30;
    
    const stats = await this.creditService.getCreditUsageStats(
      interaction.user.id,
      interaction.guildId!,
      days
    );

    const embed = new EmbedBuilder()
      .setTitle(`📊 Credit Usage (Last ${days} days)`)
      .setDescription('Analyze your AI credit consumption patterns')
      .setColor('#3b82f6')
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields([
        {
          name: '💰 Total Credits Used',
          value: `${stats.totalCreditsUsed.toLocaleString()} credits`,
          inline: true
        },
        {
          name: '🎮 Average Per Game',
          value: `${stats.averageCostPerGame.toFixed(1)} credits`,
          inline: true
        },
        {
          name: '🤖 Most Used Model',
          value: this.formatModelName(stats.mostUsedModel),
          inline: true
        },
        {
          name: '⚡ Efficiency Score',
          value: `${(stats.efficientUsageScore * 100).toFixed(1)}%`,
          inline: true
        },
        {
          name: '📈 Projected Monthly',
          value: `${stats.projectedMonthlyUsage.toLocaleString()} credits`,
          inline: true
        },
        {
          name: '💡 Recommended Tier',
          value: this.formatTier(stats.recommendedTier || 'FREE'),
          inline: true
        }
      ]);

    // Model usage breakdown
    if (Object.keys(stats.creditsUsedByModel).length > 0) {
      const modelBreakdown = Object.entries(stats.creditsUsedByModel)
        .sort(([,a], [,b]) => b - a)
        .map(([model, credits]) => {
          const percentage = ((credits / stats.totalCreditsUsed) * 100).toFixed(1);
          return `• **${this.formatModelName(model)}**: ${credits} credits (${percentage}%)`;
        })
        .join('\n');

      embed.addFields([{
        name: '🔍 Usage by Model',
        value: modelBreakdown
      }]);
    }

    // Recommendations
    const recommendations = this.generateRecommendations(stats);
    if (recommendations.length > 0) {
      embed.addFields([{
        name: '💡 Optimization Tips',
        value: recommendations.join('\n'),
        inline: false
      }]);
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  // Static button handler
  static async handleButton(
    interaction: ButtonInteraction,
    creditService: CreditService
  ): Promise<void> {
    const [, action, packSize] = interaction.customId.split(':');

    try {
      if (action === 'purchase' && packSize) {
        await CreditsCommand.handlePurchase(interaction, creditService, packSize);
      } else if (action === 'buy') {
        // Re-show credit packs
        await interaction.deferUpdate();
        // Would need to recreate the buy embed here
      }
    } catch (error) {
      console.error('Credits button interaction error:', error);
      await interaction.reply({
        content: '❌ An error occurred. Please try again.',
        ephemeral: true
      });
    }
  }

  private static async handlePurchase(
    interaction: ButtonInteraction,
    creditService: CreditService,
    packSize: string
  ): Promise<void> {
    try {
      const result = await creditService.purchaseCreditPack(
        interaction.user.id,
        interaction.guildId!,
        packSize as 'small' | 'medium' | 'large' | 'xl'
      );

      if (!result.success) {
        await interaction.reply({
          content: `❌ Purchase failed: ${result.error}`,
          ephemeral: true
        });
        return;
      }

      const packInfo = AI_CREDIT_PRICING.credit_packs[packSize as keyof typeof AI_CREDIT_PRICING.credit_packs] as any;
      
      const embed = new EmbedBuilder()
        .setTitle('💳 Complete Your Purchase')
        .setDescription(`Proceed to checkout for your **${this.formatPackName(packSize)}**`)
        .setColor('#10b981')
        .addFields([
          {
            name: '💎 Credits',
            value: `${packInfo.credits.toLocaleString()} credits`,
            inline: true
          },
          {
            name: '💰 Price',
            value: `$${(packInfo.price_cents / 100).toFixed(2)}`,
            inline: true
          },
          {
            name: '📊 Cost per Credit',
            value: `${(packInfo.price_cents / packInfo.credits).toFixed(3)}¢`,
            inline: true
          },
          {
            name: '🔒 What happens next?',
            value: '1. Complete payment on Stripe\n2. Credits instantly added to your account\n3. Start using premium AI models!',
            inline: false
          }
        ]);

      const checkoutButton = new ButtonBuilder()
        .setLabel('Complete Purchase')
        .setStyle(ButtonStyle.Link)
        .setURL(result.checkoutUrl!)
        .setEmoji('💳');

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(checkoutButton);

      await interaction.reply({
        embeds: [embed],
        components: [actionRow],
        ephemeral: true
      });

    } catch (error) {
      console.error('Credit purchase error:', error);
      await interaction.reply({
        content: '❌ Failed to create checkout session. Please try again later.',
        ephemeral: true
      });
    }
  }

  private static formatPackName(packSize: string): string {
    const names: Record<string, string> = {
      'small': 'Small Pack',
      'medium': 'Medium Pack', 
      'large': 'Large Pack',
      'xl': 'XL Pack'
    };
    return names[packSize] || packSize;
  }

  // Helper methods
  private getTierColor(tier: string): number {
    const colors = {
      'FREE': 0x9ca3af,
      'STARTER': 0x3b82f6,
      'PRO': 0x8b5cf6,
      'ENTERPRISE': 0xf59e0b
    };
    return colors[tier as keyof typeof colors] || colors.FREE;
  }

  private formatTier(tier: string): string {
    const emojis = {
      'FREE': '🆓',
      'STARTER': '🚀',
      'PRO': '⭐',
      'ENTERPRISE': '👑'
    };
    return `${emojis[tier as keyof typeof emojis] || '❓'} ${tier}`;
  }

  private formatModelName(model: string): string {
    const modelNames: Record<string, string> = {
      'claude-haiku': 'Claude Haiku',
      'claude-sonnet': 'Claude Sonnet',
      'claude-opus': 'Claude Opus',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-4-turbo': 'GPT-4 Turbo'
    };
    return modelNames[model] || model;
  }

  private formatPackName(packSize: string): string {
    const names: Record<string, string> = {
      'small': 'Small Pack',
      'medium': 'Medium Pack',
      'large': 'Large Pack',
      'xl': 'XL Pack'
    };
    return names[packSize] || packSize;
  }

  private generateRecommendations(stats: any): string[] {
    const recommendations = [];

    if (stats.efficientUsageScore < 0.5) {
      recommendations.push('• Try using Claude Haiku for simpler games to save credits');
    }

    if (stats.averageCostPerGame > 30) {
      recommendations.push('• Consider breaking complex games into simpler components');
    }

    if (stats.projectedMonthlyUsage > 1000 && stats.recommendedTier !== 'ENTERPRISE') {
      recommendations.push('• Consider upgrading to a higher tier for better value');
    }

    const mostUsedModel = stats.mostUsedModel;
    if (mostUsedModel === 'claude-opus' && stats.totalCreditsUsed > 500) {
      recommendations.push('• Try using Sonnet or GPT-4 instead of Opus for some games');
    }

    return recommendations;
  }
}