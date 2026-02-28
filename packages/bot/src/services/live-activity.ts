import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { AnalyticsService } from './analytics.js';
import { Client } from 'discord.js';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  userId: string;
  serverId?: string;
  gameId?: string;
  timestamp: Date;
  metadata: Record<string, any>;
  isPublic: boolean;
}

export type ActivityType = 
  | 'GAME_CREATED'
  | 'GAME_PLAYED'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'CHALLENGE_COMPLETED'
  | 'TIER_UPGRADED'
  | 'SERVER_JOINED'
  | 'VIRAL_MILESTONE'
  | 'AMBASSADOR_PROMOTED'
  | 'GAME_SHARED'
  | 'REMIX_CREATED'
  | 'MULTIPLAYER_SESSION'
  | 'CREDITS_EARNED'
  | 'REFERRAL_SUCCESS';

export interface ActivityFeedOptions {
  limit?: number;
  types?: ActivityType[];
  serverId?: string;
  userId?: string;
  includeGlobal?: boolean;
  timeframe?: 'hour' | 'day' | 'week';
}

export interface ActivityStats {
  totalActivities: number;
  activeUsers: number;
  popularGames: Array<{
    gameId: string;
    gameTitle: string;
    activityCount: number;
  }>;
  topServers: Array<{
    serverId: string;
    serverName: string;
    activityCount: number;
  }>;
  recentMilestones: ActivityEvent[];
}

@injectable()
export class LiveActivityService {
  private readonly CACHE_TTL = {
    FEED: 60, // 1 minute for activity feed
    STATS: 300, // 5 minutes for stats
    TRENDING: 600 // 10 minutes for trending data
  };

