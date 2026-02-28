import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { EmbedService, EmbedConfig } from '../services/embed.js';
import { DatabaseService } from '../services/database.js';
import { LiveActivityService } from '../services/live-activity.js';
import { TYPES } from '../types.js';
import { generateGameEmoji } from '@gamevibe/shared';

@injectable()
export class EmbedCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Generate embed codes for sharing games on websites and social media')
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('generate')
        .setDescription('Generate an embed code for a game')
        .addStringOption(option =>
          option
            .setName('game-id')
            .setDescription('The game ID to create an embed for')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('template')
            .setDescription('Embed template to use')
            .setRequired(false)
            .addChoices(
              { name: 'Minimal - Clean, compact embed (640x480)', value: 'minimal' },
              { name: 'Standard - Full-featured embed (800x600)', value: 'standard' },
              { name: 'Showcase - Large, high-impact embed (1024x768)', value: 'showcase' },
              { name: 'Blog - Optimized for blog content (700x525)', value: 'blog' },
              { name: 'Social - Compact for social media (600x450)', value: 'social' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('width')
            .setDescription('Custom width (300-2000px)')
            .setRequired(false)
            .setMinValue(300)
            .setMaxValue(2000)
        )
        .addIntegerOption(option =>
          option
            .setName('height')
            .setDescription('Custom height (200-1500px)')
            .setRequired(false)
            .setMinValue(200)
            .setMaxValue(1500)
        )
        .addStringOption(option =>
          option
            .setName('theme')
            .setDescription('Color theme for the embed')
            .setRequired(false)
            .addChoices(
              { name: 'Auto - Adapts to context', value: 'auto' },
              { name: 'Light - Light theme', value: 'light' },
              { name: 'Dark - Dark theme', value: 'dark' }
            )
        )
        .addBooleanOption(option =>
          option
            .setName('autoplay')
            .setDescription('Whether the game should start automatically')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('show-stats')
            .setDescription('Show game statistics in the embed')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('show-branding')
            .setDescription('Show GameVibe AI branding')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('analytics')
        .setDescription('View analytics for a game embed')
        .addStringOption(option =>
          option
            .setName('embed-id')
            .setDescription('The embed ID to view analytics for')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('Analytics timeframe')
            .setRequired(false)
            .addChoices(
              { name: 'Last 24 hours', value: 'day' },
              { name: 'Last week', value: 'week' },
              { name: 'Last month', value: 'month' },
              { name: 'Last year', value: 'year' }
            )
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('list')
        .setDescription('List all embeds for a game')
        .addStringOption(option =>
          option
            .setName('game-id')
            .setDescription('The game ID to list embeds for')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('templates')
        .setDescription('View available embed templates and their configurations')
    );

  constructor(
    @inject(TYPES.EmbedService) private embedService: EmbedService,
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.LiveActivityService) private liveActivityService: LiveActivityService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'generate':
        await this.handleGenerate(interaction);
        break;
      case 'analytics':
        await this.handleAnalytics(interaction);
        break;
      case 'list':
        await this.handleList(interaction);
        break;
      case 'templates':
        await this.handleTemplates(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand',
          ephemeral: true
        });
    }
  }

  private async handleGenerate(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const gameId = interaction.options.get('game-id', true).value as string;
      const template = interaction.options.get('template', false)?.value as string;
      const customWidth = interaction.options.get('width', false)?.value as number;
      const customHeight = interaction.options.get('height', false)?.value as number;
      const theme = interaction.options.get('theme', false)?.value as string;
      const autoplay = interaction.options.get('autoplay', false)?.value as boolean;
      const showStats = interaction.options.get('show-stats', false)?.value as boolean;
      const showBranding = interaction.options.get('show-branding', false)?.value as boolean;

      // Get game details
      const game = await this.db.getGame(gameId);
      if (!game) {
        await interaction.editReply({
          content: '❌ Game not found. Please check the game ID and try again.'
        });
        return;
      }

      // Build custom config
      const customConfig: Partial<EmbedConfig> = {};
      if (customWidth) customConfig.width = customWidth;
      if (customHeight) customConfig.height = customHeight;
      if (theme) customConfig.theme = theme as any;
      if (autoplay !== undefined) customConfig.autoplay = autoplay;
      if (showStats !== undefined) customConfig.showStats = showStats;
      if (showBranding !== undefined) customConfig.showBranding = showBranding;

      // Generate embed code
      const embedCode = await this.embedService.generateEmbedCode(
        gameId,
        customConfig,
        interaction.user.id,
        template as any
      );

      // Record activity
      await this.liveActivityService.recordActivity(
        'EMBED_GENERATED',
        interaction.user.id,
        {
          gameTitle: game.name,
          gameType: game.type,
          template: template || 'custom',
          embedId: embedCode.embedId
        },
        interaction.guildId || undefined,
        game.id
      );

      // Create response embed
      const emoji = generateGameEmoji(game.type);
      const responseEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`${emoji} Embed Code Generated`)
        .setDescription(`Embed code created for **${game.name}**`)
        .addFields(
          { 
            name: '🆔 Embed ID', 
            value: `\`${embedCode.embedId}\``, 
            inline: true 
          },
          { 
            name: '📐 Dimensions', 
            value: `${embedCode.config.width}×${embedCode.config.height}px`, 
            inline: true 
          },
          { 
            name: '🎨 Template', 
            value: template || 'Custom', 
            inline: true 
          },
          {
            name: '🔗 Direct URL',
            value: `[Open in browser](${embedCode.directUrl})`,
            inline: false
          },
          {
            name: '📋 iframe Code',
            value: `\`\`\`html\n${embedCode.iframeCode.substring(0, 1000)}${embedCode.iframeCode.length > 1000 ? '...' : ''}\n\`\`\``,
            inline: false
          }
        )
        .addFields({
          name: '📊 Analytics',
          value: `Use \`/embed analytics ${embedCode.embedId}\` to track performance`,
          inline: false
        })
        .setFooter({ 
          text: `Game: ${game.shortId} • Created by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.editReply({
        content: '✅ **Embed code generated successfully!**\n\n' +
                 '📝 Copy the iframe code above to embed this game on your website, blog, or social media.\n' +
                 '📈 All embed views and plays will be tracked for analytics.',
        embeds: [responseEmbed]
      });

    } catch (error) {
      console.error('Error generating embed:', error);
      await interaction.editReply({
        content: '❌ Failed to generate embed code. Please try again later.'
      });
    }
  }

  private async handleAnalytics(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const embedId = interaction.options.get('embed-id', true).value as string;
      const timeframe = interaction.options.get('timeframe', false)?.value as string || 'week';

      const analytics = await this.embedService.getEmbedAnalytics(embedId, timeframe as any);

      if (!analytics) {
        await interaction.editReply({
          content: '❌ Embed not found or analytics not available.'
        });
        return;
      }

      // Get game details
      const game = await this.db.getGame(analytics.gameId);
      const gameName = game?.name || 'Unknown Game';
      const emoji = game ? generateGameEmoji(game.type) : '🎮';

      const analyticsEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📊 Embed Analytics - ${timeframe}`)
        .setDescription(`Analytics for **${gameName}** embed`)
        .addFields(
          { name: '👀 Total Views', value: analytics.totalViews.toLocaleString(), inline: true },
          { name: '🎮 Total Plays', value: analytics.totalPlays.toLocaleString(), inline: true },
          { name: '👥 Unique Visitors', value: analytics.uniqueVisitors.toLocaleString(), inline: true },
          { name: '📈 Conversion Rate', value: `${analytics.conversionRate}%`, inline: true },
          { name: '⭐ Performance Score', value: `${analytics.performanceScore}/100`, inline: true },
          { name: '⏰ Timeframe', value: timeframe.charAt(0).toUpperCase() + timeframe.slice(1), inline: true }
        )
        .setFooter({ 
          text: `Embed ID: ${embedId} • ${gameName}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add performance insights
      let insights = '';
      if (analytics.conversionRate > 15) {
        insights += '🔥 Excellent conversion rate! ';
      } else if (analytics.conversionRate > 8) {
        insights += '👍 Good conversion rate. ';
      } else {
        insights += '💡 Consider optimizing embed placement or adding autoplay. ';
      }

      if (analytics.performanceScore > 80) {
        insights += 'High-performing embed!';
      } else if (analytics.performanceScore > 60) {
        insights += 'Solid performance with room for improvement.';
      } else {
        insights += 'Try different templates or optimize for your audience.';
      }

      analyticsEmbed.addFields({
        name: '💡 Insights',
        value: insights,
        inline: false
      });

      await interaction.editReply({
        embeds: [analyticsEmbed]
      });

    } catch (error) {
      console.error('Error getting embed analytics:', error);
      await interaction.editReply({
        content: '❌ Failed to get embed analytics. Please try again later.'
      });
    }
  }

  private async handleList(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const gameId = interaction.options.get('game-id', true).value as string;

      // Get game details
      const game = await this.db.getGame(gameId);
      if (!game) {
        await interaction.editReply({
          content: '❌ Game not found. Please check the game ID and try again.'
        });
        return;
      }

      const embeds = await this.embedService.getGameEmbeds(gameId);

      if (embeds.length === 0) {
        await interaction.editReply({
          content: `📝 No embeds found for **${game.name}**.\n\nUse \`/embed generate ${gameId}\` to create your first embed!`
        });
        return;
      }

      const emoji = generateGameEmoji(game.type);
      const listEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emoji} Embeds for ${game.name}`)
        .setDescription(`Found ${embeds.length} embed${embeds.length !== 1 ? 's' : ''} for this game`)
        .setFooter({ 
          text: `Game: ${game.shortId} • Use /embed analytics <embed-id> for detailed stats`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add embed details (max 25 fields)
      const maxEmbeds = Math.min(embeds.length, 10);
      for (let i = 0; i < maxEmbeds; i++) {
        const embed = embeds[i];
        listEmbed.addFields({
          name: `📋 ${embed.embedId}`,
          value: `**Size:** ${embed.config.width}×${embed.config.height}px\n` +
                 `**Views:** ${embed.analytics.views} • **Plays:** ${embed.analytics.plays}\n` +
                 `**Created:** <t:${Math.floor(embed.createdAt.getTime() / 1000)}:R>`,
          inline: false
        });
      }

      if (embeds.length > maxEmbeds) {
        listEmbed.addFields({
          name: '📋 More Embeds',
          value: `... and ${embeds.length - maxEmbeds} more embeds`,
          inline: false
        });
      }

      await interaction.editReply({
        embeds: [listEmbed]
      });

    } catch (error) {
      console.error('Error listing embeds:', error);
      await interaction.editReply({
        content: '❌ Failed to list embeds. Please try again later.'
      });
    }
  }

  private async handleTemplates(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const templates = this.embedService.getEmbedTemplates();

      const templatesEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎨 Embed Templates')
        .setDescription('Choose from pre-configured templates or customize your own embed')
        .setFooter({ 
          text: 'Use /embed generate <game-id> template:<template-name> to use a template',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add template details
      const templateEntries = Object.entries(templates);
      for (const [key, config] of templateEntries) {
        const features = [];
        if (config.showUI) features.push('Full UI');
        if (config.showStats) features.push('Statistics');
        if (config.showCreator) features.push('Creator Info');
        if (config.autoplay) features.push('Autoplay');
        if (config.showBranding) features.push('Branding');

        templatesEmbed.addFields({
          name: `${key.charAt(0).toUpperCase() + key.slice(1)} Template`,
          value: `**Size:** ${config.width}×${config.height}px\n` +
                 `**Theme:** ${config.theme}\n` +
                 `**Features:** ${features.join(', ') || 'Minimal'}\n` +
                 `**Best for:** ${this.getTemplateUseCase(key)}`,
          inline: true
        });
      }

      await interaction.editReply({
        content: '🎨 **Available Embed Templates**\n\n' +
                 'Each template is optimized for different use cases. You can also customize any template with your own settings.',
        embeds: [templatesEmbed]
      });

    } catch (error) {
      console.error('Error getting templates:', error);
      await interaction.editReply({
        content: '❌ Failed to get embed templates. Please try again later.'
      });
    }
  }

  private getTemplateUseCase(template: string): string {
    const useCases = {
      minimal: 'Sidebars, widgets, small spaces',
      standard: 'Blog posts, portfolio pages',
      showcase: 'Landing pages, game galleries',
      blog: 'Article content, reviews',
      social: 'Social media, forums'
    };
    return useCases[template as keyof typeof useCases] || 'General use';
  }
}