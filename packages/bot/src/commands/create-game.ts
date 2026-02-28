import { 
  SlashCommandBuilder, 
  CommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from 'discord.js';
import { injectable, inject } from 'inversify';
import { GameGeneratorService } from '../services/game-generator.js';
import { AnalyticsService } from '../services/analytics.js';
import { RateLimitService } from '../services/rate-limit.js';
import { SubscriptionChecker } from '../middleware/subscription-check.js';
import { AchievementService } from '../services/achievement.js';
import { LiveActivityService } from '../services/live-activity.js';
import { TYPES } from '../types.js';
import { formatNumber, generateGameEmoji, RateLimitError } from '@gamevibe/shared';

@injectable()
export class CreateGameCommand {
  data: SlashCommandBuilder;
  
  constructor(
    @inject(TYPES.GameGeneratorService) private gameGenerator: GameGeneratorService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.RateLimitService) private rateLimiter: RateLimitService,
    @inject(TYPES.SubscriptionChecker) private subscriptionChecker: SubscriptionChecker,
    @inject(TYPES.AchievementService) private achievementService: AchievementService,
    @inject(TYPES.LiveActivityService) private liveActivityService: LiveActivityService
  ) {
    this.data = new SlashCommandBuilder()
      .setName('create-game')
      .setDescription('Create a new game for your server')
      .addStringOption(option =>
        option.setName('quick')
          .setDescription('Quick game description (skip the form)')
          .setRequired(false)
      ) as SlashCommandBuilder;
  }
  
  async execute(interaction: CommandInteraction): Promise<void> {
    try {
      // Check rate limit
      const canProceed = await this.rateLimiter.checkLimit(
        interaction.user.id,
        interaction.guildId!
      );
      
      if (!canProceed) {
        await interaction.reply({
          content: '⏱️ You\'re creating games too quickly! Please wait a moment before trying again.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Check subscription limits
      const subscriptionCheck = await this.subscriptionChecker.checkGameCreation(interaction);
      if (!subscriptionCheck.allowed) {
        return; // Error message already sent by subscription checker
      }
      
      const quickDescription = interaction.isChatInputCommand() ? interaction.options.getString('quick') : null;
      
      if (quickDescription) {
        // Quick generation path
        await this.handleQuickGeneration(interaction, quickDescription);
      } else {
        // Modal path for detailed input
        await this.showCreationModal(interaction);
      }
      
      // Track command usage
      await this.analytics.track('command_used', {
        command: 'create-game',
        userId: interaction.user.id,
        serverId: interaction.guildId,
        quick: !!quickDescription
      });
      
    } catch (error) {
      console.error('Error in create-game command:', error);
      
      if (error instanceof RateLimitError) {
        await interaction.reply({
          content: '⏱️ Rate limit exceeded. Please try again later.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while creating your game. Please try again.',
          ephemeral: true
        });
      }
    }
  }
  
  private async showCreationModal(interaction: CommandInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('game-creation-modal')
      .setTitle('Create Your Game');
      
    const gameTypeInput = new TextInputBuilder()
      .setCustomId('game-type')
      .setLabel('Game Type')
      .setPlaceholder('platformer, puzzle, rpg, shooter, etc.')
      .setRequired(true)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(50);
      
    const descriptionInput = new TextInputBuilder()
      .setCustomId('game-description')
      .setLabel('Game Description')
      .setPlaceholder('A platformer where a cat collects fish while avoiding dogs...')
      .setRequired(true)
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(10)
      .setMaxLength(500);
      
    const playersInput = new TextInputBuilder()
      .setCustomId('player-count')
      .setLabel('Number of Players')
      .setPlaceholder('1, 2-4, unlimited')
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setValue('1')
      .setMaxLength(20);
      
    const nameInput = new TextInputBuilder()
      .setCustomId('game-name')
      .setLabel('Game Name (optional)')
      .setPlaceholder('Super Cat Adventure')
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(100);
      
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(gameTypeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(playersInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput)
    );
    
    await interaction.showModal(modal);
  }
  
  private async handleQuickGeneration(
    interaction: CommandInteraction, 
    description: string
  ): Promise<void> {
    await interaction.deferReply();
    
    try {
      // Show generating message
      await interaction.editReply({
        content: '🎮 Generating your game...',
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('Creating Game')
            .setDescription('Please wait while I create your game...')
            .addFields(
              { name: 'Description', value: description }
            )
            .setTimestamp()
        ]
      });
      
      // Generate game
      const game = await this.gameGenerator.generateGame({
        description,
        serverId: interaction.guildId!,
        userId: interaction.user.id,
        context: {
          serverName: interaction.guild?.name,
          memberCount: interaction.guild?.memberCount
        }
      });

      // Record usage for subscription tracking
      await this.subscriptionChecker.recordUsage(
        interaction.guildId!,
        'game_created', 
        interaction.user.id,
        { gameId: game.id, gameType: game.type }
      );
      
      // Record live activity
      await this.liveActivityService.recordGameCreated(
        interaction.user.id,
        game.id,
        game.name,
        interaction.guildId!
      );
      
      // Track achievement progress
      const unlockedAchievements = await this.achievementService.checkProgress(
        interaction.user.id,
        'games_created',
        1,
        { gameId: game.id, gameType: game.type }
      );
      
      // Create response embed
      const embed = this.createGameEmbed(game);
      const components = this.createGameButtons(game.id, game.shortId);
      
      // Add achievement notification if any were unlocked
      let content = `✅ Your game is ready!`;
      if (unlockedAchievements.length > 0) {
        const achievementNames = unlockedAchievements.map(a => a.name).join(', ');
        content += `\n\n🎉 **Achievement Unlocked:** ${achievementNames}`;
      }
      
      await interaction.editReply({ 
        content,
        embeds: [embed], 
        components: [components] 
      });
      
    } catch (error) {
      console.error('Game generation error:', error);
      await interaction.editReply({
        content: '❌ Failed to generate game. Please try again with a different description.',
        embeds: []
      });
    }
  }
  
  private createGameEmbed(game: any): EmbedBuilder {
    const emoji = generateGameEmoji(game.type);
    
    return new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(`${emoji} ${game.name}`)
      .setDescription(game.description)
      .addFields(
        { name: 'Type', value: game.type, inline: true },
        { name: 'Game ID', value: `\`${game.shortId}\``, inline: true },
        { name: 'Players', value: game.playerCount || '1', inline: true }
      )
      .setThumbnail(game.thumbnailUrl || null)
      .setTimestamp()
      .setFooter({ text: 'GameVibe AI • Create games with AI' });
  }
  
  private createGameButtons(gameId: string, shortId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`play-${gameId}`)
          .setLabel('Play Now')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎮'),
          
        new ButtonBuilder()
          .setCustomId(`share-${gameId}`)
          .setLabel('Share')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔗'),
          
        new ButtonBuilder()
          .setCustomId(`remix-${gameId}`)
          .setLabel('Remix')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄'),
          
        new ButtonBuilder()
          .setURL(`https://gamevibe.ai/game/${shortId}`)
          .setLabel('Open in Browser')
          .setStyle(ButtonStyle.Link)
          .setEmoji('🌐')
      );
  }
}