  private readonly ACTIVITY_RETENTION_DAYS = 7; // Keep activities for 7 days

  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.DiscordClient) private client: Client
  ) {}

  /**
   * Record a new activity event
   */
  async recordActivity(
    type: ActivityType,
    userId: string,
    metadata: Record<string, any> = {},
    serverId?: string,
    gameId?: string,
    isPublic: boolean = true
  ): Promise<string> {
    try {
      const activityId = this.generateActivityId();
      
      // Store in cache for immediate access
      const activity: ActivityEvent = {
        id: activityId,
        type,
        userId,
        serverId,
        gameId,
        timestamp: new Date(),
        metadata,
        isPublic
      };

      // Add to recent activities cache
      await this.addToRecentActivities(activity);
      
      // Store in database for persistence (async)
      this.storeActivityInDatabase(activity).catch(error => {
        console.error('Error storing activity in database:', error);
      });

      // Track analytics
      await this.analytics.track('live_activity_recorded', {
        type,
        userId,
        serverId,
        gameId,
        isPublic
      });

      // Clear related caches
      await this.clearRelatedCaches(type, serverId);

      return activityId;

    } catch (error) {
      console.error('Error recording activity:', error);
      throw error;
    }
  }

  /**
   * Get activity feed based on options
   */
  async getActivityFeed(options: ActivityFeedOptions = {}): Promise<ActivityEvent[]> {
    const {
      limit = 50,
      types,
      serverId,
      userId,
      includeGlobal = true,
      timeframe = 'day'
    } = options;

    const cacheKey = this.generateFeedCacheKey(options);
    const cached = await this.cache.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      let activities: ActivityEvent[] = [];

      // Get from cache first (recent activities)
      const recentActivities = await this.getRecentActivitiesFromCache();
      
      // Filter based on options
      activities = recentActivities.filter(activity => {
        // Type filter
        if (types && !types.includes(activity.type)) return false;
        
        // Server filter
        if (serverId && activity.serverId !== serverId) return false;
        
        // User filter
        if (userId && activity.userId !== userId) return false;
        
        // Public filter
        if (!activity.isPublic) return false;
        
        // Timeframe filter
        const now = new Date();
        const activityTime = new Date(activity.timestamp);
        const timeDiff = now.getTime() - activityTime.getTime();
        
        switch (timeframe) {
          case 'hour':
            return timeDiff <= 60 * 60 * 1000;
          case 'day':
            return timeDiff <= 24 * 60 * 60 * 1000;
          case 'week':
            return timeDiff <= 7 * 24 * 60 * 60 * 1000;
          default:
            return true;
        }
      });

      // Sort by timestamp (newest first)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Limit results
      activities = activities.slice(0, limit);

      // Enrich with user/game/server data
      activities = await this.enrichActivities(activities);

      // Cache the result
      await this.cache.set(cacheKey, JSON.stringify(activities), this.CACHE_TTL.FEED);

      return activities;

    } catch (error) {
      console.error('Error getting activity feed:', error);
      return [];
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<ActivityStats> {
    const cacheKey = `activity_stats:${timeframe}`;
    const cached = await this.cache.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const activities = await this.getActivityFeed({ 
        timeframe, 
        limit: 1000,
        includeGlobal: true 
      });

      // Calculate stats
      const totalActivities = activities.length;
      const activeUsers = new Set(activities.map(a => a.userId)).size;

      // Popular games
      const gameActivity = new Map<string, { title: string; count: number }>();
      const serverActivity = new Map<string, { name: string; count: number }>();

      for (const activity of activities) {
        // Game activity
        if (activity.gameId) {
          const gameTitle = activity.metadata.gameTitle || 'Unknown Game';
          const existing = gameActivity.get(activity.gameId);
          gameActivity.set(activity.gameId, {
            title: gameTitle,
            count: (existing?.count || 0) + 1
          });
        }

        // Server activity
        if (activity.serverId) {
          const serverName = activity.metadata.serverName || 'Unknown Server';
          const existing = serverActivity.get(activity.serverId);
          serverActivity.set(activity.serverId, {
            name: serverName,
            count: (existing?.count || 0) + 1
          });
        }
      }

      // Get top games and servers
      const popularGames = Array.from(gameActivity.entries())
        .map(([gameId, data]) => ({
          gameId,
          gameTitle: data.title,
          activityCount: data.count
        }))
        .sort((a, b) => b.activityCount - a.activityCount)
        .slice(0, 10);

      const topServers = Array.from(serverActivity.entries())
        .map(([serverId, data]) => ({
          serverId,
          serverName: data.name,
          activityCount: data.count
        }))
        .sort((a, b) => b.activityCount - a.activityCount)
        .slice(0, 10);

      // Recent milestones
      const milestoneTypes: ActivityType[] = [
        'VIRAL_MILESTONE',
        'TIER_UPGRADED',
        'ACHIEVEMENT_UNLOCKED',
        'AMBASSADOR_PROMOTED'
      ];
      
      const recentMilestones = activities
        .filter(a => milestoneTypes.includes(a.type))
        .slice(0, 5);

      const stats: ActivityStats = {
        totalActivities,
        activeUsers,
        popularGames,
        topServers,
        recentMilestones
      };

      // Cache stats
      await this.cache.set(cacheKey, JSON.stringify(stats), this.CACHE_TTL.STATS);

      return stats;

    } catch (error) {
      console.error('Error getting activity stats:', error);
      return {
        totalActivities: 0,
        activeUsers: 0,
        popularGames: [],
        topServers: [],
        recentMilestones: []
      };
    }
  }

  /**
   * Get trending activities (most active in short timeframe)
   */
  async getTrendingActivities(limit: number = 20): Promise<ActivityEvent[]> {
    const cacheKey = 'trending_activities';
    const cached = await this.cache.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Get recent activities (last hour)
      const recentActivities = await this.getActivityFeed({
        timeframe: 'hour',
        limit: 200,
        includeGlobal: true
      });

      // Score activities based on recency and engagement
      const scoredActivities = recentActivities.map(activity => {
        const age = Date.now() - new Date(activity.timestamp).getTime();
        const ageScore = Math.max(0, 1 - (age / (60 * 60 * 1000))); // Decay over 1 hour
        
        let typeScore = 1;
        switch (activity.type) {
          case 'VIRAL_MILESTONE':
            typeScore = 3;
            break;
          case 'TIER_UPGRADED':
            typeScore = 2.5;
            break;
          case 'ACHIEVEMENT_UNLOCKED':
            typeScore = 2;
            break;
          case 'GAME_CREATED':
            typeScore = 1.5;
            break;
        }

        return {
          activity,
          score: ageScore * typeScore
        };
      });

      // Sort by score and take top activities
      const trending = scoredActivities
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.activity);

      // Cache trending activities
      await this.cache.set(cacheKey, JSON.stringify(trending), this.CACHE_TTL.TRENDING);

      return trending;

    } catch (error) {
      console.error('Error getting trending activities:', error);
      return [];
    }
  }

  /**
   * Get live player count and active sessions
   */
  async getLiveStats(): Promise<{
    activeGames: number;
    activePlayers: number;
    recentActivity: number;
    topActivity: ActivityEvent | null;
  }> {
    const cacheKey = 'live_stats';
    const cached = await this.cache.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const hourlyActivities = await this.getActivityFeed({
        timeframe: 'hour',
        limit: 500
      });

      const activeGames = new Set(
        hourlyActivities
          .filter(a => ['GAME_PLAYED', 'MULTIPLAYER_SESSION'].includes(a.type))
          .map(a => a.gameId)
          .filter(Boolean)
      ).size;

      const activePlayers = new Set(
        hourlyActivities
          .filter(a => ['GAME_PLAYED', 'MULTIPLAYER_SESSION'].includes(a.type))
          .map(a => a.userId)
      ).size;

      const recentActivity = hourlyActivities.filter(a => {
        const age = Date.now() - new Date(a.timestamp).getTime();
        return age <= 15 * 60 * 1000; // Last 15 minutes
      }).length;

      const topActivity = hourlyActivities.find(a => 
        ['VIRAL_MILESTONE', 'TIER_UPGRADED', 'ACHIEVEMENT_UNLOCKED'].includes(a.type)
      ) || null;

      const stats = {
        activeGames,
        activePlayers,
        recentActivity,
        topActivity
      };

      // Cache for 2 minutes
      await this.cache.set(cacheKey, JSON.stringify(stats), 120);

      return stats;

    } catch (error) {
      console.error('Error getting live stats:', error);
      return {
        activeGames: 0,
        activePlayers: 0,
        recentActivity: 0,
        topActivity: null
      };
    }
  }

  /**
   * Private helper methods
   */
  private generateActivityId(): string {
    return `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFeedCacheKey(options: ActivityFeedOptions): string {
    const keyParts = [
      'activity_feed',
      options.limit || 50,
      options.types?.join(',') || 'all',
      options.serverId || 'global',
      options.userId || 'all',
      options.includeGlobal ? 'global' : 'local',
      options.timeframe || 'day'
    ];
    return keyParts.join(':');
  }

  private async addToRecentActivities(activity: ActivityEvent): Promise<void> {
    const key = 'recent_activities';
    const maxActivities = 1000;

    try {
      // Get current activities
      const current = await this.cache.get<string>(key);
      let activities: ActivityEvent[] = current ? JSON.parse(current) : [];

      // Add new activity to the beginning
      activities.unshift(activity);

      // Trim to max size
      activities = activities.slice(0, maxActivities);

      // Store back
      await this.cache.set(key, JSON.stringify(activities), 24 * 60 * 60); // 24 hours

    } catch (error) {
      console.error('Error adding to recent activities:', error);
    }
  }

  private async getRecentActivitiesFromCache(): Promise<ActivityEvent[]> {
    try {
      const cached = await this.cache.get<string>('recent_activities');
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Error getting recent activities from cache:', error);
      return [];
    }
  }

  private async storeActivityInDatabase(activity: ActivityEvent): Promise<void> {
    try {
      // Store in a simple activities table or use metadata field
      // For now, we'll use the existing game play tracking
      // In a full implementation, you'd have a dedicated activities table
      
      // Clean up old activities periodically
      await this.cleanupOldActivities();

    } catch (error) {
      console.error('Error storing activity in database:', error);
    }
  }

  private async cleanupOldActivities(): Promise<void> {
    // Cleanup logic - remove activities older than retention period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.ACTIVITY_RETENTION_DAYS);
    
    // This would clean up database records if we had a dedicated activities table
  }

  private async enrichActivities(activities: ActivityEvent[]): Promise<ActivityEvent[]> {
    // Enrich activities with user names, game titles, server names
    const enriched = await Promise.all(activities.map(async (activity) => {
      try {
        // Get user info
        if (!activity.metadata.userName) {
          const user = await this.client.users.fetch(activity.userId).catch(() => null);
          if (user) {
            activity.metadata.userName = user.displayName || user.username;
            activity.metadata.userAvatar = user.displayAvatarURL();
          }
        }

        // Get game info
        if (activity.gameId && !activity.metadata.gameTitle) {
          const game = await this.db.prisma.game.findUnique({
            where: { id: activity.gameId },
            select: { title: true, type: true }
          }).catch(() => null);
          
          if (game) {
            activity.metadata.gameTitle = game.title;
            activity.metadata.gameType = game.type;
          }
        }

        // Get server info
        if (activity.serverId && !activity.metadata.serverName) {
          const guild = await this.client.guilds.fetch(activity.serverId).catch(() => null);
          if (guild) {
            activity.metadata.serverName = guild.name;
            activity.metadata.serverIcon = guild.iconURL();
          }
        }

        return activity;
      } catch (error) {
        console.error('Error enriching activity:', error);
        return activity;
      }
    }));

    return enriched;
  }

  private async clearRelatedCaches(type: ActivityType, serverId?: string): Promise<void> {
    const keysToDelete = [
      'trending_activities',
      'live_stats',
      `activity_stats:hour`,
      `activity_stats:day`,
      `activity_stats:week`
    ];

    if (serverId) {
      keysToDelete.push(`activity_feed:*:*:${serverId}:*`);
    }

    await Promise.all(keysToDelete.map(key => 
      this.cache.delete(key).catch(() => {})
    ));
  }

  /**
   * Convenience methods for common activity types
   */
  async recordGameCreated(userId: string, gameId: string, gameTitle: string, serverId: string): Promise<void> {
    await this.recordActivity('GAME_CREATED', userId, {
      gameTitle,
      gameType: 'unknown' // Would be passed in
    }, serverId, gameId);
  }

  async recordGamePlayed(userId: string, gameId: string, serverId: string): Promise<void> {
    await this.recordActivity('GAME_PLAYED', userId, {}, serverId, gameId);
  }

  async recordAchievementUnlocked(userId: string, achievementId: string, serverId?: string): Promise<void> {
    await this.recordActivity('ACHIEVEMENT_UNLOCKED', userId, {
      achievementId
    }, serverId);
  }

  async recordTierUpgraded(userId: string, previousTier: string, newTier: string): Promise<void> {
    await this.recordActivity('TIER_UPGRADED', userId, {
      previousTier,
      newTier
    });
  }

  async recordViralMilestone(userId: string, gameId: string, milestone: number, serverId?: string): Promise<void> {
    await this.recordActivity('VIRAL_MILESTONE', userId, {
      milestone,
      plays: milestone
    }, serverId, gameId);
  }

  async recordServerJoined(serverId: string, memberCount: number): Promise<void> {
    await this.recordActivity('SERVER_JOINED', 'system', {
      memberCount,
      serverName: 'Unknown'
    }, serverId);
  }
}