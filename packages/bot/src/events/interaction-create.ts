import { Client, Events, Interaction, CommandInteraction, ModalSubmitInteraction, ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InviteTargetType, TextChannel, VoiceChannel, MessageFlags } from 'discord.js';
import { Container } from 'inversify';
import { Command } from '../commands/index.js';
import { GameGeneratorService } from '../services/game-generator.js';
import { SubscriptionChecker } from '../middleware/subscription-check.js';
import { GameTrackingService } from '../services/game-tracking.js';
import { SocialMediaService } from '../services/social-media.js';
import { handleRemixInteractions } from './remix-interactions.js';
import { handleSocialMediaInteraction } from './social-media-interactions.js';
import { handleCreatorInteraction } from './creator-interactions.js';
import { TYPES } from '../types.js';
import { generateGameEmoji, BotConfig } from '@gamevibe/shared';

export class InteractionCreateEvent {
  private commands: Map<string, Command> = new Map();
  private config: BotConfig;
  
  constructor(
    private client: Client,
    private container: Container
  ) {
    this.config = this.container.get<BotConfig>(TYPES.Config);
  }
  
  register(): void {
    this.client.on(Events.InteractionCreate, this.execute.bind(this));
  }
  
  /**
   * Check if interaction is remix-related
   */
  private isRemixInteraction(interaction: Interaction): boolean {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return false;
    
    const remixPatterns = [
      'select_game_to_remix',
      'remix_modifications:',
      'remix_template:',
      'select_remix_template',
      'refresh_remix_browse',
      'create_remix:',
      'quick_remix:',
      'browse_templates:',
      'cancel_remix',
      'start_remix:',
      'confirm_remix:',
      'back_to_game:',
      'version_details:',
      'version_nav:',
      'explore_trending_remix',
      'community_stats',
      'remix_categories',
      'my_remixes',
      'browse_by_category',
      'manage_my_remix',
      'view_history:'
    ];
    
    return remixPatterns.some(pattern => interaction.customId.includes(pattern));
  }

  /**
   * Check if interaction is social media related
   */
  private isSocialMediaInteraction(interaction: Interaction): boolean {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return false;
    
    return interaction.customId.startsWith('social:');
  }

  /**
   * Check if interaction is creator related
   */
  private isCreatorInteraction(interaction: Interaction): boolean {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return false;
    
    return interaction.customId.startsWith('creator:');
  }

  private async execute(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isCommand()) {
        await this.handleCommand(interaction);
      } else if (interaction.isModalSubmit()) {
        // Check if this is a social media modal
        if (this.isSocialMediaInteraction(interaction)) {
          await this.handleSocialMediaModalSubmit(interaction);
        } else if (this.isCreatorInteraction(interaction)) {
          await handleCreatorInteraction(interaction, this.container);
        } else {
          await this.handleModalSubmit(interaction);
        }
      } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
        // Check if this is a remix-related interaction
        const isRemixInteraction = this.isRemixInteraction(interaction);
        const isSocialMediaInteraction = this.isSocialMediaInteraction(interaction);
        const isCreatorInteraction = this.isCreatorInteraction(interaction);
        
