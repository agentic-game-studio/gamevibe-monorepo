import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { CrossServerDiscoveryService, TrendingGame, DiscoveryFilters } from '../services/cross-server-discovery.js';
import { AnalyticsService } from '../services/analytics.js';
import { TYPES } from '../types.js';

@injectable()
export class DiscoverCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('discover')
    .setDescription('Discover amazing games from across the GameVibe network')
    .addSubcommand(subcommand =>
      subcommand
        .setName('trending')
        .setDescription('Browse trending games across all servers')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Filter by game type')
            .addChoices(
              { name: 'All Types', value: 'all' },
              { name: 'Platformer', value: 'platformer' },
              { name: 'Puzzle', value: 'puzzle' },
              { name: 'Adventure', value: 'adventure' },
              { name: 'Shooter', value: 'shooter' },
              { name: 'Endless Runner', value: 'endless-runner' },
              { name: 'RPG', value: 'rpg' },
              { name: 'Racing', value: 'racing' }
            )
        )
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('How recent should games be?')
            .addChoices(
              { name: 'All Time', value: 'all' },
              { name: 'This Month', value: 'month' },
              { name: 'This Week', value: 'week' },
              { name: 'Today', value: 'day' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of games to show (1-20)')
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('Search for games by name or description')
        .addStringOption(option =>
          option
            .setName('query')
            .setDescription('Search terms')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Filter by game type')
            .addChoices(
              { name: 'All Types', value: 'all' },
              { name: 'Platformer', value: 'platformer' },
              { name: 'Puzzle', value: 'puzzle' },
              { name: 'Adventure', value: 'adventure' },
              { name: 'Shooter', value: 'shooter' },
              { name: 'Endless Runner', value: 'endless-runner' },
              { name: 'RPG', value: 'rpg' },
              { name: 'Racing', value: 'racing' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of results to show (1-20)')
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('featured')
        .setDescription('Browse hand-picked featured games')
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of games to show (1-15)')
            .setMinValue(1)
            .setMaxValue(15)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View platform discovery statistics')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('similar')
        .setDescription('Find games similar to a specific game')
        .addStringOption(option =>
          option
            .setName('game-id')
            .setDescription('ID or short ID of the game to find similar games for')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of similar games to show (1-15)')
            .setMinValue(1)
            .setMaxValue(15)
        )
    );

  constructor(
    @inject(TYPES.CrossServerDiscoveryService) private discoveryService: CrossServerDiscoveryService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'trending':
          await this.handleTrending(interaction);
          break;
        case 'search':
          await this.handleSearch(interaction);
          break;
        case 'featured':
          await this.handleFeatured(interaction);
          break;
        case 'stats':
          await this.handleStats(interaction);
          break;
        case 'similar':
          await this.handleSimilar(interaction);
          break;
      }
    } catch (error) {
      console.error('Error in discover command:', error);
      await interaction.reply({
        content: '❌ An error occurred while fetching games. Please try again.',
        ephemeral: true
      });
    }
  }

  private async handleTrending(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const gameType = interaction.options.getString('type');
    const timeframe = interaction.options.getString('timeframe') as 'day' | 'week' | 'month' | 'all';
    const limit = interaction.options.getInteger('limit') || 10;

    const filters: DiscoveryFilters = {
      excludeServer: interaction.guildId || undefined
    };

    if (gameType && gameType !== 'all') {
      filters.gameType = gameType;
    }

    if (timeframe && timeframe !== 'all') {
      filters.maxAge = timeframe;
    }

    const trendingGames = await this.discoveryService.getTrendingGames(limit, filters);

    if (trendingGames.length === 0) {
      const noGamesEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('🔍 No Trending Games Found')
        .setDescription('No games match your criteria right now. Try adjusting your filters or check back later!')
        .setFooter({ text: 'GameVibe AI • Cross-Server Discovery' })
        .setTimestamp();

      await interaction.editReply({ embeds: [noGamesEmbed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF6B35)
      .setTitle('🔥 Trending Games Across GameVibe')
      .setDescription(`Discover the hottest games from across the network!`)
      .setFooter({ text: `GameVibe AI • ${trendingGames.length} trending games` })
      .setTimestamp();

    // Add game fields
    const gameFields = trendingGames.slice(0, 10).map((game, index) => {
      const position = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
      const emoji = this.getGameTypeEmoji(game.type);
      
      return {
        name: `${position} ${emoji} ${game.title}`,
        value: `**${game.playCount}** plays • **${game.serverCount}** servers\\n` +
               `Creator: ${game.creatorName} • Server: ${game.serverName}\\n` +
               `🆔 \`${game.shortId}\` • Type: ${game.type}`,
        inline: false
      };
    });

    embed.addFields(gameFields);

    // Add summary stats
    const totalPlays = trendingGames.reduce((sum, game) => sum + game.playCount, 0);
    const uniqueServers = new Set(trendingGames.map(game => game.serverId)).size;
    const gameTypes = new Set(trendingGames.map(game => game.type)).size;

    embed.addFields({
      name: '📊 Summary',
      value: `**${totalPlays.toLocaleString()}** total plays • **${uniqueServers}** servers • **${gameTypes}** game types`,
      inline: false
    });

    // Add navigation buttons
    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('discover-refresh-trending')
          .setLabel('Refresh')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('discover-featured')
          .setLabel('Featured Games')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⭐'),
        new ButtonBuilder()
          .setCustomId('discover-stats')
          .setLabel('Platform Stats')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📈')
      );

    await interaction.editReply({ 
      embeds: [embed],
      components: [buttons]
    });

    // Track analytics
    await this.analytics.track('discover_trending_viewed', {
      userId: interaction.user.id,
      serverId: interaction.guildId,
      gameType,
      timeframe,
      limit,
      gamesFound: trendingGames.length
    });
  }

  private async handleSearch(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const query = interaction.options.getString('query', true);
    const gameType = interaction.options.getString('type');
    const limit = interaction.options.getInteger('limit') || 10;

    const filters: DiscoveryFilters = {
      excludeServer: interaction.guildId || undefined
    };

    if (gameType && gameType !== 'all') {
      filters.gameType = gameType;
    }

    const searchResults = await this.discoveryService.searchGames(query, limit, filters);

    if (searchResults.length === 0) {
      const noResultsEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('🔍 No Search Results')
        .setDescription(`No games found for "${query}". Try different search terms or check your filters.`)
        .addFields({
          name: '💡 Search Tips',
          value: '• Try broader terms like "adventure" or "puzzle"\\n• Check spelling and try synonyms\\n• Remove filters to see more results',
          inline: false
        })
        .setFooter({ text: 'GameVibe AI • Cross-Server Search' })
        .setTimestamp();

      await interaction.editReply({ embeds: [noResultsEmbed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🔍 Search Results for "${query}"`)
      .setDescription(`Found ${searchResults.length} games across the GameVibe network`)
      .setFooter({ text: `GameVibe AI • Search Results` })
      .setTimestamp();

    // Add search result fields
    const resultFields = searchResults.slice(0, 10).map((game, index) => {
      const emoji = this.getGameTypeEmoji(game.type);
      
      return {
        name: `${index + 1}. ${emoji} ${game.title}`,
        value: `${game.description.substring(0, 100)}${game.description.length > 100 ? '...' : ''}\\n` +
               `**${game.playCount}** plays • **${game.serverCount}** servers\\n` +
               `Creator: ${game.creatorName} • Server: ${game.serverName}\\n` +
               `🆔 \`${game.shortId}\` • Type: ${game.type}`,
        inline: false
      };
    });

    embed.addFields(resultFields);

    // Add search stats
    const totalPlays = searchResults.reduce((sum, game) => sum + game.playCount, 0);
    embed.addFields({
      name: '📊 Search Stats',
      value: `**${searchResults.length}** games found • **${totalPlays.toLocaleString()}** combined plays`,
      inline: false
    });

    await interaction.editReply({ embeds: [embed] });

    // Track analytics
    await this.discoveryService.trackDiscoveryEvent('game_searched', interaction.user.id, {
      query,
      gameType,
      resultsFound: searchResults.length,
      serverId: interaction.guildId
    });
  }

  private async handleFeatured(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const limit = interaction.options.getInteger('limit') || 10;
    const featuredGames = await this.discoveryService.getFeaturedGames(limit);

    if (featuredGames.length === 0) {
      const noFeaturedEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('⭐ No Featured Games')
        .setDescription('No featured games available right now. Check back soon for amazing picks!')
        .setFooter({ text: 'GameVibe AI • Featured Games' })
        .setTimestamp();

      await interaction.editReply({ embeds: [noFeaturedEmbed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('⭐ Featured Games')
      .setDescription('Hand-picked exceptional games from across the GameVibe network')
      .setFooter({ text: `GameVibe AI • ${featuredGames.length} featured games` })
      .setTimestamp();

    // Add featured game fields
    const gameFields = featuredGames.slice(0, 8).map((game, index) => {
      const emoji = this.getGameTypeEmoji(game.type);
      const quality = this.getQualityBadge(game.playCount, game.serverCount);
      
      return {
        name: `${emoji} ${game.title} ${quality}`,
        value: `${game.description.substring(0, 120)}${game.description.length > 120 ? '...' : ''}\\n` +
               `**${game.playCount}** plays • **${game.serverCount}** servers\\n` +
               `Creator: ${game.creatorName} • Server: ${game.serverName}\\n` +
               `🆔 \`${game.shortId}\` • Type: ${game.type}`,
        inline: false
      };
    });

    embed.addFields(gameFields);

    // Add featured stats
    const totalPlays = featuredGames.reduce((sum, game) => sum + game.playCount, 0);
    const avgPlays = Math.round(totalPlays / featuredGames.length);

    embed.addFields({
      name: '🏆 Quality Stats',
      value: `**${totalPlays.toLocaleString()}** total plays • **${avgPlays}** average plays per game`,
      inline: false
    });

    await interaction.editReply({ embeds: [embed] });

    // Track analytics
    await this.discoveryService.trackDiscoveryEvent('featured_viewed', interaction.user.id, {
      featuredCount: featuredGames.length,
      serverId: interaction.guildId
    });
  }

  private async handleStats(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const stats = await this.discoveryService.getDiscoveryStats();

    const statsEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('📈 GameVibe Platform Statistics')
      .setDescription('Comprehensive statistics across the entire GameVibe network')
      .addFields(
        {
          name: '🎮 Platform Overview',
          value: `**${stats.totalGames.toLocaleString()}** total games\\n**${stats.totalPlays.toLocaleString()}** total plays\\n**${stats.averageRating.toFixed(1)}** average rating`,
          inline: true
        },
        {
          name: '📊 Engagement',
          value: `**${Math.round(stats.totalPlays / Math.max(stats.totalGames, 1))}** plays per game\\n**${stats.topServers.length}** active servers\\n**${stats.popularTypes.length}** game types`,
          inline: true
        },
        {
          name: '🚀 Activity Status',
          value: this.getActivityStatus(stats.totalPlays, stats.totalGames),
          inline: true
        }
      )
      .setFooter({ text: 'GameVibe AI • Platform Statistics' })
      .setTimestamp();

    // Popular game types
    if (stats.popularTypes.length > 0) {
      const typesText = stats.popularTypes.slice(0, 5).map((type, index) => 
        `${index + 1}. **${type.type}** (${type.count} games, ${type.playPercentage.toFixed(1)}% of plays)`
      ).join('\\n');
      
      statsEmbed.addFields({
        name: '🎯 Popular Game Types',
        value: typesText,
        inline: false
      });
    }

    // Top servers
    if (stats.topServers.length > 0) {
      const serversText = stats.topServers.slice(0, 5).map((server, index) => 
        `${index + 1}. **${server.serverName}** (${server.gameCount} games, ${server.totalPlays.toLocaleString()} plays)`
      ).join('\\n');
      
      statsEmbed.addFields({
        name: '🏆 Most Active Servers',
        value: serversText,
        inline: false
      });
    }

    // Recent trends
    if (stats.recentTrends.length > 0) {
      const trendsText = stats.recentTrends.map(trend => 
        `**${trend.period}**: ${trend.gamesCreated} games created`
      ).join('\\n');
      
      statsEmbed.addFields({
        name: '📅 Recent Trends',
        value: trendsText,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [statsEmbed] });

    // Track analytics
    await this.analytics.track('discover_stats_viewed', {
      userId: interaction.user.id,
      serverId: interaction.guildId,
      totalGames: stats.totalGames,
      totalPlays: stats.totalPlays
    });
  }

  private async handleSimilar(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const gameId = interaction.options.getString('game-id', true);
    const limit = interaction.options.getInteger('limit') || 10;

    const similarGames = await this.discoveryService.getRelatedGames(
      gameId, 
      limit, 
      interaction.guildId || undefined
    );

    if (similarGames.length === 0) {
      const noSimilarEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('🔍 No Similar Games Found')
        .setDescription(`No games similar to \`${gameId}\` were found. The game might not exist or have no similar games yet.`)
        .setFooter({ text: 'GameVibe AI • Similar Games' })
        .setTimestamp();

      await interaction.editReply({ embeds: [noSimilarEmbed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`🎮 Games Similar to ${gameId}`)
      .setDescription(`Found ${similarGames.length} similar games you might enjoy`)
      .setFooter({ text: `GameVibe AI • Similar Games` })
      .setTimestamp();

    // Add similar game fields
    const gameFields = similarGames.slice(0, 8).map((game, index) => {
      const emoji = this.getGameTypeEmoji(game.type);
      
      return {
        name: `${index + 1}. ${emoji} ${game.title}`,
        value: `${game.description.substring(0, 100)}${game.description.length > 100 ? '...' : ''}\\n` +
               `**${game.playCount}** plays • **${game.serverCount}** servers\\n` +
               `Creator: ${game.creatorName} • Server: ${game.serverName}\\n` +
               `🆔 \`${game.shortId}\` • Type: ${game.type}`,
        inline: false
      };
    });

    embed.addFields(gameFields);

    await interaction.editReply({ embeds: [embed] });

    // Track analytics
    await this.discoveryService.trackDiscoveryEvent('game_discovered', interaction.user.id, {
      sourceGameId: gameId,
      similarGamesFound: similarGames.length,
      serverId: interaction.guildId
    });
  }

  private getGameTypeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      'platformer': '🏃',
      'puzzle': '🧩',
      'adventure': '🗺️',
      'shooter': '🔫',
      'endless-runner': '🏃‍♂️',
      'rpg': '⚔️',
      'racing': '🏎️',
      'strategy': '♟️',
      'simulation': '🏗️'
    };
    return emojis[type.toLowerCase()] || '🎮';
  }

  private getQualityBadge(plays: number, servers: number): string {
    if (plays >= 1000 && servers >= 10) return '👑';
    if (plays >= 500 && servers >= 5) return '💎';
    if (plays >= 100 && servers >= 3) return '⭐';
    if (plays >= 50) return '🌟';
    return '';
  }

  private getActivityStatus(totalPlays: number, totalGames: number): string {
    const avgPlays = totalGames > 0 ? totalPlays / totalGames : 0;
    
    if (avgPlays >= 100) return '🔥 **Extremely Active**';
    if (avgPlays >= 50) return '🚀 **Very Active**';
    if (avgPlays >= 20) return '📈 **Active**';
    if (avgPlays >= 10) return '📊 **Moderate**';
    return '🌱 **Growing**';
  }
}