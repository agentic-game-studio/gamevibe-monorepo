// GameVibe AI Subscription Middleware
// Enforces subscription limits and feature gating

import { 
  CommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  MessageFlags
} from 'discord.js';
import { injectable, inject } from 'inversify';
import { SubscriptionService } from '../services/subscription.js';
import { TYPES } from '../types.js';
import { 
  getTierEmoji, 
  getTierColor,
  type SubscriptionTierKey 
} from '../config/subscription-tiers.js';

export interface SubscriptionCheckResult {
  allowed: boolean;
  reason?: string;
  message?: string;
}

@injectable()
export class SubscriptionChecker {
  constructor(
    @inject(TYPES.SubscriptionService) private subscriptionService: SubscriptionService
  ) {}

  /**
   * Check if server can create a game
   */
  async checkGameCreation(interaction: CommandInteraction): Promise<SubscriptionCheckResult> {
    if (!interaction.guildId) {
      return { allowed: false, message: 'This command can only be used in a server!' };
    }

    const check = await this.subscriptionService.canPerformAction(
      interaction.guildId,
      'create_game',
      interaction.user.id
    );

    if (!check.allowed) {
      await this.handleLimitReached(interaction, check);
      return { allowed: false };
    }

    return { allowed: true };
  }

  /**
   * Check if server can generate assets
   */
  async checkAssetGeneration(interaction: CommandInteraction): Promise<SubscriptionCheckResult> {
    if (!interaction.guildId) {
      return { allowed: false, message: 'This command can only be used in a server!' };
    }

    const check = await this.subscriptionService.canPerformAction(
      interaction.guildId,
      'generate_asset',
      interaction.user.id
    );

    if (!check.allowed) {
      await this.handleLimitReached(interaction, check);
      return { allowed: false };
    }

    return { allowed: true };
  }

  /**
   * Check if server can use multiplayer features
   */
  async checkMultiplayerAccess(interaction: CommandInteraction): Promise<SubscriptionCheckResult> {
    if (!interaction.guildId) {
      return { allowed: false, message: 'This command can only be used in a server!' };
    }

    const subscription = await this.subscriptionService.getServerSubscription(interaction.guildId);
    const tierKey = subscription.tier.toLowerCase() as SubscriptionTierKey;

    // Multiplayer available on Starter tier and above
    if (tierKey === 'free') {
      await this.showUpgradePrompt(interaction, 'multiplayer games', 'starter');
      return { allowed: false };
    }

    return { allowed: true };
  }

  /**
   * Check if server can access analytics
   */
  async checkAnalyticsAccess(interaction: CommandInteraction): Promise<SubscriptionCheckResult> {
    if (!interaction.guildId) {
      return { allowed: false, message: 'This command can only be used in a server!' };
    }

    const subscription = await this.subscriptionService.getServerSubscription(interaction.guildId);
    const tierKey = subscription.tier.toLowerCase() as SubscriptionTierKey;

    // Analytics available on Starter tier and above
    if (tierKey === 'free') {
      await this.showUpgradePrompt(interaction, 'analytics dashboard', 'starter');
      return { allowed: false };
    }

    return { allowed: true };
  }

  /**
   * Record usage after successful action
   */
  async recordUsage(
    serverId: string, 
    action: string, 
    userId: string, 
    metadata?: any
  ): Promise<void> {
    await this.subscriptionService.recordUsage(serverId, action, userId, metadata);
  }

  /**
   * Handle when a limit is reached
   */
  private async handleLimitReached(interaction: CommandInteraction, check: any): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🚫 Limit Reached')
      .setColor('#ef4444');

    let description = '';
    let upgradeRequired = false;

