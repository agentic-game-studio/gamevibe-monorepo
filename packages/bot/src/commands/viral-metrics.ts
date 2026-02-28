import { injectable, inject } from 'inversify';
import { 
  CommandInteraction, 
  SlashCommandBuilder, 
  EmbedBuilder, 
  PermissionFlagsBits,
  ChatInputCommandInteraction
} from 'discord.js';
import { TYPES } from '../types.js';
import { ViralMetricsService, ViralMetrics, TimeframeSummary } from '../services/viral-metrics.js';
import { Command } from './index.js';

@injectable()
export class ViralMetricsCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('viral-metrics')
    .setDescription('View viral growth metrics and analytics')
    .addSubcommand(subcommand =>
      subcommand
        .setName('dashboard')
        .setDescription('View comprehensive viral metrics dashboard')
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('Time period to analyze')
            .setRequired(false)
            .addChoices(
              { name: '24 Hours', value: '1' },
              { name: '7 Days', value: '7' },
              { name: '30 Days', value: '30' },
              { name: '90 Days', value: '90' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('coefficient')
        .setDescription('View viral coefficient analysis')
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('Time period to analyze')
            .setRequired(false)
            .addChoices(
              { name: '7 Days', value: '7' },
              { name: '30 Days', value: '30' },
              { name: '90 Days', value: '90' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('growth')
        .setDescription('View growth metrics and trends')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('content')
        .setDescription('View content virality metrics')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('leaderboard')
        .setDescription('View top viral performers')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Type of leaderboard')
            .setRequired(false)
            .addChoices(
              { name: 'Viral Creators', value: 'creators' },
              { name: 'Viral Servers', value: 'servers' },
              { name: 'Viral Games', value: 'games' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('predictions')
        .setDescription('View growth predictions and recommendations')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

  constructor(
    @inject(TYPES.ViralMetricsService) private viralMetricsService: ViralMetricsService
  ) {}

  public async execute(interaction: CommandInteraction): Promise<void> {
    const chatInteraction = interaction as ChatInputCommandInteraction;
    const subcommand = chatInteraction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'dashboard':
          await this.handleDashboard(chatInteraction);
          break;
        case 'coefficient':
          await this.handleCoefficient(chatInteraction);
          break;
        case 'growth':
          await this.handleGrowth(chatInteraction);
          break;
        case 'content':
          await this.handleContent(chatInteraction);
          break;
        case 'leaderboard':
          await this.handleLeaderboard(chatInteraction);
          break;
        case 'predictions':
          await this.handlePredictions(chatInteraction);
          break;
        default:
          await chatInteraction.reply({
            content: '❌ Unknown subcommand.',
            ephemeral: true
          });
      }
    } catch (error: any) {
      console.error('Viral metrics command error:', error);
      const errorMessage = error.message || 'An unexpected error occurred.';
      
      if (chatInteraction.replied || chatInteraction.deferred) {
        await chatInteraction.editReply(`❌ ${errorMessage}`);
      } else {
        await chatInteraction.reply({
          content: `❌ ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  }

  private async handleDashboard(interaction: ChatInputCommandInteraction): Promise<void> {
    const timeframe = parseInt(interaction.options.getString('timeframe') || '30');

    await interaction.deferReply();

    const metrics = await this.viralMetricsService.getViralMetrics(timeframe);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('📊 Viral Metrics Dashboard')
      .setDescription(`Comprehensive viral analytics for the last ${timeframe} days`)
      .addFields(
        {
          name: '🚀 Viral Coefficient',
          value: `**Overall:** ${metrics.viralCoefficient.overall.toFixed(3)} ${this.getTrendEmoji(metrics.viralCoefficient.trend)}
**Server-to-Server:** ${metrics.viralCoefficient.serverToServer.toFixed(3)}
**User-to-User:** ${metrics.viralCoefficient.userToUser.toFixed(3)}
**Content-to-User:** ${metrics.viralCoefficient.contentToUser.toFixed(3)}
**Confidence:** ${metrics.viralCoefficient.confidenceLevel.toFixed(0)}%`,
          inline: true
        },
        {
          name: '📈 Growth Metrics',
          value: `**Total Servers:** ${metrics.growthMetrics.totalServers.toLocaleString()}
**Total Users:** ${metrics.growthMetrics.totalUsers.toLocaleString()}
**Server Growth:** ${metrics.growthMetrics.serverGrowthRate.toFixed(1)}/day
**User Growth:** ${metrics.growthMetrics.userGrowthRate.toFixed(1)}/day
**Retention Rate:** ${metrics.growthMetrics.retentionRate.toFixed(1)}%`,
          inline: true
        },
        {
          name: '🎮 Content Metrics',
          value: `**Total Games:** ${metrics.contentMetrics.totalGames.toLocaleString()}
**Viral Games:** ${metrics.contentMetrics.viralGamesCount}
**Daily Shares:** ${metrics.contentMetrics.gamesSharedToday}
**Avg Server Reach:** ${metrics.contentMetrics.averageServerReach.toFixed(1)}
**Share Conversion:** ${(metrics.contentMetrics.shareConversionRate * 100).toFixed(1)}%`,
          inline: true
        },
        {
          name: '⚡ Engagement',
          value: `**Daily Active Users:** ${metrics.engagementMetrics.dailyActiveUsers.toLocaleString()}
**Avg Games/User:** ${metrics.engagementMetrics.averageGamesPerUser.toFixed(1)}
**Challenge Participation:** ${metrics.engagementMetrics.challengeParticipationRate.toFixed(1)}%
**Ambassador Impact:** ${(metrics.engagementMetrics.ambassadorImpactScore * 100).toFixed(0)}%`,
          inline: true
        },
        {
          name: '🔮 Predictions',
          value: `**Servers Next Month:** ${metrics.predictions.projectedServersNextMonth.toLocaleString()}
**Users Next Month:** ${metrics.predictions.projectedUsersNextMonth.toLocaleString()}
**Days to VC 1.2:** ${metrics.predictions.timeToViralCoefficient1_2 > 0 ? metrics.predictions.timeToViralCoefficient1_2 : 'TBD'}`,
          inline: true
        }
      )
      .setTimestamp();

    // Add performance indicator
    const vcStatus = metrics.viralCoefficient.overall >= 1.2 ? '🟢 Excellent' :
                     metrics.viralCoefficient.overall >= 1.0 ? '🟡 Growing' :
                     metrics.viralCoefficient.overall >= 0.8 ? '🟠 Improving' : '🔴 Needs Focus';

    embed.setFooter({ 
      text: `Viral Status: ${vcStatus} | Target: 1.2+ for exponential growth` 
    });

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleCoefficient(interaction: ChatInputCommandInteraction): Promise<void> {
    const timeframe = parseInt(interaction.options.getString('timeframe') || '30');

    await interaction.deferReply();

    const coefficient = await this.viralMetricsService.calculateViralCoefficient(timeframe);

    const embed = new EmbedBuilder()
      .setColor(this.getViralCoefficientColor(coefficient.overall))
      .setTitle('🎯 Viral Coefficient Analysis')
      .setDescription(`Detailed viral coefficient breakdown for ${timeframe} days`)
      .addFields(
        {
          name: '📊 Overall Viral Coefficient',
          value: `**${coefficient.overall.toFixed(4)}** ${this.getTrendEmoji(coefficient.trend)}`,
          inline: false
        },
        {
          name: '🏢 Server-to-Server',
          value: `${coefficient.serverToServer.toFixed(4)}
*New servers per existing server*`,
          inline: true
        },
        {
          name: '👥 User-to-User',
          value: `${coefficient.userToUser.toFixed(4)}
*New users per existing user*`,
          inline: true
        },
        {
          name: '🎮 Content-to-User',
          value: `${coefficient.contentToUser.toFixed(4)}
*New users per shared game*`,
          inline: true
        },
        {
          name: '📈 Trend Analysis',
          value: `**Status:** ${coefficient.trend.charAt(0).toUpperCase() + coefficient.trend.slice(1)}
**Confidence:** ${coefficient.confidenceLevel.toFixed(0)}%
**Timeframe:** ${coefficient.timeframe}`,
          inline: false
        },
        {
          name: '🎯 Benchmark Analysis',
          value: this.getViralCoefficientAnalysis(coefficient.overall),
          inline: false
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleGrowth(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const summaries = await this.viralMetricsService.getTimeframeSummaries();

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📈 Growth Trends Analysis')
      .setDescription('Growth metrics across different timeframes');

    for (const summary of summaries) {
      const growth = summary.metrics.growthMetrics;
      const coefficient = summary.metrics.viralCoefficient;

      embed.addFields({
        name: `📅 ${summary.period.toUpperCase()}`,
        value: `**VC:** ${coefficient.overall.toFixed(3)} ${this.getTrendEmoji(coefficient.trend)}
**Servers:** ${growth.totalServers.toLocaleString()} (+${growth.serverGrowthRate.toFixed(1)}/day)
**Users:** ${growth.totalUsers.toLocaleString()} (+${growth.userGrowthRate.toFixed(1)}/day)
**Retention:** ${growth.retentionRate.toFixed(1)}%`,
        inline: true
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleContent(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const metrics = await this.viralMetricsService.getViralMetrics(30);
    const content = metrics.contentMetrics;

    const embed = new EmbedBuilder()
      .setColor(0xFF6B35)
      .setTitle('🎮 Content Virality Metrics')
      .setDescription('Content performance and viral spread analysis')
      .addFields(
        {
          name: '📊 Content Overview',
          value: `**Total Games:** ${content.totalGames.toLocaleString()}
**Viral Games (100+ plays):** ${content.viralGamesCount}
**Viral Rate:** ${((content.viralGamesCount / content.totalGames) * 100).toFixed(1)}%`,
          inline: true
        },
        {
          name: '🚀 Sharing Metrics',
          value: `**Games Shared Today:** ${content.gamesSharedToday}
**Average Server Reach:** ${content.averageServerReach.toFixed(1)}
**Share Conversion Rate:** ${(content.shareConversionRate * 100).toFixed(1)}%`,
          inline: true
        },
        {
          name: '🎯 Viral Threshold',
          value: `**Plays for Viral Status:** ${content.viralGameThreshold}
**Games Above Threshold:** ${content.viralGamesCount}
**Success Rate:** ${((content.viralGamesCount / content.totalGames) * 100).toFixed(1)}%`,
          inline: true
        }
      );

    // Add top viral games if available
    if (metrics.topPerformers.viralGames.length > 0) {
      const topGames = metrics.topPerformers.viralGames
        .slice(0, 5)
        .map((game, index) => 
          `${index + 1}. **${game.name}** by ${game.creatorUsername}\n   └ ${game.playCount} plays • ${game.serverReach} servers • VC: ${game.viralCoefficient.toFixed(2)}`
        )
        .join('\n\n');

      embed.addFields({
        name: '🏆 Top Viral Games',
        value: topGames,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
    const type = interaction.options.getString('type') || 'creators';

    await interaction.deferReply();

    const metrics = await this.viralMetricsService.getViralMetrics(30);
    const performers = metrics.topPerformers;

    let embed: EmbedBuilder;

    switch (type) {
      case 'creators':
        embed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('👑 Top Viral Creators')
          .setDescription('Creators with highest viral impact scores');

        if (performers.viralCreators.length > 0) {
          const leaderboard = performers.viralCreators
            .slice(0, 10)
            .map((creator, index) => 
              `${this.getRankEmoji(index + 1)} <@${creator.userId}>\n   └ Viral Score: ${creator.viralScore.toFixed(0)} • Reach: ${creator.totalReach} servers • Games: ${creator.gamesCreated}`
            )
            .join('\n\n');

          embed.addFields({
            name: '🏆 Rankings',
            value: leaderboard,
            inline: false
          });
        } else {
          embed.addFields({
            name: '📊 No Data',
            value: 'No viral creators found in the current timeframe.',
            inline: false
          });
        }
        break;

      case 'servers':
        embed = new EmbedBuilder()
          .setColor(0x7289DA)
          .setTitle('🏢 Top Viral Servers')
          .setDescription('Servers with highest growth impact');

        embed.addFields({
          name: '🚧 Coming Soon',
          value: 'Server leaderboard feature is under development.',
          inline: false
        });
        break;

      case 'games':
        embed = new EmbedBuilder()
          .setColor(0x43B581)
          .setTitle('🎮 Top Viral Games')
          .setDescription('Games with highest viral coefficients');

        if (performers.viralGames.length > 0) {
          const leaderboard = performers.viralGames
            .slice(0, 10)
            .map((game, index) => 
              `${this.getRankEmoji(index + 1)} **${game.name}**\n   └ by ${game.creatorUsername} • ${game.playCount} plays • ${game.serverReach} servers • VC: ${game.viralCoefficient.toFixed(2)}`
            )
            .join('\n\n');

          embed.addFields({
            name: '🏆 Rankings',
            value: leaderboard,
            inline: false
          });
        } else {
          embed.addFields({
            name: '📊 No Data',
            value: 'No viral games found in the current timeframe.',
            inline: false
          });
        }
        break;

      default:
        embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Invalid Type')
          .setDescription('Unknown leaderboard type specified.');
        break;
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handlePredictions(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const metrics = await this.viralMetricsService.getViralMetrics(30);
    const predictions = metrics.predictions;

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🔮 Growth Predictions & Recommendations')
      .setDescription('AI-powered growth forecasts and optimization suggestions')
      .addFields(
        {
          name: '📈 Next Month Projections',
          value: `**Servers:** ${predictions.projectedServersNextMonth.toLocaleString()}
**Users:** ${predictions.projectedUsersNextMonth.toLocaleString()}`,
          inline: true
        },
        {
          name: '🎯 Viral Coefficient 1.2 Target',
          value: predictions.timeToViralCoefficient1_2 > 0 
            ? `**${predictions.timeToViralCoefficient1_2} days** to reach target`
            : '**Target achieved** or trend unclear',
          inline: true
        }
      );

    if (predictions.recommendedActions.length > 0) {
      const actions = predictions.recommendedActions
        .slice(0, 5)
        .map((action, index) => `${index + 1}. ${action}`)
        .join('\n');

      embed.addFields({
        name: '💡 Recommended Actions',
        value: actions,
        inline: false
      });
    }

    const currentVC = metrics.viralCoefficient.overall;
    const impactAnalysis = currentVC >= 1.2 
      ? '🟢 **Exponential Growth Phase** - Your platform is growing virally!'
      : currentVC >= 1.0 
      ? '🟡 **Growth Phase** - Close to viral threshold. Focus on optimization.'
      : currentVC >= 0.8
      ? '🟠 **Building Momentum** - Good foundation, needs viral catalysts.'
      : '🔴 **Focus Required** - Immediate action needed for viral growth.';

    embed.addFields({
      name: '🎯 Impact Analysis',
      value: impactAnalysis,
      inline: false
    });

    await interaction.editReply({ embeds: [embed] });
  }

  // Helper methods
  private getTrendEmoji(trend: string): string {
    switch (trend) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      case 'stable': return '➡️';
      default: return '❓';
    }
  }

  private getViralCoefficientColor(coefficient: number): number {
    if (coefficient >= 1.2) return 0x00FF00; // Green - Excellent
    if (coefficient >= 1.0) return 0xFFFF00; // Yellow - Good
    if (coefficient >= 0.8) return 0xFF9900; // Orange - Fair
    return 0xFF0000; // Red - Needs work
  }

  private getViralCoefficientAnalysis(coefficient: number): string {
    if (coefficient >= 1.2) {
      return '🟢 **Excellent!** Your platform is in exponential growth mode. Each user is bringing in more than one new user on average.';
    } else if (coefficient >= 1.0) {
      return '🟡 **Good progress!** You\'re at the viral threshold. Small optimizations could push you into exponential growth.';
    } else if (coefficient >= 0.8) {
      return '🟠 **Building momentum.** You\'re close to viral growth. Focus on sharing incentives and content quality.';
    } else if (coefficient >= 0.5) {
      return '🔴 **Needs attention.** Growth is slow. Consider increasing viral features and user incentives.';
    } else {
      return '🔴 **Critical.** Very low viral coefficient. Immediate focus on viral mechanics and user engagement needed.';
    }
  }

  private getRankEmoji(rank: number): string {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `**${rank}.**`;
    }
  }
}