        if (isRemixInteraction) {
          await handleRemixInteractions(interaction, this.container);
        } else if (isSocialMediaInteraction) {
          await handleSocialMediaInteraction(interaction, this.container);
        } else if (isCreatorInteraction) {
          await handleCreatorInteraction(interaction, this.container);
        } else if (interaction.isButton()) {
          await this.handleButton(interaction);
        }
      }
    } catch (error) {
      console.error('Error handling interaction:', error);
      
      // Try to respond with error message
      if (interaction.isRepliable() && !interaction.replied) {
        try {
          await interaction.reply({
            content: '❌ An error occurred while processing your request.',
            flags: MessageFlags.Ephemeral
          });
        } catch (replyError) {
          console.error('Failed to send error reply:', replyError);
        }
      }
    }
  }
  
  private async handleCommand(interaction: CommandInteraction): Promise<void> {
    console.log(`Handling command: ${interaction.commandName}`);
    
    // Lazy load commands
    if (this.commands.size === 0) {
      console.log('Loading commands...');
      try {
        const commandList = await import('../commands/index.js').then(m => m.getCommands(this.container));
        console.log(`Loaded ${commandList.length} commands`);
        commandList.forEach(cmd => {
          console.log(`Registering command: ${cmd.data.name}`);
          this.commands.set(cmd.data.name, cmd);
        });
      } catch (error) {
        console.error('Error loading commands:', error);
        throw error;
      }
    }
    
    const command = this.commands.get(interaction.commandName);
    
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      await interaction.reply({
        content: 'Unknown command!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    console.log(`Executing command: ${interaction.commandName}`);
    await command.execute(interaction);
  }
  
  private async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.customId === 'game-creation-modal') {
      // Defer reply as generation might take time
      await interaction.deferReply();
      
      // Extract form data
      const gameType = interaction.fields.getTextInputValue('game-type');
      const description = interaction.fields.getTextInputValue('game-description');
      const playerCount = interaction.fields.getTextInputValue('player-count') || '1';
      const gameName = interaction.fields.getTextInputValue('game-name') || undefined;
      
      // Get services
      const gameGenerator = this.container.get<GameGeneratorService>(TYPES.GameGeneratorService);
      const subscriptionChecker = this.container.get<SubscriptionChecker>(TYPES.SubscriptionChecker);
      
      // Check subscription limits
      const subscriptionCheck = await subscriptionChecker.checkGameCreation(interaction);
      if (!subscriptionCheck.allowed) {
        return; // Error message already sent by subscription checker
      }
      
      try {
        // Generate game
        const game = await gameGenerator.generateGame({
          description,
          type: gameType as any,
          playerCount,
          serverId: interaction.guildId!,
          userId: interaction.user.id,
          context: {
            serverName: interaction.guild?.name,
            memberCount: interaction.guild?.memberCount
          }
        });

        // Record usage for subscription tracking
        await subscriptionChecker.recordUsage(
          interaction.guildId!,
          'game_created', 
          interaction.user.id,
          { gameId: game.id, gameType: game.type }
        );
        
        // Create response
        const emoji = generateGameEmoji(game.type);
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle(`${emoji} ${gameName || game.name}`)
          .setDescription(game.description)
          .addFields(
            { name: 'Type', value: game.type, inline: true },
            { name: 'Game ID', value: `\`${game.shortId}\``, inline: true },
            { name: 'Players', value: playerCount, inline: true }
          )
          .setTimestamp();
        
        const buttons = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`play-${game.id}`)
              .setLabel('Play Now')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🎮'),
            new ButtonBuilder()
              .setCustomId(`share-${game.id}`)
              .setLabel('Share')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('🔗')
          );
        
        await interaction.editReply({
          content: '✅ Your game is ready!',
          embeds: [embed],
          components: [buttons]
        });

        // Auto-post to social media if enabled
        try {
          const socialMediaService = this.container.get<SocialMediaService>(TYPES.SocialMediaService);
          if (socialMediaService.isServiceConfigured()) {
            await socialMediaService.autoPostGameCreation(
              game.id,
              interaction.user.id,
              gameName || game.name,
              game.type,
              interaction.guildId!
            );
          }
        } catch (socialError) {
          // Don't fail the whole flow if social media posting fails
          console.warn('Social media auto-posting failed:', socialError);
        }
        
      } catch (error) {
        console.error('Error generating game:', error);
        await interaction.editReply({
          content: '❌ Failed to generate game. Please try again.',
          embeds: []
        });
      }
    }
  }

  private async handleSocialMediaModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const [prefix, action, type, templateType] = interaction.customId.split(':');
    
    if (prefix !== 'social' || action !== 'modal') return;
    
    if (type === 'template') {
      const serverId = interaction.guildId!;
      const newTemplate = interaction.fields.getTextInputValue('template');
      
      const socialMediaService = this.container.get<SocialMediaService>(TYPES.SocialMediaService);
      const settings = await socialMediaService.getServerAutoPostSettings(serverId);
      
      // Update the specific template
      settings.templates[templateType as keyof typeof settings.templates] = newTemplate;
      
      await socialMediaService.updateServerAutoPostSettings(serverId, {
        templates: settings.templates,
      });
      
      const embed = new EmbedBuilder()
        .setTitle('📝 Template Updated')
        .setDescription(
          `Successfully updated the **${this.formatTriggerName(templateType)}** template!\n\n` +
          `**New Template:**\n\`\`\`${newTemplate}\`\`\``
        )
        .setColor(0x00ff00)
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private formatTriggerName(trigger: string): string {
    const names: Record<string, string> = {
      gameCreation: 'New Game Created',
      viralMilestone: 'Viral Milestone Reached',
      weeklyHighlight: 'Weekly Highlights',
      eventWinner: 'Event Winners',
    };
    return names[trigger] || trigger;
  }
  
  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    const [action, gameId] = interaction.customId.split('-');
    
    switch (action) {
      case 'play':
        try {
          // Track game play
          const gameTrackingService = this.container.get<GameTrackingService>(TYPES.GameTrackingService);
          await gameTrackingService.trackGamePlay(gameId, interaction.user.id, interaction.guildId!);
          
          // Check if web runtime is configured
          if (!this.config.webRuntime?.url) {
            await interaction.reply({
              content: '❌ Discord Activities are not yet configured. Please deploy the web runtime first.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          
          // Check if we're in a guild channel that supports invites
          if (!interaction.guild || !interaction.channel) {
            await interaction.reply({
              content: '❌ Discord Activities can only be launched in server channels.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          
          // Check if channel supports creating invites (text or voice channels)
          const channel = interaction.channel;
          if (!(channel instanceof TextChannel || channel instanceof VoiceChannel)) {
            await interaction.reply({
              content: '❌ Discord Activities can only be launched in text or voice channels.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          
          // Try to create Discord Activity invite
          let activityUrl: string;
          try {
            const invite = await channel.createInvite({
              targetType: InviteTargetType.EmbeddedApplication,
              targetApplication: interaction.client.application?.id,
              maxAge: 3600, // 1 hour
              maxUses: 0 // unlimited uses
            });
            activityUrl = invite.url;
          } catch (error) {
            // Discord Activities not enabled - provide web fallback
            console.error('Discord Activity not available:', error);
            const webRuntimeUrl = new URL(this.config.webRuntime.url);
            webRuntimeUrl.searchParams.set('game_id', gameId);
            activityUrl = webRuntimeUrl.toString();
          }
          
          await interaction.reply({
            content: `🎮 **Click here to play!**\n${activityUrl}\n\n${activityUrl.includes('discord.com') ? 'The game will open in Discord Activities.' : 'The game will open in your browser.'}\n\n_Game ID: ${gameId}_`,
            flags: MessageFlags.Ephemeral
          });
        } catch (error) {
          console.error('Error launching Discord Activity:', error);
          await interaction.reply({
            content: '❌ Failed to launch game. Make sure the bot has permission to create invites in this channel.',
            flags: MessageFlags.Ephemeral
          });
        }
        break;
        
      case 'share':
        await interaction.reply({
          content: `🔗 Share this game: \`/play ${gameId}\``,
          flags: MessageFlags.Ephemeral
        });
        break;
        
      case 'remix':
        await interaction.reply({
          content: `🔄 Remixing game ${gameId}...`,
          flags: MessageFlags.Ephemeral
        });
        // TODO: Implement game remixing
        break;
        
      default:
        await interaction.reply({
          content: 'Unknown action',
          flags: MessageFlags.Ephemeral
        });
    }
  }
}