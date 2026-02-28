import { PrismaClient } from '@prisma/client';
import { AchievementCategory, AchievementRarity } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

async function initializeAchievements() {
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
    }
  ];

  console.log('🏆 Initializing achievements...');

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: achievement,
      create: achievement
    });
    console.log(`✅ Created/Updated achievement: ${achievement.name}`);
  }

  console.log('✅ Achievement initialization complete!');
}

initializeAchievements()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });