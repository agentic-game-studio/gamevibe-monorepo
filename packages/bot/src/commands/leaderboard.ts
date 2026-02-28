import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { LeaderboardService } from '../services/leaderboard.js';
import { DatabaseService } from '../services/database.js';
import { TYPES } from '../types.js';
import { generateGameEmoji } from '@gamevibe/shared';

@injectable()
export class LeaderboardCommand implements Command {
  public data: SlashCommandBuilder;

  constructor(
    @inject(TYPES.LeaderboardService) private leaderboardService: LeaderboardService,
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService
  ) {
    this.data = new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('View game leaderboards')
      .addSubcommand(subcommand =>
        subcommand
          .setName('game')
          .setDescription('View leaderboard for a specific game')
          .addStringOption(option =>
            option
              .setName('game_id')
              .setDescription('The game ID or short ID')
              .setRequired(true)
          )
          .addIntegerOption(option =>
            option
              .setName('page')
              .setDescription('Page number (10 entries per page)')
              .setMinValue(1)
              .setMaxValue(10)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('global')
          .setDescription('View global high scores across all games')
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('my-stats')
          .setDescription('View your personal gaming statistics')
      ) as SlashCommandBuilder;
  }

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'game':
        await this.showGameLeaderboard(interaction);
        break;
      case 'global':
        await this.showGlobalLeaderboard(interaction);
        break;
      case 'my-stats':
        await this.showUserStats(interaction);
        break;
    }
  }

  private async showGameLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const gameIdOrShortId = interaction.options.getString('game_id', true);
    const page = interaction.options.getInteger('page') || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    try {
      // Find game by ID or short ID
      const game = await this.databaseService.prisma.game.findFirst({
        where: {
          OR: [
            { id: gameIdOrShortId },
            { shortId: gameIdOrShortId }
          ]
        }
      });

      if (!game) {
        await interaction.editReply('❌ Game not found!');
        return;
      }

      // Get leaderboard and stats
      const [entries, stats, userRank] = await Promise.all([
        this.leaderboardService.getLeaderboard(game.id, limit, offset),
        this.leaderboardService.getLeaderboardStats(game.id),
        this.leaderboardService.getUserRank(game.id, interaction.user.id)
      ]);

      if (entries.length === 0) {
        await interaction.editReply(`📊 No scores recorded for **${game.name}** yet. Be the first to play!`);
        return;
      }

      // Create embed
      const emoji = generateGameEmoji(game.type);
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(`${emoji} ${game.name} - Leaderboard`)
        .setDescription(`Page ${page} • ${stats.totalPlayers} total players`)
        .setFooter({ text: `Game ID: ${game.shortId}` })
        .setTimestamp();

      // Add leaderboard entries
      const leaderboardText = entries.map((entry, index) => {
        const rank = offset + index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
        const isUser = entry.user.discordId === interaction.user.id;
        const username = isUser ? `**${entry.user.username}**` : entry.user.username;
        return `${medal} ${username} - **${entry.score.toLocaleString()}** points`;
      }).join('\n');

      embed.addFields({
        name: '🏆 Top Players',
        value: leaderboardText || 'No entries'
      });

      // Add stats
      embed.addFields({
        name: '📊 Statistics',
        value: [
          `👑 High Score: **${stats.highestScore.toLocaleString()}**`,
          `📈 Average Score: **${stats.averageScore.toLocaleString()}**`,
          userRank ? `🎯 Your Rank: **#${userRank}**` : '🎯 You haven\'t played this game yet'
        ].join('\n'),
        inline: true
      });

      // Add recent players
      if (stats.recentEntries.length > 0) {
        const recentText = stats.recentEntries
          .slice(0, 3)
          .map(entry => `${entry.user.username} - ${entry.score.toLocaleString()}`)
          .join('\n');
        
        embed.addFields({
          name: '🕐 Recent Players',
          value: recentText,
          inline: true
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error showing game leaderboard:', error);
      await interaction.editReply('❌ Failed to load leaderboard. Please try again.');
    }
  }

  private async showGlobalLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const entries = await this.leaderboardService.getGlobalLeaderboard(10);

      if (entries.length === 0) {
        await interaction.editReply('📊 No scores recorded yet across any games!');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🌟 Global High Scores')
        .setDescription('Top scores across all GameVibe games')
        .setTimestamp();

      const leaderboardText = entries.map((entry, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
        const gameEmoji = generateGameEmoji(entry.game.type);
        const isUser = entry.user.discordId === interaction.user.id;
        const username = isUser ? `**${entry.user.username}**` : entry.user.username;
        return `${medal} ${username} - **${entry.score.toLocaleString()}** points\n   ${gameEmoji} ${entry.game.name}`;
      }).join('\n\n');

      embed.addFields({
        name: '🏆 Hall of Fame',
        value: leaderboardText
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error showing global leaderboard:', error);
      await interaction.editReply('❌ Failed to load global leaderboard. Please try again.');
    }
  }

  private async showUserStats(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const stats = await this.leaderboardService.getUserStats(interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(`📊 ${interaction.user.username}'s Gaming Stats`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

      // Overall stats
      embed.addFields({
        name: '🎮 Overall Performance',
        value: [
          `🎯 Games Played: **${stats.totalGamesPlayed}**`,
          `💯 Total Score: **${stats.totalScore.toLocaleString()}**`,
          `🏆 Best Score: **${stats.bestScore.toLocaleString()}**`,
          `📊 Average Score: **${stats.averageScore.toLocaleString()}**`
        ].join('\n')
      });

      // Recent games
      if (stats.recentGames.length > 0) {
        const recentText = stats.recentGames.map(entry => {
          const emoji = generateGameEmoji(entry.game.type);
          const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';
          return `${emoji} **${entry.game.name}** ${medal}\n   Score: ${entry.score.toLocaleString()} • Rank: #${entry.rank}`;
        }).join('\n\n');

        embed.addFields({
          name: '🕐 Recent Games',
          value: recentText
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error showing user stats:', error);
      await interaction.editReply('❌ Failed to load your stats. Play some games first!');
    }
  }
}