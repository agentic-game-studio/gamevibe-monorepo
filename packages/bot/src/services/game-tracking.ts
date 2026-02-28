// Game Tracking Service
// Handles game play tracking and credit earning

import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { DatabaseService } from './database.js';
import { PersonalCreditService } from './personal-credits.js';
import { CacheService } from './cache.js';
import { AnalyticsService } from './analytics.js';
import { AchievementService } from './achievement.js';
import { ChallengeService } from './challenge.js';
import { AmbassadorService } from './ambassador.js';
import { Game } from '@gamevibe/shared';
import { ChallengeStatus, ActivityType } from '../generated/prisma/index.js';

@injectable()
export class GameTrackingService {
  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.PersonalCreditService) private personalCreditService: PersonalCreditService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.AchievementService) private achievementService: AchievementService,
    @inject(TYPES.ChallengeService) private challengeService: ChallengeService,
    @inject(TYPES.AmbassadorService) private ambassadorService: AmbassadorService
  ) {}

  /**
   * Track a game play and process credit earning
   */
  async trackGamePlay(gameId: string, playerId: string, serverId: string): Promise<void> {
    try {
      // Increment play count in database
      const updatedGame = await this.db.incrementPlayCount(gameId);
      
      // Skip server-specific features for web plays
      if (serverId && serverId !== 'unknown' && serverId !== 'web') {
        // Process credit earning (only for Discord plays)
        await this.personalCreditService.processGamePlay(gameId, serverId);
      }
      
      // Track analytics
      await this.analytics.track('game_played', {
        gameId,
        playerId,
        serverId: serverId === 'unknown' || serverId === 'web' ? null : serverId,
        timestamp: new Date()
      });
      
      // Get game details for achievement tracking
      const game = await this.db.prisma.game.findUnique({
        where: { id: gameId },
        include: { creator: true }
      });
      
      if (game) {
        // Check total plays achievement for creator
        const totalPlays = await this.db.prisma.game.aggregate({
          where: { creatorId: game.creatorId },
          _sum: { playCount: true }
        });
        
        await this.achievementService.checkProgress(
          game.creator.discordId,
          'total_plays',
          1,
          { gameId, totalPlays: totalPlays._sum.playCount }
        );
        
        // Check for viral game achievement (100+ plays)
        if (game.playCount >= 100) {
          await this.achievementService.checkProgress(
            game.creator.discordId,
            'viral_game',
            1,
            { gameId, playCount: game.playCount }
          );
        }
      }
      
      // Update cache
      const cacheKey = `game:${gameId}:playcount`;
      await this.cache.delete(cacheKey);

      // Track ambassador activities (only for Discord plays)
      if (serverId && serverId !== 'unknown' && serverId !== 'web') {
        await this.trackAmbassadorActivities(gameId, serverId, playerId, game);
      }
      
    } catch (error) {
      console.error('Error tracking game play:', error);
      // Don't throw - we don't want play tracking failures to break the game
    }
  }

  /**
   * Track game start (for session tracking)
   */
  async trackGameStart(gameId: string, playerId: string, serverId: string, channelId: string): Promise<string | null> {
    try {
      // Skip session creation for web-only plays (no server context)
      if (!serverId || serverId === 'unknown' || serverId === 'web') {
        // Just track analytics for web plays
        await this.analytics.trackEvent('game_started_web', {
          gameId,
          playerId,
          serverId: null,
          channelId: 'web',
          sessionId: null
        });
        return null;
      }
      
      // Create game session for Discord plays
      const session = await this.db.createGameSession({
        gameId,
        serverId,
        channelId,
        activePlayers: 1
      });
      
      // Track analytics
      await this.analytics.trackEvent('game_started', {
        gameId,
        playerId,
        serverId,
        channelId,
        sessionId: session.id
      });
      
      return session.id;
      
    } catch (error) {
      console.error('Error tracking game start:', error);
      return null;
    }
  }

  /**
   * Track game end (for session tracking)
   */
  async trackGameEnd(sessionId: string, playerId: string, score?: number): Promise<void> {
    try {
      // End game session
      await this.db.endGameSession(sessionId);
      
      // Track analytics
      await this.analytics.trackEvent('game_ended', {
        sessionId,
        playerId,
        score,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Error tracking game end:', error);
    }
  }

  /**
   * Track game completion with score and time for challenge purposes
   */
  async trackGameCompletion(
    gameId: string, 
    playerId: string, 
    score?: number, 
    completionTime?: number
  ): Promise<void> {
    try {
      // First do normal play tracking
      await this.trackGamePlay(gameId, playerId, ''); // serverId not needed for this

      // Check for active challenges involving this player and game
      const user = await this.db.prisma.user.findUnique({
        where: { discordId: playerId }
      });

      if (!user) return;

      // Find active challenges for this user on this game
      const activeChallenges = await this.db.prisma.challenge.findMany({
        where: {
          gameId,
          status: ChallengeStatus.ACTIVE,
          OR: [
            { challengerId: user.id },
            { challengeeId: user.id }
          ]
        },
        include: {
          participants: {
            where: {
              userId: user.id,
              hasCompleted: false
            }
          }
        }
      });

      // Submit results for applicable challenges
      for (const challenge of activeChallenges) {
        if (challenge.participants.length > 0) {
          await this.challengeService.submitChallengeResult(
            challenge.id,
            user.id,
            score,
            completionTime
          );
        }
      }

    } catch (error) {
      console.error('Error tracking game completion:', error);
    }
  }

  /**
   * Get game with updated play count
   */
  async getGameWithPlayCount(shortId: string): Promise<Game | null> {
    // Try cache first
    const cacheKey = `game:${shortId}:full`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Get from database
    const game = await this.db.getGame(shortId);
    if (game) {
      // Cache for 5 minutes
      await this.cache.set(cacheKey, JSON.stringify(game), 300);
    }
    
    return game;
  }

  /**
   * Track ambassador activities related to game play
   */
  private async trackAmbassadorActivities(
    gameId: string, 
    serverId: string, 
    playerId: string, 
    game?: any
  ): Promise<void> {
    try {
      if (!game || !serverId) return;

      // Check if game creator is an ambassador
      const creatorAmbassador = await this.ambassadorService.getUserAmbassadorStatus(
        serverId, 
        game.creator.discordId
      );

      if (creatorAmbassador && creatorAmbassador.status === 'ACTIVE') {
        // Record game creation activity (only once per game)
        const existingActivity = await this.db.prisma.ambassadorActivity.findFirst({
          where: {
            ambassadorId: creatorAmbassador.id,
            type: ActivityType.GAME_CREATED,
            relatedGameId: gameId
          }
        });

        if (!existingActivity) {
          await this.ambassadorService.recordActivity({
            ambassadorId: creatorAmbassador.id,
            serverId,
            type: ActivityType.GAME_CREATED,
            title: `Created game: ${game.name}`,
            description: `Game "${game.name}" has been created and played by users`,
            relatedGameId: gameId,
            metadata: {
              gameType: game.type,
              autoRecorded: true
            }
          });
        }

        // Check for viral content (100+ plays)
        if (game.playCount >= 100) {
          const existingViralActivity = await this.db.prisma.ambassadorActivity.findFirst({
            where: {
              ambassadorId: creatorAmbassador.id,
              type: ActivityType.VIRAL_CONTENT,
              relatedGameId: gameId
            }
          });

          if (!existingViralActivity) {
            await this.ambassadorService.recordActivity({
              ambassadorId: creatorAmbassador.id,
              serverId,
              type: ActivityType.VIRAL_CONTENT,
              title: `Viral game: ${game.name}`,
              description: `Game "${game.name}" has reached ${game.playCount} plays`,
              relatedGameId: gameId,
              metadata: {
                playCount: game.playCount,
                gameType: game.type,
                autoRecorded: true
              }
            });
          }
        }
      }

      // Check if player is an ambassador (for recruiting activity)
      if (playerId !== game.creator.discordId) {
        const playerAmbassador = await this.ambassadorService.getUserAmbassadorStatus(
          serverId,
          playerId
        );

        if (playerAmbassador && playerAmbassador.status === 'ACTIVE') {
          // Check if this is a new player being recruited
          const playerGames = await this.db.prisma.game.count({
            where: {
              creator: { discordId: playerId },
              serverId: game.serverId
            }
          });

          // If player has no games, they might be a new recruit
          if (playerGames === 0) {
            await this.ambassadorService.recordActivity({
              ambassadorId: playerAmbassador.id,
              serverId,
              type: ActivityType.PLAYER_RECRUITED,
              title: `Engaged new player`,
              description: `New player ${playerId} played their first game`,
              relatedUserId: playerId,
              relatedGameId: gameId,
              metadata: {
                autoRecorded: true
              }
            });
          }
        }
      }

    } catch (error) {
      console.error('Error tracking ambassador activities:', error);
      // Don't throw - ambassador tracking shouldn't break game tracking
    }
  }
}