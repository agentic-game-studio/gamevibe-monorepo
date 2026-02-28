// GameVibe AI Remix Game Command
// Create remixes of existing games with modifications

import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  Colors,
  AttachmentBuilder
} from 'discord.js';
import { injectable, inject } from 'inversify';
import { GameRemixService, GameModification, RemixGameParams } from '../services/game-remix.js';
import { SubscriptionChecker } from '../middleware/subscription-check.js';
import { RemixTemplatesService } from '../services/remix-templates.js';
import { RemixType, GameType } from '../generated/prisma/index.js';
import { TYPES } from '../types.js';

@injectable()
export class RemixGameCommand {
  public data = new SlashCommandBuilder()
    .setName('remix-game')
    .setDescription('Create a remix of an existing game with your own modifications')
    .addSubcommand(sub =>
      sub.setName('browse')
        .setDescription('Browse games available for remixing')
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Filter by game type')
            .setRequired(false)
            .addChoices(
              { name: 'Platformer', value: 'PLATFORMER' },
              { name: 'Puzzle', value: 'PUZZLE' },
              { name: 'RPG', value: 'RPG' },
              { name: 'Shooter', value: 'SHOOTER' },
              { name: 'Endless Runner', value: 'ENDLESS_RUNNER' }
            )
        )
        .addStringOption(option =>
          option.setName('sort')
            .setDescription('Sort games by')
            .setRequired(false)
            .addChoices(
              { name: 'Most Popular', value: 'popularity' },
              { name: 'Most Recent', value: 'recent' },
              { name: 'Most Remixed', value: 'remixes' },
              { name: 'Most Played', value: 'plays' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a remix of a specific game')
        .addStringOption(option =>
          option.setName('game-id')
            .setDescription('The ID of the game to remix')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Title for your remix')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Description of your remix')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('trending')
        .setDescription('View trending remixes from the community')
    )
    .addSubcommand(sub =>
      sub.setName('templates')
        .setDescription('Browse remix modification templates')
        .addStringOption(option =>
          option.setName('difficulty')
            .setDescription('Filter by difficulty level')
            .setRequired(false)
            .addChoices(
              { name: 'Easy', value: 'easy' },
              { name: 'Medium', value: 'medium' },
              { name: 'Hard', value: 'hard' }
            )
        )
        .addStringOption(option =>
          option.setName('search')
            .setDescription('Search templates by name or description')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('history')
        .setDescription('View version history of a game')
        .addStringOption(option =>
          option.setName('game-id')
            .setDescription('The ID of the game to view history for')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Get information about a remix')
        .addStringOption(option =>
          option.setName('game-id')
            .setDescription('The ID of the remix to get info for')
            .setRequired(true)
        )
    );

  constructor(
    @inject(TYPES.GameRemixService) private remixService: GameRemixService,
    @inject(TYPES.SubscriptionChecker) private subscriptionChecker: SubscriptionChecker
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'browse':
          await this.handleBrowse(interaction);
          break;
        case 'create':
          await this.handleCreate(interaction);
          break;
        case 'trending':
          await this.handleTrending(interaction);
          break;
        case 'templates':
          await this.handleTemplates(interaction);
          break;
        case 'history':
          await this.handleHistory(interaction);
          break;
        case 'info':
          await this.handleInfo(interaction);
          break;
        default:
          await interaction.reply({
            content: '❌ Unknown subcommand.',
            ephemeral: true
          });
      }
    } catch (error) {
      console.error('Error in remix-game command:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: `❌ ${errorMessage}`
        });
      } else {
        await interaction.reply({
          content: `❌ ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  }

  /**
   * Handle browse subcommand
   */
  private async handleBrowse(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    const gameType = interaction.options.get('type')?.value as GameType;
    const sortBy = interaction.options.get('sort')?.value as string || 'popularity';

    await interaction.deferReply();

    const games = await this.remixService.browseGamesForRemix({
      gameType,
      sortBy: sortBy as any,
      isPublic: true,
      limit: 10
    });

    if (games.length === 0) {
      await interaction.editReply({
        content: '🎮 No games found matching your criteria. Try different filters!'
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎨 Games Available for Remixing')
      .setDescription('Select a game below to create your own remix!')
      .setColor(Colors.Purple)
      .setFooter({ text: `Found ${games.length} games • Use buttons to remix` });

    // Add game fields
    games.slice(0, 5).forEach((game, index) => {
      const creator = game.creator ? `@${game.creator.username}` : 'Unknown';
      const remixCount = game._count?.originalGameRemixes || 0;
      
      embed.addFields({
        name: `${index + 1}. ${game.name} (${game.type})`,
        value: `**ID:** \`${game.shortId}\` | **Creator:** ${creator}\n` +
               `**Plays:** ${game.playCount} | **Remixes:** ${remixCount}\n` +
               `${game.description.slice(0, 100)}${game.description.length > 100 ? '...' : ''}`,
        inline: false
      });
    });

    // Create buttons for easy remixing
    const components = [];
    if (games.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_game_to_remix')
        .setPlaceholder('Select a game to remix')
        .addOptions(
          games.slice(0, 10).map((game, index) => ({
            label: `${game.name} (${game.type})`,
            description: `${game.playCount} plays • ${game._count?.originalGameRemixes || 0} remixes`,
            value: game.id,
            emoji: this.getGameTypeEmoji(game.type)
          }))
        );

      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
    }

    const refreshButton = new ButtonBuilder()
      .setCustomId('refresh_remix_browse')
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄');

    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(refreshButton));

