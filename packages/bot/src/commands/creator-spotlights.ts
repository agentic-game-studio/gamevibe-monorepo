import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, SlashCommandSubcommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { CreatorSpotlightService, CreatorSpotlight } from '../services/creator-spotlights.js';
import { DatabaseService } from '../services/database.js';
import { LiveActivityService } from '../services/live-activity.js';
import { TYPES } from '../types.js';

@injectable()
export class CreatorSpotlightsCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('spotlights')
    .setDescription('View featured creators and nominate outstanding community members')
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('featured')
        .setDescription('View currently featured creators')
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Filter by spotlight category')
            .setRequired(false)
            .addChoices(
              { name: 'All Categories', value: 'all' },
              { name: 'Top Creator', value: 'top_creator' },
              { name: 'Rising Star', value: 'rising_star' },
              { name: 'Game Innovator', value: 'innovative_game' },
              { name: 'Community Favorite', value: 'community_favorite' },
              { name: 'Prolific Creator', value: 'prolific_creator' }
            )
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('view')
        .setDescription('View detailed information about a specific creator spotlight')
        .addStringOption(option =>
          option
            .setName('spotlight-id')
            .setDescription('The spotlight ID to view')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('nominate')
        .setDescription('Nominate a creator for spotlight recognition')
        .addUserOption(option =>
          option
            .setName('creator')
            .setDescription('The creator to nominate')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Category for nomination')
            .setRequired(true)
            .addChoices(
              { name: 'Top Creator', value: 'top_creator' },
              { name: 'Rising Star', value: 'rising_star' },
              { name: 'Game Innovator', value: 'innovative_game' },
              { name: 'Community Favorite', value: 'community_favorite' },
              { name: 'Prolific Creator', value: 'prolific_creator' }
            )
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Why this creator deserves recognition (be specific)')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('candidates')
        .setDescription('View top creator candidates for spotlight')
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Category to view candidates for')
            .setRequired(false)
            .addChoices(
              { name: 'Top Creator', value: 'top_creator' },
              { name: 'Rising Star', value: 'rising_star' },
              { name: 'Game Innovator', value: 'innovative_game' },
              { name: 'Community Favorite', value: 'community_favorite' },
              { name: 'Prolific Creator', value: 'prolific_creator' }
            )
        )
        .addStringOption(option =>
          option
            .setName('period')
            .setDescription('Time period to analyze')
            .setRequired(false)
            .addChoices(
              { name: 'This Week', value: 'week' },
              { name: 'This Month', value: 'month' },
              { name: 'This Season', value: 'season' }
            )
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('programs')
        .setDescription('View active spotlight programs and contests')
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('my-nominations')
        .setDescription('View your nomination history and votes')
    );

  constructor(
    @inject(TYPES.CreatorSpotlightService) private spotlightService: CreatorSpotlightService,
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.LiveActivityService) private liveActivityService: LiveActivityService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'featured':
        await this.handleFeatured(interaction);
        break;
      case 'view':
        await this.handleView(interaction);
        break;
      case 'nominate':
        await this.handleNominate(interaction);
        break;
      case 'candidates':
        await this.handleCandidates(interaction);
        break;
      case 'programs':
        await this.handlePrograms(interaction);
        break;
      case 'my-nominations':
        await this.handleMyNominations(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand',
          ephemeral: true
        });
    }
  }

  private async handleFeatured(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();

    try {
      const category = interaction.options.get('category', false)?.value as string;
      const filterCategory = category && category !== 'all' ? category : undefined;

      const spotlights = await this.spotlightService.getFeaturedCreators(filterCategory, 8);

      if (spotlights.length === 0) {
        await interaction.editReply({
          content: `⭐ No featured creators found${filterCategory ? ` in category: ${this.formatCategory(filterCategory)}` : ''}.\n\nCheck back later for new spotlights!`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('⭐ Featured Creators')
        .setDescription(`${spotlights.length} outstanding creator${spotlights.length !== 1 ? 's' : ''} currently featured`)
        .setFooter({ 
          text: 'Use /spotlights view <spotlight-id> for detailed information',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add creator spotlights
      for (const spotlight of spotlights.slice(0, 6)) {
        const categoryEmoji = this.getCategoryEmoji(spotlight.category);
        const periodBadge = this.getPeriodBadge(spotlight.period);
        const achievements = spotlight.achievements;

        embed.addFields({
          name: `${categoryEmoji} ${spotlight.creatorName} ${periodBadge}`,
          value: `**${this.formatCategory(spotlight.category)}**\n` +
                 `🎮 ${achievements.gamesCreated} games • ▶️ ${achievements.totalPlays.toLocaleString()} plays\n` +
                 `⭐ ${achievements.averageRating.toFixed(1)} rating • 🔥 ${achievements.viralityScore} viral score\n` +
                 `💬 ${achievements.communityEngagement} engagement\n` +
                 `**ID:** \`${spotlight.id}\``,
          inline: true
        });
      }

      if (spotlights.length > 6) {
        embed.addFields({
          name: '📋 More Spotlights',
          value: `... and ${spotlights.length - 6} more featured creators`,
          inline: false
        });
      }

      // Add action buttons
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('nominate_creator')
            .setLabel('Nominate Creator')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⭐'),
          new ButtonBuilder()
            .setCustomId('view_programs')
            .setLabel('View Programs')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏆')
        );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('Error getting featured creators:', error);
      await interaction.editReply({
        content: '❌ Failed to load featured creators. Please try again later.'
      });
    }
  }

  private async handleView(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();

    try {
      const spotlightId = interaction.options.get('spotlight-id', true).value as string;

      const spotlight = await this.spotlightService.getSpotlight(spotlightId);

      if (!spotlight) {
        await interaction.editReply({
          content: '❌ Spotlight not found. Please check the spotlight ID and try again.'
        });
        return;
      }

      // Track view interaction
      await this.spotlightService.trackSpotlightInteraction(spotlightId, 'view', interaction.user.id);

      const categoryEmoji = this.getCategoryEmoji(spotlight.category);
      const periodBadge = this.getPeriodBadge(spotlight.period);

      const embed = new EmbedBuilder()
        .setColor(this.getCategoryColor(spotlight.category))
        .setTitle(`${categoryEmoji} ${spotlight.creatorName} ${periodBadge}`)
        .setDescription(`**${this.formatCategory(spotlight.category)}**\n\n${spotlight.spotlight.description}`)
        .setFooter({ 
          text: `Spotlight ID: ${spotlight.id} • Created ${spotlight.createdAt.toLocaleDateString()}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add achievements section
      const achievements = spotlight.achievements;
      embed.addFields({
        name: '🏆 Achievements',
        value: `🎮 **Games Created:** ${achievements.gamesCreated}\n` +
               `▶️ **Total Plays:** ${achievements.totalPlays.toLocaleString()}\n` +
               `⭐ **Average Rating:** ${achievements.averageRating.toFixed(1)}\n` +
               `🔥 **Virality Score:** ${achievements.viralityScore}\n` +
               `👥 **Unique Players:** ${achievements.uniquePlayers.toLocaleString()}\n` +
               `💬 **Community Engagement:** ${achievements.communityEngagement}`,
        inline: true
      });

      // Add featured games
      if (spotlight.featuredGames.length > 0) {
        const gamesText = spotlight.featuredGames.slice(0, 3).map(game => 
          `🎮 **${game.gameName}**\n` +
          `   ▶️ ${game.playCount.toLocaleString()} plays • ⭐ ${game.rating.toFixed(1)}\n` +
          `   ${game.highlights.join(' • ')}`
        ).join('\n\n');

        embed.addFields({
          name: '🎯 Featured Games',
          value: gamesText,
          inline: false
        });
      }

      // Add rewards
      const rewards = spotlight.rewards;
      embed.addFields({
        name: '🎁 Rewards Earned',
        value: `💰 **Credits:** ${rewards.credits.toLocaleString()}\n` +
               `🏅 **Badge:** ${rewards.badge}\n` +
               `👑 **Title:** ${rewards.title}\n` +
               `⚡ **Bonus Multiplier:** ${rewards.bonusMultiplier}x\n` +
               `✨ **Exclusive Content:** ${rewards.exclusiveContent?.length || 0} items`,
        inline: true
      });

      // Add creator story
      if (spotlight.spotlight.creatorStory) {
        embed.addFields({
          name: '📖 Creator Story',
          value: spotlight.spotlight.creatorStory,
          inline: false
        });
      }

      // Add highlights
      if (spotlight.spotlight.highlights.length > 0) {
        embed.addFields({
          name: '✨ Highlights',
          value: spotlight.spotlight.highlights.map(h => `• ${h}`).join('\n'),
          inline: false
        });
      }

      // Add quote if available
      if (spotlight.spotlight.quote) {
        embed.addFields({
          name: '💭 Creator Quote',
          value: `"${spotlight.spotlight.quote}"`,
          inline: false
        });
      }

      // Add metrics
      const metrics = spotlight.metrics;
      embed.addFields({
        name: '📊 Spotlight Metrics',
        value: `👀 ${metrics.views} views • 👍 ${metrics.likes} likes • 📤 ${metrics.shares} shares\n` +
               `👤 ${metrics.profileVisits} profile visits • 🎮 ${metrics.gameClicks} game clicks`,
        inline: false
      });

      // Add interaction buttons
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`like_spotlight_${spotlightId}`)
            .setLabel(`Like (${metrics.likes})`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👍'),
          new ButtonBuilder()
            .setCustomId(`share_spotlight_${spotlightId}`)
            .setLabel('Share')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📤'),
          new ButtonBuilder()
            .setCustomId(`view_profile_${spotlight.creatorId}`)
            .setLabel('View Profile')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👤')
        );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('Error viewing spotlight:', error);
      await interaction.editReply({
        content: '❌ Failed to load spotlight details. Please try again later.'
      });
    }
  }

  private async handleNominate(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();

    try {
      const creator = interaction.options.getUser('creator', true);
      const category = interaction.options.get('category', true).value as string;
      const reason = interaction.options.get('reason', true).value as string;

      if (creator.id === interaction.user.id) {
        await interaction.editReply({
          content: '❌ You cannot nominate yourself for a spotlight.'
        });
        return;
      }

      if (creator.bot) {
        await interaction.editReply({
          content: '❌ You cannot nominate bots for spotlights.'
        });
        return;
      }

      if (reason.length < 20) {
        await interaction.editReply({
          content: '❌ Please provide a more detailed reason (at least 20 characters) for the nomination.'
        });
        return;
      }

      const result = await this.spotlightService.nominateCreator(
        creator.id,
        interaction.user.id,
        category,
        reason
      );

      if (result.success) {
        const categoryEmoji = this.getCategoryEmoji(category);
        
        const embed = new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle('⭐ Nomination Submitted!')
          .setDescription(`You've successfully nominated **${creator.username}** for ${categoryEmoji} **${this.formatCategory(category)}**`)
          .addFields(
            {
              name: '👤 Nominated Creator',
              value: `${creator.username} (${creator.id})`,
              inline: true
            },
            {
              name: '🏷️ Category',
              value: `${categoryEmoji} ${this.formatCategory(category)}`,
              inline: true
            },
            {
              name: '📝 Your Reason',
              value: reason.slice(0, 200) + (reason.length > 200 ? '...' : ''),
              inline: false
            }
          )
          .addFields({
            name: '📋 What Happens Next?',
            value: '• Your nomination is now under review\n' +
                   '• Community members can vote on nominations\n' +
                   '• Winners are announced monthly\n' +
                   '• Check `/spotlights programs` for timelines',
            inline: false
          })
          .setFooter({ 
            text: `Nomination ID: ${result.nomination?.id}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTimestamp();

        await interaction.editReply({
          embeds: [embed]
        });
      } else {
        await interaction.editReply({
          content: `❌ **Nomination Failed**\n\n${result.message}`
        });
      }

    } catch (error) {
      console.error('Error nominating creator:', error);
      await interaction.editReply({
        content: '❌ Failed to submit nomination. Please try again later.'
      });
    }
  }

  private async handleCandidates(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();

    try {
      const category = interaction.options.get('category', false)?.value as string || 'top_creator';
      const period = interaction.options.get('period', false)?.value as string || 'month';

      const candidates = await this.spotlightService.getTopCreatorCandidates(category, period as any, 15);

      if (candidates.length === 0) {
        await interaction.editReply({
          content: `📊 No candidates found for **${this.formatCategory(category)}** in the ${period} period.\n\nTry a different category or period!`
        });
        return;
      }

      const categoryEmoji = this.getCategoryEmoji(category);
      
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${categoryEmoji} Top Candidates - ${this.formatCategory(category)}`)
        .setDescription(`Top ${candidates.length} creators for **${this.formatCategory(category)}** spotlight (${period} period)`)
        .setFooter({ 
          text: 'These creators are eligible for nomination based on their recent performance',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add top candidates
      for (let i = 0; i < Math.min(candidates.length, 10); i++) {
        const candidate = candidates[i];
        const rank = i + 1;
        const medal = this.getRankMedal(rank);

        embed.addFields({
          name: `${medal} ${candidate.creatorName}`,
          value: `**Score:** ${candidate.score.toFixed(1)}\n` +
                 `🎮 ${candidate.gamesCount} games • ▶️ ${candidate.totalPlays.toLocaleString()} plays\n` +
                 `⭐ ${candidate.metrics?.averageRating?.toFixed(1) || 'N/A'} rating • 🔥 ${candidate.metrics?.viralityScore || 0} viral`,
          inline: true
        });
      }

      if (candidates.length > 10) {
        embed.addFields({
          name: '📋 More Candidates',
          value: `... and ${candidates.length - 10} more qualified creators`,
          inline: false
        });
      }

      // Add action button
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`nominate_category_${category}`)
            .setLabel('Nominate Someone')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⭐')
        );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('Error getting candidates:', error);
      await interaction.editReply({
        content: '❌ Failed to load candidates. Please try again later.'
      });
    }
  }

  private async handlePrograms(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const programs = await this.spotlightService.getActivePrograms();

      if (programs.length === 0) {
        await interaction.editReply({
          content: '🏆 No active spotlight programs currently running.\n\nCheck back later for new programs and contests!'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle('🏆 Active Spotlight Programs')
        .setDescription(`${programs.length} program${programs.length !== 1 ? 's' : ''} currently accepting nominations`)
        .setFooter({ 
          text: 'Use /spotlights nominate to submit nominations',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add program details
      for (const program of programs.slice(0, 3)) {
        const timeline = program.timeline;
        const rewards = program.rewards;
        
        const timelineText = `**Nominations:** ${timeline.nominationStart.toLocaleDateString()} - ${timeline.nominationEnd.toLocaleDateString()}\n` +
                           `**Voting:** ${timeline.votingStart.toLocaleDateString()} - ${timeline.votingEnd.toLocaleDateString()}\n` +
                           `**Announcement:** ${timeline.announcementDate.toLocaleDateString()}`;

        const rewardsText = `🥇 **Winner:** ${rewards.winner.credits} credits + ${rewards.winner.title}\n` +
                          `🥈 **Runner-up:** ${rewards.runner_up.credits} credits + ${rewards.runner_up.title}\n` +
                          `🎖️ **Participants:** ${rewards.participants.credits} credits`;

        embed.addFields(
          {
            name: `🎯 ${program.name}`,
            value: program.description,
            inline: false
          },
          {
            name: '📅 Timeline',
            value: timelineText,
            inline: true
          },
          {
            name: '🏆 Rewards',
            value: rewardsText,
            inline: true
          },
          {
            name: '📋 Eligibility',
            value: `• ${program.eligibility.minGames}+ games created\n` +
                   `• ${program.eligibility.minPlays}+ total plays\n` +
                   `• Account ${program.eligibility.accountAge}+ days old`,
            inline: false
          }
        );

        if (program.rules.length > 0) {
          embed.addFields({
            name: '📜 Rules',
            value: program.rules.slice(0, 3).map((rule, i) => `${i + 1}. ${rule}`).join('\n') +
                   (program.rules.length > 3 ? `\n... and ${program.rules.length - 3} more rules` : ''),
            inline: false
          });
        }
      }

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting programs:', error);
      await interaction.editReply({
        content: '❌ Failed to load programs. Please try again later.'
      });
    }
  }

  private async handleMyNominations(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      // For now, show a placeholder since we'd need to implement user nomination tracking
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Your Nomination History')
        .setDescription('Your nominations and voting activity')
        .addFields({
          name: '📊 Summary',
          value: 'This feature will show your nomination history, votes cast, and nomination status.',
          inline: false
        })
        .addFields({
          name: '🔄 Coming Soon',
          value: 'Personal nomination tracking is being implemented. Check back soon!',
          inline: false
        })
        .setFooter({ 
          text: 'Use /spotlights nominate to submit new nominations',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting nominations:', error);
      await interaction.editReply({
        content: '❌ Failed to load your nominations. Please try again later.'
      });
    }
  }

  // Helper methods
  private getCategoryEmoji(category: string): string {
    const emojis = {
      top_creator: '👑',
      rising_star: '⭐',
      innovative_game: '🚀',
      community_favorite: '❤️',
      prolific_creator: '🎯'
    };
    return emojis[category as keyof typeof emojis] || '🏅';
  }

  private formatCategory(category: string): string {
    const categories = {
      top_creator: 'Top Creator',
      rising_star: 'Rising Star',
      innovative_game: 'Game Innovator',
      community_favorite: 'Community Favorite',
      prolific_creator: 'Prolific Creator'
    };
    return categories[category as keyof typeof categories] || category;
  }

  private getPeriodBadge(period: string): string {
    const badges = {
      weekly: '🗓️',
      monthly: '📅',
      seasonal: '🍂',
      annual: '🎊'
    };
    return badges[period as keyof typeof badges] || '📋';
  }

  private getCategoryColor(category: string): number {
    const colors = {
      top_creator: 0xffd700,
      rising_star: 0xff6b6b,
      innovative_game: 0x4ecdc4,
      community_favorite: 0xff69b4,
      prolific_creator: 0x9b59b6
    };
    return colors[category as keyof typeof colors] || 0x5865F2;
  }

  private getRankMedal(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    if (rank <= 10) return '🏆';
    return `#${rank}`;
  }
}