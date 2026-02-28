import { injectable, inject } from 'inversify';
import { DatabaseService } from './database.js';
import { AnalyticsService } from './analytics.js';
import { CacheService } from './cache.js';
import { AchievementService } from './achievement.js';
import { LiveActivityService } from './live-activity.js';
import { TYPES } from '../types.js';

export interface SocialBadge {
  id: string;
  name: string;
  description: string;
  category: 'achievement' | 'milestone' | 'special' | 'event' | 'community' | 'creator';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  design: {
    iconUrl: string;
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    shape: 'circle' | 'hexagon' | 'shield' | 'star' | 'crown';
    effects: ('glow' | 'sparkle' | 'animate' | 'gradient')[];
    size: 'small' | 'medium' | 'large';
  };
  requirements: {
    type: 'games_created' | 'plays_received' | 'rating_achieved' | 'streak' | 'social' | 'special';
    criteria: Record<string, any>;
    description: string;
  };
  rewards: {
    credits: number;
    title?: string;
    unlocks?: string[];
  };
  stats: {
    totalAwarded: number;
    recentAwards: number;
    firstAwarded: Date;
    lastAwarded: Date;
  };
  social: {
    shareable: boolean;
    shareTemplate: string;
    socialMedia: ('twitter' | 'discord' | 'facebook' | 'instagram')[];
  };
  metadata: {
    isLimited: boolean;
    expiresAt?: Date;
    maxAwards?: number;
    seasonalEvent?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  badge: SocialBadge;
  awardedAt: Date;
  awardedBy: 'system' | 'admin' | 'community';
  awardReason: string;
  displayOrder: number;
  isVisible: boolean;
  isFavorite: boolean;
  shareCount: number;
  certificateGenerated: boolean;
  certificateUrl?: string;
}

export interface BadgeCollection {
  userId: string;
  userName: string;
  badges: UserBadge[];
  stats: {
    totalBadges: number;
    commonBadges: number;
    rareBadges: number;
    epicBadges: number;
    legendaryBadges: number;
    firstBadgeDate: Date;
    latestBadgeDate: Date;
    completionPercentage: number;
  };
  showcase: {
    featuredBadges: string[];
    layoutStyle: 'grid' | 'carousel' | 'timeline';
    backgroundColor: string;
    isPublic: boolean;
  };
  preferences: {
    showRarity: boolean;
    showStats: boolean;
    autoShare: boolean;
    shareDestinations: string[];
  };
}

export interface AchievementCertificate {
  id: string;
  userId: string;
  badgeId: string;
  type: 'badge' | 'milestone' | 'achievement' | 'event';
  template: 'classic' | 'modern' | 'gaming' | 'elegant' | 'fun';
  content: {
    title: string;
    subtitle: string;
    description: string;
    awardedDate: Date;
    badgeImage: string;
    userAvatar?: string;
  };
  design: {
    backgroundColor: string;
    borderStyle: string;
    fontFamily: string;
    accentColor: string;
    logoUrl?: string;
  };
  socialShare: {
    imageUrl: string;
    shareText: string;
    hashtags: string[];
    platforms: string[];
  };
  downloadUrl: string;
  shareUrl: string;
  views: number;
  shares: number;
  createdAt: Date;
}

export interface BadgeQuest {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  steps: {
    id: string;
    description: string;
    requirement: any;
    reward: { credits: number; badge?: string };
    isCompleted: boolean;
  }[];
  finalReward: {
    badgeId: string;
    credits: number;
    title: string;
    certificate: boolean;
  };
  timeLimit?: Date;
  participants: number;
  completions: number;
  isActive: boolean;
}

@injectable()
export class SocialBadgeService {
  private readonly cacheKeyPrefix = 'social_badges:';
  private readonly cacheTTL = 30 * 60; // 30 minutes

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.AchievementService) private achievementService: AchievementService,
    @inject(TYPES.LiveActivityService) private liveActivityService: LiveActivityService
  ) {}

  /**
   * Award a badge to a user
   */
  async awardBadge(
    userId: string,
    badgeId: string,
    awardReason: string,
    awardedBy: 'system' | 'admin' | 'community' = 'system'
  ): Promise<{ success: boolean; userBadge?: UserBadge; message: string }> {
    const badge = await this.getBadge(badgeId);
    
    if (!badge) {
      return { success: false, message: 'Badge not found' };
    }

    // Check if user already has this badge
    const existingBadge = await this.getUserBadge(userId, badgeId);
    if (existingBadge) {
      return { success: false, message: 'User already has this badge' };
    }

    // Check badge limits
    if (badge.metadata.maxAwards && badge.stats.totalAwarded >= badge.metadata.maxAwards) {
      return { success: false, message: 'Badge award limit reached' };
    }

    if (badge.metadata.expiresAt && new Date() > badge.metadata.expiresAt) {
      return { success: false, message: 'Badge is no longer available' };
    }

    // Create user badge
    const userBadge: UserBadge = {
      id: `ub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      badgeId,
      badge,
      awardedAt: new Date(),
      awardedBy,
      awardReason,
      displayOrder: await this.getNextDisplayOrder(userId),
      isVisible: true,
      isFavorite: false,
      shareCount: 0,
      certificateGenerated: false
    };

    await this.storeUserBadge(userBadge);

    // Update badge stats
    badge.stats.totalAwarded++;
    badge.stats.recentAwards++;
    badge.stats.lastAwarded = new Date();
    await this.updateBadge(badge);

    // Award credits
    if (badge.rewards.credits > 0) {
      // Would integrate with credit service
    }

    // Generate certificate for rare+ badges
    if (['rare', 'epic', 'legendary', 'mythic'].includes(badge.rarity)) {
      await this.generateCertificate(userBadge);
    }

    // Record activity
    await this.liveActivityService.recordActivity(
      'BADGE_AWARDED',
      userId,
      {
        badgeId: badge.id,
        badgeName: badge.name,
        rarity: badge.rarity,
        category: badge.category,
        awardReason
      }
    );

    // Clear user collection cache
    await this.cache.delete(`${this.cacheKeyPrefix}collection:${userId}`);

    return { success: true, userBadge, message: 'Badge awarded successfully' };
  }

  /**
   * Get user's badge collection
   */
  async getBadgeCollection(userId: string): Promise<BadgeCollection | null> {
    const cacheKey = `${this.cacheKeyPrefix}collection:${userId}`;
    let collection = await this.cache.get<BadgeCollection>(cacheKey);

    if (!collection) {
      collection = await this.buildBadgeCollection(userId);
      if (collection) {
        await this.cache.set(cacheKey, collection, this.cacheTTL);
      }
    }

    return collection;
  }

  /**
   * Get available badges
   */
  async getAvailableBadges(category?: string, rarity?: string): Promise<SocialBadge[]> {
    const cacheKey = `${this.cacheKeyPrefix}available:${category || 'all'}:${rarity || 'all'}`;
    let badges = await this.cache.get<SocialBadge[]>(cacheKey);

    if (!badges) {
      badges = await this.getAvailableBadgesFromDatabase(category, rarity);
      await this.cache.set(cacheKey, badges, this.cacheTTL);
    }

    return badges;
  }

  /**
   * Generate achievement certificate
   */
  async generateCertificate(
    userBadge: UserBadge,
    template: 'classic' | 'modern' | 'gaming' | 'elegant' | 'fun' = 'modern'
  ): Promise<AchievementCertificate> {
    const user = await this.db.prisma.user.findUnique({
      where: { discordId: userBadge.userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const certificate: AchievementCertificate = {
      id: `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: userBadge.userId,
      badgeId: userBadge.badgeId,
      type: 'badge',
      template,
      content: {
        title: `Achievement Unlocked!`,
        subtitle: userBadge.badge.name,
        description: userBadge.badge.description,
        awardedDate: userBadge.awardedAt,
        badgeImage: userBadge.badge.design.iconUrl,
        userAvatar: user.avatar || undefined
      },
      design: this.getCertificateDesign(template, userBadge.badge),
      socialShare: {
        imageUrl: '', // Would generate image
        shareText: this.generateShareText(userBadge),
        hashtags: ['GameVibe', 'Achievement', userBadge.badge.category],
        platforms: userBadge.badge.social.socialMedia
      },
      downloadUrl: '', // Would generate download URL
      shareUrl: '', // Would generate share URL
      views: 0,
      shares: 0,
      createdAt: new Date()
    };

    await this.storeCertificate(certificate);

    // Update user badge
    userBadge.certificateGenerated = true;
    userBadge.certificateUrl = certificate.shareUrl;
    await this.storeUserBadge(userBadge);

    return certificate;
  }

  /**
   * Share badge on social media
   */
  async shareBadge(
    userId: string,
    badgeId: string,
    platform: 'twitter' | 'discord' | 'facebook' | 'instagram'
  ): Promise<{ success: boolean; shareUrl?: string; message: string }> {
    const userBadge = await this.getUserBadge(userId, badgeId);
    
    if (!userBadge) {
      return { success: false, message: 'Badge not found for user' };
    }

    if (!userBadge.badge.social.shareable) {
      return { success: false, message: 'This badge cannot be shared' };
    }

    if (!userBadge.badge.social.socialMedia.includes(platform)) {
      return { success: false, message: `Badge cannot be shared on ${platform}` };
    }

    // Generate share content
    const shareContent = this.generateShareContent(userBadge, platform);
    
    // Update share count
    userBadge.shareCount++;
    await this.storeUserBadge(userBadge);

    // Record share activity
    await this.liveActivityService.recordActivity(
      'BADGE_SHARED',
      userId,
      {
        badgeId: userBadge.badgeId,
        badgeName: userBadge.badge.name,
        platform,
        shareCount: userBadge.shareCount
      }
    );

    return { 
      success: true, 
      shareUrl: shareContent.url,
      message: 'Badge shared successfully' 
    };
  }

  /**
   * Update badge showcase preferences
   */
  async updateShowcase(
    userId: string,
    showcase: Partial<BadgeCollection['showcase']>
  ): Promise<{ success: boolean; message: string }> {
    const collection = await this.getBadgeCollection(userId);
    
    if (!collection) {
      return { success: false, message: 'Badge collection not found' };
    }

    // Update showcase preferences
    collection.showcase = { ...collection.showcase, ...showcase };
    await this.storeBadgeCollection(collection);

    // Clear cache
    await this.cache.delete(`${this.cacheKeyPrefix}collection:${userId}`);

    return { success: true, message: 'Showcase updated successfully' };
  }

  /**
   * Check and award automatic badges
   */
  async checkAutomaticBadges(userId: string): Promise<UserBadge[]> {
    const user = await this.db.prisma.user.findUnique({
      where: { discordId: userId },
      include: {
        games: {
          include: { _count: { select: { plays: true } } }
        }
      }
    });

    if (!user) {
      return [];
    }

    const availableBadges = await this.getAvailableBadges();
    const userBadges = await this.getUserBadges(userId);
    const ownedBadgeIds = userBadges.map(ub => ub.badgeId);
    
    const awardedBadges: UserBadge[] = [];

    for (const badge of availableBadges) {
      if (ownedBadgeIds.includes(badge.id)) {
        continue; // Already has this badge
      }

      if (await this.meetsRequirements(user, badge.requirements)) {
        const result = await this.awardBadge(
          userId,
          badge.id,
          'Automatic award based on achievements'
        );
        
        if (result.success && result.userBadge) {
          awardedBadges.push(result.userBadge);
        }
      }
    }

    return awardedBadges;
  }

  /**
   * Get badge leaderboard
   */
  async getBadgeLeaderboard(
    category: 'total' | 'rare' | 'recent' = 'total',
    limit: number = 50
  ): Promise<{ userId: string; userName: string; score: number; badges: number }[]> {
    // For now, return sample data
    return [
      { userId: 'user1', userName: 'BadgeCollector', score: 95, badges: 45 },
      { userId: 'user2', userName: 'AchievementHunter', score: 87, badges: 38 },
      { userId: 'user3', userName: 'BadgeMaster', score: 82, badges: 34 }
    ];
  }

  /**
   * Get active badge quests
   */
  async getActiveQuests(): Promise<BadgeQuest[]> {
    return this.getSampleQuests().filter(q => q.isActive);
  }

  // Private helper methods
  private async getBadge(badgeId: string): Promise<SocialBadge | null> {
    const cacheKey = `${this.cacheKeyPrefix}badge:${badgeId}`;
    let badge = await this.cache.get<SocialBadge>(cacheKey);

    if (!badge) {
      badge = await this.getBadgeFromDatabase(badgeId);
      if (badge) {
        await this.cache.set(cacheKey, badge, this.cacheTTL);
      }
    }

    return badge;
  }

  private async getUserBadge(userId: string, badgeId: string): Promise<UserBadge | null> {
    const collection = await this.getBadgeCollection(userId);
    return collection?.badges.find(b => b.badgeId === badgeId) || null;
  }

  private async getUserBadges(userId: string): Promise<UserBadge[]> {
    const collection = await this.getBadgeCollection(userId);
    return collection?.badges || [];
  }

  private async getNextDisplayOrder(userId: string): Promise<number> {
    const badges = await this.getUserBadges(userId);
    return Math.max(...badges.map(b => b.displayOrder), 0) + 1;
  }

  private async buildBadgeCollection(userId: string): Promise<BadgeCollection | null> {
    const user = await this.db.prisma.user.findUnique({
      where: { discordId: userId }
    });

    if (!user) {
      return null;
    }

    // For now, return sample collection
    const badges = this.getSampleUserBadges(userId);
    
    const stats = this.calculateCollectionStats(badges);

    return {
      userId,
      userName: user.username || user.discordId,
      badges,
      stats,
      showcase: {
        featuredBadges: badges.slice(0, 3).map(b => b.badgeId),
        layoutStyle: 'grid',
        backgroundColor: '#1a1a1a',
        isPublic: true
      },
      preferences: {
        showRarity: true,
        showStats: true,
        autoShare: false,
        shareDestinations: ['discord']
      }
    };
  }

  private calculateCollectionStats(badges: UserBadge[]): BadgeCollection['stats'] {
    const rarities = badges.reduce((acc, badge) => {
      acc[badge.badge.rarity] = (acc[badge.badge.rarity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sortedBadges = badges.sort((a, b) => a.awardedAt.getTime() - b.awardedAt.getTime());

    return {
      totalBadges: badges.length,
      commonBadges: rarities.common || 0,
      rareBadges: (rarities.rare || 0) + (rarities.epic || 0),
      epicBadges: rarities.epic || 0,
      legendaryBadges: (rarities.legendary || 0) + (rarities.mythic || 0),
      firstBadgeDate: sortedBadges[0]?.awardedAt || new Date(),
      latestBadgeDate: sortedBadges[sortedBadges.length - 1]?.awardedAt || new Date(),
      completionPercentage: Math.min((badges.length / 50) * 100, 100) // Assume 50 total badges
    };
  }

  private async meetsRequirements(user: any, requirements: SocialBadge['requirements']): Promise<boolean> {
    switch (requirements.type) {
      case 'games_created':
        return user.games.length >= requirements.criteria.count;
      
      case 'plays_received':
        const totalPlays = user.games.reduce((sum: number, game: any) => sum + game._count.plays, 0);
        return totalPlays >= requirements.criteria.count;
      
      case 'rating_achieved':
        // Would calculate average rating
        return true;
      
      default:
        return false;
    }
  }

  private getCertificateDesign(template: string, badge: SocialBadge): AchievementCertificate['design'] {
    const designs = {
      classic: {
        backgroundColor: '#f8f4e6',
        borderStyle: 'solid 3px #8b4513',
        fontFamily: 'serif',
        accentColor: '#d4af37'
      },
      modern: {
        backgroundColor: '#1a1a1a',
        borderStyle: 'solid 2px #00d4ff',
        fontFamily: 'sans-serif',
        accentColor: badge.design.backgroundColor
      },
      gaming: {
        backgroundColor: '#0d1421',
        borderStyle: 'solid 3px #ff6b35',
        fontFamily: 'monospace',
        accentColor: '#00ff41'
      },
      elegant: {
        backgroundColor: '#ffffff',
        borderStyle: 'solid 1px #c0c0c0',
        fontFamily: 'serif',
        accentColor: '#800080'
      },
      fun: {
        backgroundColor: '#ff69b4',
        borderStyle: 'dashed 3px #ffff00',
        fontFamily: 'comic-sans',
        accentColor: '#00ff00'
      }
    };

    return designs[template as keyof typeof designs] || designs.modern;
  }

  private generateShareText(userBadge: UserBadge): string {
    const templates = {
      achievement: `🏆 Just earned the "${userBadge.badge.name}" badge in GameVibe! ${userBadge.badge.description}`,
      milestone: `🎯 Milestone achieved! Unlocked "${userBadge.badge.name}" badge for ${userBadge.badge.description}`,
      special: `✨ Special achievement unlocked! "${userBadge.badge.name}" - ${userBadge.badge.description}`,
      event: `🎉 Event badge earned! "${userBadge.badge.name}" from the latest GameVibe event!`,
      community: `👥 Community recognition! Earned "${userBadge.badge.name}" badge for ${userBadge.badge.description}`,
      creator: `🎮 Creator achievement! "${userBadge.badge.name}" badge for ${userBadge.badge.description}`
    };

    return templates[userBadge.badge.category] || templates.achievement;
  }

  private generateShareContent(userBadge: UserBadge, platform: string): { url: string; text: string } {
    const baseUrl = 'https://gamevibe.ai/badges';
    const shareUrl = `${baseUrl}/${userBadge.id}`;
    const shareText = this.generateShareText(userBadge);

    switch (platform) {
      case 'twitter':
        return {
          url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
          text: shareText
        };
      
      case 'discord':
        return {
          url: shareUrl,
          text: shareText
        };
      
      case 'facebook':
        return {
          url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          text: shareText
        };
      
      default:
        return { url: shareUrl, text: shareText };
    }
  }

  private async storeUserBadge(userBadge: UserBadge): Promise<void> {
    // Store in database and cache
    const cacheKey = `${this.cacheKeyPrefix}user_badge:${userBadge.id}`;
    await this.cache.set(cacheKey, userBadge, this.cacheTTL);
  }

  private async updateBadge(badge: SocialBadge): Promise<void> {
    badge.updatedAt = new Date();
    const cacheKey = `${this.cacheKeyPrefix}badge:${badge.id}`;
    await this.cache.set(cacheKey, badge, this.cacheTTL);
  }

  private async storeBadgeCollection(collection: BadgeCollection): Promise<void> {
    const cacheKey = `${this.cacheKeyPrefix}collection:${collection.userId}`;
    await this.cache.set(cacheKey, collection, this.cacheTTL);
  }

  private async storeCertificate(certificate: AchievementCertificate): Promise<void> {
    const cacheKey = `${this.cacheKeyPrefix}certificate:${certificate.id}`;
    await this.cache.set(cacheKey, certificate, this.cacheTTL);
  }

  private async getAvailableBadgesFromDatabase(category?: string, rarity?: string): Promise<SocialBadge[]> {
    let badges = this.getSampleBadges();

    if (category) {
      badges = badges.filter(b => b.category === category);
    }

    if (rarity) {
      badges = badges.filter(b => b.rarity === rarity);
    }

    return badges;
  }

  private async getBadgeFromDatabase(badgeId: string): Promise<SocialBadge | null> {
    return this.getSampleBadges().find(b => b.id === badgeId) || null;
  }

  private getSampleBadges(): SocialBadge[] {
    const now = new Date();
    
    return [
      {
        id: 'badge_first_game',
        name: 'First Creation',
        description: 'Created your first game in GameVibe',
        category: 'milestone',
        rarity: 'common',
        design: {
          iconUrl: 'https://example.com/badges/first-game.png',
          backgroundColor: '#4ade80',
          borderColor: '#22c55e',
          textColor: '#ffffff',
          shape: 'circle',
          effects: ['glow'],
          size: 'medium'
        },
        requirements: {
          type: 'games_created',
          criteria: { count: 1 },
          description: 'Create your first game'
        },
        rewards: {
          credits: 100,
          title: 'Game Creator',
          unlocks: ['creator_showcase']
        },
        stats: {
          totalAwarded: 1250,
          recentAwards: 45,
          firstAwarded: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
          lastAwarded: now
        },
        social: {
          shareable: true,
          shareTemplate: '🎮 Just created my first game in GameVibe! #GameVibe #FirstGame',
          socialMedia: ['twitter', 'discord', 'facebook']
        },
        metadata: {
          isLimited: false
        },
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        updatedAt: now
      },
      {
        id: 'badge_viral_creator',
        name: 'Viral Creator',
        description: 'Created a game that went viral with 10,000+ plays',
        category: 'achievement',
        rarity: 'epic',
        design: {
          iconUrl: 'https://example.com/badges/viral-creator.png',
          backgroundColor: '#8b5cf6',
          borderColor: '#7c3aed',
          textColor: '#ffffff',
          shape: 'star',
          effects: ['glow', 'sparkle'],
          size: 'large'
        },
        requirements: {
          type: 'plays_received',
          criteria: { count: 10000 },
          description: 'Achieve 10,000+ plays on a single game'
        },
        rewards: {
          credits: 1000,
          title: 'Viral Creator',
          unlocks: ['viral_analytics', 'premium_templates']
        },
        stats: {
          totalAwarded: 23,
          recentAwards: 2,
          firstAwarded: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000),
          lastAwarded: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
        },
        social: {
          shareable: true,
          shareTemplate: '🚀 Just earned the Viral Creator badge! My game hit 10K+ plays! #GameVibe #ViralCreator',
          socialMedia: ['twitter', 'discord', 'facebook', 'instagram']
        },
        metadata: {
          isLimited: false
        },
        createdAt: new Date(now.getTime() - 300 * 24 * 60 * 60 * 1000),
        updatedAt: now
      }
    ];
  }

  private getSampleUserBadges(userId: string): UserBadge[] {
    const badges = this.getSampleBadges();
    const now = new Date();
    
    return [
      {
        id: 'ub_001',
        userId,
        badgeId: 'badge_first_game',
        badge: badges[0],
        awardedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        awardedBy: 'system',
        awardReason: 'Created first game',
        displayOrder: 1,
        isVisible: true,
        isFavorite: true,
        shareCount: 2,
        certificateGenerated: false
      }
    ];
  }

  private getSampleQuests(): BadgeQuest[] {
    const now = new Date();
    
    return [
      {
        id: 'quest_creator_journey',
        name: 'Creator Journey',
        description: 'Complete the full creator experience',
        category: 'creator',
        difficulty: 'medium',
        steps: [
          {
            id: 'step1',
            description: 'Create your first game',
            requirement: { type: 'games_created', count: 1 },
            reward: { credits: 50 },
            isCompleted: false
          },
          {
            id: 'step2',
            description: 'Get 100 plays on a game',
            requirement: { type: 'plays_received', count: 100 },
            reward: { credits: 100 },
            isCompleted: false
          },
          {
            id: 'step3',
            description: 'Create 5 different games',
            requirement: { type: 'games_created', count: 5 },
            reward: { credits: 200, badge: 'badge_prolific_creator' },
            isCompleted: false
          }
        ],
        finalReward: {
          badgeId: 'badge_creator_master',
          credits: 500,
          title: 'Creator Master',
          certificate: true
        },
        participants: 156,
        completions: 23,
        isActive: true
      }
    ];
  }
}