import { injectable, inject } from 'inversify';
import { DatabaseService } from './database.js';
import { AnalyticsService } from './analytics.js';
import { CacheService } from './cache.js';
import { PersonalCreditService } from './personal-credits.js';
import { AchievementService } from './achievement.js';
import { LiveActivityService } from './live-activity.js';
import { CreatorAnalyticsService } from './creator-analytics.js';
import { TYPES } from '../types.js';

export interface CreatorSpotlight {
  id: string;
  creatorId: string;
  creatorName: string;
  period: 'weekly' | 'monthly' | 'seasonal' | 'annual';
  category: 'top_creator' | 'rising_star' | 'innovative_game' | 'community_favorite' | 'prolific_creator';
  startDate: Date;
  endDate: Date;
  status: 'active' | 'featured' | 'archived';
  achievements: {
    gamesCreated: number;
    totalPlays: number;
    averageRating: number;
    viralityScore: number;
    communityEngagement: number;
    uniquePlayers: number;
  };
  featuredGames: {
    gameId: string;
    gameName: string;
    playCount: number;
    rating: number;
    highlights: string[];
  }[];
  rewards: {
    credits: number;
    badge: string;
    title: string;
    exclusiveContent?: string[];
    bonusMultiplier: number;
  };
  spotlight: {
    description: string;
    quote?: string;
    bannerImage?: string;
    creatorStory: string;
    highlights: string[];
    socialMedia?: {
      twitter?: string;
      youtube?: string;
      twitch?: string;
    };
  };
  metrics: {
    views: number;
    likes: number;
    shares: number;
    profileVisits: number;
    gameClicks: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatorNomination {
  id: string;
  creatorId: string;
  creatorName: string;
  nominatedBy: string;
  nominatedByName: string;
  category: string;
  reason: string;
  supportingData: {
    gameIds: string[];
    metrics: Record<string, number>;
    testimonials: string[];
  };
  votes: {
    community: number;
    staff: number;
    total: number;
  };
  status: 'pending' | 'approved' | 'featured' | 'rejected';
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export interface SpotlightProgram {
  id: string;
  name: string;
  description: string;
  type: 'contest' | 'recognition' | 'monthly_feature' | 'community_choice';
  duration: string;
  eligibility: {
    minGames: number;
    minPlays: number;
    accountAge: number;
    regions?: string[];
  };
  rewards: {
    winner: { credits: number; badge: string; title: string };
    runner_up: { credits: number; badge: string; title: string };
    participants: { credits: number; badge?: string };
  };
  timeline: {
    nominationStart: Date;
    nominationEnd: Date;
    votingStart: Date;
    votingEnd: Date;
    announcementDate: Date;
  };
  rules: string[];
  judges?: string[];
  sponsors?: string[];
  isActive: boolean;
  createdAt: Date;
}

@injectable()
export class CreatorSpotlightService {
  private readonly cacheKeyPrefix = 'creator_spotlights:';
  private readonly cacheTTL = 15 * 60; // 15 minutes

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.PersonalCreditService) private personalCreditService: PersonalCreditService,
    @inject(TYPES.AchievementService) private achievementService: AchievementService,
    @inject(TYPES.LiveActivityService) private liveActivityService: LiveActivityService,
    @inject(TYPES.CreatorAnalyticsService) private creatorAnalyticsService: CreatorAnalyticsService
  ) {}

  /**
   * Get current featured creators
   */
  async getFeaturedCreators(category?: string, limit: number = 10): Promise<CreatorSpotlight[]> {
    const cacheKey = `${this.cacheKeyPrefix}featured:${category || 'all'}:${limit}`;
    let spotlights = await this.cache.get<CreatorSpotlight[]>(cacheKey);

    if (!spotlights) {
      spotlights = await this.getFeaturedCreatorsFromDatabase(category, limit);
      await this.cache.set(cacheKey, spotlights, this.cacheTTL);
    }

    return spotlights;
  }

  /**
   * Get spotlight by ID
   */
  async getSpotlight(spotlightId: string): Promise<CreatorSpotlight | null> {
    const cacheKey = `${this.cacheKeyPrefix}spotlight:${spotlightId}`;
    let spotlight = await this.cache.get<CreatorSpotlight>(cacheKey);

    if (!spotlight) {
      spotlight = await this.getSpotlightFromDatabase(spotlightId);
      if (spotlight) {
        await this.cache.set(cacheKey, spotlight, this.cacheTTL);
      }
    }

    return spotlight;
  }

  /**
   * Nominate a creator for spotlight
   */
  async nominateCreator(
    creatorId: string,
    nominatedBy: string,
    category: string,
    reason: string,
    gameIds: string[] = []
  ): Promise<{ success: boolean; nomination?: CreatorNomination; message: string }> {
    // Verify creator exists and has eligible content
    const creator = await this.db.prisma.user.findUnique({
      where: { discordId: creatorId },
      include: {
        games: {
          where: { isPublic: true },
          include: { _count: { select: { plays: true } } }
        }
      }
    });

    if (!creator) {
      return { success: false, message: 'Creator not found' };
    }

    if (creator.games.length === 0) {
      return { success: false, message: 'Creator must have at least one public game' };
    }

    // Check if already nominated this period
    const existingNomination = await this.getActiveNomination(creatorId, category);
    if (existingNomination) {
      return { success: false, message: 'Creator already nominated in this category this period' };
    }

    // Get creator metrics
    const metrics = await this.creatorAnalyticsService.getCreatorMetrics(creatorId);
    
    // Create nomination
    const nomination: CreatorNomination = {
      id: `nom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      creatorId,
      creatorName: creator.username || creator.discordId,
      nominatedBy,
      nominatedByName: nominatedBy, // Would get from user lookup
      category,
      reason,
      supportingData: {
        gameIds: gameIds.length > 0 ? gameIds : creator.games.slice(0, 3).map(g => g.id),
        metrics: {
          totalGames: creator.games.length,
          totalPlays: creator.games.reduce((sum, g) => sum + g._count.plays, 0),
          averageRating: metrics?.averageRating || 0,
          viralityScore: metrics?.viralityScore || 0
        },
        testimonials: []
      },
      votes: { community: 0, staff: 0, total: 0 },
      status: 'pending',
      submittedAt: new Date()
    };

    await this.storeNomination(nomination);

    // Record activity
    await this.liveActivityService.recordActivity(
      'CREATOR_NOMINATED',
      nominatedBy,
      {
        creatorId,
        creatorName: creator.username,
        category,
        reason: reason.slice(0, 100)
      }
    );

    return { success: true, nomination, message: 'Creator nominated successfully' };
  }

  /**
   * Vote on a creator nomination
   */
  async voteOnNomination(
    nominationId: string,
    voterId: string,
    voteType: 'community' | 'staff'
  ): Promise<{ success: boolean; message: string }> {
    const nomination = await this.getNomination(nominationId);
    
    if (!nomination) {
      return { success: false, message: 'Nomination not found' };
    }

    if (nomination.status !== 'pending') {
      return { success: false, message: 'Voting is closed for this nomination' };
    }

    // Check if user already voted
    const hasVoted = await this.hasUserVoted(nominationId, voterId);
    if (hasVoted) {
      return { success: false, message: 'You have already voted on this nomination' };
    }

    // Record vote
    await this.recordVote(nominationId, voterId, voteType);
    
    // Update vote counts
    nomination.votes[voteType]++;
    nomination.votes.total++;
    await this.storeNomination(nomination);

    return { success: true, message: 'Vote recorded successfully' };
  }

  /**
   * Create a creator spotlight
   */
  async createSpotlight(
    creatorId: string,
    category: string,
    period: 'weekly' | 'monthly' | 'seasonal' | 'annual',
    customData?: Partial<CreatorSpotlight>
  ): Promise<CreatorSpotlight> {
    const creator = await this.db.prisma.user.findUnique({
      where: { discordId: creatorId },
      include: {
        games: {
          where: { isPublic: true },
          include: { _count: { select: { plays: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!creator) {
      throw new Error('Creator not found');
    }

    // Calculate achievements
    const metrics = await this.creatorAnalyticsService.getCreatorMetrics(creatorId);
    const achievements = {
      gamesCreated: creator.games.length,
      totalPlays: creator.games.reduce((sum, g) => sum + g._count.plays, 0),
      averageRating: metrics?.averageRating || 0,
      viralityScore: metrics?.viralityScore || 0,
      communityEngagement: metrics?.communityEngagement || 0,
      uniquePlayers: metrics?.uniquePlayers || 0
    };

    // Determine period dates
    const now = new Date();
    let startDate: Date, endDate: Date;
    
    switch (period) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'seasonal':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        break;
      case 'annual':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
    }

    // Calculate rewards based on category and achievements
    const rewards = this.calculateSpotlightRewards(category, achievements);

    const spotlight: CreatorSpotlight = {
      id: `spotlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      creatorId,
      creatorName: creator.username || creator.discordId,
      period,
      category: category as any,
      startDate,
      endDate,
      status: 'featured',
      achievements,
      featuredGames: creator.games.slice(0, 3).map(game => ({
        gameId: game.id,
        gameName: game.name,
        playCount: game._count.plays,
        rating: 0, // Would calculate from ratings
        highlights: this.generateGameHighlights(game)
      })),
      rewards,
      spotlight: {
        description: this.generateSpotlightDescription(creator, achievements, category),
        creatorStory: this.generateCreatorStory(creator, achievements),
        highlights: this.generateCreatorHighlights(achievements, category),
        ...customData?.spotlight
      },
      metrics: {
        views: 0,
        likes: 0,
        shares: 0,
        profileVisits: 0,
        gameClicks: 0
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...customData
    };

    await this.storeSpotlight(spotlight);

    // Award spotlight rewards
    await this.awardSpotlightRewards(spotlight);

    // Record activity
    await this.liveActivityService.recordActivity(
      'CREATOR_SPOTLIGHTED',
      'system',
      {
        creatorId,
        creatorName: creator.username,
        category,
        period,
        credits: rewards.credits
      }
    );

    // Clear cache
    await this.clearSpotlightCaches();

    return spotlight;
  }

  /**
   * Get top creators for potential spotlights
   */
  async getTopCreatorCandidates(
    category: string,
    period: 'week' | 'month' | 'season' = 'month',
    limit: number = 20
  ): Promise<any[]> {
    const timeframe = this.getPeriodTimeframe(period);
    
    // Get creators with games created in the timeframe
    const candidates = await this.db.prisma.user.findMany({
      where: {
        games: {
          some: {
            createdAt: { gte: timeframe.start },
            isPublic: true
          }
        }
      },
      include: {
        games: {
          where: {
            createdAt: { gte: timeframe.start },
            isPublic: true
          },
          include: {
            _count: { select: { plays: true } }
          }
        }
      },
      take: limit * 2 // Get more to filter and rank
    });

    // Calculate scores for each candidate
    const scoredCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        const metrics = await this.creatorAnalyticsService.getCreatorMetrics(candidate.discordId);
        const score = this.calculateCandidateScore(candidate, metrics, category);
        
        return {
          creatorId: candidate.discordId,
          creatorName: candidate.username,
          score,
          gamesCount: candidate.games.length,
          totalPlays: candidate.games.reduce((sum, g) => sum + g._count.plays, 0),
          metrics
        };
      })
    );

