import { injectable, inject } from 'inversify';
import { 
  CommandInteraction, 
  SlashCommandBuilder, 
  EmbedBuilder, 
  PermissionFlagsBits,
  ChatInputCommandInteraction
} from 'discord.js';
import { TYPES } from '../types.js';
import { AmbassadorService, AmbassadorStats } from '../services/ambassador.js';
import { Command } from './index.js';
import { ActivityType, AmbassadorRank, AmbassadorStatus } from '../generated/prisma/index.js';

@injectable()
export class AmbassadorCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('ambassador')
    .setDescription('Manage server ambassador program')
    .addSubcommand(subcommand =>
      subcommand
        .setName('appoint')
        .setDescription('Appoint a user as server ambassador')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to appoint as ambassador')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('notes')
            .setDescription('Notes about the appointment')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove an ambassador')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('Ambassador to remove')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for removal')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('View ambassador status')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to check (defaults to yourself)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View server ambassador statistics')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all server ambassadors')
        .addStringOption(option =>
          option
            .setName('status')
            .setDescription('Filter by status')
            .setRequired(false)
            .addChoices(
              { name: 'Active', value: 'ACTIVE' },
              { name: 'Inactive', value: 'INACTIVE' },
              { name: 'Retired', value: 'RETIRED' },
              { name: 'Suspended', value: 'SUSPENDED' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('activity')
        .setDescription('Record ambassador activity')
        .addUserOption(option =>
          option
            .setName('ambassador')
            .setDescription('Ambassador who performed the activity')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Type of activity')
            .setRequired(true)
            .addChoices(
              { name: 'Game Created', value: 'GAME_CREATED' },
              { name: 'Player Recruited', value: 'PLAYER_RECRUITED' },
              { name: 'Challenge Hosted', value: 'CHALLENGE_HOSTED' },
              { name: 'Community Event', value: 'COMMUNITY_EVENT' },
              { name: 'Feedback Provided', value: 'FEEDBACK_PROVIDED' },
              { name: 'Bug Reported', value: 'BUG_REPORTED' },
              { name: 'Tutorial Created', value: 'TUTORIAL_CREATED' },
              { name: 'Mentored User', value: 'MENTORED_USER' },
              { name: 'Viral Content', value: 'VIRAL_CONTENT' },
              { name: 'Server Growth', value: 'SERVER_GROWTH' }
            )
        )
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Brief title of the activity')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Detailed description of the activity')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('points')
            .setDescription('Custom points value (overrides default)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(100)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('rewards')
        .setDescription('Process monthly ambassador rewards (Admin only)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

  constructor(
    @inject(TYPES.AmbassadorService) private ambassadorService: AmbassadorService
  ) {}

  public async execute(interaction: CommandInteraction): Promise<void> {
    const chatInteraction = interaction as ChatInputCommandInteraction;
    const subcommand = chatInteraction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'appoint':
          await this.handleAppoint(chatInteraction);
          break;
        case 'remove':
          await this.handleRemove(chatInteraction);
          break;
        case 'status':
          await this.handleStatus(chatInteraction);
          break;
        case 'stats':
          await this.handleStats(chatInteraction);
          break;
        case 'list':
          await this.handleList(chatInteraction);
          break;
        case 'activity':
          await this.handleActivity(chatInteraction);
          break;
        case 'rewards':
          await this.handleRewards(chatInteraction);
          break;
        default:
          await chatInteraction.reply({
            content: '❌ Unknown subcommand.',
            ephemeral: true
          });
      }
    } catch (error: any) {
      console.error('Ambassador command error:', error);
      const errorMessage = error.message || 'An unexpected error occurred.';
      
      if (chatInteraction.replied || chatInteraction.deferred) {
        await chatInteraction.editReply(`❌ ${errorMessage}`);
      } else {
        await chatInteraction.reply({
          content: `❌ ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  }

  private async handleAppoint(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = interaction.options.getUser('user', true);
    const notes = interaction.options.getString('notes');

    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in servers.',
        ephemeral: true
      });
      return;
    }

    // Check permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: '❌ You need Manage Server permissions to appoint ambassadors.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    const ambassador = await this.ambassadorService.appointAmbassador({
      serverId: interaction.guild.id,
      userId: user.id,
      appointedById: interaction.user.id,
      notes: notes || undefined
    });

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎖️ Ambassador Appointed')
      .setDescription(`${user} has been appointed as a server ambassador!`)
      .addFields(
        { name: '🏆 Rank', value: ambassador.rank, inline: true },
        { name: '💎 Credit Multiplier', value: `${ambassador.creditMultiplier}x`, inline: true },
        { name: '📈 Max Personal Credits', value: `${ambassador.maxPersonalCredits}`, inline: true }
      )
      .setTimestamp();

    if (notes) {
      embed.addFields({ name: '📝 Notes', value: notes, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason');

    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in servers.',
        ephemeral: true
      });
      return;
    }

    // Check permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: '❌ You need Manage Server permissions to remove ambassadors.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    await this.ambassadorService.removeAmbassador(
      interaction.guild.id,
      user.id,
      interaction.user.id,
      reason || undefined
    );

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🎖️ Ambassador Removed')
      .setDescription(`${user} is no longer a server ambassador.`)
      .setTimestamp();

    if (reason) {
      embed.addFields({ name: '📝 Reason', value: reason, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = interaction.options.getUser('user') || interaction.user;

    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in servers.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    const ambassador = await this.ambassadorService.getUserAmbassadorStatus(
      interaction.guild.id,
      user.id
    );

    if (!ambassador) {
      await interaction.editReply({
        content: user.id === interaction.user.id 
          ? '❌ You are not an ambassador for this server.'
          : `❌ ${user} is not an ambassador for this server.`
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(this.getRankColor(ambassador.rank))
      .setTitle(`🎖️ Ambassador Status - ${user.username}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: '🏆 Rank', value: ambassador.rank, inline: true },
        { name: '📊 Status', value: ambassador.status, inline: true },
        { name: '📅 Appointed', value: `<t:${Math.floor(ambassador.appointedAt.getTime() / 1000)}:R>`, inline: true },
        { name: '💎 Total Contributions', value: ambassador.totalContributions.toString(), inline: true },
        { name: '📈 Monthly Contributions', value: ambassador.monthlyContributions.toString(), inline: true },
        { name: '🔥 Current Streak', value: `${ambassador.streak} days`, inline: true }
      )
      .setTimestamp();

    // Show recent activities
    if (ambassador.activities.length > 0) {
      const recentActivities = ambassador.activities
        .slice(0, 3)
        .map(activity => `• ${activity.title} (${activity.points} pts)`)
        .join('\n');
      
      embed.addFields({
        name: '📋 Recent Activities',
        value: recentActivities,
        inline: false
      });
    }

    // Show recent rewards
    if (ambassador.rewards.length > 0) {
      const recentRewards = ambassador.rewards
        .slice(0, 2)
        .map(reward => `• ${reward.title} (${reward.personalCredits} credits)`)
        .join('\n');
      
      embed.addFields({
        name: '🎁 Recent Rewards',
        value: recentRewards,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleStats(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in servers.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    const stats = await this.ambassadorService.getServerAmbassadorStats(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`📊 Ambassador Statistics - ${interaction.guild.name}`)
      .setThumbnail(interaction.guild.iconURL())
      .addFields(
        { name: '👥 Total Ambassadors', value: stats.totalAmbassadors.toString(), inline: true },
        { name: '✅ Active Ambassadors', value: stats.activeAmbassadors.toString(), inline: true },
        { name: '📈 Average Rank', value: this.numberToRank(stats.averageRank), inline: true },
        { name: '📋 Total Activities', value: stats.totalActivities.toString(), inline: true },
        { name: '📅 Monthly Activities', value: stats.monthlyActivities.toString(), inline: true },
        { name: '💎 Total Contributions', value: stats.totalContributions.toString(), inline: true }
      )
      .setTimestamp();

    // Show top ambassadors
    if (stats.topAmbassadors.length > 0) {
      const topList = stats.topAmbassadors
        .slice(0, 5)
        .map((amb, index) => `${index + 1}. <@${amb.user.discordId}> - ${amb.totalContributions} pts (${amb.rank})`)
        .join('\n');
      
      embed.addFields({
        name: '🏆 Top Ambassadors',
        value: topList,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleList(interaction: ChatInputCommandInteraction): Promise<void> {
    const statusFilter = interaction.options.getString('status') as AmbassadorStatus;

    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in servers.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    const stats = await this.ambassadorService.getServerAmbassadorStats(interaction.guild.id);
    let ambassadors = stats.topAmbassadors; // This includes all ambassadors, not just top

    if (statusFilter) {
      ambassadors = ambassadors.filter(amb => amb.status === statusFilter);
    }

    if (ambassadors.length === 0) {
      await interaction.editReply({
        content: statusFilter 
          ? `❌ No ambassadors found with status: ${statusFilter}`
          : '❌ No ambassadors found for this server.'
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`🎖️ Server Ambassadors${statusFilter ? ` (${statusFilter})` : ''}`)
      .setDescription(`Found ${ambassadors.length} ambassador(s)`)
      .setTimestamp();

    const ambassadorList = ambassadors
      .map((amb, index) => {
        const statusEmoji = this.getStatusEmoji(amb.status);
        const rankEmoji = this.getRankEmoji(amb.rank);
        return `${index + 1}. ${statusEmoji} <@${amb.user.discordId}> ${rankEmoji}\n   └ ${amb.totalContributions} pts • Appointed <t:${Math.floor(amb.appointedAt.getTime() / 1000)}:R>`;
      })
      .join('\n\n');

    // Split into multiple embeds if too long
    if (ambassadorList.length > 4000) {
      const chunks = this.chunkText(ambassadorList, 4000);
      for (let i = 0; i < chunks.length; i++) {
        const chunkEmbed = embed.data;
        if (i > 0) {
          chunkEmbed.title += ` (${i + 1}/${chunks.length})`;
        }
        chunkEmbed.description = chunks[i];
        
        if (i === 0) {
          await interaction.editReply({ embeds: [new EmbedBuilder(chunkEmbed)] });
        } else {
          await interaction.followUp({ embeds: [new EmbedBuilder(chunkEmbed)] });
        }
      }
    } else {
      embed.setDescription(ambassadorList);
      await interaction.editReply({ embeds: [embed] });
    }
  }

  private async handleActivity(interaction: ChatInputCommandInteraction): Promise<void> {
    const ambassador = interaction.options.getUser('ambassador', true);
    const type = interaction.options.getString('type', true) as ActivityType;
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description');
    const points = interaction.options.getInteger('points');

    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in servers.',
        ephemeral: true
      });
      return;
    }

    // Check permissions - allow ambassadors to record their own activities
    const userAmbassador = await this.ambassadorService.getUserAmbassadorStatus(
      interaction.guild.id,
      interaction.user.id
    );

    const canRecord = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
                     (userAmbassador && ambassador.id === interaction.user.id);

    if (!canRecord) {
      await interaction.reply({
        content: '❌ You can only record your own activities or need Manage Server permissions.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    // Get ambassador ID
    const ambassadorRecord = await this.ambassadorService.getUserAmbassadorStatus(
      interaction.guild.id,
      ambassador.id
    );

    if (!ambassadorRecord) {
      await interaction.editReply(`❌ ${ambassador} is not an ambassador for this server.`);
      return;
    }

    const activity = await this.ambassadorService.recordActivity({
      ambassadorId: ambassadorRecord.id,
      serverId: interaction.guild.id,
      type,
      title,
      description: description || undefined,
      points: points || undefined,
      metadata: {
        recordedById: interaction.user.id,
        recordedAt: new Date()
      }
    });

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('📋 Activity Recorded')
      .setDescription(`Activity recorded for ${ambassador}`)
      .addFields(
        { name: '📝 Title', value: title, inline: false },
        { name: '🏷️ Type', value: this.formatActivityType(type), inline: true },
        { name: '💎 Points', value: activity.points.toString(), inline: true }
      )
      .setTimestamp();

    if (description) {
      embed.addFields({ name: '📄 Description', value: description, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleRewards(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in servers.',
        ephemeral: true
      });
      return;
    }

    // Check admin permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ You need Administrator permissions to process monthly rewards.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    const rewards = await this.ambassadorService.processMonthlyRewards(interaction.guild.id);

    if (rewards.length === 0) {
      await interaction.editReply('❌ No ambassadors eligible for monthly rewards.');
      return;
    }

    const totalCredits = rewards.reduce((sum, r) => sum + r.personalCredits, 0);

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🎁 Monthly Rewards Processed')
      .setDescription(`Processed ${rewards.length} reward(s) totaling ${totalCredits} personal credits`)
      .setTimestamp();

    const rewardList = rewards
      .map(reward => `• Ambassador - ${reward.personalCredits} credits`)
      .join('\n');

    embed.addFields({
      name: '💰 Rewards Distributed',
      value: rewardList || 'None',
      inline: false
    });

    await interaction.editReply({ embeds: [embed] });
  }

  // Helper methods
  private getRankColor(rank: AmbassadorRank): number {
    const colors = {
      [AmbassadorRank.APPRENTICE]: 0x95A99C,
      [AmbassadorRank.AMBASSADOR]: 0x4B9BFF,
      [AmbassadorRank.SENIOR]: 0xB565D9,
      [AmbassadorRank.MASTER]: 0xFFD700
    };
    return colors[rank] || 0x0099FF;
  }

  private getRankEmoji(rank: AmbassadorRank): string {
    const emojis = {
      [AmbassadorRank.APPRENTICE]: '🥉',
      [AmbassadorRank.AMBASSADOR]: '🥈',
      [AmbassadorRank.SENIOR]: '🥇',
      [AmbassadorRank.MASTER]: '👑'
    };
    return emojis[rank] || '🎖️';
  }

  private getStatusEmoji(status: AmbassadorStatus): string {
    const emojis = {
      [AmbassadorStatus.ACTIVE]: '🟢',
      [AmbassadorStatus.INACTIVE]: '🟡',
      [AmbassadorStatus.RETIRED]: '⚪',
      [AmbassadorStatus.SUSPENDED]: '🔴'
    };
    return emojis[status] || '❓';
  }

  private numberToRank(num: number): string {
    if (num >= 3.5) return 'Master';
    if (num >= 2.5) return 'Senior';
    if (num >= 1.5) return 'Ambassador';
    return 'Apprentice';
  }

  private formatActivityType(type: ActivityType): string {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  private chunkText(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    
    const lines = text.split('\n');
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
      }
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
}