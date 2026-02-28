import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { LimitedTimeEventService, LimitedTimeEvent } from '../services/limited-time-events.js';
import { DatabaseService } from '../services/database.js';
import { LiveActivityService } from '../services/live-activity.js';
import { TYPES } from '../types.js';

@injectable()
export class LimitedTimeEventsCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('events')
    .setDescription('Participate in limited-time events, game jams, and competitions')
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('list')
        .setDescription('View all active and upcoming events')
        .addStringOption(option =>
          option
            .setName('filter')
            .setDescription('Filter events by type')
            .setRequired(false)
            .addChoices(
              { name: 'All Events', value: 'all' },
              { name: 'Game Jams', value: 'game_jam' },
              { name: 'Competitions', value: 'competition' },
              { name: 'Template Releases', value: 'template_release' },
              { name: 'Seasonal Events', value: 'seasonal' }
            )
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('info')
        .setDescription('Get detailed information about a specific event')
        .addStringOption(option =>
          option
            .setName('event-id')
            .setDescription('The event ID to view details for')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('register')
        .setDescription('Register for an event')
        .addStringOption(option =>
          option
            .setName('event-id')
            .setDescription('The event ID to register for')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('submit')
        .setDescription('Submit a game to an event')
        .addStringOption(option =>
          option
            .setName('event-id')
            .setDescription('The event ID to submit to')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('game-id')
            .setDescription('The game ID to submit')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Description of your submission and how it fits the theme')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('tags')
            .setDescription('Tags for your submission (comma-separated)')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('leaderboard')
        .setDescription('View event leaderboards and rankings')
        .addStringOption(option =>
          option
            .setName('event-id')
            .setDescription('The event ID to view leaderboard for')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Type of leaderboard to view')
            .setRequired(false)
            .addChoices(
              { name: 'Submissions Count', value: 'submissions' },
              { name: 'Votes Received', value: 'votes' },
              { name: 'Engagement', value: 'engagement' },
              { name: 'Creativity Score', value: 'creativity' }
            )
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('submissions')
        .setDescription('View submissions for an event')
        .addStringOption(option =>
          option
            .setName('event-id')
            .setDescription('The event ID to view submissions for')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('sort')
            .setDescription('How to sort submissions')
            .setRequired(false)
            .addChoices(
              { name: 'Most Recent', value: 'recent' },
              { name: 'Most Votes', value: 'votes' },
              { name: 'Random Order', value: 'random' }
            )
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('templates')
        .setDescription('View exclusive templates available for an event')
        .addStringOption(option =>
          option
            .setName('event-id')
            .setDescription('The event ID to view templates for')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('my-status')
        .setDescription('Check your participation status and submissions for events')
        .addStringOption(option =>
          option
            .setName('event-id')
            .setDescription('Specific event ID (optional, shows all if not specified)')
            .setRequired(false)
        )
    );

  constructor(
    @inject(TYPES.LimitedTimeEventService) private eventService: LimitedTimeEventService,
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.LiveActivityService) private liveActivityService: LiveActivityService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'list':
        await this.handleList(interaction);
        break;
      case 'info':
        await this.handleInfo(interaction);
        break;
      case 'register':
        await this.handleRegister(interaction);
        break;
      case 'submit':
        await this.handleSubmit(interaction);
        break;
      case 'leaderboard':
        await this.handleLeaderboard(interaction);
        break;
      case 'submissions':
        await this.handleSubmissions(interaction);
        break;
      case 'templates':
        await this.handleTemplates(interaction);
        break;
      case 'my-status':
        await this.handleMyStatus(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand',
          ephemeral: true
        });
    }
  }

  private async handleList(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const filter = interaction.options.get('filter', false)?.value as string || 'all';

      const events = await this.eventService.getActiveEvents();
      
      const filteredEvents = filter === 'all' 
        ? events 
        : events.filter(e => e.type === filter);

      if (filteredEvents.length === 0) {
        await interaction.editReply({
          content: `🎪 No ${filter === 'all' ? '' : filter + ' '}events currently active or upcoming.\n\nCheck back later for new events!`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x9333ea)
        .setTitle('🎪 Limited-Time Events')
        .setDescription(`${filteredEvents.length} ${filter === 'all' ? '' : filter + ' '}event${filteredEvents.length !== 1 ? 's' : ''} available`)
        .setFooter({ 
          text: 'Use /events info <event-id> for more details',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add event summaries
      for (const event of filteredEvents.slice(0, 5)) { // Show max 5 events
        const status = this.getEventStatusEmoji(event.status);
        const timeLeft = this.formatTimeRemaining(event.endDate);
        const participants = event.stats.participants;

        embed.addFields({
          name: `${status} ${event.name}`,
          value: `**Type:** ${this.formatEventType(event.type)}\n` +
                 `**Status:** ${event.status}\n` +
                 `**Participants:** ${participants.toLocaleString()}\n` +
                 `**${event.status === 'active' ? 'Ends' : 'Starts'}:** ${timeLeft}\n` +
                 `**ID:** \`${event.id}\``,
          inline: true
        });
      }

      if (filteredEvents.length > 5) {
        embed.addFields({
          name: '📋 More Events',
          value: `... and ${filteredEvents.length - 5} more events available`,
          inline: false
        });
      }

      // Add quick action buttons info
      embed.addFields({
        name: '🚀 Quick Actions',
        value: '• `/events register` - Join an event\n' +
               '• `/events submit` - Submit your game\n' +
               '• `/events leaderboard` - View rankings',
        inline: false
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error listing events:', error);
      await interaction.editReply({
        content: '❌ Failed to load events. Please try again later.'
      });
    }
  }

  private async handleInfo(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const eventId = interaction.options.get('event-id', true).value as string;

      const event = await this.eventService.getEvent(eventId);
      
      if (!event) {
        await interaction.editReply({
          content: '❌ Event not found. Please check the event ID and try again.'
        });
        return;
      }

      const status = this.getEventStatusEmoji(event.status);
      const timeInfo = this.getEventTimeInfo(event);

      const embed = new EmbedBuilder()
        .setColor(this.getEventColor(event.type))
        .setTitle(`${status} ${event.name}`)
        .setDescription(event.description)
        .addFields(
          { 
            name: '📊 Event Details', 
            value: `**Type:** ${this.formatEventType(event.type)}\n` +
                   `**Status:** ${event.status}\n` +
                   `**Difficulty:** ${event.metadata.difficulty}\n` +
                   `**Time Commitment:** ${event.metadata.estimatedTimeCommitment}`,
            inline: true 
          },
          { 
            name: '⏰ Timeline', 
            value: timeInfo,
            inline: true 
          },
          { 
            name: '👥 Participation', 
            value: `**Participants:** ${event.stats.participants.toLocaleString()}\n` +
                   `**Submissions:** ${event.stats.submissions.toLocaleString()}\n` +
                   `${event.maxParticipants ? `**Max Participants:** ${event.maxParticipants.toLocaleString()}\n` : ''}` +
                   `**Avg Rating:** ${event.stats.averageRating > 0 ? event.stats.averageRating.toFixed(1) : 'N/A'}`,
            inline: true 
          }
        );

      // Add requirements if any
      if (Object.keys(event.requirements).length > 0) {
        let requirements = '';
        if (event.requirements.gameType) {
          requirements += `**Game Types:** ${event.requirements.gameType.join(', ')}\n`;
        }
        if (event.requirements.minGames) {
          requirements += `**Min Games Created:** ${event.requirements.minGames}\n`;
        }
        if (event.requirements.creatorTier) {
          requirements += `**Creator Tier:** ${event.requirements.creatorTier.join(', ')}\n`;
        }

        embed.addFields({
          name: '📋 Requirements',
          value: requirements || 'No special requirements',
          inline: false
        });
      }

      // Add rewards
      const rewards = event.rewards;
      let rewardsText = `**Participation:** ${rewards.participation.credits} credits`;
      if (rewards.participation.badge) {
        rewardsText += ` + ${rewards.participation.badge} badge`;
      }
      rewardsText += '\n';

      rewardsText += `**1st Place:** ${rewards.placement.first.credits} credits + ${rewards.placement.first.badge} badge\n`;
      rewardsText += `**2nd Place:** ${rewards.placement.second.credits} credits + ${rewards.placement.second.badge} badge\n`;
      rewardsText += `**3rd Place:** ${rewards.placement.third.credits} credits + ${rewards.placement.third.badge} badge`;

      embed.addFields({
        name: '🏆 Rewards',
        value: rewardsText,
        inline: false
      });

      // Add exclusive content if available
      if (Object.keys(event.exclusiveContent).length > 0) {
        let exclusiveText = '';
        if (event.exclusiveContent.templates) {
          exclusiveText += `**Templates:** ${event.exclusiveContent.templates.length} exclusive\n`;
        }
        if (event.exclusiveContent.themes) {
          exclusiveText += `**Themes:** ${event.exclusiveContent.themes.join(', ')}\n`;
        }
        if (event.exclusiveContent.mechanics) {
          exclusiveText += `**Mechanics:** ${event.exclusiveContent.mechanics.slice(0, 3).join(', ')}`;
        }

        embed.addFields({
          name: '✨ Exclusive Content',
          value: exclusiveText || 'Special content available for participants',
          inline: false
        });
      }

      // Add theme info if available
      if (event.metadata.theme) {
        embed.addFields({
          name: '🎨 Theme',
          value: `**${event.metadata.theme}**\n${event.metadata.inspiration || 'Let your creativity shine!'}`,
          inline: false
        });
      }

      // Add rules (first 3)
      if (event.rules.length > 0) {
        const rulesList = event.rules.slice(0, 3).map((rule, i) => `${i + 1}. ${rule}`).join('\n');
        embed.addFields({
          name: '📜 Rules',
          value: rulesList + (event.rules.length > 3 ? `\n... and ${event.rules.length - 3} more rules` : ''),
          inline: false
        });
      }

      if (event.metadata.bannerImage) {
        embed.setImage(event.metadata.bannerImage);
      }

      embed.setFooter({ 
        text: `Event ID: ${event.id} • Created ${event.createdAt.toLocaleDateString()}`,
        iconURL: interaction.user.displayAvatarURL()
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting event info:', error);
      await interaction.editReply({
        content: '❌ Failed to load event information. Please try again later.'
      });
    }
  }

  private async handleRegister(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const eventId = interaction.options.get('event-id', true).value as string;

      const result = await this.eventService.registerForEvent(
        eventId,
        interaction.user.id,
        interaction.user.username
      );

      if (result.success) {
        const event = await this.eventService.getEvent(eventId);
        
        const embed = new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle('✅ Registration Successful!')
          .setDescription(`You've successfully registered for **${event?.name}**`)
          .addFields(
            { 
              name: '🎉 Welcome to the Event!', 
              value: `You've earned ${event?.rewards.participation.credits} participation credits!`,
              inline: false 
            },
            { 
              name: '🚀 Next Steps', 
              value: '• Create your game using `/create-game`\n' +
                     '• Submit it with `/events submit`\n' +
                     '• Check exclusive templates with `/events templates`',
              inline: false 
            }
          )
          .setFooter({ 
            text: `Event ends: ${event?.endDate.toLocaleString()}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTimestamp();

        if (event?.metadata.bannerImage) {
          embed.setThumbnail(event.metadata.bannerImage);
        }

        await interaction.editReply({
          embeds: [embed]
        });
      } else {
        await interaction.editReply({
          content: `❌ **Registration Failed**\n\n${result.message}`
        });
      }

    } catch (error) {
      console.error('Error registering for event:', error);
      await interaction.editReply({
        content: '❌ Failed to register for event. Please try again later.'
      });
    }
  }

  private async handleSubmit(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const eventId = interaction.options.get('event-id', true).value as string;
      const gameId = interaction.options.get('game-id', true).value as string;
      const description = interaction.options.get('description', true).value as string;
      const tagsString = interaction.options.get('tags', false)?.value as string;

      const tags = tagsString ? tagsString.split(',').map(t => t.trim()) : [];

      const result = await this.eventService.submitToEvent(
        eventId,
        interaction.user.id,
        gameId,
        description,
        tags
      );

      if (result.success) {
        const event = await this.eventService.getEvent(eventId);
        const game = await this.db.getGame(gameId);
        
        const embed = new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle('🎉 Submission Successful!')
          .setDescription(`**${game?.name}** has been submitted to **${event?.name}**`)
          .addFields(
            { 
              name: '🎮 Your Submission', 
              value: `**Game:** ${game?.name}\n**Description:** ${description}`,
              inline: false 
            },
            { 
              name: '🏆 Bonus Earned', 
              value: `You've earned bonus credits for submitting! Good luck!`,
              inline: false 
            }
          );

        if (tags.length > 0) {
          embed.addFields({
            name: '🏷️ Tags',
            value: tags.map(t => `\`${t}\``).join(', '),
            inline: false
          });
        }

        embed.addFields({
          name: '📊 What\'s Next?',
          value: '• Your submission is now live in the event\n' +
                 '• Other participants can view and vote on it\n' +
                 '• Check the leaderboard with `/events leaderboard`',
          inline: false
        });

        embed.setFooter({ 
          text: `Event: ${eventId} • Game: ${game?.shortId}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

        await interaction.editReply({
          embeds: [embed]
        });
      } else {
        await interaction.editReply({
          content: `❌ **Submission Failed**\n\n${result.message}`
        });
      }

    } catch (error) {
      console.error('Error submitting to event:', error);
      await interaction.editReply({
        content: '❌ Failed to submit to event. Please try again later.'
      });
    }
  }

  private async handleLeaderboard(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const eventId = interaction.options.get('event-id', true).value as string;
      const type = interaction.options.get('type', false)?.value as string || 'submissions';

      const event = await this.eventService.getEvent(eventId);
      if (!event) {
        await interaction.editReply({
          content: '❌ Event not found. Please check the event ID and try again.'
        });
        return;
      }

      const leaderboard = await this.eventService.getEventLeaderboard(eventId, type as any);

      if (leaderboard.entries.length === 0) {
        await interaction.editReply({
          content: `📊 No entries yet for **${event.name}** ${type} leaderboard.\n\nBe the first to participate!`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x9333ea)
        .setTitle(`🏆 ${event.name} - ${this.formatLeaderboardType(type)} Leaderboard`)
        .setDescription(`Top performers in the **${this.formatLeaderboardType(type)}** category`)
        .setFooter({ 
          text: `Last updated: ${leaderboard.lastUpdated.toLocaleString()}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add leaderboard entries
      let leaderboardText = '';
      for (let i = 0; i < Math.min(leaderboard.entries.length, 10); i++) {
        const entry = leaderboard.entries[i];
        const medal = this.getRankMedal(entry.rank);
        const badges = entry.badges.length > 0 ? ` ${entry.badges.map(b => this.formatBadge(b)).join('')}` : '';

        leaderboardText += `${medal} **${entry.userName}**${badges}\n`;
        leaderboardText += `   Score: ${entry.score.toLocaleString()}\n\n`;
      }

      embed.addFields({
        name: '📋 Rankings',
        value: leaderboardText || 'No entries to display',
        inline: false
      });

      // Add user's position if they're in the leaderboard
      const userEntry = leaderboard.entries.find(e => e.userId === interaction.user.id);
      if (userEntry && userEntry.rank > 10) {
        embed.addFields({
          name: '👤 Your Position',
          value: `**Rank:** #${userEntry.rank}\n**Score:** ${userEntry.score.toLocaleString()}`,
          inline: true
        });
      }

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting event leaderboard:', error);
      await interaction.editReply({
        content: '❌ Failed to load leaderboard. Please try again later.'
      });
    }
  }

  private async handleSubmissions(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const eventId = interaction.options.get('event-id', true).value as string;
      const sort = interaction.options.get('sort', false)?.value as string || 'recent';

      const event = await this.eventService.getEvent(eventId);
      if (!event) {
        await interaction.editReply({
          content: '❌ Event not found. Please check the event ID and try again.'
        });
        return;
      }

      const submissions = await this.eventService.getEventSubmissions(eventId, sort as any, 10);

      if (submissions.length === 0) {
        await interaction.editReply({
          content: `🎮 No submissions yet for **${event.name}**.\n\nBe the first to submit your game with \`/events submit\`!`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎮 ${event.name} - Submissions`)
        .setDescription(`${submissions.length} submissions (sorted by ${sort})`)
        .setFooter({ 
          text: `Event: ${eventId} • Total submissions: ${event.stats.submissions}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add submissions
      for (const submission of submissions.slice(0, 8)) {
        const votes = submission.votes.total > 0 ? `• ${submission.votes.total} votes` : '';
        const timeAgo = this.formatTimeAgo(submission.submittedAt);
        const awards = submission.awards.length > 0 ? 
          ` ${submission.awards.map(a => this.formatBadge(a)).join('')}` : '';

        embed.addFields({
          name: `🎮 ${submission.gameTitle}${awards}`,
          value: `**By:** ${submission.userId}\n` +
                 `**Description:** ${submission.description.slice(0, 100)}${submission.description.length > 100 ? '...' : ''}\n` +
                 `**Submitted:** ${timeAgo} ${votes}\n` +
                 `**Tags:** ${submission.tags.length > 0 ? submission.tags.map(t => `\`${t}\``).join(', ') : 'None'}`,
          inline: false
        });
      }

      if (submissions.length > 8) {
        embed.addFields({
          name: '📋 More Submissions',
          value: `... and ${submissions.length - 8} more submissions available`,
          inline: false
        });
      }

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting event submissions:', error);
      await interaction.editReply({
        content: '❌ Failed to load submissions. Please try again later.'
      });
    }
  }

  private async handleTemplates(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const eventId = interaction.options.get('event-id', true).value as string;

      const event = await this.eventService.getEvent(eventId);
      if (!event) {
        await interaction.editReply({
          content: '❌ Event not found. Please check the event ID and try again.'
        });
        return;
      }

      const templates = await this.eventService.getEventTemplates(eventId);

      if (templates.length === 0) {
        await interaction.editReply({
          content: `🎨 No exclusive templates available for **${event.name}**.\n\nUse the standard game creation templates instead.`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle(`🎨 ${event.name} - Exclusive Templates`)
        .setDescription(`${templates.length} exclusive template${templates.length !== 1 ? 's' : ''} available for participants`)
        .setFooter({ 
          text: 'These templates are only available during the event period',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add template details
      for (const template of templates.slice(0, 5)) {
        const availability = template.availableUntil > new Date() ? 
          `Available until ${template.availableUntil.toLocaleDateString()}` :
          'Expired';
        
        const usage = template.maxUsage ? 
          `${template.usageCount}/${template.maxUsage} uses` :
          `${template.usageCount} uses`;

        embed.addFields({
          name: `${template.isExclusive ? '✨' : '🎨'} ${template.name}`,
          value: `**Type:** ${template.gameType}\n` +
                 `**Description:** ${template.description}\n` +
                 `**Required Tier:** ${template.requiredTier}\n` +
                 `**Usage:** ${usage}\n` +
                 `**Status:** ${availability}`,
          inline: true
        });
      }

      if (templates.length > 5) {
        embed.addFields({
          name: '📋 More Templates',
          value: `... and ${templates.length - 5} more exclusive templates`,
          inline: false
        });
      }

      // Add instructions
      embed.addFields({
        name: '🚀 How to Use',
        value: 'Use `/create-game` and select the event template option to access these exclusive templates.',
        inline: false
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting event templates:', error);
      await interaction.editReply({
        content: '❌ Failed to load event templates. Please try again later.'
      });
    }
  }

  private async handleMyStatus(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const eventId = interaction.options.get('event-id', false)?.value as string;

      // For now, show a placeholder response since we'd need to implement user status tracking
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('👤 Your Event Status')
        .setDescription('Your participation status across all events')
        .addFields({
          name: '📊 Summary',
          value: 'This feature will show your registration status, submissions, and rankings across all events.',
          inline: false
        })
        .addFields({
          name: '🔄 Coming Soon',
          value: 'User status tracking is being implemented. Check back soon!',
          inline: false
        })
        .setFooter({ 
          text: 'Use /events list to see available events',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting user status:', error);
      await interaction.editReply({
        content: '❌ Failed to load your event status. Please try again later.'
      });
    }
  }

  // Helper methods
  private getEventStatusEmoji(status: string): string {
    const emojis = {
      upcoming: '📅',
      active: '🔥',
      ended: '🏁',
      cancelled: '❌'
    };
    return emojis[status as keyof typeof emojis] || '📋';
  }

  private formatEventType(type: string): string {
    const types = {
      game_jam: 'Game Jam',
      template_release: 'Template Release',
      challenge: 'Challenge',
      competition: 'Competition',
      seasonal: 'Seasonal Event'
    };
    return types[type as keyof typeof types] || type;
  }

  private formatTimeRemaining(date: Date): string {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) {
      return 'Ended';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ${hours}h`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  }

  private getEventTimeInfo(event: LimitedTimeEvent): string {
    const now = new Date();
    let timeInfo = '';

    if (event.status === 'upcoming') {
      timeInfo += `**Starts:** ${this.formatTimeRemaining(event.startDate)}\n`;
    } else if (event.status === 'active') {
      timeInfo += `**Ends:** ${this.formatTimeRemaining(event.endDate)}\n`;
    } else {
      timeInfo += `**Ended:** ${event.endDate.toLocaleDateString()}\n`;
    }

    if (event.registrationDeadline && event.registrationDeadline > now) {
      timeInfo += `**Registration Ends:** ${this.formatTimeRemaining(event.registrationDeadline)}`;
    }

    return timeInfo;
  }

  private getEventColor(type: string): number {
    const colors = {
      game_jam: 0x9333ea,
      template_release: 0xff6b6b,
      challenge: 0xf59e0b,
      competition: 0xef4444,
      seasonal: 0x10b981
    };
    return colors[type as keyof typeof colors] || 0x5865F2;
  }

  private formatLeaderboardType(type: string): string {
    const types = {
      submissions: 'Submissions',
      votes: 'Votes Received',
      engagement: 'Engagement',
      creativity: 'Creativity Score'
    };
    return types[type as keyof typeof types] || type;
  }

  private getRankMedal(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    if (rank <= 10) return '🏆';
    return `#${rank}`;
  }

  private formatBadge(badge: string): string {
    const badges = {
      winter_participant: '❄️',
      winter_champion: '👑',
      winter_runner_up: '🥈',
      winter_finalist: '🥉',
      creative_winter: '🎨',
      champion: '👑',
      runner_up: '🥈',
      bronze: '🥉'
    };
    return badges[badge as keyof typeof badges] || '🏅';
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${minutes}m ago`;
    }
  }
}