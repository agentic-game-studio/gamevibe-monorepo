import { 
  CommandInteraction, 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { ChallengeService } from '../services/challenge.js';
import { DatabaseService } from '../services/database.js';
import { TYPES } from '../types.js';
import { ChallengeType, ChallengeStatus } from '../generated/prisma/index.js';

@injectable()
export class ChallengeCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('Create and manage game challenges')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new challenge')
        .addStringOption(option =>
          option
            .setName('game-id')
            .setDescription('The game ID or short ID to challenge on')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Type of challenge')
            .setRequired(true)
            .addChoices(
              { name: 'Beat My Score', value: 'SCORE_BEAT' },
              { name: 'Speed Run', value: 'SPEED_RUN' },
              { name: 'Direct 1v1', value: 'DIRECT_1V1' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('wager')
            .setDescription('Personal credits to wager (0 for no wager)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(1000)
        )
        .addUserOption(option =>
          option
            .setName('opponent')
            .setDescription('Specific user to challenge (leave blank for open challenge)')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('target-score')
            .setDescription('Target score to beat (for Score Beat challenges)')
            .setRequired(false)
            .setMinValue(1)
        )
        .addIntegerOption(option =>
          option
            .setName('target-time')
            .setDescription('Target time in seconds (for Speed Run challenges)')
            .setRequired(false)
            .setMinValue(1)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Optional challenge description')
            .setRequired(false)
            .setMaxLength(200)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('accept')
        .setDescription('Accept a challenge')
        .addStringOption(option =>
          option
            .setName('challenge-id')
            .setDescription('The challenge ID to accept')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List your active challenges')
        .addStringOption(option =>
          option
            .setName('filter')
            .setDescription('Filter challenges')
            .setRequired(false)
            .addChoices(
              { name: 'All Active', value: 'all' },
              { name: 'Created by Me', value: 'created' },
              { name: 'Received by Me', value: 'received' },
              { name: 'Open Challenges', value: 'open' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View your challenge statistics')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('View your recent challenge history')
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of challenges to show (default: 10)')
            .setRequired(false)
            .setMinValue(5)
            .setMaxValue(25)
        )
    );

  constructor(
    @inject(TYPES.ChallengeService) private challengeService: ChallengeService,
    @inject(TYPES.DatabaseService) private db: DatabaseService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await this.handleCreate(interaction);
        break;
      case 'accept': 
        await this.handleAccept(interaction);
        break;
      case 'list':
        await this.handleList(interaction);
        break;
      case 'stats':
        await this.handleStats(interaction);
        break;
      case 'history':
        await this.handleHistory(interaction);
        break;
    }
  }

  private async handleCreate(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();

    const gameIdInput = interaction.options.get('game-id', true).value as string;
    const challengeType = interaction.options.get('type', true).value as ChallengeType;
    const wagerAmount = interaction.options.get('wager', true).value as number;
    const opponent = interaction.options.get('opponent', false)?.user;
    const targetScore = interaction.options.get('target-score', false)?.value as number;
    const targetTime = interaction.options.get('target-time', false)?.value as number;
    const description = interaction.options.get('description', false)?.value as string;

    try {
      // Find the game
      let game = await this.db.prisma.game.findFirst({
        where: {
          OR: [
            { id: gameIdInput },
            { shortId: gameIdInput }
          ]
        },
        include: {
          creator: true
        }
      });

      if (!game) {
        await interaction.editReply({
          content: '❌ Game not found. Please check the game ID and try again.'
        });
        return;
      }

      // Validate challenge parameters
      if (challengeType === ChallengeType.SCORE_BEAT && !targetScore) {
        await interaction.editReply({
          content: '❌ Score Beat challenges require a target score. Please specify `target-score`.'
        });
        return;
      }

      if (challengeType === ChallengeType.SPEED_RUN && !targetTime) {
        await interaction.editReply({
          content: '❌ Speed Run challenges require a target time. Please specify `target-time` in seconds.'
        });
        return;
      }

      // Can't challenge yourself
      if (opponent && opponent.id === interaction.user.id) {
        await interaction.editReply({
          content: '❌ You cannot challenge yourself!'
        });
        return;
      }

      // Create the challenge
      const challenge = await this.challengeService.createChallenge({
        gameId: game.id,
        challengerId: interaction.user.id,
        challengeeId: opponent?.id,
        type: challengeType,
        wagerAmount,
        targetScore,
        targetTime,
        description,
        serverId: interaction.guildId || undefined
      });

      // Build response embed
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎯 Challenge Created!')
        .setDescription(`Challenge created successfully!`)
        .addFields(
          { name: '🎮 Game', value: game.name, inline: true },
          { name: '⚔️ Type', value: this.formatChallengeType(challengeType), inline: true },
          { name: '💎 Wager', value: `${wagerAmount} credits`, inline: true }
        );

      if (targetScore) {
        embed.addFields({ name: '🎯 Target Score', value: targetScore.toLocaleString(), inline: true });
      }
      
      if (targetTime) {
        embed.addFields({ name: '⏱️ Target Time', value: `${targetTime}s`, inline: true });
      }

      if (opponent) {
        embed.addFields({ name: '👤 Opponent', value: `<@${opponent.id}>`, inline: true });
      } else {
        embed.addFields({ name: '👥 Type', value: 'Open Challenge', inline: true });
      }

      if (description) {
        embed.addFields({ name: '📝 Description', value: description, inline: false });
      }

      embed.addFields(
        { name: '🆔 Challenge ID', value: `\`${challenge.id}\``, inline: false },
        { name: '⏰ Expires', value: `<t:${Math.floor(challenge.expiresAt.getTime() / 1000)}:R>`, inline: false }
      );

      // Add action buttons
      const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`challenge_view_${challenge.id}`)
            .setLabel('View Challenge')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👁️')
        );

      if (!opponent) {
        buttons.addComponents(
          new ButtonBuilder()
            .setCustomId(`challenge_accept_${challenge.id}`)
            .setLabel('Accept Challenge')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚔️')
        );
      }

      await interaction.editReply({
        embeds: [embed],
        components: [buttons]
      });

    } catch (error) {
      console.error('Error creating challenge:', error);
      await interaction.editReply({
        content: `❌ Failed to create challenge: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async handleAccept(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();

    const challengeId = interaction.options.get('challenge-id', true).value as string;

    try {
      const challenge = await this.challengeService.acceptChallenge(challengeId, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Challenge Accepted!')
        .setDescription('You have successfully accepted the challenge. Good luck!')
        .addFields(
          { name: '🆔 Challenge ID', value: `\`${challengeId}\``, inline: true },
          { name: '💎 Wager', value: `${challenge.wagerAmount} credits`, inline: true }
        )
        .setFooter({ text: 'Play the game and your score will be automatically submitted!' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error accepting challenge:', error);
      await interaction.editReply({
        content: `❌ Failed to accept challenge: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async handleList(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();

    const filter = interaction.options.get('filter', false)?.value as string || 'all';

    try {
      const challenges = await this.challengeService.getUserActiveChallenges(interaction.user.id);

      if (challenges.length === 0) {
        await interaction.editReply({
          content: '📭 You have no active challenges. Create one with `/challenge create`!'
        });
        return;
      }

      // Filter challenges based on request
      let filteredChallenges = challenges;
      let title = '🎯 Your Active Challenges';

      switch (filter) {
        case 'created':
          filteredChallenges = challenges.filter(c => c.challenger.discordId === interaction.user.id);
          title = '🎯 Challenges You Created';
          break;
        case 'received':
          filteredChallenges = challenges.filter(c => c.challengee?.discordId === interaction.user.id);
          title = '🎯 Challenges You Received';
          break;
        case 'open':
          filteredChallenges = challenges.filter(c => !c.challengeeId && c.challenger.discordId !== interaction.user.id);
          title = '🎯 Open Challenges';
          break;
      }

      if (filteredChallenges.length === 0) {
        await interaction.editReply({
          content: `📭 No challenges found for filter: ${filter}`
        });
        return;
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(title)
        .setDescription(`Showing ${filteredChallenges.length} active challenge${filteredChallenges.length !== 1 ? 's' : ''}`);

      // Add challenge fields (limit to 10)
      filteredChallenges.slice(0, 10).forEach((challenge, index) => {
        const statusIcon = challenge.status === ChallengeStatus.PENDING ? '⏳' : '⚔️';
        const opponentName = challenge.challengee 
          ? challenge.challengee.username 
          : 'Open';
        
        const challengeInfo = [
          `${statusIcon} **${this.formatChallengeType(challenge.type)}**`,
          `🎮 ${challenge.game.name}`,
          `👤 vs ${opponentName}`,
          `💎 ${challenge.wagerAmount} credits`,
          `🆔 \`${challenge.id.slice(-8)}\``
        ].join('\n');

        embed.addFields({
          name: `${index + 1}. ${challenge.game.name}`,
          value: challengeInfo,
          inline: true
        });
      });

      if (filteredChallenges.length > 10) {
        embed.setFooter({ text: `Showing first 10 of ${filteredChallenges.length} challenges` });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error listing challenges:', error);
      await interaction.editReply({
        content: '❌ Failed to list challenges. Please try again later.'
      });
    }
  }

  private async handleStats(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const stats = await this.challengeService.getUserChallengeStats(interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 Your Challenge Statistics')
        .setDescription(`Challenge performance for <@${interaction.user.id}>`)
        .addFields(
          {
            name: '🏆 Overall Record',
            value: [
              `**Total Challenges:** ${stats.totalChallenges}`,
              `**Wins:** ${stats.challengesWon} 🟢`,
              `**Losses:** ${stats.challengesLost} 🔴`,
              `**Draws:** ${stats.challengesDrawn} 🟡`,
              `**Win Rate:** ${stats.winRate.toFixed(1)}%`
            ].join('\n'),
            inline: true
          },
          {
            name: '💎 Credit Performance',
            value: [
              `**Credits Won:** +${stats.totalCreditsWon.toLocaleString()}`,
              `**Credits Lost:** -${stats.totalCreditsLost.toLocaleString()}`,
              `**Net Profit:** ${(stats.totalCreditsWon - stats.totalCreditsLost).toLocaleString()}`,
              `**Avg Challenge Value:** ${stats.avgChallengeValue.toFixed(1)}`
            ].join('\n'),
            inline: true
          },
          {
            name: '📈 Activity',
            value: [
              `**Active Challenges:** ${stats.activeChallenges}`,
              `**Favorite Game Type:** ${stats.favoriteGameType}`,
              `**Risk Level:** ${this.getRiskLevel(stats.avgChallengeValue)}`
            ].join('\n'),
            inline: true
          }
        );

      // Add performance indicators
      if (stats.winRate >= 70) {
        embed.addFields({ name: '🔥 Status', value: 'Dominating! Keep up the great work!', inline: false });
      } else if (stats.winRate >= 50) {  
        embed.addFields({ name: '⚡ Status', value: 'Solid performer! Room for improvement.', inline: false });
      } else if (stats.totalChallenges > 5) {
        embed.addFields({ name: '📚 Status', value: 'Learning phase. Practice makes perfect!', inline: false });
      }

      // Add credit profit indicator
      const netProfit = stats.totalCreditsWon - stats.totalCreditsLost;
      if (netProfit > 0) {
        embed.setColor(0x00FF00); // Green for profit
      } else if (netProfit < 0) {
        embed.setColor(0xFF0000); // Red for loss
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error getting challenge stats:', error);
      await interaction.editReply({
        content: '❌ Failed to get challenge statistics. Please try again later.'
      });
    }
  }

  private async handleHistory(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();

    const limit = interaction.options.get('limit', false)?.value as number || 10;

    try {
      // Get user's internal ID
      const user = await this.db.prisma.user.findUnique({
        where: { discordId: interaction.user.id }
      });

      if (!user) {
        await interaction.editReply({
          content: '❌ User not found in database.'
        });
        return;
      }

      // Get recent completed challenges
      const challenges = await this.db.prisma.challenge.findMany({
        where: {
          OR: [
            { challengerId: user.id },
            { challengeeId: user.id }
          ],
          status: ChallengeStatus.COMPLETED
        },
        include: {
          game: {
            select: {
              name: true,
              type: true
            }
          },
          challenger: {
            select: {
              discordId: true,
              username: true
            }
          },
          challengee: {
            select: {
              discordId: true,
              username: true
            }
          },
          results: {
            select: {
              winnerId: true,
              isDraw: true,
              creditsTransferred: true,
              winnerScore: true,
              loserScore: true
            }
          }
        },
        orderBy: {
          completedAt: 'desc'
        },
        take: limit
      });

      if (challenges.length === 0) {
        await interaction.editReply({
          content: '📭 You have no completed challenges yet. Start challenging others with `/challenge create`!'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📚 Your Challenge History')
        .setDescription(`Your last ${challenges.length} completed challenge${challenges.length !== 1 ? 's' : ''}`);

      challenges.forEach((challenge, index) => {
        const result = challenge.results[0];
        const isWinner = result && result.winnerId === user.id;
        const isDraw = result?.isDraw || false;
        
        let statusIcon = '🟡';
        let statusText = 'Draw';
        let creditChange = '';
        
        if (!isDraw) {
          if (isWinner) {
            statusIcon = '🏆';
            statusText = 'Won';
            creditChange = result ? `+${result.creditsTransferred}` : '';
          } else {
            statusIcon = '😔';
            statusText = 'Lost';
            creditChange = challenge.wagerAmount > 0 ? `-${challenge.wagerAmount}` : '';
          }
        }

        const opponent = challenge.challenger.discordId === interaction.user.id 
          ? challenge.challengee?.username || 'Unknown'
          : challenge.challenger.username;

        const challengeInfo = [
          `${statusIcon} **${statusText}** vs ${opponent}`,
          `🎮 ${challenge.game.name}`,
          `⚔️ ${this.formatChallengeType(challenge.type)}`,
          creditChange ? `💎 ${creditChange}` : '💎 No wager',
          `📅 <t:${Math.floor((challenge.completedAt || new Date()).getTime() / 1000)}:R>`
        ].join('\n');

        embed.addFields({
          name: `${index + 1}. ${challenge.game.name}`,
          value: challengeInfo,
          inline: true
        });
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error getting challenge history:', error);
      await interaction.editReply({
        content: '❌ Failed to get challenge history. Please try again later.'
      });
    }
  }

  /**
   * Helper methods
   */
  private formatChallengeType(type: ChallengeType): string {
    const typeMap = {
      SCORE_BEAT: 'Beat My Score',
      SPEED_RUN: 'Speed Run', 
      DIRECT_1V1: 'Direct 1v1'
    };
    return typeMap[type] || type;
  }

  private getRiskLevel(avgWager: number): string {
    if (avgWager === 0) return 'No Risk 🟢';
    if (avgWager < 10) return 'Low Risk 🟡';
    if (avgWager < 50) return 'Medium Risk 🟠';
    return 'High Risk 🔴';
  }
}