    await interaction.editReply({
      embeds: [embed],
      components
    });
  }

  /**
   * Handle create subcommand
   */
  private async handleCreate(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    // Check subscription permissions for game creation
    const subscriptionCheck = await this.subscriptionChecker.checkGameCreation(interaction);
    if (!subscriptionCheck.allowed) return;

    const gameId = interaction.options.get('game-id', true).value as string;
    const title = interaction.options.get('title')?.value as string;
    const description = interaction.options.get('description')?.value as string;

    await interaction.deferReply();

    // Get the original game
    const games = await this.remixService.browseGamesForRemix({ limit: 1000 });
    const originalGame = games.find(g => g.id === gameId || g.shortId === gameId);

    if (!originalGame) {
      await interaction.editReply({
        content: '❌ Game not found or not available for remixing. Use `/remix-game browse` to find available games.'
      });
      return;
    }

    // Show remix customization interface
    await this.showRemixCustomization(interaction, originalGame, title, description);
  }

  /**
   * Handle templates subcommand
   */
  private async handleTemplates(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    const difficulty = interaction.options.get('difficulty')?.value as 'easy' | 'medium' | 'hard';
    const searchQuery = interaction.options.get('search')?.value as string;

    await interaction.deferReply();

    let templates = RemixTemplatesService.getModificationTemplates();

    // Apply filters
    if (difficulty) {
      templates = RemixTemplatesService.getTemplatesByDifficulty(difficulty);
    }
    
    if (searchQuery) {
      templates = RemixTemplatesService.searchTemplates(searchQuery);
    }

    if (templates.length === 0) {
      await interaction.editReply({
        content: '🔍 No templates found matching your criteria. Try adjusting your filters!'
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎨 Remix Modification Templates')
      .setDescription('Choose from these pre-made modification templates to quickly customize your remix!')
      .setColor(Colors.Purple)
      .setFooter({ text: `${templates.length} templates available` });

    // Show first 8 templates
    templates.slice(0, 8).forEach((template, index) => {
      const difficultyIcon = {
        easy: '🟢',
        medium: '🟡',
        hard: '🔴'
      }[template.difficulty];

      const gameTypesText = template.gameTypes.slice(0, 3).join(', ');
      
      embed.addFields({
        name: `${template.emoji} ${template.name} ${difficultyIcon}`,
        value: `${template.description}\n**Supports:** ${gameTypesText}${template.gameTypes.length > 3 ? '...' : ''}`,
        inline: false
      });
    });

    // Create template selection menu
    const templateSelect = new StringSelectMenuBuilder()
      .setCustomId('select_remix_template')
      .setPlaceholder('Select a template to learn more')
      .addOptions(
        templates.slice(0, 20).map(template => ({
          label: template.name,
          description: template.description.slice(0, 100),
          value: template.id,
          emoji: template.emoji
        }))
      );

    await interaction.editReply({
      embeds: [embed],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(templateSelect)
      ]
    });
  }

  /**
   * Handle trending subcommand
   */
  private async handleTrending(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const trendingRemixes = await this.remixService.getTrendingRemixes(15);

    if (trendingRemixes.length === 0) {
      await interaction.editReply({
        content: '🌟 No trending remixes found. Be the first to create one!'
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🔥 Community Remix Showcase')
      .setDescription('Discover amazing game remixes created by the community!')
      .setColor(Colors.Orange)
      .addFields(
        { name: '📊 Trending Stats', value: `${trendingRemixes.length} hot remixes this week`, inline: true },
        { name: '🎮 Most Active', value: this.getMostActiveGameType(trendingRemixes), inline: true },
        { name: '👑 Top Creator', value: this.getTopRemixCreator(trendingRemixes), inline: true }
      )
      .setFooter({ text: 'Click "Explore Remixes" to see detailed community stats' });

    // Show top 8 trending remixes with enhanced details
    trendingRemixes.slice(0, 8).forEach((remix, index) => {
      const remixCreator = remix.remixedBy ? `@${remix.remixedBy.username}` : 'Unknown';
      const originalCreator = remix.originalGame.creator ? `@${remix.originalGame.creator.username}` : 'Unknown';
      
      // Calculate trending score
      const trendingScore = this.calculateTrendingScore(remix);
      const trendingEmoji = index < 3 ? ['🥇', '🥈', '🥉'][index] : '🔥';
      
      embed.addFields({
        name: `${trendingEmoji} ${remix.remixGame.name}`,
        value: `**ID:** \`${remix.remixGame.shortId}\` | **Score:** ${trendingScore}\n` +
               `**Original:** ${remix.originalGame.name.slice(0, 25)}${remix.originalGame.name.length > 25 ? '...' : ''} by ${originalCreator}\n` +
               `**Remixed by:** ${remixCreator} | **Type:** ${this.getRemixTypeDisplay(remix.remixType)}\n` +
               `**Plays:** ${remix.remixGame.playCount} | **Created:** <t:${Math.floor(remix.remixedAt.getTime() / 1000)}:R>`,
        inline: false
      });
    });

    // Add community interaction components
    const components = [];
    
    // Create remix selection dropdown
    const remixSelect = new StringSelectMenuBuilder()
      .setCustomId('explore_trending_remix')
      .setPlaceholder('🔍 Explore a trending remix in detail')
      .addOptions(
        trendingRemixes.slice(0, 20).map((remix, index) => ({
          label: `${remix.remixGame.name}`,
          description: `${remix.remixGame.playCount} plays • by @${remix.remixedBy?.username || 'Unknown'}`,
          value: remix.remixGame.id,
          emoji: index < 3 ? ['🥇', '🥈', '🥉'][index] : '🎮'
        }))
      );

    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(remixSelect));

    // Add action buttons
    const actionButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('community_stats')
          .setLabel('Community Stats')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('remix_categories')
          .setLabel('Browse Categories')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📂'),
        new ButtonBuilder()
          .setCustomId('my_remixes')
          .setLabel('My Remixes')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👤')
      );

    components.push(actionButtons);

    await interaction.editReply({ 
      embeds: [embed],
      components 
    });
  }

  /**
   * Handle history subcommand
   */
  private async handleHistory(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    const gameId = interaction.options.get('game-id', true).value as string;

    await interaction.deferReply();

    const games = await this.remixService.browseGamesForRemix({ limit: 1000 });
    const game = games.find(g => g.id === gameId || g.shortId === gameId);

    if (!game) {
      await interaction.editReply({
        content: '❌ Game not found.'
      });
      return;
    }

    const versions = await this.remixService.getGameVersions(game.id);

    const embed = new EmbedBuilder()
      .setTitle(`📚 Version History: ${game.name}`)
      .setDescription(`Complete version history and modifications for **${game.name}**`)
      .setColor(Colors.Blue)
      .addFields(
        { name: 'Game ID', value: `\`${game.shortId}\``, inline: true },
        { name: 'Current Version', value: versions.find(v => v.isLatest)?.version || '1.0', inline: true },
        { name: 'Total Versions', value: versions.length.toString(), inline: true }
      )
      .setFooter({ text: `Use /remix-game info ${game.shortId} for detailed version comparison` });

    if (versions.length === 0) {
      embed.addFields({
        name: '📝 No Version History',
        value: 'This game doesn\'t have detailed version history yet. Versions are created when games are remixed or updated.',
        inline: false
      });
    } else {
      // Show last 8 versions with enhanced details
      versions.slice(0, 8).forEach((version, index) => {
        const creator = version.createdBy ? `@${version.createdBy.username}` : 'Unknown';
        const isLatest = version.isLatest ? ' 🟢 **(Current)**' : '';
        
        // Parse changes to show modification summary
        let changesSummary = 'No changes recorded';
        if (version.changes && Array.isArray(version.changes)) {
          const modTypes = version.changes.map((change: any) => change.type || 'unknown');
          const uniqueTypes = [...new Set(modTypes)];
          changesSummary = uniqueTypes.map(type => {
            const typeEmojis: Record<string, string> = {
              'style': '🎨',
              'mechanics': '⚙️', 
              'theme': '🌍',
              'difficulty': '🎯',
              'assets': '🖼️'
            };
            return `${typeEmojis[type] || '🔧'} ${type}`;
          }).join(', ');
        }
        
        embed.addFields({
          name: `${index === 0 ? '🆕' : '📌'} v${version.version}${isLatest}`,
          value: `**Creator:** ${creator} | **Date:** <t:${Math.floor(version.createdAt.getTime() / 1000)}:R>\n` +
                 `**Changes:** ${changesSummary}\n` +
                 `**Changelog:** ${version.changelog || 'No changelog provided'}`,
          inline: false
        });
      });

      // Add truncation notice if there are more versions
      if (versions.length > 8) {
        embed.addFields({
          name: '📋 More Versions',
          value: `... and ${versions.length - 8} more versions. Use the buttons below to navigate through all versions.`,
          inline: false
        });
      }
    }

    // Add interactive components for version navigation
    const components = [];
    if (versions.length > 0) {
      const versionSelect = new StringSelectMenuBuilder()
        .setCustomId(`version_details:${game.id}`)
        .setPlaceholder('Select a version to view detailed changes')
        .addOptions(
          versions.slice(0, 20).map((version, index) => ({
            label: `v${version.version}${version.isLatest ? ' (Current)' : ''}`,
            description: version.changelog?.slice(0, 100) || 'No changelog',
            value: version.id,
            emoji: index === 0 ? '🆕' : '📌'
          }))
        );

      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(versionSelect));
    }

    await interaction.editReply({ 
      embeds: [embed],
      components 
    });
  }

  /**
   * Handle info subcommand
   */
  private async handleInfo(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    const gameId = interaction.options.get('game-id', true).value as string;

    await interaction.deferReply();

    const games = await this.remixService.browseGamesForRemix({ limit: 1000 });
    const game = games.find(g => g.id === gameId || g.shortId === gameId);

    if (!game) {
      await interaction.editReply({
        content: '❌ Game not found.'
      });
      return;
    }

    const remixInfo = await this.remixService.getRemixInfo(game.id);
    const gameRemixes = await this.remixService.getGameRemixes(game.id, 5);

    const embed = new EmbedBuilder()
      .setTitle(`🎮 ${game.name}`)
      .setDescription(game.description)
      .setColor(Colors.Green)
      .addFields(
        { name: 'Game ID', value: `\`${game.shortId}\``, inline: true },
        { name: 'Type', value: game.type, inline: true },
        { name: 'Plays', value: game.playCount.toString(), inline: true },
        { name: 'Remixes', value: gameRemixes.length.toString(), inline: true },
        { name: 'Creator', value: game.creator ? `@${game.creator.username}` : 'Unknown', inline: true },
        { name: 'Created', value: `<t:${Math.floor(game.createdAt.getTime() / 1000)}:R>`, inline: true }
      );

    if (remixInfo) {
      embed.addFields({
        name: '🎨 Remix Information',
        value: `**Original Game:** ${remixInfo.originalGame.name}\n` +
               `**Original Creator:** @${remixInfo.originalGame.creator.username}\n` +
               `**Remix Type:** ${remixInfo.remixType}\n` +
               `**Remixed By:** @${remixInfo.remixedBy.username}\n` +
               `**Remixed:** <t:${Math.floor(remixInfo.remixedAt.getTime() / 1000)}:R>`,
        inline: false
      });
    }

    if (gameRemixes.length > 0) {
      const remixList = gameRemixes.map(remix => 
        `• **${remix.remixGame.name}** (${remix.remixGame.playCount} plays)`
      ).join('\n');
      
      embed.addFields({
        name: '🌟 Popular Remixes',
        value: remixList,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  /**
   * Show remix customization interface
   */
  private async showRemixCustomization(
    interaction: CommandInteraction,
    originalGame: any,
    title?: string,
    description?: string
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle(`🎨 Remix: ${originalGame.name}`)
      .setDescription(`Customize your remix of **${originalGame.name}**`)
      .setColor(Colors.Purple)
      .addFields(
        { name: 'Original Game', value: `${originalGame.name} by @${originalGame.creator?.username || 'Unknown'}`, inline: false },
        { name: 'Your Remix Title', value: title || `${originalGame.name} (Remix)`, inline: true },
        { name: 'Description', value: description || `My remix of ${originalGame.name}`, inline: true }
      )
      .setFooter({ text: 'Choose a template or create custom modifications' });

    // Get templates suitable for this game type
    const suitableTemplates = RemixTemplatesService.getTemplatesForGameType(originalGame.type);
    const randomTemplates = suitableTemplates.slice(0, 5);

    const templateSelect = new StringSelectMenuBuilder()
      .setCustomId(`remix_template:${originalGame.id}:${title || ''}:${description || ''}`)
      .setPlaceholder('🎨 Choose a remix template (recommended)')
      .addOptions(
        randomTemplates.map(template => ({
          label: template.name,
          description: template.description.slice(0, 100),
          value: template.id,
          emoji: template.emoji
        }))
      );

    const customSelect = new StringSelectMenuBuilder()
      .setCustomId(`remix_modifications:${originalGame.id}`)
      .setPlaceholder('🛠️ Or create custom modifications')
      .setMinValues(1)
      .setMaxValues(5)
      .addOptions([
        {
          label: 'Change Colors & Style',
          description: 'Modify the visual theme and color scheme',
          value: 'style',
          emoji: '🎨'
        },
        {
          label: 'Adjust Game Mechanics',
          description: 'Change movement speed, jump height, etc.',
          value: 'mechanics',
          emoji: '⚙️'
        },
        {
          label: 'Change Theme',
          description: 'Transform the game setting and story',
          value: 'theme',
          emoji: '🌍'
        },
        {
          label: 'Modify Difficulty',
          description: 'Make the game easier or harder',
          value: 'difficulty',
          emoji: '🎯'
        },
        {
          label: 'Update Assets',
          description: 'Replace sprites and sounds',
          value: 'assets',
          emoji: '🖼️'
        }
      ]);

    const quickRemixButton = new ButtonBuilder()
      .setCustomId(`quick_remix:${originalGame.id}:${title || ''}:${description || ''}`)
      .setLabel('Quick Remix')
      .setStyle(ButtonStyle.Success)
      .setEmoji('⚡');

    const browseTemplatesButton = new ButtonBuilder()
      .setCustomId(`browse_templates:${originalGame.type}`)
      .setLabel('Browse All Templates')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📚');

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_remix')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌');

    const components = [];
    
    if (randomTemplates.length > 0) {
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(templateSelect));
    }
    
    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(customSelect),
      new ActionRowBuilder<ButtonBuilder>().addComponents(quickRemixButton, browseTemplatesButton, cancelButton)
    );

    await interaction.editReply({
      embeds: [embed],
      components
    });
  }

  /**
   * Get emoji for game type
   */
  private getGameTypeEmoji(gameType: GameType): string {
    const emojis = {
      PLATFORMER: '🏃',
      PUZZLE: '🧩',  
      RPG: '⚔️',
      SHOOTER: '🔫',
      ENDLESS_RUNNER: '🏃‍♂️',
      TOWER_DEFENSE: '🏰',
      OTHER: '🎮'
    };
    return emojis[gameType] || '🎮';
  }

  /**
   * Calculate trending score for a remix
   */
  private calculateTrendingScore(remix: any): number {
    const playWeight = 0.6;
    const ageWeight = 0.3;
    const remixWeight = 0.1;

    const playScore = Math.min(remix.remixGame.playCount, 1000) / 10; // Max 100 points
    const ageScore = Math.max(0, 100 - (Date.now() - remix.remixedAt.getTime()) / (1000 * 60 * 60 * 24)); // Newer = higher
    const remixScore = (remix.originalGame._count?.originalGameRemixes || 1) * 5; // Bonus for remixing popular games

    return Math.round(playScore * playWeight + ageScore * ageWeight + remixScore * remixWeight);
  }

  /**
   * Get display-friendly remix type
   */
  private getRemixTypeDisplay(remixType: RemixType): string {
    const displays = {
      FORK: '🍴 Fork',
      VARIATION: '🎨 Variation', 
      COMMUNITY: '👥 Community',
      OFFICIAL: '⭐ Official'
    };
    return displays[remixType] || remixType;
  }

  /**
   * Get most active game type from trending remixes
   */
  private getMostActiveGameType(remixes: any[]): string {
    const typeCounts: Record<string, number> = {};
    remixes.forEach(remix => {
      const type = remix.originalGame.type;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const mostActive = Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (!mostActive) return 'No data';
    
    const emoji = this.getGameTypeEmoji(mostActive[0] as GameType);
    return `${emoji} ${mostActive[0]} (${mostActive[1]})`;
  }

  /**
   * Get top remix creator from trending remixes
   */
  private getTopRemixCreator(remixes: any[]): string {
    const creatorCounts: Record<string, number> = {};
    remixes.forEach(remix => {
      if (remix.remixedBy?.username) {
        const username = remix.remixedBy.username;
        creatorCounts[username] = (creatorCounts[username] || 0) + 1;
      }
    });

    const topCreator = Object.entries(creatorCounts)
      .sort(([,a], [,b]) => b - a)[0];
    
    return topCreator ? `@${topCreator[0]} (${topCreator[1]} remixes)` : 'No data';
  }
}