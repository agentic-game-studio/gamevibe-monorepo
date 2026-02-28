import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { SEOLandingPageService } from '../services/seo-landing-pages.js';
import { DatabaseService } from '../services/database.js';
import { LiveActivityService } from '../services/live-activity.js';
import { TYPES } from '../types.js';
import { generateGameEmoji } from '@gamevibe/shared';

@injectable()
export class SEOLandingPagesCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('landing-page')
    .setDescription('Manage SEO landing pages for your games')
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('generate')
        .setDescription('Generate an SEO-optimized landing page for a game')
        .addStringOption(option =>
          option
            .setName('game-id')
            .setDescription('The game ID to create a landing page for')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('template')
            .setDescription('Landing page template to use')
            .setRequired(false)
            .addChoices(
              { name: 'Gaming - For game enthusiasts', value: 'gaming' },
              { name: 'Educational - For learning content', value: 'educational' },
              { name: 'Casual - For casual players', value: 'casual' },
              { name: 'Showcase - For developer portfolios', value: 'showcase' }
            )
        )
        .addBooleanOption(option =>
          option
            .setName('include-related')
            .setDescription('Include related games section')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('include-creator')
            .setDescription('Include creator information')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('preview')
        .setDescription('Preview SEO metadata for a game landing page')
        .addStringOption(option =>
          option
            .setName('game-id')
            .setDescription('The game ID to preview')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('template')
            .setDescription('Template to preview')
            .setRequired(false)
            .addChoices(
              { name: 'Gaming', value: 'gaming' },
              { name: 'Educational', value: 'educational' },
              { name: 'Casual', value: 'casual' },
              { name: 'Showcase', value: 'showcase' }
            )
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('templates')
        .setDescription('View available landing page templates')
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('batch')
        .setDescription('Generate landing pages for multiple games (admin only)')
        .addStringOption(option =>
          option
            .setName('game-type')
            .setDescription('Generate for all games of this type')
            .setRequired(false)
            .addChoices(
              { name: 'Puzzle', value: 'puzzle' },
              { name: 'Platformer', value: 'platformer' },
              { name: 'Shooter', value: 'shooter' },
              { name: 'RPG', value: 'rpg' },
              { name: 'Adventure', value: 'adventure' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Maximum number of pages to generate (1-50)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('sitemap')
        .setDescription('Get sitemap information and regenerate if needed')
    );

  constructor(
    @inject(TYPES.SEOLandingPageService) private seoService: SEOLandingPageService,
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.LiveActivityService) private liveActivityService: LiveActivityService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'generate':
        await this.handleGenerate(interaction);
        break;
      case 'preview':
        await this.handlePreview(interaction);
        break;
      case 'templates':
        await this.handleTemplates(interaction);
        break;
      case 'batch':
        await this.handleBatch(interaction);
        break;
      case 'sitemap':
        await this.handleSitemap(interaction);
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
      const template = interaction.options.get('template', false)?.value as string || 'gaming';
      const includeRelated = interaction.options.get('include-related', false)?.value as boolean;
      const includeCreator = interaction.options.get('include-creator', false)?.value as boolean;

      // Get game details
      const game = await this.db.getGame(gameId);
      if (!game) {
        await interaction.editReply({
          content: '❌ Game not found. Please check the game ID and try again.'
        });
        return;
      }

      // Check if user is the creator or has permissions
      if (game.creatorId !== interaction.user.id) {
        // Could add server admin check here
        await interaction.editReply({
          content: '❌ You can only generate landing pages for games you created.'
        });
        return;
      }

      // Generate landing page
      const landingPage = await this.seoService.generateLandingPage(game.id, {
        includeRelated: includeRelated !== false,
        includeCreatorInfo: includeCreator !== false,
        customTemplate: template,
        optimizeFor: 'seo'
      });

      // Record activity
      await this.liveActivityService.recordActivity(
        'LANDING_PAGE_GENERATED',
        interaction.user.id,
        {
          gameTitle: game.name,
          gameType: game.type,
          template,
          url: landingPage.url
        },
        interaction.guildId || undefined,
        game.id
      );

      const emoji = generateGameEmoji(game.type);
      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`${emoji} Landing Page Generated`)
        .setDescription(`SEO-optimized landing page created for **${game.name}**`)
        .addFields(
          { 
            name: '🌐 Landing Page URL', 
            value: `[${landingPage.url}](${landingPage.url})`, 
            inline: false 
          },
          { 
            name: '📝 Template', 
            value: template, 
            inline: true 
          },
          { 
            name: '🔗 Slug', 
            value: landingPage.slug, 
            inline: true 
          },
          { 
            name: '📊 SEO Score', 
            value: this.calculateSEOScore(landingPage.seo), 
            inline: true 
          }
        )
        .addFields({
          name: '🔍 SEO Preview',
          value: `**Title:** ${landingPage.seo.title}\n**Description:** ${landingPage.seo.description}`,
          inline: false
        })
        .addFields({
          name: '🏷️ Keywords',
          value: landingPage.seo.keywords.slice(0, 8).map(k => `\`${k}\``).join(', '),
          inline: false
        })
        .setImage(landingPage.seo.ogImage)
        .setFooter({ 
          text: `Game: ${game.shortId} • Generated with ${template} template`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.editReply({
        content: '✅ **Landing page generated successfully!**\n\n' +
                 '🌐 Your game now has an SEO-optimized landing page that will help with search engine discovery.\n' +
                 '📈 The page includes structured data, social media cards, and optimized metadata.',
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error generating landing page:', error);
      await interaction.editReply({
        content: '❌ Failed to generate landing page. Please try again later.'
      });
    }
  }

  private async handlePreview(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const gameId = interaction.options.get('game-id', true).value as string;
      const template = interaction.options.get('template', false)?.value as string || 'gaming';

      // Get game details
      const game = await this.db.getGame(gameId);
      if (!game) {
        await interaction.editReply({
          content: '❌ Game not found. Please check the game ID and try again.'
        });
        return;
      }

      // Generate landing page for preview
      const landingPage = await this.seoService.generateLandingPage(game.id, {
        customTemplate: template,
        optimizeFor: 'seo'
      });

      const emoji = generateGameEmoji(game.type);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emoji} Landing Page Preview`)
        .setDescription(`Preview of SEO metadata for **${game.name}**`)
        .addFields(
          { 
            name: '📝 Page Title', 
            value: landingPage.seo.title, 
            inline: false 
          },
          { 
            name: '📄 Meta Description', 
            value: landingPage.seo.description, 
            inline: false 
          },
          { 
            name: '🌐 Canonical URL', 
            value: landingPage.seo.canonicalUrl, 
            inline: false 
          },
          { 
            name: '📱 Social Media Title', 
            value: landingPage.seo.ogTitle, 
            inline: true 
          },
          { 
            name: '🐦 Twitter Description', 
            value: landingPage.seo.twitterDescription.slice(0, 100) + '...', 
            inline: true 
          },
          { 
            name: '📊 SEO Score', 
            value: this.calculateSEOScore(landingPage.seo), 
            inline: true 
          }
        )
        .addFields({
          name: '🏷️ Keywords',
          value: landingPage.seo.keywords.slice(0, 10).map(k => `\`${k}\``).join(', '),
          inline: false
        })
        .setImage(landingPage.seo.ogImage)
        .setFooter({ 
          text: `Template: ${template} • Use /landing-page generate to create the actual page`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add template recommendation
      const templateInfo = this.getTemplateInfo(template);
      if (templateInfo) {
        embed.addFields({
          name: '🎨 Template Info',
          value: `**${templateInfo.name}**\n${templateInfo.description}\n**Performance Score:** ${templateInfo.performanceScore}/100`,
          inline: false
        });
      }

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error previewing landing page:', error);
      await interaction.editReply({
        content: '❌ Failed to preview landing page. Please try again later.'
      });
    }
  }

  private async handleTemplates(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      const templates = this.seoService.getLandingPageTemplates();

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎨 Landing Page Templates')
        .setDescription('Choose from optimized templates for different audiences and use cases')
        .setFooter({ 
          text: 'Use /landing-page generate <game-id> template:<template-name> to apply a template',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add template details
      for (const template of templates) {
        const optimizations = template.seoOptimizations.slice(0, 3).join(', ');
        const sections = template.contentSections.slice(0, 4).join(', ');

        embed.addFields({
          name: `${this.getTemplateEmoji(template.name)} ${template.name.charAt(0).toUpperCase() + template.name.slice(1)}`,
          value: `**Description:** ${template.description}\n` +
                 `**Target Audience:** ${template.targetAudience}\n` +
                 `**Hero Layout:** ${template.heroLayout}\n` +
                 `**Sections:** ${sections}\n` +
                 `**SEO Features:** ${optimizations}\n` +
                 `**Performance Score:** ${template.performanceScore}/100`,
          inline: false
        });
      }

      await interaction.editReply({
        content: '🎨 **Available Landing Page Templates**\n\n' +
                 'Each template is optimized for specific audiences and use cases. Choose the one that best fits your game and target audience.',
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting templates:', error);
      await interaction.editReply({
        content: '❌ Failed to get templates. Please try again later.'
      });
    }
  }

  private async handleBatch(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      // Simple admin check - in production, you might want a more robust system
      const isAdmin = interaction.user.id === process.env.ADMIN_USER_ID || 
                      interaction.memberPermissions?.has('Administrator');

      if (!isAdmin) {
        await interaction.editReply({
          content: '❌ This command requires administrator permissions.'
        });
        return;
      }

      const gameType = interaction.options.get('game-type', false)?.value as string;
      const limit = interaction.options.get('limit', false)?.value as number || 20;

      // Get games based on criteria
      const games = await this.db.prisma.game.findMany({
        where: gameType ? { type: gameType } : undefined,
        select: { id: true, name: true, type: true, creatorId: true },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      if (games.length === 0) {
        await interaction.editReply({
          content: `❌ No games found${gameType ? ` of type ${gameType}` : ''}.`
        });
        return;
      }

      const gameIds = games.map(g => g.id);

      // Generate landing pages in batch
      const landingPages = await this.seoService.getBatchLandingPages(gameIds, {
        optimizeFor: 'seo',
        customTemplate: 'gaming'
      });

      // Record activity
      await this.liveActivityService.recordActivity(
        'BATCH_LANDING_PAGES_GENERATED',
        interaction.user.id,
        {
          totalGames: games.length,
          generatedPages: landingPages.length,
          gameType: gameType || 'all',
          requestedBy: interaction.user.id
        },
        interaction.guildId || undefined
      );

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('📋 Batch Landing Page Generation')
        .setDescription(`Generated landing pages for ${landingPages.length} out of ${games.length} games`)
        .addFields(
          { 
            name: '🎮 Games Processed', 
            value: games.length.toString(), 
            inline: true 
          },
          { 
            name: '✅ Pages Generated', 
            value: landingPages.length.toString(), 
            inline: true 
          },
          { 
            name: '📊 Success Rate', 
            value: `${Math.round((landingPages.length / games.length) * 100)}%`, 
            inline: true 
          }
        )
        .setFooter({ 
          text: `Filter: ${gameType || 'All types'} • Limit: ${limit}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add details about generated pages
      if (landingPages.length > 0) {
        const samplePages = landingPages.slice(0, 5);
        const pagesList = samplePages.map(page => 
          `• [${page.title}](${page.url})`
        ).join('\n');

        embed.addFields({
          name: '🔗 Sample Generated Pages',
          value: pagesList + (landingPages.length > 5 ? `\n... and ${landingPages.length - 5} more` : ''),
          inline: false
        });
      }

      await interaction.editReply({
        content: '✅ **Batch landing page generation complete!**\n\n' +
                 '🌐 All generated pages are now available and optimized for search engines.',
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error in batch generation:', error);
      await interaction.editReply({
        content: '❌ Failed to generate landing pages in batch. Please try again later.'
      });
    }
  }

  private async handleSitemap(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    try {
      // Get sitemap statistics
      const allGames = await this.db.prisma.game.count();
      const recentGames = await this.db.prisma.game.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      });

      const baseUrl = process.env.WEB_RUNTIME_URL || 'http://localhost:3001';
      const sitemapUrl = `${baseUrl}/sitemap.xml`;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🗺️ Sitemap Information')
        .setDescription('SEO sitemap status and information')
        .addFields(
          { 
            name: '🎮 Total Games', 
            value: allGames.toLocaleString(), 
            inline: true 
          },
          { 
            name: '🆕 Recent Games', 
            value: `${recentGames} (last 7 days)`, 
            inline: true 
          },
          { 
            name: '🌐 Sitemap URL', 
            value: `[sitemap.xml](${sitemapUrl})`, 
            inline: false 
          }
        )
        .addFields({
          name: '📋 Included Pages',
          value: '• Homepage\n• Games list page\n• All individual game landing pages\n• Game type category pages',
          inline: false
        })
        .addFields({
          name: '🔄 Update Frequency',
          value: '• **Homepage:** Daily\n• **Game pages:** Weekly\n• **New games:** Immediate',
          inline: false
        })
        .setFooter({ 
          text: 'Sitemap is automatically updated when new games are created',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.editReply({
        content: '🗺️ **Sitemap Status**\n\n' +
                 '✅ The sitemap is automatically generated and updated to help search engines discover your games.',
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error getting sitemap info:', error);
      await interaction.editReply({
        content: '❌ Failed to get sitemap information. Please try again later.'
      });
    }
  }

  private calculateSEOScore(seo: any): string {
    let score = 0;
    let maxScore = 100;

    // Title optimization (20 points)
    if (seo.title && seo.title.length >= 30 && seo.title.length <= 60) {
      score += 20;
    } else if (seo.title && seo.title.length > 0) {
      score += 10;
    }

    // Description optimization (20 points)
    if (seo.description && seo.description.length >= 150 && seo.description.length <= 160) {
      score += 20;
    } else if (seo.description && seo.description.length > 0) {
      score += 10;
    }

    // Keywords (15 points)
    if (seo.keywords && seo.keywords.length >= 5) {
      score += 15;
    } else if (seo.keywords && seo.keywords.length > 0) {
      score += 8;
    }

    // Open Graph (15 points)
    if (seo.ogTitle && seo.ogDescription && seo.ogImage) {
      score += 15;
    }

    // Twitter Cards (10 points)
    if (seo.twitterTitle && seo.twitterDescription && seo.twitterImage) {
      score += 10;
    }

    // Structured Data (10 points)
    if (seo.structuredData && Object.keys(seo.structuredData).length > 0) {
      score += 10;
    }

    // Canonical URL (10 points)
    if (seo.canonicalUrl) {
      score += 10;
    }

    const percentage = Math.round((score / maxScore) * 100);
    const emoji = percentage >= 90 ? '🟢' : percentage >= 70 ? '🟡' : '🔴';
    
    return `${emoji} ${percentage}/100`;
  }

  private getTemplateInfo(templateName: string): any {
    const templates = this.seoService.getLandingPageTemplates();
    return templates.find(t => t.name === templateName);
  }

  private getTemplateEmoji(templateName: string): string {
    const emojis = {
      gaming: '🎮',
      educational: '📚',
      casual: '😊',
      showcase: '🎨'
    };
    return emojis[templateName as keyof typeof emojis] || '📄';
  }
}