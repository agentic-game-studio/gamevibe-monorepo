import { 
  SlashCommandBuilder, 
  CommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import { injectable, inject } from 'inversify';
import { logger } from '@gamevibe/shared';

const log = logger('JoinGameCommand');
import { TYPES } from '../types.js';
import { MultiplayerService } from '../services/multiplayer.js';
import { DatabaseService } from '../services/database.js';

@injectable()
export class JoinGameCommand {
  data: SlashCommandBuilder;
  
  constructor(
    @inject(TYPES.MultiplayerService) private multiplayerService: MultiplayerService,
    @inject(TYPES.DatabaseService) private database: DatabaseService
  ) {
    this.data = new SlashCommandBuilder()
  .setName('join-game')
  .setDescription('Join a multiplayer game using a room code')
  .addStringOption(option =>
    option.setName('code')
      .setDescription('The 6-character room code')
      .setRequired(true)
      .setMaxLength(6)
      .setMinLength(6)
  ) as SlashCommandBuilder;
  }

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;  const roomCode = interaction.options.getString('code', true).toUpperCase();

  await interaction.deferReply({ ephemeral: true });

  try {
    log.info(`User ${interaction.user.id} attempting to join room ${roomCode}`);

    const room = await this.multiplayerService.getRoomByCode(roomCode);

    if (!room) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Room Not Found')
        .setDescription(`No active room found with code: \`${roomCode}\``)
        .setFooter({ text: 'Room codes are case-insensitive and expire after the game ends.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (room.status === 'finished') {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Game Ended')
        .setDescription('This game has already finished.')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (room.currentPlayers >= room.maxPlayers) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Room Full')
        .setDescription(`This room is full (${room.currentPlayers}/${room.maxPlayers} players).`)
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const game = await this.database.getGame(room.gameId);

    if (!game) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Game Not Found')
        .setDescription('The game associated with this room no longer exists.')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const authToken = this.multiplayerService.generateAuthToken({
      userId: interaction.user.id,
      username: interaction.user.username,
      avatar: interaction.user.avatar || undefined
    });

    const joinUrl = this.multiplayerService.buildJoinUrl(game.id, room.roomCode, authToken);

    const joinEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(`🎮 Joining: ${room.gameName}`)
      .setDescription(game.description)
      .addFields(
        { name: 'Room Code', value: `\`${room.roomCode}\``, inline: true },
        { name: 'Players', value: `${room.currentPlayers}/${room.maxPlayers}`, inline: true },
        { name: 'Status', value: room.status === 'waiting' ? '🟡 Waiting to start' : '🟢 In progress', inline: true },
        { name: 'Game Type', value: game.type, inline: true }
      )
      .setFooter({ text: `Game ID: ${game.id}` })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Join Game')
          .setURL(joinUrl)
          .setStyle(ButtonStyle.Link)
          .setEmoji('🎮')
      );

    await interaction.editReply({ 
      embeds: [joinEmbed], 
      components: [actionRow] 
    });

    log.info(`User ${interaction.user.id} received join link for room ${roomCode}`);

  } catch (error) {
    log.error('Failed to join game:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Failed to Join Game')
      .setDescription('An error occurred while trying to join the game. Please try again.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
  }
}