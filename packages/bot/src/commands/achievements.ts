import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { injectable, inject } from 'inversify';
import { Command } from './index.js';
import { AchievementService } from '../services/achievement.js';
import { TYPES } from '../types.js';
import { AchievementCategory, AchievementRarity } from '../generated/prisma/index.js';

@injectable()
export class AchievementsCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('View your achievements and progress')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('View all achievements')
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Filter by category')
            .setRequired(false)
            .addChoices(
              { name: 'Creator', value: 'CREATOR' },
              { name: 'Player', value: 'PLAYER' },
              { name: 'Social', value: 'SOCIAL' },
              { name: 'Milestone', value: 'MILESTONE' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View your achievement statistics')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('recent')
        .setDescription('View recently unlocked achievements')
    );

  constructor(
    @inject(TYPES.AchievementService) private achievementService: AchievementService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'list':
        await this.handleList(interaction);
        break;
      case 'stats':
        await this.handleStats(interaction);
        break;
      case 'recent':
        await this.handleRecent(interaction);
        break;
    }
  }

  private async handleList(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();

    const category = interaction.options.get('category')?.value as AchievementCategory | undefined;
    const achievements = await this.achievementService.getUserAchievements(interaction.user.id);

    // Filter by category if specified
    const filteredAchievements = category
      ? achievements.filter(a => a.achievement.category === category)
      : achievements;

    // Group by category
    const grouped = filteredAchievements.reduce((acc, item) => {
      const cat = item.achievement.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<AchievementCategory, typeof achievements>);

    const embeds: EmbedBuilder[] = [];

    // Create embed for each category
    for (const [cat, items] of Object.entries(grouped)) {
      const categoryEmbed = new EmbedBuilder()
        .setColor(this.getCategoryColor(cat as AchievementCategory))
        .setTitle(`${this.getCategoryEmoji(cat as AchievementCategory)} ${this.formatCategory(cat as AchievementCategory)} Achievements`);

      const description = items
        .sort((a, b) => a.achievement.sortOrder - b.achievement.sortOrder)
        .map(item => {
          const icon = item.isComplete ? '✅' : '🔒';
          const progress = item.achievement.targetValue
            ? ` (${Math.floor(item.progress)}%)`
            : '';
          const reward = item.achievement.creditReward > 0
            ? ` • 💎 ${item.achievement.creditReward}`
            : '';

          return `${icon} **${item.achievement.name}**${progress}${reward}\n` +
                 `   ${item.achievement.iconEmoji} ${item.achievement.description}`;
        })
        .join('\n\n');

      categoryEmbed.setDescription(description || 'No achievements in this category');
      embeds.push(categoryEmbed);
    }

    // Add summary embed
    const completed = achievements.filter(a => a.isComplete).length;
    const total = achievements.length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    const summaryEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📊 Achievement Summary')
      .setDescription(
        `**Progress:** ${completed}/${total} achievements unlocked (${percentage.toFixed(1)}%)\n\n` +
        `Use the buttons below to navigate between categories.`
      )
      .setFooter({ text: 'Complete achievements to earn personal credits!' });

    await interaction.editReply({
      embeds: [summaryEmbed, ...embeds.slice(0, 3)] // Discord limit
    });
  }

  private async handleStats(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();

    const stats = await this.achievementService.getUserStats(interaction.user.id);

    const statsEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🏆 Achievement Statistics')
      .setDescription(`Statistics for <@${interaction.user.id}>`)
      .addFields(
        {
          name: '📊 Overall Progress',
          value: `${stats.totalUnlocked}/${stats.totalAvailable} (${stats.completionPercentage.toFixed(1)}%)`,
          inline: true
        },
        {
          name: '💎 Credits Earned',
          value: `${stats.creditsEarned.toLocaleString()}`,
          inline: true
        },
        {
          name: '🎯 Completion Rate',
          value: this.getCompletionBar(stats.completionPercentage),
          inline: false
        }
      );

    // Add category breakdown
    if (Object.keys(stats.categoryCounts).length > 0) {
      const categoryBreakdown = Object.entries(stats.categoryCounts)
        .map(([cat, count]) => `${this.getCategoryEmoji(cat as AchievementCategory)} ${this.formatCategory(cat as AchievementCategory)}: ${count}`)
        .join('\n');

      statsEmbed.addFields({
        name: '📂 Category Breakdown',
        value: categoryBreakdown,
        inline: false
      });
    }

    // Add rarity distribution
    const rarityDistribution = this.calculateRarityDistribution(stats);
    if (rarityDistribution) {
      statsEmbed.addFields({
        name: '✨ Rarity Distribution',
        value: rarityDistribution,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [statsEmbed] });
  }

  private async handleRecent(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();

    const stats = await this.achievementService.getUserStats(interaction.user.id);
    
    if (stats.recentUnlocks.length === 0) {
      await interaction.editReply({
        content: '❌ You haven\'t unlocked any achievements yet. Start creating and sharing games to earn achievements!'
      });
      return;
    }

    const recentEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🎉 Recently Unlocked Achievements')
      .setDescription('Your latest accomplishments:');

    stats.recentUnlocks.slice(0, 10).forEach((unlock, index) => {
      const achievement = unlock.achievement;
      const timeAgo = this.getTimeAgo(new Date(unlock.unlockedAt));

      recentEmbed.addFields({
        name: `${index + 1}. ${achievement.iconEmoji} ${achievement.name}`,
        value: `${achievement.description}\n` +
               `${this.formatRarity(achievement.rarity)} • 💎 ${achievement.creditReward} credits • ${timeAgo}`,
        inline: false
      });
    });

    await interaction.editReply({ embeds: [recentEmbed] });
  }

  /**
   * Helper methods
   */
  private getCategoryColor(category: AchievementCategory): number {
    const colors = {
      CREATOR: 0x3498DB,
      PLAYER: 0x2ECC71,
      SOCIAL: 0xE74C3C,
      COLLECTOR: 0xF39C12,
      MILESTONE: 0x9B59B6,
      SPECIAL: 0xE91E63
    };
    return colors[category] || 0x5865F2;
  }

  private getCategoryEmoji(category: AchievementCategory): string {
    const emojis = {
      CREATOR: '🎮',
      PLAYER: '▶️',
      SOCIAL: '🔗',
      COLLECTOR: '📦',
      MILESTONE: '🏆',
      SPECIAL: '⭐'
    };
    return emojis[category] || '🏅';
  }

  private formatCategory(category: AchievementCategory): string {
    return category.charAt(0) + category.slice(1).toLowerCase();
  }

  private formatRarity(rarity: AchievementRarity): string {
    const formatted = {
      COMMON: '⚪ Common',
      UNCOMMON: '🟢 Uncommon',
      RARE: '🔵 Rare',
      EPIC: '🟣 Epic',
      LEGENDARY: '🟠 Legendary'
    };
    return formatted[rarity];
  }

  private getCompletionBar(percentage: number): string {
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percentage.toFixed(1)}%`;
  }

  private calculateRarityDistribution(stats: any): string | null {
    // This would need the actual rarity data from achievements
    // For now, return a placeholder
    return null;
  }

  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    
    return date.toLocaleDateString();
  }
}