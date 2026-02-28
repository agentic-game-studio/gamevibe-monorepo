import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, InteractionReplyOptions, MessageFlags } from 'discord.js';
import { injectable } from 'inversify';
import { generateGameEmoji } from '@gamevibe/shared';

@injectable()
export class HelpCommand {
  data: SlashCommandBuilder;
  
  constructor() {
    this.data = new SlashCommandBuilder()
      .setName('help')
      .setDescription('Get help with GameVibe commands') as SlashCommandBuilder;
  }
  
  async execute(interaction: CommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎮 GameVibe Help')
      .setDescription('Create and play games instantly with AI!')
      .addFields(
        {
          name: '📝 Creating Games',
          value: `
\`/create-game\` - Open the game creation form
\`/create-game quick:<description>\` - Quick create with a description
\`/vibe <description>\` - Shortcut for quick game creation
          `.trim()
        },
        {
          name: '🎮 Playing Games',
          value: `
\`/play <game-id>\` - Play a game by its ID
\`/browse\` - Browse available games
\`/my-games\` - View your created games
          `.trim()
        },
        {
          name: '🏆 Leaderboards & Stats',
          value: `
\`/leaderboard game <game-id>\` - View game leaderboard
\`/leaderboard global\` - View top scores across all games
\`/leaderboard my-stats\` - View your personal statistics
          `.trim()
        },
        {
          name: '🎨 Game Types',
          value: Object.entries({
            'Platformer': 'Jump and run adventures',
            'Puzzle': 'Brain-teasing challenges',
            'RPG': 'Role-playing adventures',
            'Shooter': 'Action-packed battles',
            'Endless Runner': 'Never-ending fun',
            'Tower Defense': 'Strategic defense games'
          }).map(([type, desc]) => `${generateGameEmoji(type.toLowerCase().replace(' ', '-'))} **${type}** - ${desc}`).join('\n')
        },
        {
          name: '💡 Tips',
          value: `
• Be descriptive when creating games for better results
• Try remixing existing games to create variations
• Join voice chat for voice-controlled gaming!
• Premium users get unlimited game creations
          `.trim()
        }
      )
      .setFooter({ 
        text: 'GameVibe AI • Need more help? Join our support server!',
        iconURL: interaction.client.user?.displayAvatarURL()
      })
      .setTimestamp();
    
    await interaction.reply({ 
      embeds: [embed], 
      flags: MessageFlags.Ephemeral 
    });
  }
}