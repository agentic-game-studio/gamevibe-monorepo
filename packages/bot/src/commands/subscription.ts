// GameVibe AI Subscription Command
// Handles Discord server subscription management

import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ButtonInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { SubscriptionService } from '../services/subscription.js';
import { 
  SUBSCRIPTION_TIERS,
  getTierEmoji,
  getTierColor,
  getTierDescription,
  getTierLevel,
  type SubscriptionTierKey 
} from '../config/subscription-tiers.js';

@injectable()
export class SubscriptionCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('subscription')
    .setDescription('Manage server subscription')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View current subscription details')
    )
    .addSubcommand(sub =>
      sub.setName('upgrade')
        .setDescription('Upgrade server subscription')
    )
    .addSubcommand(sub =>
      sub.setName('manage')
        .setDescription('Manage subscription settings')
    ) as SlashCommandBuilder;

  constructor(
    @inject(TYPES.SubscriptionService) private subscriptionService: SubscriptionService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    // Check permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: '❌ You need **Manage Server** permission to manage subscriptions!',
        ephemeral: true
      });
      return;
    }

    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server!',
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'info':
          await this.showSubscriptionInfo(interaction);
          break;
        case 'upgrade':
          await this.showUpgradeOptions(interaction);
          break;
        case 'manage':
          await this.showManagementPanel(interaction);
          break;
      }
    } catch (error) {
      console.error('Subscription command error:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing your request. Please try again.',
        ephemeral: true
      });
    }
  }

  private async showSubscriptionInfo(interaction: CommandInteraction): Promise<void> {
    const subscription = await this.subscriptionService.getServerSubscription(interaction.guildId!);
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Server Subscription')
      .setColor(getTierColor(subscription.tier.toLowerCase()))
      .setThumbnail(interaction.guild?.iconURL() || null);

    // Current tier info
    embed.addFields([
      {
        name: 'Current Tier',
        value: `${getTierEmoji(subscription.tier.toLowerCase())} **${subscription.tier.toUpperCase()}**`,
        inline: true
      },
      {
        name: 'Status',
        value: this.formatStatus(subscription.status),
        inline: true
      },
      {
        name: 'Games This Month',
        value: `${subscription.gamesCreatedThisPeriod}/${this.getGameLimit(subscription.tier.toLowerCase())}`,
        inline: true
      }
    ]);

    // Features list
    const tierKey = subscription.tier.toLowerCase() as SubscriptionTierKey;
    const features = SUBSCRIPTION_TIERS[tierKey].features;
    const featureList = Object.entries(features)
      .map(([key, value]) => {
        const emoji = value === true || value === -1 ? '✅' : '❌';
        const display = this.formatFeatureName(key);
        return `${emoji} ${display}`;
      })
      .join('\n');

    embed.addFields([{
      name: 'Features',
      value: featureList
    }]);

    // Add renewal info if subscribed
    if (subscription.status === 'ACTIVE' && subscription.currentPeriodEnd) {
      embed.addFields([{
        name: 'Next Renewal',
        value: `<t:${Math.floor(subscription.currentPeriodEnd.getTime() / 1000)}:R>`,
        inline: true
      }]);
    }

    const components = [];

    // Add upgrade button if not on highest tier
    if (subscription.tier !== 'ENTERPRISE') {
      const upgradeButton = new ButtonBuilder()
        .setCustomId('subscription:upgrade')
        .setLabel('Upgrade')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🚀');
      
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(upgradeButton));
    }

    // Add manage button if subscribed
    if (subscription.status === 'ACTIVE') {
      const manageButton = new ButtonBuilder()
        .setCustomId('subscription:manage')
        .setLabel('Manage Subscription')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚙️');
      
      if (components.length > 0) {
        (components[0] as ActionRowBuilder<ButtonBuilder>).addComponents(manageButton);
      } else {
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(manageButton));
      }
    }

    await interaction.reply({
      embeds: [embed],
      components
    });
  }

  private async showUpgradeOptions(interaction: CommandInteraction): Promise<void> {
    const currentSub = await this.subscriptionService.getServerSubscription(interaction.guildId!);
    
    const embed = new EmbedBuilder()
      .setTitle('🚀 Upgrade Your Server')
      .setDescription('Choose the perfect plan for your server')
      .setColor('#f59e0b')
      .setThumbnail(interaction.guild?.iconURL() || null);

    const tiers: SubscriptionTierKey[] = ['starter', 'pro', 'enterprise'];
    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();
    let buttonCount = 0;

    for (const tier of tiers) {
      const config = SUBSCRIPTION_TIERS[tier];
      
      // Skip current and lower tiers
      if (getTierLevel(tier) <= getTierLevel(currentSub.tier.toLowerCase())) {
        continue;
      }

      embed.addFields([{
        name: `${getTierEmoji(tier)} ${config.name} - $${config.price / 100}/month`,
        value: getTierDescription(tier)
      }]);

      const button = new ButtonBuilder()
        .setCustomId(`subscription:checkout:${tier}`)
        .setLabel(`Get ${config.name}`)
        .setStyle(ButtonStyle.Primary);

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

    if (components.length === 0) {
      embed.setDescription('🎉 You\'re already on the highest tier!');
    }

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true
    });
  }

  private async showManagementPanel(interaction: CommandInteraction): Promise<void> {
    const subscription = await this.subscriptionService.getServerSubscription(interaction.guildId!);
    
    if (subscription.status !== 'ACTIVE') {
      await interaction.reply({
        content: '❌ No active subscription to manage. Use `/subscription upgrade` to get started!',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Subscription Management')
      .setDescription('Manage your server subscription settings')
      .setColor(getTierColor(subscription.tier.toLowerCase()))
      .addFields([
        {
          name: 'Current Plan',
          value: `${getTierEmoji(subscription.tier.toLowerCase())} ${subscription.tier.toUpperCase()}`,
          inline: true
        },
        {
          name: 'Monthly Usage',
          value: `${subscription.gamesCreatedThisPeriod} games created`,
          inline: true
        }
      ]);

    const portalButton = new ButtonBuilder()
      .setCustomId('subscription:portal')
      .setLabel('Customer Portal')
      .setStyle(ButtonStyle.Link)
      .setEmoji('🔗')
      .setURL(`${process.env.APP_URL || 'http://localhost:3000'}/subscription/portal`);

    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(portalButton)
    ];

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true
    });
  }

  // Button interaction handler
  static async handleButton(
    interaction: ButtonInteraction,
    subscriptionService: SubscriptionService
  ): Promise<void> {
    const [, action, tier] = interaction.customId.split(':');

    try {
      if (action === 'checkout' && tier) {
        await SubscriptionCommand.handleCheckout(interaction, subscriptionService, tier);
      } else if (action === 'upgrade') {
        // Re-show upgrade options
        await interaction.deferUpdate();
        // Would need to recreate the upgrade embed here
      } else if (action === 'manage') {
        // Re-show management panel
        await interaction.deferUpdate();
        // Would need to recreate the management embed here
      }
    } catch (error) {
      console.error('Button interaction error:', error);
      await interaction.reply({
        content: '❌ An error occurred. Please try again.',
        ephemeral: true
      });
    }
  }

  private static async handleCheckout(
    interaction: ButtonInteraction,
    subscriptionService: SubscriptionService,
    tier: string
  ): Promise<void> {
    try {
      const session = await subscriptionService.createCheckoutSession({
        serverId: interaction.guildId!,
        tier,
        userId: interaction.user.id
      });

      const tierConfig = SUBSCRIPTION_TIERS[tier as SubscriptionTierKey];
      
      const embed = new EmbedBuilder()
        .setTitle('🔗 Complete Your Purchase')
        .setDescription(`Complete your **${tierConfig.name}** subscription`)
        .setColor('#10b981')
        .addFields([
          {
            name: 'What happens next?',
            value: '1. Complete payment on Stripe\n2. Server instantly upgraded\n3. All members get premium features!'
          },
          {
            name: 'Price',
            value: `$${tierConfig.price / 100}/month`,
            inline: true
          },
          {
            name: 'Trial',
            value: tier === 'pro' ? '7 days free' : 'No trial',
            inline: true
          }
        ]);

      const button = new ButtonBuilder()
        .setLabel('Subscribe Now')
        .setStyle(ButtonStyle.Link)
        .setURL(session.url!)
        .setEmoji('💳');

      await interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
        ephemeral: true
      });

    } catch (error) {
      console.error('Checkout session error:', error);
      await interaction.reply({
        content: '❌ Failed to create checkout session. Please try again later.',
        ephemeral: true
      });
    }
  }

  // Helper methods
  private formatStatus(status: string): string {
    const statusEmojis = {
      'ACTIVE': '🟢 Active',
      'INACTIVE': '⚪ Inactive', 
      'CANCELED': '🔴 Canceled',
      'PAST_DUE': '🟡 Past Due',
      'TRIALING': '🆓 Trial'
    };
    return statusEmojis[status as keyof typeof statusEmojis] || status;
  }

  private formatFeatureName(key: string): string {
    const featureNames: Record<string, string> = {
      'games_per_month': 'Monthly Games',
      'concurrent_games': 'Concurrent Games',
      'max_players': 'Max Players',
      'custom_assets': 'AI-Generated Assets',
      'analytics': 'Analytics Dashboard',
      'priority_support': 'Priority Support',
      'api_access': 'API Access',
      'white_label': 'White Label'
    };
    return featureNames[key] || key;
  }

  private getGameLimit(tier: string): string {
    const limit = SUBSCRIPTION_TIERS[tier as SubscriptionTierKey]?.features.games_per_month;
    return limit === -1 ? '∞' : limit?.toString() || '0';
  }
}