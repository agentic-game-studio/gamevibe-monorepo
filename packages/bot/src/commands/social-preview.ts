import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { SocialPreviewService, SocialPreviewCard } from '../services/social-preview.js';
import { AnalyticsService } from '../services/analytics.js';
import { TYPES } from '../types.js';

@injectable()
export class SocialPreviewCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('social-preview')
    .setDescription('Generate and manage social media preview cards for your games')
    .addSubcommand(subcommand =>
      subcommand
        .setName('generate')
        .setDescription('Generate a social preview card for a game')
        .addStringOption(option =>
          option
            .setName('game-id')
            .setDescription('Game ID or short ID to generate preview for')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('platform')
            .setDescription('Target social media platform')
            .addChoices(
              { name: 'Generic (All Platforms)', value: 'generic' },
              { name: 'Twitter', value: 'twitter' },
              { name: 'Facebook', value: 'facebook' },
              { name: 'Discord', value: 'discord' }
            )
        )
        .addBooleanOption(option =>
          option
            .setName('include-gif')
            .setDescription('Include animated gameplay GIF in preview')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('analytics')
        .setDescription('View preview analytics for a game')
        .addStringOption(option =>
          option
            .setName('game-id')
            .setDescription('Game ID or short ID to view analytics for')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('Analytics timeframe')
            .addChoices(
              { name: 'Last 24 Hours', value: 'day' },
              { name: 'Last Week', value: 'week' },
              { name: 'Last Month', value: 'month' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('share-url')
        .setDescription('Get shareable URLs for a game preview')
        .addStringOption(option =>
          option
            .setName('game-id')
            .setDescription('Game ID or short ID to get share URLs for')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('metadata')
        .setDescription('View OpenGraph and Twitter Card metadata for a game')
        .addStringOption(option =>
          option
            .setName('game-id')
            .setDescription('Game ID or short ID to view metadata for')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('templates')
        .setDescription('View available preview card templates and platforms')
    );

  constructor(
    @inject(TYPES.SocialPreviewService) private socialPreviewService: SocialPreviewService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'generate':
          await this.handleGenerate(interaction);
          break;
        case 'analytics':
          await this.handleAnalytics(interaction);
          break;
        case 'share-url':
          await this.handleShareURL(interaction);
          break;
        case 'metadata':
          await this.handleMetadata(interaction);
          break;
        case 'templates':
          await this.handleTemplates(interaction);
          break;
      }
    } catch (error) {
      console.error('Error in social-preview command:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing your request. Please check the game ID and try again.',
        ephemeral: true
      });
    }
  }

  private async handleGenerate(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const gameId = interaction.options.getString('game-id', true);
    const platform = interaction.options.getString('platform') as 'twitter' | 'facebook' | 'discord' | 'generic' || 'generic';
    const includeGIF = interaction.options.getBoolean('include-gif') || false;

    try {
      // Generate the preview card
      const previewCard = await this.socialPreviewService.generatePreviewCard(gameId, platform, includeGIF);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎨 Social Preview Card Generated!')
        .setDescription(`Preview card created for **${previewCard.metadata.gameTitle}**`)
        .setImage(previewCard.imageUrl)
        .addFields(
          {
            name: '🎮 Game Details',
            value: `**Title**: ${previewCard.metadata.gameTitle}\n` +
                   `**Type**: ${previewCard.metadata.gameType}\n` +
                   `**Creator**: ${previewCard.metadata.creatorName}\n` +
                   `**Server**: ${previewCard.metadata.serverName}`,
            inline: true
          },
          {
            name: '📊 Performance',
            value: `**${previewCard.metadata.playCount}** plays\n` +
                   `**${previewCard.metadata.serverCount}** servers\n` +
                   `**${previewCard.metadata.rating?.toFixed(1) || 'N/A'}** rating\n` +
                   `**${platform}** platform`,
            inline: true
          },
          {
            name: '🏷️ Tags',
            value: previewCard.metadata.tags.slice(0, 5).map(tag => `\`${tag}\``).join(' ') || 'None',
            inline: false
          }
        )
        .setFooter({ 
          text: `GameVibe AI • ${previewCard.metadata.dimensions.width}x${previewCard.metadata.dimensions.height}` 
        })
        .setTimestamp();

      // Add GIF field if included
      if (previewCard.gifUrl) {
        embed.addFields({
          name: '🎬 Animated Preview',
          value: `[View Gameplay GIF](${previewCard.gifUrl})`,
          inline: false
        });
      }

      // Create action buttons
      const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`preview-share-${gameId}`)
            .setLabel('Get Share URLs')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔗'),
          new ButtonBuilder()
            .setCustomId(`preview-metadata-${gameId}`)
            .setLabel('View Metadata')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋'),
          new ButtonBuilder()
            .setCustomId(`preview-analytics-${gameId}`)
            .setLabel('View Analytics')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📈')
        );

      await interaction.editReply({ 
        embeds: [embed], 
        components: [buttons] 
      });

      // Track analytics
      await this.analytics.track('social_preview_command_used', {
        userId: interaction.user.id,
        serverId: interaction.guildId,
        gameId,
        platform,
        includeGIF
      });

    } catch (error) {
      console.error('Error generating preview:', error);
      await interaction.editReply({
        content: `❌ Failed to generate preview for game \`${gameId}\`. Please check the game ID and try again.`
      });
    }
  }

  private async handleAnalytics(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const gameId = interaction.options.getString('game-id', true);
    const timeframe = interaction.options.getString('timeframe') as 'day' | 'week' | 'month' || 'week';

    try {
      const analytics = await this.socialPreviewService.getPreviewAnalytics(gameId, timeframe);

      const analyticsEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('📈 Social Preview Analytics')
        .setDescription(`Analytics for game \`${gameId}\` over the last ${timeframe}`)
        .addFields(
          {
            name: '👀 Engagement Overview',
            value: `**${analytics.views.toLocaleString()}** views\n` +
                   `**${analytics.shares.toLocaleString()}** shares\n` +
                   `**${(analytics.engagement * 100).toFixed(1)}%** engagement rate`,
            inline: true
          },
          {
            name: '📊 Performance',
            value: `**${(analytics.shares / Math.max(analytics.views, 1) * 100).toFixed(1)}%** share rate\n` +
                   `**${Math.round(analytics.views / this.getTimeframeDays(timeframe))}** views/day\n` +
                   `**${Math.round(analytics.shares / this.getTimeframeDays(timeframe))}** shares/day`,
            inline: true
          },
          {
            name: '🌐 Platform Breakdown',
            value: Object.entries(analytics.platforms)
              .sort(([,a], [,b]) => b - a)
              .map(([platform, count]) => `**${platform}**: ${count}`)
              .join('\n') || 'No platform data',
            inline: false
          }
        )
        .setFooter({ text: `GameVibe AI • Analytics for ${timeframe}` })
        .setTimestamp();

      // Add performance indicators
      let performanceIndicator = '🔴 Low Performance';
      let performanceColor = 0xED4245;

      if (analytics.engagement > 0.10) {
        performanceIndicator = '🟢 Excellent Performance';
        performanceColor = 0x57F287;
      } else if (analytics.engagement > 0.05) {
        performanceIndicator = '🟡 Good Performance';
        performanceColor = 0xFEE75C;
      }

      analyticsEmbed.setColor(performanceColor);
      analyticsEmbed.addFields({
        name: '⚡ Performance Status',
        value: performanceIndicator,
        inline: false
      });

      await interaction.editReply({ embeds: [analyticsEmbed] });

    } catch (error) {
      console.error('Error getting analytics:', error);
      await interaction.editReply({
        content: `❌ Failed to get analytics for game \`${gameId}\`. Please check the game ID and try again.`
      });
    }
  }

  private async handleShareURL(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const gameId = interaction.options.getString('game-id', true);

    try {
      const platforms = ['generic', 'twitter', 'facebook', 'discord'];
      const shareURLs = platforms.map(platform => ({
        platform,
        url: this.socialPreviewService.generateShareableURL(gameId, platform)
      }));

      const shareEmbed = new EmbedBuilder()
        .setColor(0xFF6B35)
        .setTitle('🔗 Shareable Preview URLs')
        .setDescription(`Share your game \`${gameId}\` across different platforms`)
        .addFields(
          ...shareURLs.map(({ platform, url }) => ({
            name: `${this.getPlatformEmoji(platform)} ${this.capitalizePlatform(platform)}`,
            value: `[Share Preview](${url})\n\`${url}\``,
            inline: false
          }))
        )
        .addFields({
          name: '💡 How to Use',
          value: '• Copy the URL for your target platform\n' +
                 '• Paste it in your social media post\n' +
                 '• The preview card will automatically appear\n' +
                 '• URLs include OpenGraph and Twitter Card metadata',
          inline: false
        })
        .setFooter({ text: 'GameVibe AI • Social Sharing' })
        .setTimestamp();

      await interaction.editReply({ embeds: [shareEmbed] });

    } catch (error) {
      console.error('Error generating share URLs:', error);
      await interaction.editReply({
        content: `❌ Failed to generate share URLs for game \`${gameId}\`.`
      });
    }
  }

  private async handleMetadata(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const gameId = interaction.options.getString('game-id', true);

    try {
      const [openGraphMeta, twitterMeta] = await Promise.all([
        this.socialPreviewService.getOpenGraphMetadata(gameId),
        this.socialPreviewService.getTwitterCardMetadata(gameId)
      ]);

      const metadataEmbed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('📋 Social Media Metadata')
        .setDescription(`OpenGraph and Twitter Card metadata for game \`${gameId}\``)
        .setFooter({ text: 'GameVibe AI • Social Metadata' })
        .setTimestamp();

      // OpenGraph metadata
      const ogFields = Object.entries(openGraphMeta)
        .slice(0, 8) // Limit to prevent too long embeds
        .map(([key, value]) => `**${key}**: ${value}`)
        .join('\n');

      metadataEmbed.addFields({
        name: '🌐 OpenGraph Metadata',
        value: ogFields || 'No OpenGraph metadata',
        inline: false
      });

      // Twitter metadata  
      const twitterFields = Object.entries(twitterMeta)
        .slice(0, 6)
        .map(([key, value]) => `**${key}**: ${value}`)
        .join('\n');

      metadataEmbed.addFields({
        name: '🐦 Twitter Card Metadata',
        value: twitterFields || 'No Twitter metadata',
        inline: false
      });

      // Usage instructions
      metadataEmbed.addFields({
        name: '🔧 Implementation',
        value: '• Add these meta tags to your HTML `<head>`\n' +
               '• Use our preview URLs for automatic metadata\n' +
               '• Test with Facebook Debugger and Twitter Validator\n' +
               '• Metadata updates automatically with game stats',
        inline: false
      });

      await interaction.editReply({ embeds: [metadataEmbed] });

    } catch (error) {
      console.error('Error getting metadata:', error);
      await interaction.editReply({
        content: `❌ Failed to get metadata for game \`${gameId}\`.`
      });
    }
  }

  private async handleTemplates(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const templatesEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🎨 Available Preview Templates')
      .setDescription('Social media preview card templates and platform specifications')
      .addFields(
        {
          name: '🐦 Twitter Cards',
          value: '**Dimensions**: 1200x675 pixels\n' +
                 '**Type**: Summary Large Image\n' +
                 '**Features**: Auto-cropping, GIF support\n' +
                 '**Best for**: Quick shares, viral content',
          inline: true
        },
        {
          name: '📘 Facebook Shares',
          value: '**Dimensions**: 1200x630 pixels\n' +
                 '**Type**: Article/Website\n' +
                 '**Features**: Rich descriptions, metrics\n' +
                 '**Best for**: Detailed game info',
          inline: true
        },
        {
          name: '💬 Discord Embeds',
          value: '**Dimensions**: 800x450 pixels\n' +
                 '**Type**: Rich Embed\n' +
                 '**Features**: Native Discord styling\n' +
                 '**Best for**: Server sharing',
          inline: true
        },
        {
          name: '🌐 Generic Cards',
          value: '**Dimensions**: 1200x630 pixels\n' +
                 '**Type**: Universal\n' +
                 '**Features**: Cross-platform compatibility\n' +
                 '**Best for**: All platforms',
          inline: true
        },
        {
          name: '🎬 GIF Features',
          value: '• **Duration**: 5 seconds max\n' +
                 '• **Resolution**: 640x360 pixels\n' +
                 '• **Size**: 5MB maximum\n' +
                 '• **FPS**: 10 frames per second',
          inline: true
        },
        {
          name: '⚙️ Customization',
          value: '• Game title and description\n' +
                 '• Creator and server info\n' +
                 '• Play count and ratings\n' +
                 '• Dynamic backgrounds and colors',
          inline: true
        }
      )
      .addFields({
        name: '💡 Tips for Best Results',
        value: '🎯 **Include GIFs** for higher engagement\n' +
               '📊 **Use analytics** to optimize performance\n' +
               '🏷️ **Add relevant tags** for discoverability\n' +
               '🔄 **Update regularly** as stats improve\n' +
               '📱 **Test on multiple platforms** before sharing',
        inline: false
      })
      .setFooter({ text: 'GameVibe AI • Preview Templates' })
      .setTimestamp();

    await interaction.editReply({ embeds: [templatesEmbed] });

    // Track analytics
    await this.analytics.track('social_preview_templates_viewed', {
      userId: interaction.user.id,
      serverId: interaction.guildId
    });
  }

  private getPlatformEmoji(platform: string): string {
    const emojis = {
      twitter: '🐦',
      facebook: '📘', 
      discord: '💬',
      generic: '🌐'
    };
    return emojis[platform as keyof typeof emojis] || '🌐';
  }

  private capitalizePlatform(platform: string): string {
    return platform.charAt(0).toUpperCase() + platform.slice(1);
  }

  private getTimeframeDays(timeframe: string): number {
    switch (timeframe) {
      case 'day': return 1;
      case 'week': return 7;
      case 'month': return 30;
      default: return 7;
    }
  }
}