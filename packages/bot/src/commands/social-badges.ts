import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, SlashCommandSubcommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { SocialBadgeService, BadgeCollection, UserBadge } from '../services/social-badges.js';
import { DatabaseService } from '../services/database.js';
import { LiveActivityService } from '../services/live-activity.js';
import { TYPES } from '../types.js';

@injectable()
export class SocialBadgesCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('badges')
    .setDescription('View and manage your badge collection and achievements')
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('collection')
        .setDescription('View your complete badge collection')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('View another user\'s badge collection')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('available')
        .setDescription('View all available badges you can earn')
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Filter badges by category')
            .setRequired(false)
            .addChoices(
              { name: 'All Categories', value: 'all' },
              { name: 'Achievements', value: 'achievement' },
              { name: 'Milestones', value: 'milestone' },
              { name: 'Special Events', value: 'special' },
              { name: 'Community', value: 'community' },
              { name: 'Creator', value: 'creator' }
            )
        )
        .addStringOption(option =>
          option
            .setName('rarity')
            .setDescription('Filter badges by rarity')
            .setRequired(false)
            .addChoices(
              { name: 'All Rarities', value: 'all' },
              { name: 'Common', value: 'common' },
              { name: 'Uncommon', value: 'uncommon' },
              { name: 'Rare', value: 'rare' },
              { name: 'Epic', value: 'epic' },
              { name: 'Legendary', value: 'legendary' },
              { name: 'Mythic', value: 'mythic' }
            )
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('share')
        .setDescription('Share one of your badges on social media')
        .addStringOption(option =>
          option
            .setName('badge-id')
            .setDescription('The ID of the badge to share')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('platform')
            .setDescription('Platform to share on')
            .setRequired(true)
            .addChoices(
              { name: 'Discord', value: 'discord' },
              { name: 'Twitter/X', value: 'twitter' },
              { name: 'Facebook', value: 'facebook' },
              { name: 'Instagram', value: 'instagram' }
            )
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('showcase')
        .setDescription('Customize your badge showcase display')
        .addStringOption(option =>
          option
            .setName('layout')
            .setDescription('Choose your showcase layout')
            .setRequired(false)
            .addChoices(
              { name: 'Grid Layout', value: 'grid' },
              { name: 'Carousel', value: 'carousel' },
              { name: 'Timeline', value: 'timeline' }
            )
        )
        .addBooleanOption(option =>
          option
            .setName('public')
            .setDescription('Make your showcase public')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('leaderboard')
        .setDescription('View badge collection leaderboards')
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Type of leaderboard to view')
            .setRequired(false)
            .addChoices(
              { name: 'Total Badges', value: 'total' },
              { name: 'Rare Badges', value: 'rare' },
              { name: 'Recent Earners', value: 'recent' }
            )
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('quests')
        .setDescription('View active badge quests and challenges')
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('certificate')
        .setDescription('Generate or view achievement certificate')
        .addStringOption(option =>
          option
            .setName('badge-id')
            .setDescription('Badge ID to generate certificate for')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('template')
            .setDescription('Certificate template style')
            .setRequired(false)
            .addChoices(
              { name: 'Modern', value: 'modern' },
              { name: 'Classic', value: 'classic' },
              { name: 'Gaming', value: 'gaming' },
              { name: 'Elegant', value: 'elegant' },
              { name: 'Fun', value: 'fun' }
            )
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('check')
        .setDescription('Check for new badges you might have earned')
    );

  constructor(
    @inject(TYPES.SocialBadgeService) private badgeService: SocialBadgeService,
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.LiveActivityService) private liveActivityService: LiveActivityService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'collection':
        await this.handleCollection(interaction);
        break;
      case 'available':
        await this.handleAvailable(interaction);
        break;
      case 'share':
        await this.handleShare(interaction);
        break;
      case 'showcase':
        await this.handleShowcase(interaction);
        break;
      case 'leaderboard':
        await this.handleLeaderboard(interaction);
        break;
      case 'quests':
        await this.handleQuests(interaction);
        break;
      case 'certificate':
        await this.handleCertificate(interaction);
        break;
      case 'check':
        await this.handleCheck(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand',
          ephemeral: true
        });
    }
  }

  private async handleCollection(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const collection = await this.badgeService.getBadgeCollection(targetUser.id);

      if (!collection) {
        await interaction.editReply({
          content: `🏅 ${targetUser.id === interaction.user.id ? 'You don\'t' : `${targetUser.username} doesn't`} have any badges yet.\n\nStart creating games to earn your first badges!`
        });
        return;
      }

      const isOwnCollection = targetUser.id === interaction.user.id;
      const stats = collection.stats;

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`🏅 ${isOwnCollection ? 'Your' : `${collection.userName}'s`} Badge Collection`)
        .setDescription(`${stats.totalBadges} badge${stats.totalBadges !== 1 ? 's' : ''} earned • ${stats.completionPercentage.toFixed(1)}% collection complete`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setFooter({ 
          text: `First badge: ${stats.firstBadgeDate.toLocaleDateString()} • Latest: ${stats.latestBadgeDate.toLocaleDateString()}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add collection stats
      embed.addFields({
        name: '📊 Collection Stats',
        value: `🟢 **Common:** ${stats.commonBadges}\n` +
               `🔵 **Rare:** ${stats.rareBadges}\n` +
               `🟣 **Epic:** ${stats.epicBadges}\n` +
               `🟡 **Legendary:** ${stats.legendaryBadges}\n` +
               `💎 **Total:** ${stats.totalBadges}`,
        inline: true
      });

      // Add featured badges
      const featuredBadges = collection.badges
        .filter(b => collection.showcase.featuredBadges.includes(b.badgeId))
        .slice(0, 6);

      if (featuredBadges.length > 0) {
        const badgeText = featuredBadges.map(badge => {
          const rarityEmoji = this.getRarityEmoji(badge.badge.rarity);
          const categoryEmoji = this.getCategoryEmoji(badge.badge.category);
          return `${rarityEmoji}${categoryEmoji} **${badge.badge.name}**\n   ${badge.badge.description}`;
        }).join('\n\n');

        embed.addFields({
          name: '✨ Featured Badges',
          value: badgeText,
          inline: false
        });
      }

      // Add recent badges
      const recentBadges = collection.badges
        .sort((a, b) => b.awardedAt.getTime() - a.awardedAt.getTime())
        .slice(0, 3);

      if (recentBadges.length > 0) {
        const recentText = recentBadges.map(badge => {
          const rarityEmoji = this.getRarityEmoji(badge.badge.rarity);
          const daysAgo = Math.floor((Date.now() - badge.awardedAt.getTime()) / (1000 * 60 * 60 * 24));
          return `${rarityEmoji} **${badge.badge.name}** (${daysAgo} days ago)`;
        }).join('\n');

        embed.addFields({
          name: '🕒 Recently Earned',
          value: recentText,
          inline: true
        });
      }

      // Add rarest badges
      const rareOrder = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
      const rarestBadges = collection.badges
        .sort((a, b) => (rareOrder[b.badge.rarity as keyof typeof rareOrder] || 0) - (rareOrder[a.badge.rarity as keyof typeof rareOrder] || 0))
        .slice(0, 3);

      if (rarestBadges.length > 0) {
        const rarestText = rarestBadges.map(badge => {
          const rarityEmoji = this.getRarityEmoji(badge.badge.rarity);
          return `${rarityEmoji} **${badge.badge.name}** (${badge.badge.rarity})`;
        }).join('\n');

        embed.addFields({
          name: '💎 Rarest Badges',
          value: rarestText,
          inline: true
        });
      }

      // Add showcase settings for own collection
      if (isOwnCollection) {
        embed.addFields({
          name: '🎨 Showcase Settings',
          value: `**Layout:** ${collection.showcase.layoutStyle}\n` +
                 `**Public:** ${collection.showcase.isPublic ? 'Yes' : 'No'}\n` +
                 `**Featured:** ${collection.showcase.featuredBadges.length}/6 slots`,
          inline: true
        });
      }

      // Add action buttons
      const buttons: ButtonBuilder[] = [];
      
      if (isOwnCollection) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId('customize_showcase')
            .setLabel('Customize Showcase')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎨'),
          new ButtonBuilder()
            .setCustomId('check_new_badges')
            .setLabel('Check for New Badges')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔍')
        );
      }

      buttons.push(
        new ButtonBuilder()
          .setCustomId('view_quests')
          .setLabel('View Quests')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎯')
      );

      if (buttons.length > 0) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
        await interaction.editReply({
          embeds: [embed],
          components: [row]
        });
      } else {
        await interaction.editReply({
          embeds: [embed]
        });
      }

    } catch (error) {
      console.error('Error getting badge collection:', error);
      await interaction.editReply({
        content: '❌ Failed to load badge collection. Please try again later.'
      });
    }
  }

  private async handleAvailable(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const category = interaction.options.get('category', false)?.value as string;
      const rarity = interaction.options.get('rarity', false)?.value as string;

      const filterCategory = category && category !== 'all' ? category : undefined;
      const filterRarity = rarity && rarity !== 'all' ? rarity : undefined;

      const badges = await this.badgeService.getAvailableBadges(filterCategory, filterRarity);

      if (badges.length === 0) {
        await interaction.editReply({
          content: `🏅 No badges found${filterCategory ? ` in category: ${this.formatCategory(filterCategory)}` : ''}${filterRarity ? ` with rarity: ${filterRarity}` : ''}.\n\nTry different filters!`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🏅 Available Badges')
        .setDescription(`${badges.length} badge${badges.length !== 1 ? 's' : ''} available to earn`)
        .setFooter({ 
          text: 'Create games and engage with the community to earn badges!',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add badges by rarity groups
      const groupedBadges = this.groupBadgesByRarity(badges);

      for (const [rarityLevel, rarityBadges] of Object.entries(groupedBadges)) {
        if (rarityBadges.length === 0) continue;

        const rarityEmoji = this.getRarityEmoji(rarityLevel);
        const badgeList = rarityBadges.slice(0, 5).map(badge => {
          const categoryEmoji = this.getCategoryEmoji(badge.category);
          const statsText = `${badge.stats.totalAwarded.toLocaleString()} earned`;
          return `${categoryEmoji} **${badge.name}** (${statsText})\n   ${badge.description}`;
        }).join('\n\n');

        embed.addFields({
          name: `${rarityEmoji} ${this.formatRarity(rarityLevel)} Badges (${rarityBadges.length})`,
          value: badgeList + (rarityBadges.length > 5 ? `\n\n... and ${rarityBadges.length - 5} more` : ''),
          inline: false
        });
      }

      // Add filter info
      if (filterCategory || filterRarity) {
        embed.addFields({
          name: '🔍 Applied Filters',
          value: `${filterCategory ? `**Category:** ${this.formatCategory(filterCategory)}` : ''}${filterCategory && filterRarity ? '\n' : ''}${filterRarity ? `**Rarity:** ${this.formatRarity(filterRarity)}` : ''}`,
          inline: true
        });
      }

      // Add action buttons
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('my_progress')
            .setLabel('My Progress')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊'),
          new ButtonBuilder()
            .setCustomId('view_quests')
            .setLabel('Badge Quests')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🎯')
        );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('Error getting available badges:', error);
      await interaction.editReply({
        content: '❌ Failed to load available badges. Please try again later.'
      });
    }
  }

  private async handleShare(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const badgeId = interaction.options.get('badge-id', true).value as string;
      const platform = interaction.options.get('platform', true).value as string;

      const result = await this.badgeService.shareBadge(
        interaction.user.id,
        badgeId,
        platform as any
      );

      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle('📤 Badge Shared Successfully!')
          .setDescription(`Your badge has been prepared for sharing on **${this.formatPlatform(platform)}**`)
          .addFields({
            name: '🔗 Share Instructions',
            value: platform === 'discord' 
              ? 'Use the share text below to post in any Discord channel!'
              : `Click the link below to share on ${this.formatPlatform(platform)}:`,
            inline: false
          })
          .setFooter({ 
            text: 'Your badge share has been recorded',
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTimestamp();

        if (result.shareUrl) {
          embed.addFields({
            name: '🌐 Share Link',
            value: result.shareUrl,
            inline: false
          });
        }

        await interaction.editReply({
          embeds: [embed]
        });
      } else {
        await interaction.editReply({
          content: `❌ **Sharing Failed**\n\n${result.message}`
        });
      }

    } catch (error) {
      console.error('Error sharing badge:', error);
      await interaction.editReply({
        content: '❌ Failed to share badge. Please try again later.'
      });
    }
  }

  private async handleShowcase(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const layout = interaction.options.get('layout', false)?.value as string;
      const isPublic = interaction.options.get('public', false)?.value as boolean;

      const updateData: any = {};
      if (layout) updateData.layoutStyle = layout;
      if (isPublic !== null) updateData.isPublic = isPublic;

      if (Object.keys(updateData).length === 0) {
        // Show current showcase settings
        const collection = await this.badgeService.getBadgeCollection(interaction.user.id);
        
        if (!collection) {
          await interaction.editReply({
            content: '🏅 You don\'t have any badges yet. Create your first game to start earning badges!'
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🎨 Your Badge Showcase')
          .setDescription('Customize how your badges are displayed to others')
          .addFields(
            {
              name: '⚙️ Current Settings',
              value: `**Layout:** ${this.formatLayout(collection.showcase.layoutStyle)}\n` +
                     `**Public:** ${collection.showcase.isPublic ? 'Yes' : 'No'}\n` +
                     `**Featured Badges:** ${collection.showcase.featuredBadges.length}/6`,
              inline: true
            },
            {
              name: '🎯 Preferences',
              value: `**Show Rarity:** ${collection.preferences.showRarity ? 'Yes' : 'No'}\n` +
                     `**Show Stats:** ${collection.preferences.showStats ? 'Yes' : 'No'}\n` +
                     `**Auto Share:** ${collection.preferences.autoShare ? 'Yes' : 'No'}`,
              inline: true
            }
          )
          .setFooter({ 
            text: 'Use the options above to customize your showcase',
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTimestamp();

        await interaction.editReply({
          embeds: [embed]
        });
        return;
      }

      const result = await this.badgeService.updateShowcase(interaction.user.id, updateData);

      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle('✅ Showcase Updated!')
          .setDescription('Your badge showcase settings have been updated')
          .addFields({
            name: '🔄 Changes Made',
            value: Object.entries(updateData).map(([key, value]) => 
              `**${this.formatSettingKey(key)}:** ${this.formatSettingValue(key, value)}`
            ).join('\n'),
            inline: false
          })
          .setFooter({ 
            text: 'Others can now see your updated showcase',
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTimestamp();

        await interaction.editReply({
          embeds: [embed]
        });
      } else {
        await interaction.editReply({
          content: `❌ **Update Failed**\n\n${result.message}`
        });
      }

    } catch (error) {
      console.error('Error updating showcase:', error);
      await interaction.editReply({
        content: '❌ Failed to update showcase. Please try again later.'
      });
    }
  }

  private async handleLeaderboard(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const category = interaction.options.get('category', false)?.value as string || 'total';

      const leaderboard = await this.badgeService.getBadgeLeaderboard(category as any, 20);

      if (leaderboard.length === 0) {
        await interaction.editReply({
          content: `📊 No data available for **${this.formatLeaderboardCategory(category)}** leaderboard.\n\nCheck back later!`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`🏆 Badge Leaderboard - ${this.formatLeaderboardCategory(category)}`)
        .setDescription(`Top ${leaderboard.length} badge collectors`)
        .setFooter({ 
          text: 'Rankings update in real-time',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add leaderboard entries
      let leaderboardText = '';
      for (let i = 0; i < Math.min(leaderboard.length, 15); i++) {
        const entry = leaderboard[i];
        const rank = i + 1;
        const medal = this.getRankMedal(rank);
        
        leaderboardText += `${medal} **${entry.userName}**\n`;
        leaderboardText += `   Score: ${entry.score} • Badges: ${entry.badges}\n\n`;
      }

      embed.addFields({
        name: '📋 Rankings',
        value: leaderboardText || 'No entries to display',
        inline: false
      });

      // Add user's position if they're in the leaderboard
      const userEntry = leaderboard.find(e => e.userId === interaction.user.id);
      if (userEntry) {
        const userRank = leaderboard.indexOf(userEntry) + 1;
        embed.addFields({
          name: '👤 Your Position',
          value: `**Rank:** #${userRank}\n**Score:** ${userEntry.score}\n**Badges:** ${userEntry.badges}`,
          inline: true
        });
      }

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting leaderboard:', error);
      await interaction.editReply({
        content: '❌ Failed to load leaderboard. Please try again later.'
      });
    }
  }

  private async handleQuests(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const quests = await this.badgeService.getActiveQuests();

      if (quests.length === 0) {
        await interaction.editReply({
          content: '🎯 No active badge quests available.\n\nCheck back later for new challenges!'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle('🎯 Active Badge Quests')
        .setDescription(`${quests.length} quest${quests.length !== 1 ? 's' : ''} available to complete`)
        .setFooter({ 
          text: 'Complete quests to earn exclusive badges and rewards',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add quest details
      for (const quest of quests.slice(0, 3)) {
        const difficultyEmoji = this.getDifficultyEmoji(quest.difficulty);
        const progress = `${quest.completions}/${quest.participants} completed`;
        
        const stepsText = quest.steps.slice(0, 3).map((step, i) => 
          `${i + 1}. ${step.description} (${step.reward.credits} credits)`
        ).join('\n');

        embed.addFields(
          {
            name: `${difficultyEmoji} ${quest.name}`,
            value: quest.description,
            inline: false
          },
          {
            name: '📋 Quest Steps',
            value: stepsText + (quest.steps.length > 3 ? `\n... and ${quest.steps.length - 3} more steps` : ''),
            inline: true
          },
          {
            name: '🏆 Final Reward',
            value: `**Badge:** ${quest.finalReward.badgeId}\n` +
                   `**Credits:** ${quest.finalReward.credits}\n` +
                   `**Title:** ${quest.finalReward.title}\n` +
                   `**Certificate:** ${quest.finalReward.certificate ? 'Yes' : 'No'}`,
            inline: true
          },
          {
            name: '📊 Progress',
            value: `**Participants:** ${quest.participants}\n**Completion Rate:** ${((quest.completions / quest.participants) * 100).toFixed(1)}%`,
            inline: false
          }
        );
      }

      if (quests.length > 3) {
        embed.addFields({
          name: '📋 More Quests',
          value: `... and ${quests.length - 3} more quests available`,
          inline: false
        });
      }

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting quests:', error);
      await interaction.editReply({
        content: '❌ Failed to load quests. Please try again later.'
      });
    }
  }

  private async handleCertificate(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const badgeId = interaction.options.get('badge-id', true).value as string;
      const template = interaction.options.get('template', false)?.value as string || 'modern';

      // For now, show a placeholder response
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📜 Achievement Certificate')
        .setDescription('Generate a shareable certificate for your badge')
        .addFields({
          name: '🎨 Certificate Generation',
          value: 'This feature will create a beautiful, shareable certificate for your achievement.',
          inline: false
        })
        .addFields({
          name: '🔄 Coming Soon',
          value: 'Certificate generation is being implemented. Check back soon!',
          inline: false
        })
        .setFooter({ 
          text: `Badge ID: ${badgeId} • Template: ${template}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error generating certificate:', error);
      await interaction.editReply({
        content: '❌ Failed to generate certificate. Please try again later.'
      });
    }
  }

  private async handleCheck(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const newBadges = await this.badgeService.checkAutomaticBadges(interaction.user.id);

      if (newBadges.length === 0) {
        await interaction.editReply({
          content: '🔍 **Badge Check Complete**\n\nNo new badges earned at this time. Keep creating games and engaging with the community to unlock more achievements!'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('🎉 New Badges Earned!')
        .setDescription(`Congratulations! You've earned ${newBadges.length} new badge${newBadges.length !== 1 ? 's' : ''}!`)
        .setFooter({ 
          text: 'Keep up the great work!',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add new badges
      for (const userBadge of newBadges.slice(0, 5)) {
        const rarityEmoji = this.getRarityEmoji(userBadge.badge.rarity);
        const categoryEmoji = this.getCategoryEmoji(userBadge.badge.category);

        embed.addFields({
          name: `${rarityEmoji}${categoryEmoji} ${userBadge.badge.name}`,
          value: `${userBadge.badge.description}\n` +
                 `**Rarity:** ${this.formatRarity(userBadge.badge.rarity)}\n` +
                 `**Credits:** ${userBadge.badge.rewards.credits}\n` +
                 `**Reason:** ${userBadge.awardReason}`,
          inline: true
        });
      }

      if (newBadges.length > 5) {
        embed.addFields({
          name: '🎊 More Badges',
          value: `... and ${newBadges.length - 5} more badges earned!`,
          inline: false
        });
      }

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error checking badges:', error);
      await interaction.editReply({
        content: '❌ Failed to check for new badges. Please try again later.'
      });
    }
  }

  // Helper methods
  private getRarityEmoji(rarity: string): string {
    const emojis = {
      common: '🟢',
      uncommon: '🔵',
      rare: '🟣',
      epic: '🟡',
      legendary: '🟠',
      mythic: '💎'
    };
    return emojis[rarity as keyof typeof emojis] || '⚪';
  }

  private getCategoryEmoji(category: string): string {
    const emojis = {
      achievement: '🏆',
      milestone: '🎯',
      special: '✨',
      event: '🎉',
      community: '👥',
      creator: '🎮'
    };
    return emojis[category as keyof typeof emojis] || '🏅';
  }

  private getDifficultyEmoji(difficulty: string): string {
    const emojis = {
      easy: '🟢',
      medium: '🟡',
      hard: '🟠',
      expert: '🔴'
    };
    return emojis[difficulty as keyof typeof emojis] || '⚪';
  }

  private getRankMedal(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    if (rank <= 10) return '🏆';
    return `#${rank}`;
  }

  private formatCategory(category: string): string {
    const categories = {
      achievement: 'Achievements',
      milestone: 'Milestones',
      special: 'Special Events',
      event: 'Events',
      community: 'Community',
      creator: 'Creator'
    };
    return categories[category as keyof typeof categories] || category;
  }

  private formatRarity(rarity: string): string {
    return rarity.charAt(0).toUpperCase() + rarity.slice(1);
  }

  private formatPlatform(platform: string): string {
    const platforms = {
      discord: 'Discord',
      twitter: 'Twitter/X',
      facebook: 'Facebook',
      instagram: 'Instagram'
    };
    return platforms[platform as keyof typeof platforms] || platform;
  }

  private formatLayout(layout: string): string {
    const layouts = {
      grid: 'Grid Layout',
      carousel: 'Carousel',
      timeline: 'Timeline'
    };
    return layouts[layout as keyof typeof layouts] || layout;
  }

  private formatLeaderboardCategory(category: string): string {
    const categories = {
      total: 'Total Badges',
      rare: 'Rare Badges',
      recent: 'Recent Earners'
    };
    return categories[category as keyof typeof categories] || category;
  }

  private formatSettingKey(key: string): string {
    const keys = {
      layoutStyle: 'Layout',
      isPublic: 'Public'
    };
    return keys[key as keyof typeof keys] || key;
  }

  private formatSettingValue(key: string, value: any): string {
    if (key === 'isPublic') {
      return value ? 'Yes' : 'No';
    }
    if (key === 'layoutStyle') {
      return this.formatLayout(value);
    }
    return String(value);
  }

  private groupBadgesByRarity(badges: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      mythic: [],
      legendary: [],
      epic: [],
      rare: [],
      uncommon: [],
      common: []
    };

    for (const badge of badges) {
      if (groups[badge.rarity]) {
        groups[badge.rarity].push(badge);
      }
    }

    return groups;
  }
}