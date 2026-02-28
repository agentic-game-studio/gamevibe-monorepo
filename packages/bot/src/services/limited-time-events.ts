import { injectable, inject } from 'inversify';
import { DatabaseService } from './database.js';
import { AnalyticsService } from './analytics.js';
import { CacheService } from './cache.js';
import { PersonalCreditService } from './personal-credits.js';
import { AchievementService } from './achievement.js';
import { LiveActivityService } from './live-activity.js';
import { TYPES } from '../types.js';

export interface LimitedTimeEvent {
  id: string;
  name: string;
  description: string;
  type: 'game_jam' | 'template_release' | 'challenge' | 'competition' | 'seasonal';
  status: 'upcoming' | 'active' | 'ended' | 'cancelled';
  startDate: Date;
  endDate: Date;
  registrationDeadline?: Date;
  maxParticipants?: number;
  requirements: {
    gameType?: string[];
    minGames?: number;
    creatorTier?: string[];
    serverRequirement?: boolean;
  };
  rewards: {
    participation: {
      credits: number;
      badge?: string;
      title?: string;
    };
    placement: {
      first: { credits: number; badge: string; title: string };
      second: { credits: number; badge: string; title: string };
      third: { credits: number; badge: string; title: string };
      topTen?: { credits: number; badge?: string };
    };
    special?: {
      name: string;
      description: string;
      credits: number;
      badge?: string;
      criteria: string;
    }[];
  };
  exclusiveContent: {
    templates?: string[];
    assets?: string[];
    themes?: string[];
    mechanics?: string[];
  };
  rules: string[];
  judging: {
    criteria: string[];
    judges?: string[];
    votingType: 'community' | 'expert' | 'hybrid';
    votingStart?: Date;
    votingEnd?: Date;
  };
  metadata: {
    theme?: string;
    inspiration?: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'all';
    estimatedTimeCommitment: string;
    bannerImage?: string;
    sponsors?: string[];
  };
  stats: {
    participants: number;
    submissions: number;
    totalVotes: number;
    averageRating: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface EventParticipation {
  eventId: string;
  userId: string;
  userName: string;
  registeredAt: Date;
  submissions: EventSubmission[];
  status: 'registered' | 'submitted' | 'withdrawn' | 'disqualified';
  notifications: boolean;
}

export interface EventSubmission {
  id: string;
  eventId: string;
  userId: string;
  gameId: string;
  gameTitle: string;
  submittedAt: Date;
  isLateSubmission: boolean;
  description: string;
  tags: string[];
  votes: {
    community: number;
    expert: number;
    total: number;
  };
  ranking?: {
    overall: number;
    category: Record<string, number>;
  };
  awards: string[];
}

export interface EventTemplate {
  id: string;
  name: string;
  description: string;
  eventId: string;
  gameType: string;
  isExclusive: boolean;
  availableFrom: Date;
  availableUntil: Date;
  usageCount: number;
  maxUsage?: number;
  template: {
    mechanics: string[];
    assets: string[];
    themes: string[];
    baseCode: string;
    instructions: string;
  };
  requiredTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
}

export interface EventLeaderboard {
  eventId: string;
  type: 'submissions' | 'votes' | 'engagement' | 'creativity';
  entries: {
    rank: number;
    userId: string;
    userName: string;
    score: number;
    details: Record<string, any>;
    badges: string[];
  }[];
  lastUpdated: Date;
}

@injectable()
export class LimitedTimeEventService {
  private readonly cacheKeyPrefix = 'limited_events:';
  private readonly cacheTTL = 10 * 60; // 10 minutes

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.PersonalCreditService) private personalCreditService: PersonalCreditService,
    @inject(TYPES.AchievementService) private achievementService: AchievementService,
    @inject(TYPES.LiveActivityService) private liveActivityService: LiveActivityService
  ) {}

  /**
   * Get all active and upcoming events
   */
  async getActiveEvents(): Promise<LimitedTimeEvent[]> {
    const cacheKey = `${this.cacheKeyPrefix}active`;
    let events = await this.cache.get<LimitedTimeEvent[]>(cacheKey);

    if (!events) {
      events = await this.getEventsFromDatabase(['active', 'upcoming']);
      await this.cache.set(cacheKey, events, this.cacheTTL);
    }

    return events;
  }

