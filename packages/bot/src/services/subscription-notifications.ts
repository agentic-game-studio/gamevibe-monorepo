// GameVibe AI Subscription Notifications Service
// Handles Discord notifications for subscription events

import { 
  Client, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  TextChannel,
  Guild,
  User,
  Colors
} from 'discord.js';
import { injectable, inject } from 'inversify';
import { SubscriptionStatus, SubscriptionTier } from '../generated/prisma/index.js';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { TYPES } from '../types.js';
import { 
  getTierEmoji, 
  getTierColor,
  SUBSCRIPTION_TIERS,
  type SubscriptionTierKey 
} from '../config/subscription-tiers.js';

export interface NotificationRecipient {
  userId: string;
  discordUserId: string;
  role: string;
}

@injectable()
export class SubscriptionNotifications {
  constructor(
    @inject(TYPES.DiscordClient) private client: Client,
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService
  ) {}

  /**
   * Notify when subscription is activated
   */
  async notifySubscriptionActivated(serverId: string, tier: string, subscribedByUserId?: string): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(serverId);
      if (!guild) return;

      const tierKey = tier.toLowerCase() as SubscriptionTierKey;
      const tierConfig = SUBSCRIPTION_TIERS[tierKey];

      // Send announcement to server
      const channel = await this.getAnnouncementChannel(guild);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('🎉 Server Upgraded!')
          .setDescription(`This server now has **${tier.toUpperCase()}** features!`)
          .setColor(getTierColor(tierKey))
          .setThumbnail(guild.iconURL() || null)
          .addFields([
            {
              name: '🎯 What\'s New?',
              value: this.getNewFeaturesMessage(tierKey),
              inline: false
            },
            {
              name: '🚀 Get Started',
              value: 'Use `/create-game` to try your new premium features!',
              inline: false
            },
            {
              name: '📊 Monthly Limits',
              value: this.getUsageLimitsMessage(tierKey),
              inline: true
            }
          ])
          .setFooter({ 
            text: 'Thank you for supporting GameVibe AI!',
            iconURL: this.client.user?.avatarURL() || undefined
          })
          .setTimestamp();