    switch (check.reason) {
      case 'feature_not_in_tier':
        description = `This feature requires **${check.requiredTier.toUpperCase()}** tier or higher!`;
        upgradeRequired = true;
        embed.addFields([
          {
            name: 'Current Tier',
            value: 'FREE',
            inline: true
          },
          {
            name: 'Required Tier',
            value: check.requiredTier.toUpperCase(),
            inline: true
          }
        ]);
        break;

      case 'monthly_limit_reached':
        description = `You've reached your monthly limit of **${check.limit} games**!`;
        upgradeRequired = true;
        embed.addFields([
          {
            name: 'Games Created',
            value: `${check.usage}/${check.limit}`,
            inline: true
          },
          {
            name: 'Resets In',
            value: `<t:${Math.floor(check.resetDate.getTime() / 1000)}:R>`,
            inline: true
          }
        ]);
        break;

      case 'asset_limit_reached':
        description = `You've reached your monthly asset generation limit of **${check.limit} assets**!`;
        upgradeRequired = true;
        embed.addFields([
          {
            name: 'Assets Generated',
            value: `${check.usage}/${check.limit}`,
            inline: true
          }
        ]);
        break;

      case 'rate_limit_exceeded':
        description = 'Slow down! You\'re creating games too quickly.';
        embed.addFields([
          {
            name: 'Try Again In',
            value: `${check.retryAfter} seconds`,
            inline: true
          }
        ]);
        break;

      default:
        description = 'You\'ve reached a subscription limit.';
        upgradeRequired = true;
    }

    embed.setDescription(description);

    const components = [];

    if (upgradeRequired) {
      // Add upgrade button
      const upgradeButton = new ButtonBuilder()
        .setCustomId('subscription:upgrade')
        .setLabel('Upgrade Now')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🚀');

      const infoButton = new ButtonBuilder()
        .setCustomId('subscription:info')
        .setLabel('View Plans')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊');

      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(upgradeButton, infoButton)
      );
    }

    await interaction.reply({
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral
    });
  }

  /**
   * Show upgrade prompt for specific features
   */
  private async showUpgradePrompt(
    interaction: CommandInteraction, 
    featureName: string, 
    requiredTier: string
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔒 Premium Feature')
      .setDescription(`**${featureName}** requires ${getTierEmoji(requiredTier)} **${requiredTier.toUpperCase()}** tier or higher!`)
      .setColor(getTierColor(requiredTier))
      .addFields([
        {
          name: '🎯 What you get with an upgrade:',
          value: this.getTierBenefits(requiredTier)
        }
      ]);

    const upgradeButton = new ButtonBuilder()
      .setCustomId('subscription:upgrade')
      .setLabel(`Upgrade to ${requiredTier.toUpperCase()}`)
      .setStyle(ButtonStyle.Success)
      .setEmoji('🚀');

    await interaction.reply({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(upgradeButton)
      ],
      flags: MessageFlags.Ephemeral
    });
  }

  /**
   * Get tier benefits for display
   */
  private getTierBenefits(tier: string): string {
    switch (tier.toLowerCase()) {
      case 'starter':
        return '• 50 games per month\n• Up to 10 players\n• Analytics dashboard\n• 10 AI-generated assets';
      case 'pro':
        return '• 100 games per month\n• Unlimited players\n• AI-generated assets\n• Priority support\n• API access';
      case 'enterprise':
        return '• Unlimited everything\n• Priority processing (faster generation)\n• Multi-server support\n• Custom integrations & domains\n• 1-hour SLA support\n• White-label & custom branding';
      default:
        return 'Enhanced features and higher limits';
    }
  }
}

/**
 * Decorator for commands that require subscription checks
 */
export function requiresSubscription(action: 'game_creation' | 'asset_generation' | 'multiplayer' | 'analytics') {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const interaction = args[0] as CommandInteraction;
      const checker = this.subscriptionChecker as SubscriptionChecker;

      if (!checker) {
        console.error('SubscriptionChecker not injected properly');
        return method.apply(this, args);
      }

      let checkResult: SubscriptionCheckResult;
      
      switch (action) {
        case 'game_creation':
          checkResult = await checker.checkGameCreation(interaction);
          break;
        case 'asset_generation':
          checkResult = await checker.checkAssetGeneration(interaction);
          break;
        case 'multiplayer':
          checkResult = await checker.checkMultiplayerAccess(interaction);
          break;
        case 'analytics':
          checkResult = await checker.checkAnalyticsAccess(interaction);
          break;
        default:
          checkResult = { allowed: true };
      }

      if (!checkResult.allowed) {
        if (checkResult.message) {
          await interaction.reply({
            content: `❌ ${checkResult.message}`,
            flags: MessageFlags.Ephemeral
          });
        }
        return;
      }

      // Call original method
      return method.apply(this, args);
    };

    return descriptor;
  };
}