    // Sort by score and return top candidates
    return scoredCandidates
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get active spotlight programs
   */
  async getActivePrograms(): Promise<SpotlightProgram[]> {
    return this.getSamplePrograms().filter(p => p.isActive);
  }

  /**
   * Track spotlight interaction
   */
  async trackSpotlightInteraction(
    spotlightId: string,
    interactionType: 'view' | 'like' | 'share' | 'profile_visit' | 'game_click',
    userId: string
  ): Promise<void> {
    const spotlight = await this.getSpotlight(spotlightId);
    
    if (!spotlight) {
      return;
    }

    // Update metrics
    spotlight.metrics[this.getMetricKey(interactionType)]++;
    spotlight.updatedAt = new Date();
    
    await this.storeSpotlight(spotlight);

    // Record activity for analytics
    await this.liveActivityService.recordActivity(
      'SPOTLIGHT_INTERACTION',
      userId,
      {
        spotlightId,
        creatorId: spotlight.creatorId,
        interactionType
      }
    );

    // Clear cache to ensure fresh data
    await this.cache.delete(`${this.cacheKeyPrefix}spotlight:${spotlightId}`);
  }

  // Private helper methods
  private async getFeaturedCreatorsFromDatabase(category?: string, limit: number = 10): Promise<CreatorSpotlight[]> {
    // In a real implementation, this would query the database
    return this.getSampleSpotlights()
      .filter(s => s.status === 'featured' && (!category || s.category === category))
      .slice(0, limit);
  }

