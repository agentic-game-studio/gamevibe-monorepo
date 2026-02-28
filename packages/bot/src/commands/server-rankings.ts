import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { ServerRankingService, ServerRankingMetrics } from '../services/server-rankings.js';
import { DatabaseService } from '../services/database.js';
import { LiveActivityService } from '../services/live-activity.js';
import { TYPES } from '../types.js';

@injectable()
export class ServerRankingsCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('server-rankings')
    .setDescription('View server rankings and leaderboards for gaming communities')
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('leaderboard')
        .setDescription('View top servers in various categories')
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Ranking category to display')
            .setRequired(false)
            .addChoices(
              { name: 'Overall - Community health and activity', value: 'overall' },
              { name: 'Creative - Most games created', value: 'creative' },
              { name: 'Engagement - Highest play rates', value: 'engagement' },
              { name: 'Viral - Cross-server reach', value: 'viral' },
              { name: 'Growth - Recent activity', value: 'growth' },
              { name: 'Diversity - Game type variety', value: 'diversity' }
            )
        )
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('Time period for rankings')
            .setRequired(false)
            .addChoices(
              { name: 'This Week', value: 'week' },
              { name: 'This Month', value: 'month' },
              { name: 'All Time', value: 'all' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of servers to show (1-25)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('my-server')
        .setDescription('View this server\'s ranking and detailed metrics')
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Ranking category to check')
            .setRequired(false)
            .addChoices(
              { name: 'Overall', value: 'overall' },
              { name: 'Creative', value: 'creative' },
              { name: 'Engagement', value: 'engagement' },
              { name: 'Viral', value: 'viral' },
              { name: 'Growth', value: 'growth' },
              { name: 'Diversity', value: 'diversity' }
            )
        )
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('Time period for ranking')
            .setRequired(false)
            .addChoices(
              { name: 'This Week', value: 'week' },
              { name: 'This Month', value: 'month' },
              { name: 'All Time', value: 'all' }
            )
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('compare')
        .setDescription('Compare two servers side by side')
        .addStringOption(option =>
          option
            .setName('server-b')
            .setDescription('Second server ID to compare with')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('server-a')
            .setDescription('First server ID (leave empty for current server)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('Time period for comparison')
            .setRequired(false)
            .addChoices(
              { name: 'This Week', value: 'week' },
              { name: 'This Month', value: 'month' },
              { name: 'All Time', value: 'all' }
            )
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('trending')
        .setDescription('View servers with the biggest ranking changes')
        .addStringOption(option =>
          option
            .setName('direction')
            .setDescription('Movement direction to show')
            .setRequired(false)
            .addChoices(
              { name: 'Rising - Biggest climbers', value: 'up' },
              { name: 'Falling - Biggest drops', value: 'down' },
              { name: 'Both - All movers', value: 'both' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of servers to show (1-20)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('stats')
        .setDescription('View overall ranking statistics and insights')
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('Time period for statistics')
            .setRequired(false)
            .addChoices(
              { name: 'This Week', value: 'week' },
              { name: 'This Month', value: 'month' },
              { name: 'All Time', value: 'all' }
            )
        )
    );

  constructor(
    @inject(TYPES.ServerRankingService) private serverRankingService: ServerRankingService,
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.LiveActivityService) private liveActivityService: LiveActivityService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'leaderboard':
        await this.handleLeaderboard(interaction);
        break;
      case 'my-server':
        await this.handleMyServer(interaction);
        break;
      case 'compare':
        await this.handleCompare(interaction);
        break;
      case 'trending':
        await this.handleTrending(interaction);
        break;
      case 'stats':
        await this.handleStats(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand',
          ephemeral: true
        });
    }
  }

  private async handleLeaderboard(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const category = interaction.options.get('category', false)?.value as string || 'overall';
      const timeframe = interaction.options.get('timeframe', false)?.value as string || 'month';
      const limit = interaction.options.get('limit', false)?.value as number || 10;

      const rankings = await this.serverRankingService.getServerRankings(
        category as any,
        limit,
        timeframe as any
      );

      // Record activity
      await this.liveActivityService.recordActivity(
        'RANKINGS_VIEWED',
        interaction.user.id,
        {
          category,
          timeframe,
          serverCount: rankings.servers.length
        },
        interaction.guildId || undefined
      );

      if (rankings.servers.length === 0) {
        await interaction.editReply({
          content: `📊 No servers found for **${category}** rankings in the selected timeframe.`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🏆 ${rankings.title}`)
        .setDescription(`${rankings.description}\n\n**Timeframe:** ${this.formatTimeframe(timeframe)}`)
        .setFooter({ 
          text: `Showing top ${rankings.servers.length} servers • Updated every 15 minutes`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add server entries
      let leaderboardText = '';
      for (let i = 0; i < Math.min(rankings.servers.length, limit); i++) {
        const server = rankings.servers[i];
        const medal = this.getRankMedal(server.rank);
        const rankChange = this.formatRankChange(server.rankChange, server.previousRank);
        const score = this.getCategoryDisplayScore(server, category);

        leaderboardText += `${medal} **${server.serverName}** ${rankChange}\n`;
        leaderboardText += `   ${score} • ${server.totalGames} games • ${server.totalPlays} plays\n\n`;
      }

      embed.addFields({
        name: '📋 Rankings',
        value: leaderboardText || 'No servers to display',
        inline: false
      });

      // Add category explanation
      embed.addFields({
        name: '📊 Category Details',
        value: this.getCategoryExplanation(category),
        inline: false
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting server leaderboard:', error);
      await interaction.editReply({
        content: '❌ Failed to get server rankings. Please try again later.'
      });
    }
  }

  private async handleMyServer(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    if (!interaction.guildId) {
      await interaction.editReply({
        content: '❌ This command can only be used in a server.'
      });
      return;
    }

    try {
      const category = interaction.options.get('category', false)?.value as string || 'overall';
      const timeframe = interaction.options.get('timeframe', false)?.value as string || 'month';

      const serverRanking = await this.serverRankingService.getServerRanking(
        interaction.guildId,
        category as any,
        timeframe as any
      );

      if (!serverRanking) {
        await interaction.editReply({
          content: `📊 Your server hasn't been ranked yet in the **${category}** category.\n\nCreate some games to start appearing in the rankings!`
        });
        return;
      }

      const rankChange = this.formatRankChange(serverRanking.rankChange, serverRanking.previousRank);
      const score = this.getCategoryDisplayScore(serverRanking, category);

      const embed = new EmbedBuilder()
        .setColor(this.getRankColor(serverRanking.rank))
        .setTitle(`🏆 ${serverRanking.serverName} Rankings`)
        .setDescription(`**Category:** ${this.formatCategory(category)}\n**Timeframe:** ${this.formatTimeframe(timeframe)}`)
        .addFields(
          { 
            name: '🎯 Current Rank', 
            value: `#${serverRanking.rank} ${rankChange}`, 
            inline: true 
          },
          { 
            name: '📊 Score', 
            value: score, 
            inline: true 
          },
          { 
            name: '👥 Members', 
            value: serverRanking.memberCount.toLocaleString(), 
            inline: true 
          },
          { 
            name: '🎮 Total Games', 
            value: serverRanking.totalGames.toLocaleString(), 
            inline: true 
          },
          { 
            name: '▶️ Total Plays', 
            value: serverRanking.totalPlays.toLocaleString(), 
            inline: true 
          },
          { 
            name: '👤 Creators', 
            value: `${serverRanking.activeCreators}/${serverRanking.totalCreators}`, 
            inline: true 
          },
          { 
            name: '📈 Engagement Rate', 
            value: `${serverRanking.engagementRate}%`, 
            inline: true 
          },
          { 
            name: '🌟 Viral Score', 
            value: `${serverRanking.viralScore}/100`, 
            inline: true 
          },
          { 
            name: '🎨 Diversity Score', 
            value: `${serverRanking.diversityScore}/100`, 
            inline: true 
          }
        )
        .setFooter({ 
          text: `Last updated: ${serverRanking.lastUpdated.toLocaleString()}`,
          iconURL: interaction.guild?.iconURL() || undefined
        })
        .setTimestamp();

      // Add improvement suggestions
      const suggestions = this.generateImprovementSuggestions(serverRanking);
      if (suggestions.length > 0) {
        embed.addFields({
          name: '💡 Improvement Suggestions',
          value: suggestions.join('\n'),
          inline: false
        });
      }

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting server ranking:', error);
      await interaction.editReply({
        content: '❌ Failed to get your server\'s ranking. Please try again later.'
      });
    }
  }

  private async handleCompare(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const serverAId = interaction.options.get('server-a', false)?.value as string || interaction.guildId;
      const serverBId = interaction.options.get('server-b', true).value as string;
      const timeframe = interaction.options.get('timeframe', false)?.value as string || 'month';

      if (!serverAId) {
        await interaction.editReply({
          content: '❌ Please specify a server ID or use this command in a server.'
        });
        return;
      }

      if (serverAId === serverBId) {
        await interaction.editReply({
          content: '❌ Cannot compare a server with itself.'
        });
        return;
      }

      const comparison = await this.serverRankingService.compareServers(
        serverAId,
        serverBId,
        timeframe as any
      );

      if (!comparison) {
        await interaction.editReply({
          content: '❌ One or both servers not found in rankings or have insufficient data.'
        });
        return;
      }

      const { serverA, serverB, differences, overallWinner, recommendations } = comparison;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚡ Server Comparison')
        .setDescription(`**${serverA.serverName}** vs **${serverB.serverName}**\n**Timeframe:** ${this.formatTimeframe(timeframe)}`)
        .addFields(
          { 
            name: '🏆 Overall Winner', 
            value: overallWinner === 'A' ? serverA.serverName : 
                   overallWinner === 'B' ? serverB.serverName : 'Tie', 
            inline: false 
          }
        )
        .setFooter({ 
          text: 'Comparison based on overall community metrics',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add comparison metrics
      let comparisonText = '';
      for (const diff of differences) {
        const winner = diff.betterServer === 'A' ? '🔵' : diff.betterServer === 'B' ? '🔴' : '⚪';
        comparisonText += `${winner} **${diff.metric}**\n`;
        comparisonText += `   ${serverA.serverName}: ${diff.valueA.toLocaleString()}\n`;
        comparisonText += `   ${serverB.serverName}: ${diff.valueB.toLocaleString()}\n\n`;
      }

      embed.addFields({
        name: '📊 Detailed Comparison',
        value: comparisonText,
        inline: false
      });

      // Add recommendations
      if (recommendations.length > 0) {
        embed.addFields({
          name: '💡 Recommendations',
          value: recommendations.join('\n'),
          inline: false
        });
      }

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error comparing servers:', error);
      await interaction.editReply({
        content: '❌ Failed to compare servers. Please try again later.'
      });
    }
  }

  private async handleTrending(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const direction = interaction.options.get('direction', false)?.value as string || 'up';
      const limit = interaction.options.get('limit', false)?.value as number || 10;

      const trending = await this.serverRankingService.getTrendingServers(
        direction as any,
        limit
      );

      if (trending.length === 0) {
        await interaction.editReply({
          content: `📈 No trending servers found for ${direction === 'up' ? 'rising' : direction === 'down' ? 'falling' : 'moving'} rankings.`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(direction === 'up' ? 0x00ff88 : direction === 'down' ? 0xff4444 : 0x5865F2)
        .setTitle(`📈 Trending Servers - ${direction === 'up' ? 'Rising' : direction === 'down' ? 'Falling' : 'All Movers'}`)
        .setDescription('Servers with the biggest ranking changes this month')
        .setFooter({ 
          text: `Showing ${trending.length} trending servers`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      let trendingText = '';
      for (let i = 0; i < trending.length; i++) {
        const server = trending[i];
        const rankChange = this.formatRankChange(server.rankChange, server.previousRank);
        const changeAmount = server.previousRank ? Math.abs(server.previousRank - server.rank) : 0;
        
        trendingText += `**${i + 1}.** ${server.serverName} ${rankChange}\n`;
        trendingText += `   Rank #${server.rank} (${changeAmount > 0 ? `±${changeAmount}` : 'New'}) • ${server.communityScore} score\n\n`;
      }

      embed.addFields({
        name: '🔥 Trending Servers',
        value: trendingText,
        inline: false
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting trending servers:', error);
      await interaction.editReply({
        content: '❌ Failed to get trending servers. Please try again later.'
      });
    }
  }

  private async handleStats(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const timeframe = interaction.options.get('timeframe', false)?.value as string || 'month';

      const stats = await this.serverRankingService.getRankingStats(timeframe as any);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 Server Rankings Statistics')
        .setDescription(`Overall statistics for **${this.formatTimeframe(timeframe)}**`)
        .addFields(
          { 
            name: '🏢 Total Servers', 
            value: stats.totalServers.toLocaleString(), 
            inline: true 
          },
          { 
            name: '🟢 Active Servers', 
            value: stats.totalActiveServers.toLocaleString(), 
            inline: true 
          },
          { 
            name: '🎮 Avg Games/Server', 
            value: stats.averageGamesPerServer.toString(), 
            inline: true 
          },
          { 
            name: '📈 New Games', 
            value: stats.weeklyGrowth.newGames.toLocaleString(), 
            inline: true 
          },
          { 
            name: '⏰ Peak Hour', 
            value: `${stats.mostActiveHour}:00 UTC`, 
            inline: true 
          },
          { 
            name: '🌍 Top Region', 
            value: stats.topPerformingRegion, 
            inline: true 
          }
        )
        .setFooter({ 
          text: `Statistics for ${stats.timeframe} • Updated every 15 minutes`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add category leaders
      let leadersText = '';
      const categoryEmojis = {
        creative: '🎨',
        engagement: '📈',
        viral: '🌟',
        growth: '📊',
        diversity: '🎭'
      };

      for (const [category, leader] of Object.entries(stats.categoryLeaders)) {
        const emoji = categoryEmojis[category as keyof typeof categoryEmojis] || '🏆';
        leadersText += `${emoji} **${this.formatCategory(category)}:** ${leader.serverName}\n`;
      }

      if (leadersText) {
        embed.addFields({
          name: '👑 Category Leaders',
          value: leadersText,
          inline: false
        });
      }

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting ranking stats:', error);
      await interaction.editReply({
        content: '❌ Failed to get ranking statistics. Please try again later.'
      });
    }
  }

  private getRankMedal(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    if (rank <= 10) return '🏆';
    if (rank <= 25) return '⭐';
    return '📊';
  }

  private formatRankChange(
    change: 'up' | 'down' | 'same' | 'new',
    previousRank?: number | null
  ): string {
    switch (change) {
      case 'up': return '📈';
      case 'down': return '📉';
      case 'new': return '🆕';
      default: return '➖';
    }
  }

  private getCategoryDisplayScore(server: ServerRankingMetrics, category: string): string {
    switch (category) {
      case 'creative':
        return `${server.totalGames} games`;
      case 'engagement':
        return `${server.engagementRate}% engagement`;
      case 'viral':
        return `${server.viralScore}/100 viral`;
      case 'growth':
        return `${server.gamesThisMonth} this month`;
      case 'diversity':
        return `${server.diversityScore}/100 diversity`;
      default:
        return `${server.communityScore}/100 community`;
    }
  }

  private getCategoryExplanation(category: string): string {
    const explanations = {
      overall: 'Weighted score combining viral reach, engagement, diversity, and activity',
      creative: 'Total number of games created by server members',
      engagement: 'Average plays per game created (play-to-creation ratio)',
      viral: 'How well server content spreads to other servers',
      growth: 'Recent activity and new content creation',
      diversity: 'Variety of different game types created'
    };
    return explanations[category as keyof typeof explanations] || 'Server performance metric';
  }

  private formatCategory(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  private formatTimeframe(timeframe: string): string {
    switch (timeframe) {
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'all': return 'All Time';
      default: return 'This Month';
    }
  }

  private getRankColor(rank: number): number {
    if (rank === 1) return 0xffd700; // Gold
    if (rank <= 3) return 0xc0c0c0; // Silver
    if (rank <= 10) return 0xcd7f32; // Bronze
    return 0x5865F2; // Default
  }

  private generateImprovementSuggestions(server: ServerRankingMetrics): string[] {
    const suggestions: string[] = [];

    if (server.engagementRate < 5) {
      suggestions.push('• Encourage more game sharing to boost engagement rates');
    }

    if (server.viralScore < 30) {
      suggestions.push('• Use `/share` command to increase cross-server reach');
    }

    if (server.diversityScore < 60) {
      suggestions.push('• Try creating different types of games (puzzle, RPG, shooter, etc.)');
    }

    if (server.activeCreators < 3) {
      suggestions.push('• Encourage more members to try game creation');
    }

    if (server.gamesThisMonth === 0) {
      suggestions.push('• Create some new games to improve growth metrics');
    }

    return suggestions.slice(0, 3); // Max 3 suggestions
  }
}