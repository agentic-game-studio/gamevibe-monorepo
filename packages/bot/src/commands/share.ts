import { CommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { DatabaseService } from '../services/database.js';
import { PersonalCreditService } from '../services/personal-credits.js';
import { AnalyticsService } from '../services/analytics.js';
import { AchievementService } from '../services/achievement.js';
import { SocialPreviewService } from '../services/social-preview.js';
import { LiveActivityService } from '../services/live-activity.js';
import { EmbedService } from '../services/embed.js';
import { TYPES } from '../types.js';
import { generateGameEmoji } from '@gamevibe/shared';

@injectable()
export class ShareCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('share')
    .setDescription('Share a game and earn credits')
    .addStringOption(option =>
      option
        .setName('game-id')
        .setDescription('The game ID to share')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Optional message to include with the share')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('include-embed')
        .setDescription('Generate embed code for website sharing')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('embed-template')
        .setDescription('Quick embed template (only used if include-embed is true)')
        .setRequired(false)
        .addChoices(
          { name: 'Standard - Full-featured (800x600)', value: 'standard' },
          { name: 'Blog - Optimized for blogs (700x525)', value: 'blog' },
          { name: 'Social - Compact for social media (600x450)', value: 'social' },
          { name: 'Showcase - Large display (1024x768)', value: 'showcase' }
        )
    );

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.PersonalCreditService) private personalCreditService: PersonalCreditService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.AchievementService) private achievementService: AchievementService,
    @inject(TYPES.SocialPreviewService) private socialPreviewService: SocialPreviewService,
    @inject(TYPES.LiveActivityService) private liveActivityService: LiveActivityService,
    @inject(TYPES.EmbedService) private embedService: EmbedService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply();

    const gameId = interaction.options.get('game-id', true).value as string;
    const customMessage = interaction.options.get('message', false)?.value as string;
    const includeEmbed = interaction.options.get('include-embed', false)?.value as boolean;
    const embedTemplate = interaction.options.get('embed-template', false)?.value as string;

    try {
      // Get game details
      const game = await this.db.getGame(gameId);
      
      if (!game) {
        await interaction.editReply({
          content: '❌ Game not found. Please check the game ID and try again.'
        });
        return;
      }

      // Generate social preview card for sharing
      const socialPreview = await this.socialPreviewService.generatePreviewCard(
        game.id,
        'discord',
        true // Include GIF for better engagement
      );

      // Generate embed code if requested
      let embedCode = null;
      if (includeEmbed) {
        try {
          embedCode = await this.embedService.generateEmbedCode(
            game.id,
            {}, // Use template defaults
            interaction.user.id,
            (embedTemplate || 'standard') as any
          );
        } catch (error) {
          console.error('Error generating embed code:', error);
          // Continue without embed - don't fail the entire share
        }
      }

      // Record live activity for game sharing
      await this.liveActivityService.recordActivity(
        'GAME_SHARED',
        interaction.user.id,
        {
          gameTitle: game.name,
          gameType: game.type,
          serverId: interaction.guildId,
          hasCustomMessage: !!customMessage,
          previewGenerated: true,
          embedGenerated: !!embedCode,
          embedTemplate: embedTemplate || null
        },
        interaction.guildId || undefined,
        game.id
      );

      // Track share event
      await this.analytics.track('game_shared', {
        gameId: game.id,
        sharerId: interaction.user.id,
        serverId: interaction.guildId,
        channelId: interaction.channelId,
        hasCustomMessage: !!customMessage,
        socialPreviewGenerated: true,
        embedGenerated: !!embedCode,
        embedTemplate: embedTemplate || null,
        embedId: embedCode?.embedId || null
      });

      // Award credits to the sharer (not the creator) - small amount for sharing
      const shareCredits = await this.personalCreditService.earnCredits(
        interaction.user.id,
        1, // 1 credit for sharing
        'CONTENT_SHARE' as any,
        { gameId: game.id, serverId: interaction.guildId }
      );

      // Check for share achievements
      const unlockedAchievements = await this.achievementService.checkProgress(
        interaction.user.id,
        'games_shared',
        1,
        { gameId: game.id, serverId: interaction.guildId }
      );

      // Generate share URLs for different platforms
      const shareUrls = {
        generic: this.socialPreviewService.generateShareableURL(game.id, 'generic'),
        twitter: this.socialPreviewService.generateShareableURL(game.id, 'twitter'),
        facebook: this.socialPreviewService.generateShareableURL(game.id, 'facebook'),
        discord: this.socialPreviewService.generateShareableURL(game.id, 'discord')
      };

      // Build enhanced share embed
      const emoji = generateGameEmoji(game.type);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emoji} ${game.name}`)
        .setDescription(game.description)
        .setImage(socialPreview.imageUrl) // Add the social preview image
        .addFields(
          { name: 'Type', value: game.type, inline: true },
          { name: 'Players', value: game.playCount.toString(), inline: true },
          { name: 'Created by', value: `<@${game.creatorId}>`, inline: true }
        )
        .addFields({
          name: '🔗 Share Links',
          value: `[Generic](${shareUrls.generic}) • [Twitter](${shareUrls.twitter}) • [Facebook](${shareUrls.facebook})`,
          inline: false
        })
        .setFooter({ text: `Game ID: ${game.shortId} • Shared by ${interaction.user.username} • Rich preview enabled` })
        .setTimestamp();

      // Add custom message if provided
      if (customMessage) {
        embed.addFields({ 
          name: '💬 Message', 
          value: customMessage.substring(0, 1024) // Discord field limit
        });
      }

      // Add embed code information if generated
      if (embedCode) {
        embed.addFields({
          name: '📋 Website Embed Code',
          value: `**Template:** ${embedTemplate || 'Standard'} (${embedCode.config.width}×${embedCode.config.height}px)\n` +
                 `**ID:** \`${embedCode.embedId}\`\n` +
                 `**Direct URL:** [Open](${embedCode.directUrl})\n` +
                 `Use \`/embed analytics ${embedCode.embedId}\` to track performance`,
          inline: false
        });
      }

      // Create play button
      const playButton = {
        type: 2, // Button
        style: 1, // Primary
        label: 'Play Now',
        emoji: '🎮',
        custom_id: `play-${game.shortId}`
      };

      // Build enhanced response message
      let content = shareCredits.success 
        ? `✅ Game shared with rich preview card! You earned ${shareCredits.creditsEarned} credit${shareCredits.creditsEarned !== 1 ? 's' : ''}.`
        : '✅ Game shared with rich preview card!';

      // Add social preview info
      if (socialPreview.gifUrl) {
        content += '\n🎬 **Animated preview generated** - perfect for social media sharing!';
      }

      // Add embed code info
      if (embedCode) {
        content += `\n📋 **Embed code generated** (${embedTemplate || 'standard'} template) - ready for websites!`;
      }
      
      // Add achievement notifications
      if (unlockedAchievements.length > 0) {
        const achievementNames = unlockedAchievements.map(a => a.name).join(', ');
        content += `\n\n🎉 **Achievement Unlocked:** ${achievementNames}`;
      }

      // Send the share
      await interaction.editReply({
        content,
        embeds: [embed],
        components: [{
          type: 1, // Action row
          components: [playButton]
        }]
      });

      // Update game's share analytics
      await this.db.prisma.game.update({
        where: { id: game.id },
        data: {
          metadata: {
            ...game.metadata,
            totalShares: ((game.metadata?.totalShares as number) || 0) + 1,
            lastSharedAt: new Date(),
            lastSharedBy: interaction.user.id
          }
        }
      });

      // Track server virality
      await this.personalCreditService.trackContentShare(
        game.id,
        interaction.guildId!,
        interaction.user.id
      );

    } catch (error) {
      console.error('Error sharing game:', error);
      await interaction.editReply({
        content: '❌ Failed to share game. Please try again later.'
      });
    }
  }
}