  private async getSpotlightFromDatabase(spotlightId: string): Promise<CreatorSpotlight | null> {
    return this.getSampleSpotlights().find(s => s.id === spotlightId) || null;
  }

  private async getActiveNomination(creatorId: string, category: string): Promise<CreatorNomination | null> {
    // Check for existing nominations in the current period
    return null; // Would implement database check
  }

  private async storeNomination(nomination: CreatorNomination): Promise<void> {
    // Store nomination in database
    const cacheKey = `${this.cacheKeyPrefix}nomination:${nomination.id}`;
    await this.cache.set(cacheKey, nomination, 24 * 60 * 60); // 24 hours
  }

  private async getNomination(nominationId: string): Promise<CreatorNomination | null> {
    const cacheKey = `${this.cacheKeyPrefix}nomination:${nominationId}`;
    return await this.cache.get<CreatorNomination>(cacheKey);
  }

  private async hasUserVoted(nominationId: string, voterId: string): Promise<boolean> {
    // Check if user has already voted on this nomination
    return false; // Would implement database check
  }

  private async recordVote(nominationId: string, voterId: string, voteType: string): Promise<void> {
    // Record vote in database
    const voteKey = `${this.cacheKeyPrefix}vote:${nominationId}:${voterId}`;
    await this.cache.set(voteKey, { voterId, voteType, timestamp: new Date() }, 30 * 24 * 60 * 60);
  }

