import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { CreatorAnalyticsService } from '../services/creator-analytics.js';
import { TYPES } from '../types.js';

@injectable()
export class CreatorAnalyticsCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('creator-analytics')
    .setDescription('View detailed analytics for your games across all servers')
    .addSubcommand(subcommand =>
      subcommand
        .setName('overview')
        .setDescription('Get your overall creator analytics')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('game')
        .setDescription('Get cross-server analytics for a specific game')
        .addStringOption(option =>
          option
            .setName('game-id')
            .setDescription('The game ID to analyze')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('export')
        .setDescription('Export your analytics data (CSV format)')
    );

  constructor(
    @inject(TYPES.CreatorAnalyticsService) private creatorAnalytics: CreatorAnalyticsService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'overview':
        await this.handleOverview(interaction);
        break;
      case 'game':
        await this.handleGameAnalytics(interaction);
        break;
      case 'export':
        await this.handleExport(interaction);
        break;
    }
  }

  private async handleOverview(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const metrics = await this.creatorAnalytics.getCreatorMetrics(interaction.user.id);

      // Create main overview embed
      const overviewEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 Creator Analytics Dashboard')
        .setDescription(`Comprehensive analytics for <@${interaction.user.id}>`)
        .addFields(
          {
            name: '🎮 Games Created',
            value: `${metrics.totalGames}`,
            inline: true
          },
          {
            name: '▶️ Total Plays',
            value: `${metrics.totalPlays.toLocaleString()}`,
            inline: true
          },
          {
            name: '🔗 Total Shares',
            value: `${metrics.totalShares.toLocaleString()}`,
            inline: true
          },
          {
            name: '🌐 Server Reach',
            value: `${metrics.uniqueServers} servers`,
            inline: true
          },
          {
            name: '👥 Estimated Players',
            value: `${metrics.uniquePlayers.toLocaleString()}`,
            inline: true
          },
          {
            name: '🔥 Viral Games',
            value: `${metrics.viralGames}`,
            inline: true
          }
        );

      // Add tier information
      const tierEmbed = new EmbedBuilder()
        .setColor(this.getTierColor(metrics.tier.current))
        .setTitle(`${this.getTierEmoji(metrics.tier.current)} Creator Tier: ${metrics.tier.current}`)
        .setDescription(`${metrics.tier.multiplier}x earning multiplier`)
        .addFields(
          {
            name: '📈 Progress to Next Tier',
            value: metrics.tier.nextTier 
              ? `${metrics.tier.progress.toFixed(1)}% to ${metrics.tier.nextTier}`
              : '🏆 Max tier achieved!',
            inline: false
          },
          {
            name: '✨ Current Perks',
            value: metrics.tier.perks.join('\n'),
            inline: false
          }
        );

      // Add earnings information
      const earningsEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('💰 Earnings Overview')
        .addFields(
          {
            name: '💎 Total Earned',
            value: `${metrics.earnings.totalEarned.toLocaleString()} credits`,
            inline: true
          },
          {
            name: '📅 This Month',
            value: `${metrics.earnings.thisMonth.toLocaleString()} credits`,
            inline: true
          },
          {
            name: '📊 Avg per Game',
            value: `${metrics.earnings.averagePerGame.toFixed(1)} credits`,
            inline: true
          }
        );

      if (metrics.earnings.topEarningGame.gameId) {
        earningsEmbed.addFields({
          name: '🏆 Top Earning Game',
          value: `**${metrics.earnings.topEarningGame.name}**\n${metrics.earnings.topEarningGame.earned} credits earned`,
          inline: false
        });
      }

      // Create top games list
      let topGamesDescription = '';
      metrics.topGames.slice(0, 5).forEach((game, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        topGamesDescription += `${medal} **${game.name}**\n`;
        topGamesDescription += `   ${game.playCount} plays • ${game.shareCount} shares • ${game.serverReach} servers\n`;
        topGamesDescription += `   Viral Score: ${game.viralScore}/100\n\n`;
      });

      const topGamesEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 Top Performing Games')
        .setDescription(topGamesDescription || 'No games yet');

      // Create buttons for navigation
      const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('view-time-series')
            .setLabel('View Trends')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📈'),
          new ButtonBuilder()
            .setCustomId('view-server-distribution')
            .setLabel('Server Stats')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🌐'),
          new ButtonBuilder()
            .setCustomId('export-analytics')
            .setLabel('Export Data')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📥')
        );

      await interaction.editReply({
        embeds: [overviewEmbed, tierEmbed, earningsEmbed, topGamesEmbed],
        components: [buttons]
      });

    } catch (error) {
      console.error('Error getting creator analytics:', error);
      await interaction.editReply({
        content: '❌ Failed to get analytics. Please try again later.'
      });
    }
  }

  private async handleGameAnalytics(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    const gameId = interaction.options.get('game-id', true).value as string;
    await interaction.deferReply();

    try {
      const analytics = await this.creatorAnalytics.getGameCrossServerAnalytics(gameId);

      // Create game overview embed
      const overviewEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📊 Cross-Server Analytics: ${analytics.game.name}`)
        .setDescription(`Created by ${analytics.game.creator} in ${analytics.game.originalServer}`)
        .addFields(
          {
            name: '▶️ Total Plays',
            value: `${analytics.metrics.totalPlays.toLocaleString()}`,
            inline: true
          },
          {
            name: '🔗 Total Shares',
            value: `${analytics.metrics.totalShares.toLocaleString()}`,
            inline: true
          },
          {
            name: '🌐 Server Reach',
            value: `${analytics.metrics.uniqueServers} servers`,
            inline: true
          },
          {
            name: '📈 Viral Coefficient',
            value: `${analytics.metrics.viralCoefficient}`,
            inline: true
          },
          {
            name: '🔥 Viral Score',
            value: `${analytics.metrics.viralScore}/100`,
            inline: true
          },
          {
            name: '📊 Growth Rate',
            value: `${analytics.growthRate} shares/day`,
            inline: true
          }
        )
        .setFooter({ text: `Game ID: ${gameId}` })
        .setTimestamp(new Date(analytics.game.createdAt));

      // Create server distribution embed
      let serverDistDescription = '';
      analytics.serverDistribution.slice(0, 10).forEach((server: any, index: number) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        serverDistDescription += `${medal} **${server.serverName}**\n`;
        serverDistDescription += `   ${server.shareCount} shares • First: ${new Date(server.firstShared).toLocaleDateString()}\n\n`;
      });

      const serverDistEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🌐 Server Distribution')
        .setDescription(serverDistDescription || 'No cross-server data yet')
        .setFooter({ 
          text: analytics.serverDistribution.length > 10 
            ? `Showing top 10 of ${analytics.serverDistribution.length} servers` 
            : 'All servers shown' 
        });

      await interaction.editReply({
        embeds: [overviewEmbed, serverDistEmbed]
      });

    } catch (error) {
      console.error('Error getting game analytics:', error);
      await interaction.editReply({
        content: '❌ Failed to get game analytics. Please check the game ID and try again.'
      });
    }
  }

  private async handleExport(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const metrics = await this.creatorAnalytics.getCreatorMetrics(interaction.user.id);

      // Create CSV content
      let csv = 'Creator Analytics Export\n';
      csv += `Generated: ${new Date().toISOString()}\n\n`;
      
      csv += 'Overview\n';
      csv += 'Metric,Value\n';
      csv += `Total Games,${metrics.totalGames}\n`;
      csv += `Total Plays,${metrics.totalPlays}\n`;
      csv += `Total Shares,${metrics.totalShares}\n`;
      csv += `Unique Servers,${metrics.uniqueServers}\n`;
      csv += `Unique Players,${metrics.uniquePlayers}\n`;
      csv += `Viral Games,${metrics.viralGames}\n`;
      csv += `Average Play Rate,${metrics.averagePlayRate.toFixed(2)}\n`;
      csv += `Creator Tier,${metrics.tier.current}\n`;
      csv += `Tier Multiplier,${metrics.tier.multiplier}x\n`;
      csv += `Total Earnings,${metrics.earnings.totalEarned}\n\n`;

      csv += 'Top Games\n';
      csv += 'Game Name,Type,Plays,Shares,Server Reach,Viral Score,Created At\n';
      metrics.topGames.forEach(game => {
        csv += `"${game.name}",${game.type},${game.playCount},${game.shareCount},${game.serverReach},${game.viralScore},${game.createdAt}\n`;
      });

      csv += '\nServer Distribution\n';
      csv += 'Server Name,Total Plays,Last Activity\n';
      metrics.serverDistribution.forEach(server => {
        csv += `"${server.serverName}",${server.totalPlays},${server.lastActivity}\n`;
      });

      // Create a download link (in a real implementation, this would be uploaded to a temporary storage)
      const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

      await interaction.editReply({
        content: '📥 Your analytics data has been exported!\n\n' +
                 '**Note:** Copy the data below and save it as a .csv file:\n\n' +
                 '```csv\n' + csv.substring(0, 1000) + '\n...\n```\n\n' +
                 '*Full export truncated for Discord. Use the web dashboard for complete exports.*'
      });

    } catch (error) {
      console.error('Error exporting analytics:', error);
      await interaction.editReply({
        content: '❌ Failed to export analytics. Please try again later.'
      });
    }
  }

  private getTierColor(tier: string): number {
    const colors: Record<string, number> = {
      BRONZE: 0xCD7F32,
      SILVER: 0xC0C0C0,
      GOLD: 0xFFD700,
      DIAMOND: 0xB9F2FF
    };
    return colors[tier] || 0x5865F2;
  }

  private getTierEmoji(tier: string): string {
    const emojis: Record<string, string> = {
      BRONZE: '🥉',
      SILVER: '🥈',
      GOLD: '🥇',
      DIAMOND: '💎'
    };
    return emojis[tier] || '🏆';
  }
}