  /**
   * Get event by ID with full details
   */
  async getEvent(eventId: string): Promise<LimitedTimeEvent | null> {
    const cacheKey = `${this.cacheKeyPrefix}event:${eventId}`;
    let event = await this.cache.get<LimitedTimeEvent>(cacheKey);

    if (!event) {
      event = await this.getEventFromDatabase(eventId);
      if (event) {
        await this.cache.set(cacheKey, event, this.cacheTTL);
      }
    }

    return event;
  }

  /**
   * Register user for an event
   */
  async registerForEvent(
    eventId: string,
    userId: string,
    userName: string
  ): Promise<{ success: boolean; message: string }> {
    const event = await this.getEvent(eventId);
    
    if (!event) {
      return { success: false, message: 'Event not found' };
    }

    if (event.status !== 'active' && event.status !== 'upcoming') {
      return { success: false, message: 'Event is not accepting registrations' };
    }

    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      return { success: false, message: 'Registration deadline has passed' };
    }

    if (event.maxParticipants) {
      const currentParticipants = await this.getParticipantCount(eventId);
      if (currentParticipants >= event.maxParticipants) {
        return { success: false, message: 'Event is full' };
      }
    }

    // Check requirements
    const meetsRequirements = await this.checkEventRequirements(userId, event.requirements);
    if (!meetsRequirements.eligible) {
      return { success: false, message: meetsRequirements.reason || 'Does not meet event requirements' };
    }

    // Check if already registered
    const existingParticipation = await this.getParticipation(eventId, userId);
    if (existingParticipation) {
      return { success: false, message: 'Already registered for this event' };
    }

    // Create participation record
    const participation: EventParticipation = {
      eventId,
      userId,
      userName,
      registeredAt: new Date(),
      submissions: [],
      status: 'registered',
      notifications: true
    };

    await this.storeParticipation(participation);

    // Award participation credits
    await this.personalCreditService.earnCredits(
      userId,
      event.rewards.participation.credits,
      'EVENT_PARTICIPATION' as any,
      { eventId, eventName: event.name }
    );

    // Record activity
    await this.liveActivityService.recordActivity(
      'EVENT_REGISTERED',
      userId,
      {
        eventName: event.name,
        eventType: event.type,
        endDate: event.endDate.toISOString()
      }
    );

    // Clear cache
    await this.cache.delete(`${this.cacheKeyPrefix}participants:${eventId}`);

