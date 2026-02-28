import { 
  SlashCommandBuilder, 
  CommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType
} from 'discord.js';
import { injectable, inject } from 'inversify';
import { logger } from '@gamevibe/shared';

const log = logger('CreateMultiplayerGameCommand');
import { TYPES } from '../types.js';
import { GameGeneratorService } from '../services/game-generator.js';
import { DatabaseService } from '../services/database.js';
import { MultiplayerService } from '../services/multiplayer.js';

@injectable()
export class CreateMultiplayerGameCommand {
  data: SlashCommandBuilder;
  
  constructor(
    @inject(TYPES.GameGeneratorService) private gameGenerator: GameGeneratorService,
    @inject(TYPES.DatabaseService) private database: DatabaseService,
    @inject(TYPES.MultiplayerService) private multiplayerService: MultiplayerService
  ) {
    this.data = new SlashCommandBuilder()
  .setName('create-multiplayer-game')
  .setDescription('Create a new multiplayer game from a prompt')
  .addStringOption(option =>
    option.setName('prompt')
      .setDescription('Describe the multiplayer game you want to create')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option.setName('max-players')
      .setDescription('Maximum number of players (2-8)')
      .setMinValue(2)
      .setMaxValue(8)
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('mode')
      .setDescription('Game mode')
      .addChoices(
        { name: 'Competitive', value: 'competitive' },
        { name: 'Cooperative', value: 'cooperative' },
        { name: 'Free Play', value: 'freeplay' }
      )
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('private')
      .setDescription('Make the game private (join by code only)')
      .setRequired(false)
  ) as SlashCommandBuilder;
  }

  async execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const prompt = interaction.options.getString('prompt', true);
  const maxPlayers = interaction.options.getInteger('max-players') || 4;
  const gameMode = (interaction.options.getString('mode') || 'competitive') as 'competitive' | 'cooperative' | 'freeplay';
  const isPrivate = interaction.options.getBoolean('private') || false;

  await interaction.deferReply();

  try {
    log.info(`Creating multiplayer game for user ${interaction.user.id} with prompt: ${prompt}`);

    const thinkingEmbed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle('🎮 Creating Your Multiplayer Game...')
      .setDescription('Our AI is designing an exciting multiplayer experience!')
      .addFields(
        { name: 'Prompt', value: prompt },
        { name: 'Max Players', value: maxPlayers.toString(), inline: true },
        { name: 'Game Mode', value: gameMode, inline: true },
        { name: 'Visibility', value: isPrivate ? 'Private' : 'Public', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [thinkingEmbed] });

    const gameSpec = await this.gameGenerator.generateGame({
      description: prompt + ` (multiplayer ${gameMode} game for ${maxPlayers} players)`,
      userId: interaction.user.id,
      serverId: interaction.guildId!,
      type: 'shooter',
      playerCount: maxPlayers.toString()
    });
    
    const game = await this.database.createGame({
      shortId: gameSpec.shortId,
      serverId: interaction.guildId!,
      creatorId: interaction.user.id,
      name: gameSpec.name,
      description: gameSpec.description,
      type: gameSpec.type,
      code: gameSpec.code,
      assets: gameSpec.assets,
      metadata: {
        multiplayer: {
          enabled: true,
          maxPlayers,
          mode: gameMode
        },
        prompt
      },
      isPublic: !isPrivate
    });

    const room = await this.multiplayerService.createRoom(game, {
      maxPlayers,
      gameMode,
      isPrivate
    });

    const authToken = this.multiplayerService.generateAuthToken({
      userId: interaction.user.id,
      username: interaction.user.username,
      avatar: interaction.user.avatar || undefined
    });

    const joinUrl = this.multiplayerService.buildJoinUrl(game.id, room.roomCode, authToken);

    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(`🎮 ${game.name}`)
      .setDescription(game.description)
      .addFields(
        { name: 'Type', value: game.type, inline: true },
        { name: 'Max Players', value: maxPlayers.toString(), inline: true },
        { name: 'Room Code', value: `\`${room.roomCode}\``, inline: true },
        { name: 'Mode', value: gameMode, inline: true },
        { name: 'Status', value: '🟢 Waiting for players', inline: true },
        { name: 'Players', value: `0/${maxPlayers}`, inline: true }
      )
      .setFooter({ text: `Game ID: ${game.id} | Room: ${room.roomId}` })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Play Now')
          .setURL(joinUrl)
          .setStyle(ButtonStyle.Link)
          .setEmoji('🎮'),
        new ButtonBuilder()
          .setCustomId(`share_room_${room.roomCode}`)
          .setLabel('Share Room Code')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📤'),
        new ButtonBuilder()
          .setCustomId(`room_info_${room.roomId}`)
          .setLabel('Room Info')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('ℹ️')
      );

    const response = await interaction.editReply({ 
      embeds: [successEmbed], 
      components: [actionRow] 
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 600000 // 10 minutes
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.customId === `share_room_${room.roomCode}`) {
        await buttonInteraction.reply({
          content: `**Join Multiplayer Game: ${game.name}**\n\nRoom Code: \`${room.roomCode}\`\n\nOthers can join using: \`/join-game ${room.roomCode}\``,
          ephemeral: false
        });
      } else if (buttonInteraction.customId === `room_info_${room.roomId}`) {
        const roomInfo = await this.multiplayerService.getRoomInfo(room.roomId);
        
        if (roomInfo) {
          const infoEmbed = new EmbedBuilder()
            .setColor(0x7289DA)
            .setTitle('🎮 Room Information')
            .addFields(
              { name: 'Game', value: roomInfo.gameName, inline: true },
              { name: 'Room Code', value: `\`${roomInfo.roomCode}\``, inline: true },
              { name: 'Players', value: `${roomInfo.currentPlayers}/${roomInfo.maxPlayers}`, inline: true },
              { name: 'Status', value: roomInfo.status, inline: true },
              { name: 'Created', value: new Date(roomInfo.createdAt).toLocaleString(), inline: true }
            );
          
          await buttonInteraction.reply({ embeds: [infoEmbed], ephemeral: true });
        } else {
          await buttonInteraction.reply({ content: 'Room information not available.', ephemeral: true });
        }
      }
    });

    log.info(`Successfully created multiplayer game ${game.id} with room ${room.roomId}`);

  } catch (error) {
    log.error('Failed to create multiplayer game:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Failed to Create Multiplayer Game')
      .setDescription('An error occurred while creating your multiplayer game. Please try again.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed], components: [] });
  }
  }
}