import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
// Remove circular dependency - credits are awarded externally
import { AnalyticsService } from './analytics.js';
import { DiscordAPIError, EmbedBuilder } from 'discord.js';
import { Achievement, AchievementCategory, AchievementRarity, UserAchievement } from '../generated/prisma/index.js';

export interface AchievementProgress {
  achievement: Achievement;
  progress: number;
  isComplete: boolean;
  userAchievement?: UserAchievement;
}

// Type for UserAchievement with included relations
type UserAchievementWithRelations = UserAchievement & {
  achievement: Achievement;
};

export interface AchievementStats {
  totalUnlocked: number;
  totalAvailable: number;
  completionPercentage: number;
  recentUnlocks: UserAchievementWithRelations[];
  categoryCounts: Record<AchievementCategory, number>;
  creditsEarned: number;
}

@injectable()
export class AchievementService {
  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.DiscordClient) private discord: any
  ) {}

  /**
   * Check and update progress for a specific achievement type
   */
  async checkProgress(
    userId: string,
    targetType: string,
    value: number = 1,
    metadata?: any
  ): Promise<Achievement[]> {
    const unlockedAchievements: Achievement[] = [];

    // Get user to ensure they exist
    const user = await this.db.prisma.user.findUnique({
      where: { discordId: userId }
    });

    if (!user) {
      return unlockedAchievements;
    }

    // Get all achievements for this target type
    const achievements = await this.db.prisma.achievement.findMany({
      where: {
        targetType,
        userAchievements: {
          none: {
            userId: user.id
          }
        }
      }
    });

    for (const achievement of achievements) {
      // Check if achievement conditions are met
      const progress = await this.getOrCreateProgress(user.id, achievement.id);
      const newValue = progress.currentValue + value;

      // Update progress
      await this.db.prisma.achievementProgress.update({
        where: {
          userId_achievementId: {
            userId: user.id,
            achievementId: achievement.id
          }
        },
        data: {
          currentValue: newValue
        }
      });

      // Check if achievement is completed
      if (achievement.targetValue && newValue >= achievement.targetValue) {
        // Unlock achievement
        await this.unlockAchievement(user.id, achievement.id, metadata);
        unlockedAchievements.push(achievement);
      }
    }

    // Track analytics
    if (unlockedAchievements.length > 0) {
      await this.analytics.track('achievements_unlocked', {
        userId,
        count: unlockedAchievements.length,
        achievements: unlockedAchievements.map(a => a.key)
      });
    }

    return unlockedAchievements;
  }

  /**
   * Unlock an achievement for a user
   */
  private async unlockAchievement(
    userId: string,
    achievementId: string,
    metadata?: any
  ): Promise<UserAchievement> {
    // Create user achievement record
    const userAchievement = await this.db.prisma.userAchievement.create({
      data: {
        userId,
        achievementId,
        metadata: metadata || {}
      },
      include: {
        achievement: true,
        user: true
      }
    });

    // TODO: Credits are awarded externally to avoid circular dependency
    // Achievement credit rewards should be handled by PersonalCreditService

    // Send notification
    await this.sendUnlockNotification(userAchievement);

    // Clear cache
    await this.cache.delete(`achievements:user:${userId}`);

    return userAchievement;
  }

  /**
   * Send a notification when an achievement is unlocked
   */
  private async sendUnlockNotification(userAchievement: any): Promise<void> {
    try {
      const user = await this.discord.users.fetch(userAchievement.user.discordId);
      
      const embed = new EmbedBuilder()
        .setColor(this.getRarityColor(userAchievement.achievement.rarity))
        .setTitle('🎉 Achievement Unlocked!')
        .setDescription(`**${userAchievement.achievement.name}**\n${userAchievement.achievement.description}`)
        .addFields(
          {
            name: '🏆 Rarity',
            value: this.formatRarity(userAchievement.achievement.rarity),
            inline: true
          },
          {
            name: '💎 Reward',
            value: `${userAchievement.achievement.creditReward} credits`,
            inline: true
          }
        )
        .setTimestamp();

      await user.send({ embeds: [embed] });
    } catch (error) {
      // User has DMs disabled or bot was blocked
      console.error('Failed to send achievement notification:', error);
    }
  }

  /**
   * Get or create progress tracking for an achievement
   */
  private async getOrCreateProgress(userId: string, achievementId: string): Promise<any> {
    const achievement = await this.db.prisma.achievement.findUnique({
      where: { id: achievementId }
    });

    if (!achievement || !achievement.targetValue) {
      throw new Error('Invalid achievement for progress tracking');
    }

    return await this.db.prisma.achievementProgress.upsert({
      where: {
        userId_achievementId: {
          userId,
          achievementId
        }
      },
      update: {},
      create: {
        userId,
        achievementId,
        targetValue: achievement.targetValue
      }
    });
  }

  /**
   * Get all achievements and progress for a user
   */
  async getUserAchievements(discordUserId: string): Promise<AchievementProgress[]> {
    const cacheKey = `achievements:user:${discordUserId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const user = await this.db.prisma.user.findUnique({
      where: { discordId: discordUserId },
      include: {
        achievements: {
          include: {
            achievement: true
          }
        },
        achievementProgress: {
          include: {
            achievement: true
          }
        }
      }
    });

    if (!user) {
      return [];
    }

    // Get all achievements
    const allAchievements = await this.db.prisma.achievement.findMany({
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' }
      ]
    });

    // Map achievements with progress
    const achievementProgress: AchievementProgress[] = allAchievements.map(achievement => {
      const userAchievement = user.achievements.find(ua => ua.achievementId === achievement.id);
      const progress = user.achievementProgress.find(ap => ap.achievementId === achievement.id);

      const currentProgress = userAchievement
        ? 100
        : progress && achievement.targetValue
        ? (progress.currentValue / achievement.targetValue) * 100
        : 0;

      return {
        achievement,
        progress: currentProgress,
        isComplete: !!userAchievement,
        userAchievement
      };
    });

    // Cache for 5 minutes
    await this.cache.set(cacheKey, JSON.stringify(achievementProgress), 300);

    return achievementProgress;
  }

  /**
   * Get achievement statistics for a user
   */
  async getUserStats(discordUserId: string): Promise<AchievementStats> {
    const user = await this.db.prisma.user.findUnique({
      where: { discordId: discordUserId },
      include: {
        achievements: {
          include: {
            achievement: true
          },
          orderBy: {
            unlockedAt: 'desc'
          },
          take: 10
        }
      }
    });

    if (!user) {
      return {
        totalUnlocked: 0,
        totalAvailable: 0,
        completionPercentage: 0,
        recentUnlocks: [],
        categoryCounts: {} as Record<AchievementCategory, number>,
        creditsEarned: 0
      };
    }

    const totalAvailable = await this.db.prisma.achievement.count();
    const totalUnlocked = user.achievements.length;

    // Count by category
    const categoryCounts = user.achievements.reduce((acc, ua) => {
      const category = ua.achievement.category;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<AchievementCategory, number>);

    // Calculate total credits earned
    const creditsEarned = user.achievements
      .filter(ua => ua.creditsClaimed)
      .reduce((sum, ua) => sum + ua.achievement.creditReward, 0);

    return {
      totalUnlocked,
      totalAvailable,
      completionPercentage: totalAvailable > 0 ? (totalUnlocked / totalAvailable) * 100 : 0,
      recentUnlocks: user.achievements,
      categoryCounts,
      creditsEarned
    };
  }

  /**
   * Initialize default achievements in the database
   */
  async initializeAchievements(): Promise<void> {
    const achievements = [
      // Creator achievements
      {
        key: 'first_game',
        name: 'First Steps',
        description: 'Create your first game',
        category: AchievementCategory.CREATOR,
        rarity: AchievementRarity.COMMON,
        targetType: 'games_created',
        targetValue: 1,
        creditReward: 10,
        iconEmoji: '🎮'
      },
      {
        key: 'game_creator_5',
        name: 'Game Designer',
        description: 'Create 5 games',
        category: AchievementCategory.CREATOR,
        rarity: AchievementRarity.UNCOMMON,
        targetType: 'games_created',
        targetValue: 5,
        creditReward: 50,
        iconEmoji: '🎨'
      },
      {
        key: 'game_creator_25',
        name: 'Prolific Creator',
        description: 'Create 25 games',
        category: AchievementCategory.CREATOR,
        rarity: AchievementRarity.RARE,
        targetType: 'games_created',
        targetValue: 25,
        creditReward: 250,
        iconEmoji: '🏗️'
      },
      {
        key: 'game_creator_100',
        name: 'Master Developer',
        description: 'Create 100 games',
        category: AchievementCategory.CREATOR,
        rarity: AchievementRarity.EPIC,
        targetType: 'games_created',
        targetValue: 100,
        creditReward: 1000,
        iconEmoji: '👨‍💻'
      },

      // Player achievements
      {
        key: 'plays_100',
        name: 'Casual Player',
        description: 'Your games have been played 100 times',
        category: AchievementCategory.PLAYER,
        rarity: AchievementRarity.COMMON,
        targetType: 'total_plays',
        targetValue: 100,
        creditReward: 25,
        iconEmoji: '▶️'
      },
      {
        key: 'plays_1000',
        name: 'Popular Creator',
        description: 'Your games have been played 1,000 times',
        category: AchievementCategory.PLAYER,
        rarity: AchievementRarity.UNCOMMON,
        targetType: 'total_plays',
        targetValue: 1000,
        creditReward: 100,
        iconEmoji: '🌟'
      },
      {
        key: 'plays_10000',
        name: 'Hit Maker',
        description: 'Your games have been played 10,000 times',
        category: AchievementCategory.PLAYER,
        rarity: AchievementRarity.RARE,
        targetType: 'total_plays',
        targetValue: 10000,
        creditReward: 500,
        iconEmoji: '🔥'
      },

      // Social achievements
      {
        key: 'first_share',
        name: 'Sharing is Caring',
        description: 'Share your first game',
        category: AchievementCategory.SOCIAL,
        rarity: AchievementRarity.COMMON,
        targetType: 'games_shared',
        targetValue: 1,
        creditReward: 15,
        iconEmoji: '🔗'
      },
      {
        key: 'viral_game',
        name: 'Going Viral',
        description: 'Have a game reach 100+ plays',
        category: AchievementCategory.SOCIAL,
        rarity: AchievementRarity.RARE,
        targetType: 'viral_game',
        targetValue: 1,
        creditReward: 200,
        iconEmoji: '🚀'
      },
      {
        key: 'cross_server_5',
        name: 'Server Hopper',
        description: 'Have your games played in 5+ servers',
        category: AchievementCategory.SOCIAL,
        rarity: AchievementRarity.UNCOMMON,
        targetType: 'server_reach',
        targetValue: 5,
        creditReward: 75,
        iconEmoji: '🌐'
      },

      // Milestone achievements
      {
        key: 'tier_silver',
        name: 'Silver Creator',
        description: 'Reach Silver creator tier',
        category: AchievementCategory.MILESTONE,
        rarity: AchievementRarity.UNCOMMON,
        targetType: 'creator_tier',
        targetValue: 1,
        creditReward: 100,
        iconEmoji: '🥈'
      },
      {
        key: 'tier_gold',
        name: 'Gold Creator',
        description: 'Reach Gold creator tier',
        category: AchievementCategory.MILESTONE,
        rarity: AchievementRarity.RARE,
        targetType: 'creator_tier',
        targetValue: 2,
        creditReward: 500,
        iconEmoji: '🥇'
      },
      {
        key: 'tier_diamond',
        name: 'Diamond Creator',
        description: 'Reach Diamond creator tier',
        category: AchievementCategory.MILESTONE,
        rarity: AchievementRarity.LEGENDARY,
        targetType: 'creator_tier',
        targetValue: 3,
        creditReward: 2500,
        iconEmoji: '💎'
      },

      // Challenge achievements
      {
        key: 'first_challenge',
        name: 'Challenger',
        description: 'Create your first challenge',
        category: AchievementCategory.SOCIAL,
        rarity: AchievementRarity.COMMON,
        targetType: 'challenges_created',
        targetValue: 1,
        creditReward: 15,
        iconEmoji: '⚔️'
      },
      {
        key: 'challenge_winner',
        name: 'Victory',
        description: 'Win your first challenge',
        category: AchievementCategory.SOCIAL,
        rarity: AchievementRarity.COMMON,
        targetType: 'challenges_won',
        targetValue: 1,
        creditReward: 25,
        iconEmoji: '🏆'
      },
      {
        key: 'challenge_master',
        name: 'Challenge Master',
        description: 'Win 10 challenges',
        category: AchievementCategory.SOCIAL,
        rarity: AchievementRarity.RARE,
        targetType: 'challenges_won',
        targetValue: 10,
        creditReward: 150,
        iconEmoji: '👑'
      },
      {
        key: 'big_winner',
        name: 'Big Winner',
        description: 'Win a challenge worth 100+ credits',
        category: AchievementCategory.SOCIAL,
        rarity: AchievementRarity.UNCOMMON,
        targetType: 'high_value_challenge_win',
        targetValue: 1,
        creditReward: 100,
        iconEmoji: '💰'
      }
    ];

    // Upsert achievements
    for (const achievement of achievements) {
      await this.db.prisma.achievement.upsert({
        where: { key: achievement.key },
        update: achievement,
        create: achievement
      });
    }
  }

  /**
   * Helper methods
   */
  private getRarityColor(rarity: AchievementRarity): number {
    const colors = {
      COMMON: 0x95A99C,
      UNCOMMON: 0x96BE4B,
      RARE: 0x4B9BFF,
      EPIC: 0xB565D9,
      LEGENDARY: 0xFFB93A
    };
    return colors[rarity];
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
}