  private async storeSpotlight(spotlight: CreatorSpotlight): Promise<void> {
    // Store spotlight in database
    const cacheKey = `${this.cacheKeyPrefix}spotlight:${spotlight.id}`;
    await this.cache.set(cacheKey, spotlight, this.cacheTTL);
  }

  private async awardSpotlightRewards(spotlight: CreatorSpotlight): Promise<void> {
    // Award credits
    await this.personalCreditService.earnCredits(
      spotlight.creatorId,
      spotlight.rewards.credits,
      'CREATOR_SPOTLIGHT' as any,
      {
        spotlightId: spotlight.id,
        category: spotlight.category,
        period: spotlight.period
      }
    );

    // Award achievement badge
    if (spotlight.rewards.badge) {
      await this.achievementService.awardAchievement(
        spotlight.creatorId,
        spotlight.rewards.badge,
        {
          spotlightId: spotlight.id,
          category: spotlight.category
        }
      );
    }
  }

  private calculateSpotlightRewards(category: string, achievements: any): CreatorSpotlight['rewards'] {
    const baseCredits = 500;
    let multiplier = 1;

    // Category bonuses
    switch (category) {
      case 'top_creator':
        multiplier = 2;
        break;
      case 'rising_star':
        multiplier = 1.5;
        break;
      case 'innovative_game':
        multiplier = 1.8;
        break;
      case 'community_favorite':
        multiplier = 1.6;
        break;
      case 'prolific_creator':
        multiplier = 1.3;
        break;
    }

    // Achievement bonuses
    if (achievements.totalPlays > 10000) multiplier += 0.5;
    if (achievements.averageRating > 4.5) multiplier += 0.3;
    if (achievements.gamesCreated > 10) multiplier += 0.2;

    return {
      credits: Math.floor(baseCredits * multiplier),
      badge: `spotlight_${category}`,
      title: this.getCategoryTitle(category),
      bonusMultiplier: 1.2,
      exclusiveContent: ['featured_banner', 'custom_emoji']
    };
  }