    return { success: true, message: 'Successfully registered for event' };
  }

  /**
   * Submit a game to an event
   */
  async submitToEvent(
    eventId: string,
    userId: string,
    gameId: string,
    description: string,
    tags: string[] = []
  ): Promise<{ success: boolean; message: string }> {
    const event = await this.getEvent(eventId);
    
    if (!event) {
      return { success: false, message: 'Event not found' };
    }

    if (event.status !== 'active') {
      return { success: false, message: 'Event is not accepting submissions' };
    }

    if (new Date() > event.endDate) {
      return { success: false, message: 'Event submission deadline has passed' };
    }

    // Check if user is registered
    const participation = await this.getParticipation(eventId, userId);
    if (!participation) {
      return { success: false, message: 'Must register for event before submitting' };
    }

    // Get game details
    const game = await this.db.getGame(gameId);
    if (!game) {
      return { success: false, message: 'Game not found' };
    }

    if (game.creatorId !== userId) {
      return { success: false, message: 'Can only submit games you created' };
    }

    // Check if game meets event requirements
    if (event.requirements.gameType && !event.requirements.gameType.includes(game.type)) {
      return { success: false, message: `Game type must be one of: ${event.requirements.gameType.join(', ')}` };
    }

    // Check for existing submission
    const existingSubmission = participation.submissions.find(s => s.gameId === gameId);
    if (existingSubmission) {
      return { success: false, message: 'Game already submitted to this event' };
    }

    // Create submission
    const submission: EventSubmission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventId,
      userId,
      gameId,
      gameTitle: game.name,
      submittedAt: new Date(),
      isLateSubmission: new Date() > event.endDate,
      description,
      tags,
      votes: { community: 0, expert: 0, total: 0 },
      awards: []
    };

    // Update participation
    participation.submissions.push(submission);
    participation.status = 'submitted';
    await this.storeParticipation(participation);

    // Award submission bonus credits
    const bonusCredits = event.rewards.participation.credits * 0.5; // 50% bonus for submission
    await this.personalCreditService.earnCredits(
      userId,
      bonusCredits,
      'EVENT_SUBMISSION' as any,
      { eventId, gameId, eventName: event.name }
    );

    // Record activity
    await this.liveActivityService.recordActivity(
      'EVENT_SUBMISSION',
      userId,
      {
        eventName: event.name,
        gameTitle: game.name,
        eventType: event.type
      }
    );

    // Clear caches
    await this.cache.delete(`${this.cacheKeyPrefix}submissions:${eventId}`);
    await this.cache.delete(`${this.cacheKeyPrefix}leaderboard:${eventId}:*`);

    return { success: true, message: 'Game submitted successfully' };
  }

  /**
   * Get event participants
   */
  async getEventParticipants(
    eventId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<EventParticipation[]> {
    const cacheKey = `${this.cacheKeyPrefix}participants:${eventId}:${limit}:${offset}`;
    let participants = await this.cache.get<EventParticipation[]>(cacheKey);

    if (!participants) {
      participants = await this.getParticipantsFromDatabase(eventId, limit, offset);
      await this.cache.set(cacheKey, participants, this.cacheTTL);
    }

    return participants;
  }

  /**
   * Get event submissions
   */
  async getEventSubmissions(
    eventId: string,
    sortBy: 'recent' | 'votes' | 'random' = 'recent',
    limit: number = 20
  ): Promise<EventSubmission[]> {
    const cacheKey = `${this.cacheKeyPrefix}submissions:${eventId}:${sortBy}:${limit}`;
    let submissions = await this.cache.get<EventSubmission[]>(cacheKey);

    if (!submissions) {
      submissions = await this.getSubmissionsFromDatabase(eventId, sortBy, limit);
      await this.cache.set(cacheKey, submissions, this.cacheTTL);
    }

    return submissions;
  }

  /**
   * Get event leaderboard
   */
  async getEventLeaderboard(
    eventId: string,
    type: 'submissions' | 'votes' | 'engagement' | 'creativity' = 'submissions'
  ): Promise<EventLeaderboard> {
    const cacheKey = `${this.cacheKeyPrefix}leaderboard:${eventId}:${type}`;
    let leaderboard = await this.cache.get<EventLeaderboard>(cacheKey);

    if (!leaderboard) {
      leaderboard = await this.calculateEventLeaderboard(eventId, type);
      await this.cache.set(cacheKey, leaderboard, this.cacheTTL);
    }

    return leaderboard;
  }

  /**
   * Get exclusive event templates
   */
  async getEventTemplates(eventId: string): Promise<EventTemplate[]> {
    const cacheKey = `${this.cacheKeyPrefix}templates:${eventId}`;
    let templates = await this.cache.get<EventTemplate[]>(cacheKey);

    if (!templates) {
      templates = await this.getTemplatesFromDatabase(eventId);
      await this.cache.set(cacheKey, templates, this.cacheTTL);
    }

    return templates;
  }

  /**
   * Create a new limited-time event (admin only)
   */
  async createEvent(eventData: Partial<LimitedTimeEvent>): Promise<LimitedTimeEvent> {
    const event: LimitedTimeEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: eventData.name || 'Untitled Event',
      description: eventData.description || '',
      type: eventData.type || 'game_jam',
      status: 'upcoming',
      startDate: eventData.startDate || new Date(),
      endDate: eventData.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      registrationDeadline: eventData.registrationDeadline,
      maxParticipants: eventData.maxParticipants,
      requirements: eventData.requirements || {},
      rewards: eventData.rewards || {
        participation: { credits: 50 },
        placement: {
          first: { credits: 1000, badge: 'champion', title: 'Event Champion' },
          second: { credits: 500, badge: 'runner_up', title: 'Event Runner-up' },
          third: { credits: 250, badge: 'bronze', title: 'Event Finalist' }
        }
      },
      exclusiveContent: eventData.exclusiveContent || {},
      rules: eventData.rules || [],
      judging: eventData.judging || {
        criteria: ['Creativity', 'Gameplay', 'Theme Adherence'],
        votingType: 'community'
      },
      metadata: eventData.metadata || { difficulty: 'all', estimatedTimeCommitment: '2-4 hours' },
      stats: { participants: 0, submissions: 0, totalVotes: 0, averageRating: 0 },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.storeEvent(event);

    // Clear active events cache
    await this.cache.delete(`${this.cacheKeyPrefix}active`);

    return event;
  }

  /**
   * End an event and calculate final results
   */
  async endEvent(eventId: string): Promise<{ success: boolean; results: any }> {
    const event = await this.getEvent(eventId);
    
    if (!event || event.status !== 'active') {
      return { success: false, results: null };
    }

    // Calculate final rankings
    const leaderboard = await this.getEventLeaderboard(eventId, 'submissions');
    
    // Award placement prizes
    const results = await this.awardEventPrizes(event, leaderboard);

    // Update event status
    event.status = 'ended';
    event.updatedAt = new Date();
    await this.storeEvent(event);

    // Record activity
    await this.liveActivityService.recordActivity(
      'EVENT_ENDED',
      'system',
      {
        eventName: event.name,
        participants: event.stats.participants,
        submissions: event.stats.submissions,
        winner: results.winner?.userName
      }
    );

    // Clear all caches for this event
    await this.clearEventCaches(eventId);

    return { success: true, results };
  }

  // Private helper methods
  private async getEventsFromDatabase(statuses: string[]): Promise<LimitedTimeEvent[]> {
    // In a real implementation, this would query the database
    // For now, return sample events
    return this.getSampleEvents().filter(e => statuses.includes(e.status));
  }

  private async getEventFromDatabase(eventId: string): Promise<LimitedTimeEvent | null> {
    // In a real implementation, this would query the database
    const events = this.getSampleEvents();
    return events.find(e => e.id === eventId) || null;
  }

  private async getParticipation(eventId: string, userId: string): Promise<EventParticipation | null> {
    // In a real implementation, this would query the database
    const cacheKey = `${this.cacheKeyPrefix}participation:${eventId}:${userId}`;
    return await this.cache.get<EventParticipation>(cacheKey);
  }

  private async storeParticipation(participation: EventParticipation): Promise<void> {
    // In a real implementation, this would store in the database
    const cacheKey = `${this.cacheKeyPrefix}participation:${participation.eventId}:${participation.userId}`;
    await this.cache.set(cacheKey, participation, 24 * 60 * 60); // 24 hours
  }

  private async getParticipantCount(eventId: string): Promise<number> {
    // In a real implementation, this would count from database
    return 0;
  }

  private async checkEventRequirements(
    userId: string,
    requirements: any
  ): Promise<{ eligible: boolean; reason?: string }> {
    // Check minimum games requirement
    if (requirements.minGames) {
      const userGames = await this.db.prisma.game.count({
        where: { creatorId: userId }
      });
      
      if (userGames < requirements.minGames) {
        return {
          eligible: false,
          reason: `Must have created at least ${requirements.minGames} games`
        };
      }
    }

    // Check creator tier requirement
    if (requirements.creatorTier) {
      // Would check user's creator tier
    }

    return { eligible: true };
  }

  private async getParticipantsFromDatabase(
    eventId: string,
    limit: number,
    offset: number
  ): Promise<EventParticipation[]> {
    // In a real implementation, this would query the database
    return [];
  }

  private async getSubmissionsFromDatabase(
    eventId: string,
    sortBy: string,
    limit: number
  ): Promise<EventSubmission[]> {
    // In a real implementation, this would query the database
    return [];
  }

  private async calculateEventLeaderboard(eventId: string, type: string): Promise<EventLeaderboard> {
    // In a real implementation, this would calculate from submissions and votes
    return {
      eventId,
      type: type as any,
      entries: [],
      lastUpdated: new Date()
    };
  }

  private async getTemplatesFromDatabase(eventId: string): Promise<EventTemplate[]> {
    // In a real implementation, this would query the database
    return [];
  }

  private async storeEvent(event: LimitedTimeEvent): Promise<void> {
    // In a real implementation, this would store in the database
    const cacheKey = `${this.cacheKeyPrefix}event:${event.id}`;
    await this.cache.set(cacheKey, event, this.cacheTTL);
  }

  private async awardEventPrizes(event: LimitedTimeEvent, leaderboard: EventLeaderboard): Promise<any> {
    const results: any = { awards: [] };

    // Award top 3 finishers
    for (let i = 0; i < Math.min(3, leaderboard.entries.length); i++) {
      const entry = leaderboard.entries[i];
      let reward;
      
      switch (i) {
        case 0:
          reward = event.rewards.placement.first;
          results.winner = entry;
          break;
        case 1:
          reward = event.rewards.placement.second;
          break;
        case 2:
          reward = event.rewards.placement.third;
          break;
      }

      if (reward) {
        await this.personalCreditService.earnCredits(
          entry.userId,
          reward.credits,
          'EVENT_PRIZE' as any,
          { eventId: event.id, placement: i + 1 }
        );

        results.awards.push({
          userId: entry.userId,
          userName: entry.userName,
          placement: i + 1,
          credits: reward.credits,
          badge: reward.badge,
          title: reward.title
        });
      }
    }

    return results;
  }

  private async clearEventCaches(eventId: string): Promise<void> {
    const patterns = [
      `${this.cacheKeyPrefix}event:${eventId}`,
      `${this.cacheKeyPrefix}participants:${eventId}:*`,
      `${this.cacheKeyPrefix}submissions:${eventId}:*`,
      `${this.cacheKeyPrefix}leaderboard:${eventId}:*`,
      `${this.cacheKeyPrefix}templates:${eventId}`,
      `${this.cacheKeyPrefix}active`
    ];

    for (const pattern of patterns) {
      await this.cache.delete(pattern);
    }
  }

  private getSampleEvents(): LimitedTimeEvent[] {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return [
      {
        id: 'evt_winter_jam_2024',
        name: 'Winter Game Jam 2024',
        description: 'Create games with a winter/holiday theme! Focus on cozy gameplay, winter sports, or holiday celebrations.',
        type: 'game_jam',
        status: 'active',
        startDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        endDate: futureDate,
        registrationDeadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        maxParticipants: 500,
        requirements: {
          gameType: ['puzzle', 'platformer', 'adventure'],
          minGames: 1
        },
        rewards: {
          participation: { credits: 100, badge: 'winter_participant' },
          placement: {
            first: { credits: 2000, badge: 'winter_champion', title: 'Winter Game Jam Champion' },
            second: { credits: 1000, badge: 'winter_runner_up', title: 'Winter Game Jam Runner-up' },
            third: { credits: 500, badge: 'winter_finalist', title: 'Winter Game Jam Finalist' }
          },
          special: [
            {
              name: 'Most Creative Theme',
              description: 'Most creative interpretation of winter theme',
              credits: 300,
              badge: 'creative_winter',
              criteria: 'Judged by community vote on creativity'
            }
          ]
        },
        exclusiveContent: {
          templates: ['winter_wonderland', 'holiday_helper', 'ice_adventure'],
          themes: ['Snow Kingdom', 'Cozy Cabin', 'Winter Festival'],
          mechanics: ['ice_sliding', 'snow_building', 'gift_delivery']
        },
        rules: [
          'Game must incorporate winter or holiday themes',
          'Must be family-friendly content',
          'Original creations only (no remixes)',
          'Maximum 1 submission per participant'
        ],
        judging: {
          criteria: ['Theme Adherence', 'Creativity', 'Gameplay Fun', 'Visual Appeal'],
          votingType: 'hybrid',
          votingStart: new Date(futureDate.getTime() + 24 * 60 * 60 * 1000),
          votingEnd: new Date(futureDate.getTime() + 3 * 24 * 60 * 60 * 1000)
        },
        metadata: {
          theme: 'Winter/Holiday',
          inspiration: 'Create games that capture the magic of winter and holidays',
          difficulty: 'all',
          estimatedTimeCommitment: '3-6 hours',
          bannerImage: 'https://example.com/winter-jam-banner.jpg'
        },
        stats: {
          participants: 127,
          submissions: 89,
          totalVotes: 0,
          averageRating: 0
        },
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      }
    ];
  }
}