        const components = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('subscription:info')
              .setLabel('View Details')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('📊'),
            new ButtonBuilder()
              .setCustomId('create-game:quick')
              .setLabel('Create Game')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🎮')
          );

        await channel.send({ 
          embeds: [embed],
          components: [components]
        });
      }

      // Send personal thank you to subscriber
      if (subscribedByUserId) {
        await this.sendPersonalThankYou(subscribedByUserId, tier, guild.name);
      }

      // Notify subscription managers
      await this.notifySubscriptionManagers(serverId, 'activated', { tier });

      console.log(`✅ Subscription activation notifications sent for server ${serverId} (${tier})`);

    } catch (error) {
      console.error('Error sending subscription activation notifications:', error);
    }
  }

  /**
   * Notify when trial is ending
   */
  async notifyTrialEnding(serverId: string, daysLeft: number): Promise<void> {
    try {
      const managers = await this.getSubscriptionManagers(serverId);
      const guild = await this.client.guilds.fetch(serverId);
      
      for (const manager of managers) {
        try {
          const user = await this.client.users.fetch(manager.discordUserId);
          
          const embed = new EmbedBuilder()
            .setTitle('⏰ Trial Ending Soon')
            .setDescription(`Your **${guild?.name || 'server'}** trial ends in **${daysLeft} days**!`)
            .setColor(Colors.Yellow)
            .addFields([
              {
                name: '🔥 Keep Your Premium Features',
                value: 'Subscribe now to continue enjoying unlimited games and premium features.',
                inline: false
              },
              {
                name: '⚡ What You\'ll Lose',
                value: '• Unlimited game creation\n• AI-generated assets\n• Priority support\n• Advanced analytics',
                inline: true
              },
              {
                name: '💡 Easy to Continue',
                value: 'Use `/subscription upgrade` in your server to subscribe instantly.',
                inline: true
              }
            ])
            .setFooter({ text: `Trial ends: ${new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000).toLocaleDateString()}` })
            .setTimestamp();

          const components = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('subscription:convert_trial')
                .setLabel('Subscribe Now')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💳'),
              new ButtonBuilder()
                .setCustomId('subscription:info')
                .setLabel('View Plans')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📊')
            );

          await user.send({
            embeds: [embed],
            components: [components]
          });

        } catch (error) {
          // User has DMs disabled, try to notify in server
          console.warn(`Could not DM trial ending notice to user ${manager.discordUserId}`);
        }
      }

      // Also send server notification if 3 days or less
      if (daysLeft <= 3) {
        const channel = await this.getAnnouncementChannel(guild);
        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('⏰ Premium Trial Ending')
            .setDescription(`Your server's premium trial ends in **${daysLeft} days**!`)
            .setColor(Colors.Yellow)
            .addFields([
              {
                name: '📢 Server Administrators',
                value: 'Use `/subscription upgrade` to continue enjoying premium features.',
                inline: false
              }
            ]);

          await channel.send({ embeds: [embed] });
        }
      }

      console.log(`⏰ Trial ending notifications sent for server ${serverId} (${daysLeft} days left)`);

    } catch (error) {
      console.error('Error sending trial ending notifications:', error);
    }
  }

  /**
   * Notify when payment fails
   */
  async notifyPaymentFailed(serverId: string, attemptCount: number = 1): Promise<void> {
    try {
      const managers = await this.getSubscriptionManagers(serverId);
      const guild = await this.client.guilds.fetch(serverId);
      
      for (const manager of managers) {
        try {
          const user = await this.client.users.fetch(manager.discordUserId);
          
          const embed = new EmbedBuilder()
            .setTitle('❌ Payment Failed')
            .setDescription(`We couldn't process your subscription payment for **${guild?.name || 'your server'}**.`)
            .setColor(Colors.Red)
            .addFields([
              {
                name: '⚠️ Action Required',
                value: 'Please update your payment method to continue using premium features.',
                inline: false
              },
              {
                name: '🛡️ Grace Period',
                value: `You have **${4 - attemptCount} attempts** remaining before premium features are disabled.`,
                inline: true
              },
              {
                name: '🔧 Quick Fix',
                value: 'Use `/subscription manage` to update your payment method.',
                inline: true
              }
            ])
            .setFooter({ text: `Attempt ${attemptCount} of 4` })
            .setTimestamp();

          const components = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setLabel('Update Payment Method')
                .setStyle(ButtonStyle.Link)
                .setURL(`${process.env.APP_URL || 'http://localhost:3000'}/subscription/manage`)
                .setEmoji('💳'),
              new ButtonBuilder()
                .setCustomId('subscription:support')
                .setLabel('Get Help')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('💬')
            );

          await user.send({
            embeds: [embed],
            components: [components]
          });

        } catch (error) {
          console.warn(`Could not DM payment failed notice to user ${manager.discordUserId}`);
        }
      }

      // Send warning to server if final attempt
      if (attemptCount >= 3) {
        const channel = await this.getAnnouncementChannel(guild);
        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('⚠️ Payment Issue')
            .setDescription('Your server subscription payment has failed. Premium features may be disabled soon.')
            .setColor(Colors.Orange)
            .addFields([
              {
                name: '📢 Server Administrators',
                value: 'Please use `/subscription manage` to update payment information.',
                inline: false
              }
            ]);

          await channel.send({ embeds: [embed] });
        }
      }

      console.log(`❌ Payment failed notifications sent for server ${serverId} (attempt ${attemptCount})`);

    } catch (error) {
      console.error('Error sending payment failed notifications:', error);
    }
  }

  /**
   * Notify when subscription is canceled
   */
  async notifySubscriptionCanceled(serverId: string, tier: string, endsAt?: Date): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(serverId);
      const channel = await this.getAnnouncementChannel(guild);
      
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('😔 Subscription Canceled')
          .setDescription(`Your **${tier.toUpperCase()}** subscription has been canceled.`)
          .setColor(Colors.Orange)
          .addFields([
            {
              name: '📅 Service Until',
              value: endsAt 
                ? `Premium features will continue until <t:${Math.floor(endsAt.getTime() / 1000)}:f>`
                : 'Premium features have been disabled.',
              inline: false
            },
            {
              name: '🔄 Reactivate Anytime',
              value: 'You can resubscribe at any time using `/subscription upgrade`.',
              inline: false
            }
          ])
          .setFooter({ text: 'Thank you for using GameVibe AI!' })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }

      // Notify managers
      await this.notifySubscriptionManagers(serverId, 'canceled', { tier, endsAt });

      console.log(`😔 Subscription cancelation notifications sent for server ${serverId}`);

    } catch (error) {
      console.error('Error sending subscription cancelation notifications:', error);
    }
  }

  /**
   * Notify when approaching usage limits
   */
  async notifyUsageLimitWarning(serverId: string, limitType: string, current: number, limit: number, percentage: number): Promise<void> {
    try {
      if (percentage < 80) return; // Only warn at 80%+ usage

      const managers = await this.getSubscriptionManagers(serverId);
      const guild = await this.client.guilds.fetch(serverId);
      
      const embed = new EmbedBuilder()
        .setTitle('⚠️ Usage Limit Warning')
        .setDescription(`Your server is approaching its monthly ${limitType} limit.`)
        .setColor(Colors.Yellow)
        .addFields([
          {
            name: '📊 Current Usage',
            value: `${current}/${limit === -1 ? '∞' : limit} (${Math.round(percentage)}%)`,
            inline: true
          },
          {
            name: '🚀 Need More?',
            value: 'Consider upgrading to a higher tier for increased limits.',
            inline: true
          }
        ])
        .setTimestamp();

      if (percentage >= 95) {
        embed.setColor(Colors.Red);
        embed.setTitle('🚨 Usage Limit Almost Reached');
        embed.addFields([
          {
            name: '⏰ What Happens Next',
            value: 'You may be unable to create more games once you hit the limit.',
            inline: false
          }
        ]);
      }

      // Send to subscription managers
      for (const manager of managers) {
        try {
          const user = await this.client.users.fetch(manager.discordUserId);
          await user.send({ embeds: [embed] });
        } catch (error) {
          console.warn(`Could not DM usage warning to user ${manager.discordUserId}`);
        }
      }

      console.log(`⚠️ Usage limit warning sent for server ${serverId} (${limitType}: ${percentage}%)`);

    } catch (error) {
      console.error('Error sending usage limit warnings:', error);
    }
  }

  /**
   * Send renewal reminder
   */
  async notifyRenewalReminder(serverId: string, tier: string, renewsAt: Date, daysUntil: number): Promise<void> {
    try {
      if (daysUntil > 7) return; // Only remind within 7 days

      const managers = await this.getSubscriptionManagers(serverId);
      const guild = await this.client.guilds.fetch(serverId);
      
      const embed = new EmbedBuilder()
        .setTitle('🔄 Subscription Renewal Reminder')
        .setDescription(`Your **${tier.toUpperCase()}** subscription renews in **${daysUntil} days**.`)
        .setColor(Colors.Blue)
        .addFields([
          {
            name: '📅 Renewal Date',
            value: `<t:${Math.floor(renewsAt.getTime() / 1000)}:f>`,
            inline: true
          },
          {
            name: '✅ All Set',
            value: 'Your subscription will renew automatically.',
            inline: true
          },
          {
            name: '⚙️ Need Changes?',
            value: 'Use `/subscription manage` to modify your subscription.',
            inline: false
          }
        ])
        .setTimestamp();

      // Send to subscription managers
      for (const manager of managers) {
        try {
          const user = await this.client.users.fetch(manager.discordUserId);
          await user.send({ embeds: [embed] });
        } catch (error) {
          console.warn(`Could not DM renewal reminder to user ${manager.discordUserId}`);
        }
      }

      console.log(`🔄 Renewal reminder sent for server ${serverId} (${daysUntil} days)`);

    } catch (error) {
      console.error('Error sending renewal reminders:', error);
    }
  }

  // Private helper methods

  private async getAnnouncementChannel(guild: Guild | null): Promise<TextChannel | null> {
    if (!guild) return null;

    try {
      // Try to find a suitable channel (system, general, or first text channel)
      let channel: TextChannel | null = null;

      // Try system channel first
      if (guild.systemChannel) {
        channel = guild.systemChannel;
      }

      // Try to find 'general' channel
      if (!channel) {
        const generalChannel = guild.channels.cache.find(
          ch => ch.isTextBased() && 
               ['general', 'announcements', 'bot-commands'].includes(ch.name.toLowerCase())
        ) as TextChannel;
        if (generalChannel) channel = generalChannel;
      }

      // Fall back to first available text channel
      if (!channel) {
        const firstTextChannel = guild.channels.cache.find(
          ch => ch.isTextBased() && ch.permissionsFor(guild.members.me!)?.has('SendMessages')
        ) as TextChannel;
        if (firstTextChannel) channel = firstTextChannel;
      }

      return channel;

    } catch (error) {
      console.error('Error finding announcement channel:', error);
      return null;
    }
  }

  private async getSubscriptionManagers(serverId: string): Promise<NotificationRecipient[]> {
    try {
      const managers = await this.db.prisma.subscriptionManager.findMany({
        where: { serverId },
        include: { user: true }
      });

      return managers.map(manager => ({
        userId: manager.userId,
        discordUserId: manager.discordUserId,
        role: manager.role
      }));

    } catch (error) {
      console.error('Error fetching subscription managers:', error);
      return [];
    }
  }

  private async notifySubscriptionManagers(serverId: string, event: string, data: any): Promise<void> {
    const managers = await this.getSubscriptionManagers(serverId);
    console.log(`📬 Notifying ${managers.length} subscription managers of ${event} event for server ${serverId}`);
  }

  private async sendPersonalThankYou(userId: string, tier: string, serverName: string): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      
      const embed = new EmbedBuilder()
        .setTitle('🎉 Thank You for Subscribing!')
        .setDescription(`Thank you for upgrading **${serverName}** to **${tier.toUpperCase()}**!`)
        .setColor(Colors.Green)
        .addFields([
          {
            name: '🌟 You\'re Amazing!',
            value: 'Your support helps us continue building awesome AI-powered games.',
            inline: false
          },
          {
            name: '🎮 What\'s Next?',
            value: 'Head back to your server and try creating some premium games!',
            inline: false
          }
        ])
        .setFooter({ text: 'The GameVibe AI Team' })
        .setTimestamp();

      await user.send({ embeds: [embed] });

    } catch (error) {
      console.warn(`Could not send thank you message to user ${userId}`);
    }
  }

  private getNewFeaturesMessage(tier: SubscriptionTierKey): string {
    const features = SUBSCRIPTION_TIERS[tier].features;
    const highlights = [];

    if (features.games_per_month === -1) {
      highlights.push('🎮 Unlimited game creation');
    } else if (features.games_per_month > 10) {
      highlights.push(`🎮 ${features.games_per_month} games per month`);
    }

    if (features.custom_assets) {
      highlights.push('🎨 AI-generated sprites & backgrounds');
    }

    if (features.analytics) {
      highlights.push('📊 Analytics dashboard');
    }

    if (features.priority_support) {
      highlights.push('⚡ Priority support');
    }

    if (features.white_label) {
      highlights.push('🏷️ White-label branding');
    }

    if (features.priority_processing) {
      highlights.push('🚀 Priority processing');
    }

    return highlights.slice(0, 4).join('\n') || 'Enhanced gaming features';
  }

  private getUsageLimitsMessage(tier: SubscriptionTierKey): string {
    const features = SUBSCRIPTION_TIERS[tier].features;
    const limits = SUBSCRIPTION_TIERS[tier].limits;

    const info = [];
    
    if (features.games_per_month === -1) {
      info.push('🎮 Games: Unlimited');
    } else {
      info.push(`🎮 Games: ${features.games_per_month}/month`);
    }

    if (limits.asset_generation === -1) {
      info.push('🎨 Assets: Unlimited');
    } else if (limits.asset_generation > 0) {
      info.push(`🎨 Assets: ${limits.asset_generation}/month`);
    }

    return info.join('\n') || 'Check `/subscription info` for details';
  }
}