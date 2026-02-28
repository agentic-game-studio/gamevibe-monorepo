// Creator Stats Command
// Shows creator achievements, game statistics, and viral metrics

import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  User
} from 'discord.js';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { PersonalCreditService } from '../services/personal-credits.js';
import { PrismaClient } from '../generated/prisma/index.js';
import { formatNumber } from '@gamevibe/shared';

const CREATOR_TIER_COLORS = {
  BRONZE: 0xCD7F32,
  SILVER: 0xC0C0C0,
  GOLD: 0xFFD700,
  DIAMOND: 0xB9F2FF
};

const CREATOR_TIER_EMOJIS = {
  BRONZE: '🥉',
  SILVER: '🥈',
  GOLD: '🥇',
  DIAMOND: '💎'
};

interface CreatorStats {
  // Basic stats
  gamesCreated: number;
  totalPlays: number;
  totalShares: number;
  totalRemixes: number;
  
  // Reach
  serversReached: number;
  uniquePlayers: number;
  
  // Viral metrics
  viralGames: number; // Games with 1000+ plays
  mostPopularGame: {
    id: string;
    title: string;
    plays: number;
  } | null;
  
  // Earnings
  creditsEarned: number;
  creatorTier: string;
  tierProgress: {
    current: string;
    next: string | null;
    progress: number;
    required: number;
    percentage: number;
  };
  
  // Achievements
  unlockedAchievements: number;
  totalAchievements: number;
  recentAchievements: Array<{
    name: string;
    description: string;
    unlockedAt: Date;
  }>;
  
  // Rankings
  globalRank: number | null;
  serverRank: number | null;
  
  // Recent activity
  recentGames: Array<{
    id: string;
    title: string;
    createdAt: Date;
    plays: number;
  }>;
}