  private generateSpotlightDescription(creator: any, achievements: any, category: string): string {
    const descriptions = {
      top_creator: `Exceptional creator with ${achievements.gamesCreated} games and ${achievements.totalPlays.toLocaleString()} total plays`,
      rising_star: `Emerging talent showing incredible growth and creativity`,
      innovative_game: `Revolutionary game design pushing the boundaries of what's possible`,
      community_favorite: `Beloved by the community with outstanding engagement`,
      prolific_creator: `Consistently delivering quality content with impressive output`
    };

    return descriptions[category as keyof typeof descriptions] || 'Outstanding contributor to the GameVibe community';
  }

  private generateCreatorStory(creator: any, achievements: any): string {
    return `${creator.username || creator.discordId} has been creating amazing games on GameVibe, ` +
           `building a collection of ${achievements.gamesCreated} unique experiences that have ` +
           `captivated ${achievements.totalPlays.toLocaleString()} players. Their dedication to ` +
           `quality and innovation makes them a standout creator in our community.`;
  }

  private generateCreatorHighlights(achievements: any, category: string): string[] {
    const highlights = [
      `${achievements.gamesCreated} games created`,
      `${achievements.totalPlays.toLocaleString()} total plays`,
      `${achievements.uniquePlayers.toLocaleString()} unique players reached`
    ];

    if (achievements.averageRating > 4) {
      highlights.push(`${achievements.averageRating.toFixed(1)}⭐ average rating`);
    }

    if (achievements.viralityScore > 50) {
      highlights.push('High viral engagement');
    }

    return highlights;
  }

