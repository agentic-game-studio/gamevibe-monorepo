import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { PersonalCreditService } from './personal-credits.js';
import { AchievementService } from './achievement.js';
import { AnalyticsService } from './analytics.js';
import { DiscordAPIError, EmbedBuilder } from 'discord.js';
import { 
  Challenge, 
  ChallengeType, 
  ChallengeStatus, 
  ChallengeParticipant,
  ChallengeResult
} from '../generated/prisma/index.js';

export interface ChallengeStats {
  totalChallenges: number;
  challengesWon: number;
  challengesLost: number;
  challengesDrawn: number;
  winRate: number;
  totalCreditsWon: number;
  totalCreditsLost: number;
  activeChallenges: number;
  favoriteGameType: string;
  avgChallengeValue: number;
}

export interface CreateChallengeRequest {
  gameId: string;
  challengerId: string;
  challengeeId?: string;
  type: ChallengeType;
  wagerAmount: number;
  targetScore?: number;
  targetTime?: number;
  description?: string;
  expiresInHours?: number;
  serverId?: string;
}

export interface ChallengeWithDetails extends Challenge {
  game: any;
  challenger: any;
  challengee?: any;
  participants: ChallengeParticipant[];
  results: ChallengeResult[];
}

@injectable()
export class ChallengeService {
  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.PersonalCreditService) private personalCreditService: PersonalCreditService,
    @inject(TYPES.AchievementService) private achievementService: AchievementService,
    @inject(TYPES.AnalyticsService) private analytics: AnalyticsService,
    @inject(TYPES.DiscordClient) private discord: any
  ) {}

  /**
   * Create a new challenge
   */
  async createChallenge(request: CreateChallengeRequest): Promise<Challenge> {
    // Validate wager amount
    if (request.wagerAmount > 0) {
      const challengerCredits = await this.personalCreditService.getPersonalCredits(request.challengerId);
      if (challengerCredits.balance < request.wagerAmount) {
        throw new Error('Insufficient credits to create this challenge');
      }
    }

    // Validate game exists
    const game = await this.db.prisma.game.findUnique({
      where: { id: request.gameId }
    });

    if (!game) {
      throw new Error('Game not found');
    }

    // Set expiration (default 7 days)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (request.expiresInHours || 168)); // 7 days default

    // Create challenge
    const challenge = await this.db.prisma.challenge.create({
      data: {
        gameId: request.gameId,
        challengerId: request.challengerId,
        challengeeId: request.challengeeId,
        type: request.type,
        wagerAmount: request.wagerAmount,
        targetScore: request.targetScore,
        targetTime: request.targetTime,
        description: request.description,
        expiresAt,
        serverId: request.serverId,
        metadata: {
          createdInServer: request.serverId
        }
      }
    });

    // Reserve credits if wagered
    if (request.wagerAmount > 0) {
      await this.personalCreditService.spendCredits(
        request.challengerId,
        request.wagerAmount,
        `Challenge wager: ${challenge.id}`,
        request.serverId
      );
    }

    // Track analytics
    await this.analytics.track('challenge_created', {
      challengeId: challenge.id,
      challengerId: request.challengerId,
      gameId: request.gameId,
      type: request.type,
      wagerAmount: request.wagerAmount,
      hasTarget: !!request.challengeeId
    });

    // Check for challenge creation achievement
    await this.achievementService.checkProgress(
      request.challengerId,
      'challenges_created',
      1,
      { challengeId: challenge.id, wagerAmount: request.wagerAmount }
    );

    // Clear cache
    await this.clearUserChallengeCache(request.challengerId);
    if (request.challengeeId) {
      await this.clearUserChallengeCache(request.challengeeId);
    }

    return challenge;
  }

  /**
   * Accept a challenge
   */
  async acceptChallenge(challengeId: string, accepterId: string): Promise<Challenge> {
    const challenge = await this.db.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        challenger: true,
        challengee: true
      }
    });

    if (!challenge) {
      throw new Error('Challenge not found');
    }

    if (challenge.status !== ChallengeStatus.PENDING) {
      throw new Error('Challenge is no longer available');
    }

    if (new Date() > challenge.expiresAt) {
      throw new Error('Challenge has expired');
    }

    if (challenge.challengerId === accepterId) {
      throw new Error('Cannot accept your own challenge');
    }

    // Check if specific challenge
    if (challenge.challengeeId && challenge.challengeeId !== accepterId) {
      throw new Error('This challenge is not for you');
    }

    // Check accepter has enough credits
    if (challenge.wagerAmount > 0) {
      const accepterCredits = await this.personalCreditService.getPersonalCredits(accepterId);
      if (accepterCredits.balance < challenge.wagerAmount) {
        throw new Error('Insufficient credits to accept this challenge');
      }

      // Reserve accepter's credits
      await this.personalCreditService.spendCredits(
        accepterId,
        challenge.wagerAmount,
        `Challenge wager: ${challengeId}`,
        challenge.serverId
      );
    }

    // Update challenge
    const updatedChallenge = await this.db.prisma.challenge.update({
      where: { id: challengeId },
      data: {
        challengeeId: accepterId,
        status: ChallengeStatus.ACTIVE,
        acceptedAt: new Date()
      }
    });

    // Create participant records
    await this.db.prisma.challengeParticipant.createMany({
      data: [
        {
          challengeId,
          userId: challenge.challengerId
        },
        {
          challengeId,
          userId: accepterId
        }
      ]
    });

    // Send notification to challenger
    await this.sendChallengeNotification(updatedChallenge, 'accepted');

    // Track analytics
    await this.analytics.track('challenge_accepted', {
      challengeId,
      challengerId: challenge.challengerId,
      accepterId,
      wagerAmount: challenge.wagerAmount
    });

    // Clear cache
    await this.clearUserChallengeCache(challenge.challengerId);
    await this.clearUserChallengeCache(accepterId);

    return updatedChallenge;
  }

  /**
   * Submit challenge result
   */
  async submitChallengeResult(
    challengeId: string, 
    userId: string, 
    score?: number, 
    completionTime?: number
  ): Promise<void> {
    const challenge = await this.db.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        participants: true,
        challenger: true,
        challengee: true
      }
    });

    if (!challenge) {
      throw new Error('Challenge not found');
    }

    if (challenge.status !== ChallengeStatus.ACTIVE) {
      throw new Error('Challenge is not active');
    }

    // Find participant
    const participant = challenge.participants.find(p => p.userId === userId);
    if (!participant) {
      throw new Error('You are not a participant in this challenge');
    }

    if (participant.hasCompleted) {
      throw new Error('You have already submitted your result');
    }

    // Update participant result
    await this.db.prisma.challengeParticipant.update({
      where: { id: participant.id },
      data: {
        hasCompleted: true,
        completedAt: new Date(),
        finalScore: score,
        completionTime
      }
    });

    // Check if both participants have completed
    const completedParticipants = await this.db.prisma.challengeParticipant.count({
      where: {
        challengeId,
        hasCompleted: true
      }
    });

    if (completedParticipants === 2) {
      await this.completeChallenge(challengeId);
    }

    // Clear cache
    await this.clearUserChallengeCache(userId);
  }

  /**
   * Complete a challenge and determine winner
   */
  private async completeChallenge(challengeId: string): Promise<void> {
    const challenge = await this.db.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        participants: true,
        challenger: true,
        challengee: true
      }
    });

    if (!challenge) return;

    const participants = challenge.participants;
    if (participants.length !== 2) return;

    const [p1, p2] = participants;
    let winnerId: string | null = null;
    let loserId: string | null = null;
    let isDraw = false;

    // Determine winner based on challenge type
    switch (challenge.type) {
      case ChallengeType.SCORE_BEAT:
        if (challenge.targetScore) {
          // Both must beat target score, highest wins
          const p1BeatTarget = (p1.finalScore || 0) >= challenge.targetScore;
          const p2BeatTarget = (p2.finalScore || 0) >= challenge.targetScore;
          
          if (p1BeatTarget && p2BeatTarget) {
            if ((p1.finalScore || 0) > (p2.finalScore || 0)) {
              winnerId = p1.userId;
              loserId = p2.userId;
            } else if ((p2.finalScore || 0) > (p1.finalScore || 0)) {
              winnerId = p2.userId;
              loserId = p1.userId;
            } else {
              isDraw = true;
            }
          } else if (p1BeatTarget) {
            winnerId = p1.userId;
            loserId = p2.userId;
          } else if (p2BeatTarget) {
            winnerId = p2.userId;
            loserId = p1.userId;
          } else {
            isDraw = true; // Neither beat target
          }
        } else {
          // Simple high score wins
          if ((p1.finalScore || 0) > (p2.finalScore || 0)) {
            winnerId = p1.userId;
            loserId = p2.userId;
          } else if ((p2.finalScore || 0) > (p1.finalScore || 0)) {
            winnerId = p2.userId;
            loserId = p1.userId;
          } else {
            isDraw = true;
          }
        }
        break;

      case ChallengeType.SPEED_RUN:
        if (challenge.targetTime) {
          // Both must beat target time, fastest wins
          const p1BeatTarget = (p1.completionTime || Infinity) <= challenge.targetTime;
          const p2BeatTarget = (p2.completionTime || Infinity) <= challenge.targetTime;
          
          if (p1BeatTarget && p2BeatTarget) {
            if ((p1.completionTime || Infinity) < (p2.completionTime || Infinity)) {
              winnerId = p1.userId;
              loserId = p2.userId;
            } else if ((p2.completionTime || Infinity) < (p1.completionTime || Infinity)) {
              winnerId = p2.userId;
              loserId = p1.userId;
            } else {
              isDraw = true;
            }
          } else if (p1BeatTarget) {
            winnerId = p1.userId;
            loserId = p2.userId;
          } else if (p2BeatTarget) {
            winnerId = p2.userId;
            loserId = p1.userId;
          } else {
            isDraw = true;
          }
        } else {
          // Simple fastest time wins
          if ((p1.completionTime || Infinity) < (p2.completionTime || Infinity)) {
            winnerId = p1.userId;
            loserId = p2.userId;
          } else if ((p2.completionTime || Infinity) < (p1.completionTime || Infinity)) {
            winnerId = p2.userId;
            loserId = p1.userId;
          } else {
            isDraw = true;
          }
        }
        break;

      case ChallengeType.DIRECT_1V1:
        // For direct 1v1, highest score wins
        if ((p1.finalScore || 0) > (p2.finalScore || 0)) {
          winnerId = p1.userId;
          loserId = p2.userId;
        } else if ((p2.finalScore || 0) > (p1.finalScore || 0)) {
          winnerId = p2.userId;
          loserId = p1.userId;
        } else {
          isDraw = true;
        }
        break;
    }

    // Create result record
    const result = await this.db.prisma.challengeResult.create({
      data: {
        challengeId,
        winnerId,
        loserId,
        winnerScore: winnerId ? participants.find(p => p.userId === winnerId)?.finalScore : undefined,
        loserScore: loserId ? participants.find(p => p.userId === loserId)?.finalScore : undefined,
        winnerTime: winnerId ? participants.find(p => p.userId === winnerId)?.completionTime : undefined,
        loserTime: loserId ? participants.find(p => p.userId === loserId)?.completionTime : undefined,
        isDraw,
        creditsTransferred: 0
      }
    });

    // Handle credit transfer
    if (challenge.wagerAmount > 0) {
      const totalPot = challenge.wagerAmount * 2;
      
      if (isDraw) {
        // Return credits to both players
        if (challenge.challenger?.discordId) {
          await this.personalCreditService.addCredits(
            challenge.challenger.discordId,
            challenge.wagerAmount,
            'challenge_refund',
            { challengeId, reason: 'draw' }
          );
        }
        if (challenge.challengee?.discordId) {  
          await this.personalCreditService.addCredits(
            challenge.challengee.discordId,
            challenge.wagerAmount,
            'challenge_refund',
            { challengeId, reason: 'draw' }
          );
        }
      } else if (winnerId) {
        // Award full pot to winner
        const winner = winnerId === challenge.challengerId ? challenge.challenger : challenge.challengee;
        if (winner?.discordId) {
          await this.personalCreditService.addCredits(
            winner.discordId,
            totalPot,
            'challenge_win',
            { challengeId, defeatedOpponent: loserId }
          );
          
          // Update result with credits transferred
          await this.db.prisma.challengeResult.update({
            where: { id: result.id },
            data: {
              creditsTransferred: totalPot,
              transferredAt: new Date()
            }
          });
        }
      }
    }

    // Update challenge status
    await this.db.prisma.challenge.update({
      where: { id: challengeId },
      data: {
        status: ChallengeStatus.COMPLETED,
        completedAt: new Date()
      }
    });

    // Check for challenge achievements
    if (winnerId) {
      const winner = winnerId === challenge.challengerId ? challenge.challenger : challenge.challengee;
      if (winner?.discordId) {
        await this.achievementService.checkProgress(
          winner.discordId,
          'challenges_won',
          1,
          { challengeId, wagerAmount: challenge.wagerAmount }
        );

        // Check for high-value challenge win (100+ credits)
        if (challenge.wagerAmount >= 100) {
          await this.achievementService.checkProgress(
            winner.discordId,
            'high_value_challenge_win',
            1,
            { challengeId, wagerAmount: challenge.wagerAmount }
          );
        }
      }
    }

    // Send completion notifications
    await this.sendChallengeNotification(challenge, 'completed', { winnerId, isDraw });

    // Track analytics
    await this.analytics.track('challenge_completed', {
      challengeId,
      winnerId,
      loserId,
      isDraw,
      wagerAmount: challenge.wagerAmount,
      totalPot: challenge.wagerAmount * 2,
      type: challenge.type
    });

    // Clear cache for all participants
    for (const participant of participants) {
      await this.clearUserChallengeCache(participant.userId);
    }
  }

  /**
   * Get user challenge statistics
   */
  async getUserChallengeStats(userId: string): Promise<ChallengeStats> {
    const cacheKey = `challenge_stats:${userId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get user's internal ID
    const user = await this.db.prisma.user.findUnique({
      where: { discordId: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get all results for this user
    const wins = await this.db.prisma.challengeResult.count({
      where: { winnerId: user.id }
    });

    const losses = await this.db.prisma.challengeResult.count({
      where: { loserId: user.id }
    });

    const draws = await this.db.prisma.challengeResult.count({
      where: {
        isDraw: true,
        challenge: {
          OR: [
            { challengerId: user.id },
            { challengeeId: user.id }
          ]
        }
      }
    });

    const totalChallenges = wins + losses + draws;
    const winRate = totalChallenges > 0 ? (wins / totalChallenges) * 100 : 0;

    // Get credits won/lost
    const creditResults = await this.db.prisma.challengeResult.findMany({
      where: {
        OR: [
          { winnerId: user.id },
          { loserId: user.id }  
        ]
      },
      select: {
        winnerId: true,
        creditsTransferred: true
      }
    });

    let totalCreditsWon = 0;
    let totalCreditsLost = 0;

    creditResults.forEach(result => {
      if (result.winnerId === user.id) {
        totalCreditsWon += result.creditsTransferred;
      } else {
        // This was a loss, estimate credits lost (half the pot)
        totalCreditsLost += Math.floor(result.creditsTransferred / 2);
      }
    });

    // Get active challenges
    const activeChallenges = await this.db.prisma.challenge.count({
      where: {
        OR: [
          { challengerId: user.id },
          { challengeeId: user.id }
        ],
        status: {
          in: [ChallengeStatus.PENDING, ChallengeStatus.ACTIVE]
        }
      }
    });

    // Get favorite game type (most challenged on)
    const gameTypeStats = await this.db.prisma.challenge.groupBy({
      by: ['gameId'],
      where: {
        OR: [
          { challengerId: user.id },
          { challengeeId: user.id }
        ]
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 1
    });

    let favoriteGameType = 'None';
    if (gameTypeStats.length > 0) {
      const game = await this.db.prisma.game.findUnique({
        where: { id: gameTypeStats[0].gameId },
        select: { type: true }
      });
      favoriteGameType = game?.type || 'Unknown';
    }

    // Calculate average challenge value
    const challengeValues = await this.db.prisma.challenge.findMany({
      where: {
        OR: [
          { challengerId: user.id },
          { challengeeId: user.id }
        ]
      },
      select: {
        wagerAmount: true
      }
    });

    const avgChallengeValue = challengeValues.length > 0 
      ? challengeValues.reduce((sum, c) => sum + c.wagerAmount, 0) / challengeValues.length
      : 0;

    const stats: ChallengeStats = {
      totalChallenges,
      challengesWon: wins,
      challengesLost: losses,
      challengesDrawn: draws,
      winRate,
      totalCreditsWon,
      totalCreditsLost,
      activeChallenges,
      favoriteGameType,
      avgChallengeValue
    };

    // Cache for 10 minutes
    await this.cache.set(cacheKey, JSON.stringify(stats), 600);

    return stats;
  }

  /**
   * Get active challenges for a user
   */
  async getUserActiveChallenges(userId: string): Promise<ChallengeWithDetails[]> {
    const user = await this.db.prisma.user.findUnique({
      where: { discordId: userId }
    });

    if (!user) {
      return [];
    }

    return await this.db.prisma.challenge.findMany({
      where: {
        OR: [
          { challengerId: user.id },
          { challengeeId: user.id }
        ],
        status: {
          in: [ChallengeStatus.PENDING, ChallengeStatus.ACTIVE]
        }
      },
      include: {
        game: {
          select: {
            id: true,
            shortId: true,
            name: true,
            type: true
          }
        },
        challenger: {
          select: {
            id: true,
            discordId: true,
            username: true
          }
        },
        challengee: {
          select: {
            id: true,
            discordId: true,
            username: true
          }
        },
        participants: true,
        results: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    }) as ChallengeWithDetails[];
  }

  /**
   * Send challenge notification
   */
  private async sendChallengeNotification(
    challenge: any, 
    type: 'accepted' | 'completed',
    details?: { winnerId?: string; isDraw?: boolean }
  ): Promise<void> {
    try {
      let targetUserId: string;
      let embed: EmbedBuilder;

      if (type === 'accepted') {
        targetUserId = challenge.challenger.discordId;
        embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🎯 Challenge Accepted!')
          .setDescription(`Your challenge has been accepted!`)
          .addFields(
            { name: 'Game', value: challenge.game?.name || 'Unknown', inline: true },
            { name: 'Wager', value: `${challenge.wagerAmount} credits`, inline: true },
            { name: 'Opponent', value: `<@${challenge.challengee.discordId}>`, inline: true }
          )
          .setTimestamp();
      } else {
        // Completion notification
        const { winnerId, isDraw } = details || {};
        
        if (isDraw) {
          embed = new EmbedBuilder()
            .setColor(0xFFFF00)
            .setTitle('🤝 Challenge Draw!')
            .setDescription('The challenge ended in a draw. Credits have been refunded.')
            .addFields(
              { name: 'Game', value: challenge.game?.name || 'Unknown', inline: true },
              { name: 'Wager Refunded', value: `${challenge.wagerAmount} credits`, inline: true }
            );
        } else if (winnerId) {
          const isWinner = winnerId === challenge.challenger.id;
          targetUserId = isWinner ? challenge.challenger.discordId : challenge.challengee.discordId;
          
          embed = new EmbedBuilder()
            .setColor(isWinner ? 0x00FF00 : 0xFF0000)
            .setTitle(isWinner ? '🏆 Challenge Won!' : '😔 Challenge Lost')
            .setDescription(isWinner ? 'Congratulations! You won the challenge!' : 'Better luck next time!')
            .addFields(
              { name: 'Game', value: challenge.game?.name || 'Unknown', inline: true },
              { name: 'Credits', value: isWinner ? `+${challenge.wagerAmount * 2}` : `-${challenge.wagerAmount}`, inline: true }
            );
        }

        // Send to both players for completion
        if (challenge.challenger?.discordId) {
          const challengerUser = await this.discord.users.fetch(challenge.challenger.discordId);
          await challengerUser.send({ embeds: [embed] });
        }
        if (challenge.challengee?.discordId) {
          const challengeeUser = await this.discord.users.fetch(challenge.challengee.discordId);
          await challengeeUser.send({ embeds: [embed] });
        }
        return;
      }

      // Send single notification
      if (targetUserId) {
        const user = await this.discord.users.fetch(targetUserId);
        await user.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Failed to send challenge notification:', error);
    }
  }

  /**
   * Clear user challenge cache
   */
  private async clearUserChallengeCache(userId: string): Promise<void> {
    await this.cache.del(`challenge_stats:${userId}`);
    await this.cache.del(`user_challenges:${userId}`);
  }
}