@injectable()
export class CreatorStatsCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('creator-stats')
    .setDescription('View your creator statistics and achievements')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('View stats for another creator')
        .setRequired(false)
    ) as SlashCommandBuilder;

  constructor(
    @inject(TYPES.PersonalCreditService) private personalCreditService: PersonalCreditService,
    @inject(TYPES.DatabaseService) private prisma: PrismaClient
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;    await interaction.deferReply({ ephemeral: true });

    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const stats = await this.getCreatorStats(targetUser.id);
      
      if (!stats.gamesCreated) {
        await interaction.editReply({
          content: `${targetUser.id === interaction.user.id ? "You haven't" : `${targetUser.username} hasn't`} created any games yet. Use \`/create-game\` to get started!`
        });
        return;
      }

      const embed = await this.buildStatsEmbed(targetUser, stats);
      const components = this.buildComponents(targetUser.id, interaction.user.id);

      await interaction.editReply({
        embeds: [embed],
        components
      });

    } catch (error) {
      console.error('Creator stats error:', error);
      await interaction.editReply({
        content: '❌ Failed to load creator statistics. Please try again.'
      });
    }
  }

  private async getCreatorStats(userId: string): Promise<CreatorStats> {
    // Get personal credits info
    const credits = await this.personalCreditService.getPersonalCredits(userId);
    
    // Get games created
    const games = await this.prisma.game.findMany({
      where: { creatorId: userId },
      include: {
        serverReach: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const gamesCreated = games.length;
    const totalPlays = games.reduce((sum, game) => sum + game.playCount, 0);
    
    // Get shares
    const shares = await this.prisma.gameShare.count({
      where: { sharerId: userId }
    });

    // Get remixes
    const remixes = await this.prisma.remixHistory.count({
      where: { 
        game: {
          creatorId: userId
        }
      }
    });

    // Calculate servers reached
    const serversReached = new Set(
      games.flatMap(game => game.serverReach.map(sr => sr.serverId))
    ).size;

    // Find viral games
    const viralGames = games.filter(game => game.playCount >= 1000).length;
    
    // Find most popular game
    const mostPopularGame = games.sort((a, b) => b.playCount - a.playCount)[0] || null;

    // Get achievements
    const achievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 5
    });

    // Calculate tier progress
    const tierProgress = this.calculateTierProgress(credits);

    // Get recent games
    const recentGames = games.slice(0, 3).map(game => ({
      id: game.id,
      title: game.title,
      createdAt: game.createdAt,
      plays: game.playCount
    }));

    // TODO: Calculate rankings (would need aggregation queries)
    const globalRank = null;
    const serverRank = null;

    return {
      gamesCreated,
      totalPlays,
      totalShares: shares,
      totalRemixes: remixes,
      serversReached,
      uniquePlayers: Math.floor(totalPlays * 0.7), // Estimate
      viralGames,
      mostPopularGame: mostPopularGame ? {
        id: mostPopularGame.id,
        title: mostPopularGame.title,
        plays: mostPopularGame.playCount
      } : null,
      creditsEarned: credits.totalEarned,
      creatorTier: credits.creatorTier,
      tierProgress,
      unlockedAchievements: achievements.filter(a => a.completed).length,
      totalAchievements: 20, // TODO: Get from achievement definitions
      recentAchievements: achievements.filter(a => a.completed).slice(0, 3).map(a => ({
        name: 'Achievement', // TODO: Get from definitions
        description: 'Description',
        unlockedAt: a.completedAt!
      })),
      globalRank,
      serverRank,
      recentGames
    };
  }

  private calculateTierProgress(credits: any): any {
    const tiers = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'];
    const thresholds = [0, 1000, 10000, 100000];
    
    const currentIndex = tiers.indexOf(credits.creatorTier);
    if (currentIndex === tiers.length - 1) {
      return {
        current: credits.creatorTier,
        next: null,
        progress: credits.totalEarned,
        required: thresholds[currentIndex],
        percentage: 100
      };
    }

    const nextTier = tiers[currentIndex + 1];
    const currentThreshold = thresholds[currentIndex];
    const nextThreshold = thresholds[currentIndex + 1];
    const progress = credits.totalEarned - currentThreshold;
    const required = nextThreshold - currentThreshold;

    return {
      current: credits.creatorTier,
      next: nextTier,
      progress,
      required,
      percentage: Math.min(100, (progress / required) * 100)
    };
  }

  private async buildStatsEmbed(user: User, stats: CreatorStats): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setTitle(`${CREATOR_TIER_EMOJIS[stats.creatorTier as keyof typeof CREATOR_TIER_EMOJIS]} ${user.username}'s Creator Stats`)
      .setDescription(`${stats.creatorTier} Creator • ${formatNumber(stats.creditsEarned)} credits earned`)
      .setColor(CREATOR_TIER_COLORS[stats.creatorTier as keyof typeof CREATOR_TIER_COLORS])
      .setThumbnail(user.displayAvatarURL());

    // Core stats
    embed.addFields([
      {
        name: '🎮 Games Created',
        value: stats.gamesCreated.toString(),
        inline: true
      },
      {
        name: '👥 Total Plays',
        value: formatNumber(stats.totalPlays),
        inline: true
      },
      {
        name: '🌍 Servers Reached',
        value: stats.serversReached.toString(),
        inline: true
      }
    ]);

    // Engagement stats
    embed.addFields([
      {
        name: '🔄 Total Remixes',
        value: stats.totalRemixes.toString(),
        inline: true
      },
      {
        name: '📤 Total Shares',
        value: stats.totalShares.toString(),
        inline: true
      },
      {
        name: '🔥 Viral Games',
        value: stats.viralGames.toString(),
        inline: true
      }
    ]);

    // Most popular game
    if (stats.mostPopularGame) {
      embed.addFields([
        {
          name: '🏆 Most Popular Game',
          value: `**${stats.mostPopularGame.title}**\n${formatNumber(stats.mostPopularGame.plays)} plays`,
          inline: false
        }
      ]);
    }

    // Tier progress
    if (stats.tierProgress.next) {
      const progressBar = this.createProgressBar(stats.tierProgress.percentage);
      embed.addFields([
        {
          name: `📈 Progress to ${CREATOR_TIER_EMOJIS[stats.tierProgress.next as keyof typeof CREATOR_TIER_EMOJIS]} ${stats.tierProgress.next}`,
          value: [
            progressBar,
            `${formatNumber(stats.tierProgress.progress)} / ${formatNumber(stats.tierProgress.required)} credits (${stats.tierProgress.percentage.toFixed(1)}%)`
          ].join('\n'),
          inline: false
        }
      ]);
    }

    // Rankings
    if (stats.globalRank || stats.serverRank) {
      const rankings = [];
      if (stats.globalRank) rankings.push(`🌍 Global: #${stats.globalRank}`);
      if (stats.serverRank) rankings.push(`🏰 Server: #${stats.serverRank}`);
      
      embed.addFields([
        {
          name: '🏅 Rankings',
          value: rankings.join('\n'),
          inline: false
        }
      ]);
    }

    // Recent games
    if (stats.recentGames.length > 0) {
      const recentGamesText = stats.recentGames
        .map((game, i) => `${i + 1}. **${game.title}** - ${formatNumber(game.plays)} plays`)
        .join('\n');

      embed.addFields([
        {
          name: '🎯 Recent Games',
          value: recentGamesText,
          inline: false
        }
      ]);
    }

    // Achievements
    embed.addFields([
      {
        name: '🏆 Achievements',
        value: `${stats.unlockedAchievements} / ${stats.totalAchievements} unlocked`,
        inline: false
      }
    ]);

    embed.setFooter({
      text: 'Create amazing games to climb the creator ranks!'
    });

    return embed;
  }

  private createProgressBar(percentage: number): string {
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;
    
    const filledChar = '█';
    const emptyChar = '░';
    
    return `[${filledChar.repeat(filled)}${emptyChar.repeat(empty)}]`;
  }

  private buildComponents(targetUserId: string, viewerUserId: string): ActionRowBuilder<ButtonBuilder>[] {
    const components = [];
    const row = new ActionRowBuilder<ButtonBuilder>();

    // View games button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`creator:games:${targetUserId}`)
        .setLabel('View Games')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎮')
    );

    // View achievements button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`creator:achievements:${targetUserId}`)
        .setLabel('Achievements')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏆')
    );

    // If viewing own stats, add earn credits button
    if (targetUserId === viewerUserId) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('credits:earn')
          .setLabel('How to Earn')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💰')
      );
    }

    components.push(row);
    return components;
  }
}