  private generateGameHighlights(game: any): string[] {
    const highlights = [`${game._count.plays} plays`];
    
    if (game.type) {
      highlights.push(`${game.type} genre`);
    }
    
    if (game.createdAt) {
      const daysAgo = Math.floor((Date.now() - new Date(game.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      highlights.push(`Created ${daysAgo} days ago`);
    }

    return highlights;
  }

  private calculateCandidateScore(candidate: any, metrics: any, category: string): number {
    let score = 0;

    // Base scores from metrics
    score += (metrics?.averageRating || 0) * 20;
    score += Math.min(candidate.games.length, 10) * 10;
    score += Math.min(candidate.games.reduce((sum: number, g: any) => sum + g._count.plays, 0) / 100, 50);
    score += (metrics?.viralityScore || 0) * 0.5;

    // Category-specific bonuses
    switch (category) {
      case 'rising_star':
        // Favor newer creators with recent growth
        const recentGames = candidate.games.filter((g: any) => 
          new Date(g.createdAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
        );
        score += recentGames.length * 15;
        break;
      
      case 'prolific_creator':
        // Favor creators with many games
        score += candidate.games.length * 5;
        break;
      
      case 'community_favorite':
        // Favor high engagement
        score += (metrics?.communityEngagement || 0) * 0.3;
        break;
    }

    return score;
  }

  private getPeriodTimeframe(period: string): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;

    switch (period) {
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'season':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end: now };
  }

  private getMetricKey(interactionType: string): keyof CreatorSpotlight['metrics'] {
    switch (interactionType) {
      case 'view': return 'views';
      case 'like': return 'likes';
      case 'share': return 'shares';
      case 'profile_visit': return 'profileVisits';
      case 'game_click': return 'gameClicks';
      default: return 'views';
    }
  }

  private getCategoryTitle(category: string): string {
    const titles = {
      top_creator: 'Top Creator',
      rising_star: 'Rising Star',
      innovative_game: 'Game Innovator',
      community_favorite: 'Community Champion',
      prolific_creator: 'Prolific Creator'
    };

    return titles[category as keyof typeof titles] || 'Featured Creator';
  }

  private async clearSpotlightCaches(): Promise<void> {
    const patterns = [
      `${this.cacheKeyPrefix}featured:*`,
      `${this.cacheKeyPrefix}candidates:*`
    ];

    for (const pattern of patterns) {
      await this.cache.delete(pattern);
    }
  }

  private getSampleSpotlights(): CreatorSpotlight[] {
    const now = new Date();
    
    return [
      {
        id: 'spotlight_creator_001',
        creatorId: 'user123',
        creatorName: 'GameMaster',
        period: 'monthly',
        category: 'top_creator',
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        status: 'featured',
        achievements: {
          gamesCreated: 15,
          totalPlays: 25000,
          averageRating: 4.7,
          viralityScore: 85,
          communityEngagement: 92,
          uniquePlayers: 12000
        },
        featuredGames: [
          {
            gameId: 'game001',
            gameName: 'Epic Adventure',
            playCount: 8500,
            rating: 4.8,
            highlights: ['Most played this month', 'High viral score']
          }
        ],
        rewards: {
          credits: 1000,
          badge: 'spotlight_top_creator',
          title: 'Top Creator',
          bonusMultiplier: 1.2,
          exclusiveContent: ['featured_banner']
        },
        spotlight: {
          description: 'Outstanding creator with exceptional games and community engagement',
          quote: 'Creating games is my passion, and seeing players enjoy them is the best reward.',
          creatorStory: 'GameMaster has been consistently creating innovative games that push creative boundaries.',
          highlights: ['15 games created', '25,000 total plays', '4.7⭐ average rating']
        },
        metrics: {
          views: 1250,
          likes: 89,
          shares: 23,
          profileVisits: 456,
          gameClicks: 234
        },
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        updatedAt: now
      }
    ];
  }

  private getSamplePrograms(): SpotlightProgram[] {
    const now = new Date();
    
    return [
      {
        id: 'program_monthly_spotlight',
        name: 'Monthly Creator Spotlight',
        description: 'Recognizing the most outstanding creators each month',
        type: 'monthly_feature',
        duration: '1 month',
        eligibility: {
          minGames: 3,
          minPlays: 100,
          accountAge: 30
        },
        rewards: {
          winner: { credits: 1000, badge: 'monthly_spotlight_winner', title: 'Creator of the Month' },
          runner_up: { credits: 500, badge: 'monthly_spotlight_runner_up', title: 'Rising Creator' },
          participants: { credits: 100 }
        },
        timeline: {
          nominationStart: new Date(now.getFullYear(), now.getMonth(), 1),
          nominationEnd: new Date(now.getFullYear(), now.getMonth(), 15),
          votingStart: new Date(now.getFullYear(), now.getMonth(), 16),
          votingEnd: new Date(now.getFullYear(), now.getMonth(), 25),
          announcementDate: new Date(now.getFullYear(), now.getMonth(), 28)
        },
        rules: [
          'Creator must have at least 3 public games',
          'Games must be original creations',
          'No inappropriate content',
          'Must be active in the community'
        ],
        isActive: true,
        createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
      }
    ];
  }
}