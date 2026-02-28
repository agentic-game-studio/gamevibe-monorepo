# 📋 Viral Features Technical Specification

## Overview
This document provides detailed technical specifications for implementing viral growth features in GameVibe AI.

## 1. Share System Specification

### Database Schema
```sql
-- Share tracking table
CREATE TABLE game_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id),
  sharer_id VARCHAR(255) NOT NULL,
  share_code VARCHAR(20) UNIQUE NOT NULL,
  share_type VARCHAR(50) NOT NULL, -- 'discord', 'twitter', 'embed', 'direct'
  channel_id VARCHAR(255),
  server_id VARCHAR(255),
  
  -- Metrics
  view_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  play_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_clicked_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes
  INDEX idx_share_code (share_code),
  INDEX idx_game_shares (game_id, created_at DESC),
  INDEX idx_sharer_shares (sharer_id, created_at DESC)
);

-- Share conversions table
CREATE TABLE share_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES game_shares(id),
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'view', 'play', 'create', 'subscribe'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent duplicate tracking
  UNIQUE(share_id, user_id, action)
);
```

### Share URL Format
```
Base: https://gamevibe.ai/play/{gameId}?ref={shareCode}
Discord: https://gamevibe.ai/play/{gameId}?ref={shareCode}&source=discord&server={serverId}
Twitter: https://gamevibe.ai/play/{gameId}?ref={shareCode}&source=twitter
Embed: https://gamevibe.ai/embed/{gameId}?ref={shareCode}
```

### Share Command Implementation
```typescript
// /share-game command
interface ShareGameOptions {
  gameId: string;
  message?: string; // Custom share message
  channels?: string[]; // Cross-post to multiple channels
}

class ShareGameCommand {
  async execute(interaction: CommandInteraction, options: ShareGameOptions) {
    // 1. Validate game ownership/permissions
    const game = await this.gameService.getGame(options.gameId);
    if (!this.canShareGame(interaction.user.id, game)) {
      throw new Error('Permission denied');
    }
    
    // 2. Generate unique share code
    const shareCode = await this.generateShareCode();
    
    // 3. Create share record
    const share = await this.shareService.createShare({
      gameId: options.gameId,
      sharerId: interaction.user.id,
      shareCode,
      shareType: 'discord',
      channelId: interaction.channelId,
      serverId: interaction.guildId
    });
    
    // 4. Generate share embed
    const embed = await this.createShareEmbed(game, share);
    
    // 5. Add share buttons
    const components = this.createShareComponents(share);
    
    // 6. Send to requested channels
    await this.crossPostToChannels(embed, components, options.channels);
    
    // 7. Track share event
    await this.analytics.trackShare(share);
    
    return { embed, components };
  }
}
```

### Share Tracking Middleware
```typescript
// Web runtime middleware
export async function shareTrackingMiddleware(req: Request, res: Response, next: NextFunction) {
  const { ref: shareCode, source } = req.query;
  
  if (shareCode) {
    // Track view
    await trackShareView(shareCode, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      source
    });
    
    // Set tracking cookie
    res.cookie('gamevibe_ref', shareCode, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: true
    });
    
    // Store in session for conversion tracking
    req.session.shareCode = shareCode;
  }
  
  next();
}
```

## 2. Referral System Specification

### Database Schema
```sql
-- User referral codes
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  referral_code VARCHAR(10) UNIQUE NOT NULL,
  tier VARCHAR(20) DEFAULT 'bronze', -- bronze, silver, gold, diamond
  
  -- Metrics
  total_referrals INTEGER DEFAULT 0,
  successful_referrals INTEGER DEFAULT 0,
  credits_earned INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_referral_code (referral_code)
);

-- Referral tracking
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id VARCHAR(255) NOT NULL,
  referred_id VARCHAR(255) NOT NULL,
  referral_code VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, expired
  
  -- Rewards
  referrer_credits INTEGER DEFAULT 0,
  referred_discount INTEGER DEFAULT 0,
  
  -- Conversion tracking
  signed_up_at TIMESTAMP WITH TIME ZONE,
  first_game_at TIMESTAMP WITH TIME ZONE,
  subscribed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent duplicate referrals
  UNIQUE(referred_id)
);
```

### Referral Tiers
```typescript
const REFERRAL_TIERS = {
  bronze: {
    requirement: 0,
    referralBonus: 10,
    subscriptionCommission: 0.10, // 10%
    perks: ['referral_badge']
  },
  silver: {
    requirement: 5,
    referralBonus: 20,
    subscriptionCommission: 0.15, // 15%
    perks: ['referral_badge', 'exclusive_template']
  },
  gold: {
    requirement: 20,
    referralBonus: 50,
    subscriptionCommission: 0.20, // 20%
    perks: ['referral_badge', 'exclusive_template', 'priority_support']
  },
  diamond: {
    requirement: 100,
    referralBonus: 100,
    subscriptionCommission: 0.25, // 25%
    perks: ['referral_badge', 'exclusive_template', 'priority_support', 'lifetime_pro']
  }
};
```

### Referral Processing
```typescript
class ReferralService {
  async processReferral(referralCode: string, newUserId: string): Promise<void> {
    // 1. Validate referral code
    const referrer = await this.getReferrerByCode(referralCode);
    if (!referrer) return;
    
    // 2. Check if user already referred
    const existing = await this.getReferralByUserId(newUserId);
    if (existing) return;
    
    // 3. Create referral record
    const referral = await this.createReferral({
      referrerId: referrer.userId,
      referredId: newUserId,
      referralCode,
      status: 'pending'
    });
    
    // 4. Award signup bonus
    await this.awardSignupBonus(referral);
    
    // 5. Track conversion funnel
    this.trackReferralEvent('signup', referral);
    
    // 6. Send welcome message
    await this.sendReferralWelcome(newUserId, referrer);
  }
  
  async completeReferralMilestone(
    userId: string, 
    milestone: 'first_game' | 'subscription'
  ): Promise<void> {
    const referral = await this.getReferralByUserId(userId);
    if (!referral || referral.status === 'completed') return;
    
    const rewards = {
      first_game: { referrerCredits: 20, milestone: 'first_game_at' },
      subscription: { referrerCredits: 100, milestone: 'subscribed_at' }
    };
    
    const reward = rewards[milestone];
    
    // Award credits
    await this.creditService.addCredits(
      referral.referrerId,
      reward.referrerCredits,
      `Referral ${milestone}: ${userId}`
    );
    
    // Update referral record
    await this.updateReferral(referral.id, {
      [reward.milestone]: new Date(),
      referrerCredits: { increment: reward.referrerCredits }
    });
    
    // Check for tier upgrade
    await this.checkReferralTierUpgrade(referral.referrerId);
    
    // Send notification
    await this.notifyReferralReward(referral.referrerId, milestone, reward.referrerCredits);
  }
}
```

## 3. Achievement System Specification

### Database Schema
```sql
-- Achievement definitions
CREATE TABLE achievements (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  emoji VARCHAR(10),
  
  -- Requirements
  requirement_type VARCHAR(50), -- 'count', 'milestone', 'special'
  requirement_value JSONB,
  
  -- Rewards
  credit_reward INTEGER DEFAULT 0,
  badge_id VARCHAR(50),
  unlocks JSONB, -- ['feature_name', 'template_id']
  
  -- Metadata
  rarity VARCHAR(20) DEFAULT 'common', -- common, rare, epic, legendary
  shareable BOOLEAN DEFAULT TRUE,
  active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User achievements
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  achievement_id VARCHAR(50) NOT NULL REFERENCES achievements(id),
  
  -- Progress tracking
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  shared_at TIMESTAMP WITH TIME ZONE,
  
  -- Stats
  share_count INTEGER DEFAULT 0,
  
  UNIQUE(user_id, achievement_id),
  INDEX idx_user_achievements (user_id, completed)
);
```

### Achievement Definitions
```typescript
const ACHIEVEMENTS = {
  // Creation achievements
  first_game: {
    id: 'first_game',
    name: 'Hello World',
    description: 'Create your first game',
    requirement: { type: 'count', target: 1, metric: 'games_created' },
    reward: { credits: 10 },
    emoji: '🎮'
  },
  
  prolific_creator: {
    id: 'prolific_creator',
    name: 'Prolific Creator',
    description: 'Create 50 games',
    requirement: { type: 'count', target: 50, metric: 'games_created' },
    reward: { credits: 100, badge: 'prolific_creator' },
    emoji: '🏭',
    rarity: 'rare'
  },
  
  // Viral achievements
  viral_sensation: {
    id: 'viral_sensation',
    name: 'Viral Sensation',
    description: 'Have a game reach 1000 plays',
    requirement: { type: 'milestone', target: 1000, metric: 'game_plays' },
    reward: { credits: 200, badge: 'viral_star' },
    emoji: '🔥',
    rarity: 'epic',
    shareable: true
  },
  
  // Social achievements
  social_butterfly: {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Share 10 games',
    requirement: { type: 'count', target: 10, metric: 'games_shared' },
    reward: { credits: 50 },
    emoji: '🦋'
  },
  
  // Special achievements
  early_adopter: {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'One of the first 1000 users',
    requirement: { type: 'special', condition: 'user_id <= 1000' },
    reward: { credits: 100, badge: 'og', unlocks: ['exclusive_template'] },
    emoji: '🌟',
    rarity: 'legendary'
  }
};
```

### Achievement Processing
```typescript
class AchievementService {
  async checkAchievements(userId: string, event: AchievementEvent): Promise<Achievement[]> {
    const unlocked: Achievement[] = [];
    const userStats = await this.getUserStats(userId);
    
    // Get relevant achievements for this event
    const relevantAchievements = this.getAchievementsForEvent(event.type);
    
    for (const achievement of relevantAchievements) {
      // Skip if already unlocked
      const progress = await this.getUserAchievementProgress(userId, achievement.id);
      if (progress?.completed) continue;
      
      // Check if requirements met
      if (this.checkRequirements(achievement, userStats, event)) {
        // Unlock achievement
        await this.unlockAchievement(userId, achievement);
        unlocked.push(achievement);
        
        // Award rewards
        await this.awardAchievementRewards(userId, achievement);
        
        // Create viral moment for rare achievements
        if (achievement.rarity === 'epic' || achievement.rarity === 'legendary') {
          await this.createViralAchievementMoment(userId, achievement);
        }
      } else {
        // Update progress
        await this.updateAchievementProgress(userId, achievement, event);
      }
    }
    
    return unlocked;
  }
  
  private async createViralAchievementMoment(userId: string, achievement: Achievement) {
    // Generate achievement image
    const imageUrl = await this.generateAchievementImage(userId, achievement);
    
    // Create shareable embed
    const embed = new EmbedBuilder()
      .setTitle(`${achievement.emoji} Achievement Unlocked!`)
      .setDescription(`**${username}** just unlocked **${achievement.name}**!`)
      .setImage(imageUrl)
      .setColor(this.getRarityColor(achievement.rarity))
      .setFooter({ text: 'Create your own games with GameVibe AI!' });
    
    // Broadcast to activity feeds
    await this.activityFeed.broadcast({
      type: 'achievement_unlocked',
      userId,
      achievement,
      embed
    });
    
    // Prompt user to share
    await this.promptAchievementShare(userId, achievement, imageUrl);
  }
}
```

## 4. Challenge System Specification

### Database Schema
```sql
-- Game challenges
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id),
  challenger_id VARCHAR(255) NOT NULL,
  
  -- Challenge details
  type VARCHAR(50) NOT NULL, -- '1v1', 'tournament', 'speedrun', 'high_score'
  title VARCHAR(200),
  description TEXT,
  
  -- Participants
  max_participants INTEGER DEFAULT 2,
  participants JSONB DEFAULT '[]', -- Array of participant objects
  
  -- Timing
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Rewards
  reward_credits INTEGER DEFAULT 0,
  reward_badge VARCHAR(50),
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, completed, cancelled
  winner_id VARCHAR(255),
  
  -- Metadata
  rules JSONB,
  scores JSONB DEFAULT '{}', -- userId -> score mapping
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  INDEX idx_active_challenges (status, ends_at),
  INDEX idx_game_challenges (game_id, created_at DESC)
);

-- Challenge participation
CREATE TABLE challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id),
  user_id VARCHAR(255) NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'invited', -- invited, accepted, declined, completed
  
  -- Performance
  score INTEGER,
  time_taken INTEGER, -- milliseconds
  attempts INTEGER DEFAULT 0,
  
  -- Timestamps
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(challenge_id, user_id)
);
```

### Challenge Types
```typescript
const CHALLENGE_TYPES = {
  '1v1': {
    name: 'Head to Head',
    maxParticipants: 2,
    duration: 24 * 60 * 60 * 1000, // 24 hours
    rewards: { winner: 20, participant: 5 }
  },
  
  tournament: {
    name: 'Tournament',
    maxParticipants: 16,
    duration: 7 * 24 * 60 * 60 * 1000, // 7 days
    rewards: { 
      winner: 100, 
      second: 50, 
      third: 25,
      participant: 10 
    }
  },
  
  speedrun: {
    name: 'Speedrun Challenge',
    maxParticipants: -1, // Unlimited
    duration: 3 * 24 * 60 * 60 * 1000, // 3 days
    rewards: { winner: 50, topTen: 20 }
  },
  
  high_score: {
    name: 'High Score Battle',
    maxParticipants: -1, // Unlimited
    duration: 7 * 24 * 60 * 60 * 1000, // 7 days
    rewards: { winner: 75, topFive: 30 }
  }
};
```

### Challenge Implementation
```typescript
class ChallengeService {
  async createChallenge(
    creatorId: string,
    gameId: string,
    type: ChallengeType,
    options: ChallengeOptions
  ): Promise<Challenge> {
    // 1. Validate challenge creation
    await this.validateChallengeCreation(creatorId, gameId, type);
    
    // 2. Create challenge
    const challenge = await this.prisma.challenge.create({
      data: {
        gameId,
        challengerId: creatorId,
        type,
        title: options.title || this.generateChallengeTitle(type, gameId),
        description: options.description,
        maxParticipants: CHALLENGE_TYPES[type].maxParticipants,
        endsAt: new Date(Date.now() + CHALLENGE_TYPES[type].duration),
        rewardCredits: CHALLENGE_TYPES[type].rewards.winner,
        rules: options.rules || this.getDefaultRules(type),
        participants: [{ userId: creatorId, status: 'accepted' }]
      }
    });
    
    // 3. Invite participants
    if (options.invitees) {
      await this.inviteParticipants(challenge.id, options.invitees);
    }
    
    // 4. Create viral moment
    await this.createChallengeLaunchEvent(challenge);
    
    // 5. Schedule completion check
    await this.scheduleCompletionCheck(challenge);
    
    return challenge;
  }
  
  async acceptChallenge(challengeId: string, userId: string): Promise<void> {
    const challenge = await this.getChallenge(challengeId);
    
    // Validate acceptance
    if (challenge.status !== 'pending' && challenge.status !== 'active') {
      throw new Error('Challenge is not accepting participants');
    }
    
    // Update participant status
    await this.updateParticipantStatus(challengeId, userId, 'accepted');
    
    // Check if challenge should start
    if (await this.shouldStartChallenge(challenge)) {
      await this.startChallenge(challengeId);
    }
    
    // Create viral moment
    await this.createChallengeAcceptedEvent(challenge, userId);
  }
  
  async submitChallengeScore(
    challengeId: string,
    userId: string,
    score: number,
    metadata?: any
  ): Promise<void> {
    const challenge = await this.getChallenge(challengeId);
    
    // Validate submission
    if (challenge.status !== 'active') {
      throw new Error('Challenge is not active');
    }
    
    // Update score
    await this.prisma.challenge.update({
      where: { id: challengeId },
      data: {
        scores: {
          ...challenge.scores,
          [userId]: Math.max(challenge.scores[userId] || 0, score)
        }
      }
    });
    
    // Update participant
    await this.updateParticipantScore(challengeId, userId, score);
    
    // Check if user is now winning
    const isWinning = await this.isUserWinning(challengeId, userId);
    if (isWinning) {
      await this.createNewLeaderEvent(challenge, userId, score);
    }
    
    // Check if challenge complete
    if (await this.isChallengeComplete(challengeId)) {
      await this.completeChallenge(challengeId);
    }
  }
}
```

## 5. Activity Feed Specification

### Real-time Event System
```typescript
interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  userId: string;
  serverId?: string;
  gameId?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

type ActivityEventType = 
  | 'game_created'
  | 'high_score'
  | 'achievement_unlocked'
  | 'challenge_created'
  | 'challenge_won'
  | 'viral_moment'
  | 'milestone_reached'
  | 'remix_created'
  | 'trending_game';

class ActivityFeedService {
  private readonly FEED_SIZE = 100;
  private readonly BROADCAST_INTERVAL = 1000; // 1 second
  
  private feedBuffer: ActivityEvent[] = [];
  private subscribers: Map<string, SubscriberConfig> = new Map();
  
  async broadcast(event: ActivityEvent): Promise<void> {
    // Add to buffer
    this.feedBuffer.push(event);
    
    // Trim buffer
    if (this.feedBuffer.length > this.FEED_SIZE) {
      this.feedBuffer = this.feedBuffer.slice(-this.FEED_SIZE);
    }
    
    // Format event
    const embed = this.formatEventEmbed(event);
    
    // Broadcast to subscribers
    for (const [channelId, config] of this.subscribers) {
      if (this.shouldBroadcastToChannel(event, config)) {
        await this.sendToChannel(channelId, embed, config);
      }
    }
    
    // Store in database
    await this.storeEvent(event);
    
    // Update statistics
    await this.updateServerStats(event);
  }
  
  private formatEventEmbed(event: ActivityEvent): EmbedBuilder {
    const formatters: Record<ActivityEventType, (e: ActivityEvent) => EmbedBuilder> = {
      game_created: (e) => new EmbedBuilder()
        .setColor('#10b981')
        .setDescription(`🎮 **${e.metadata.username}** created a new ${e.metadata.gameType} game!`)
        .addFields([
          { name: 'Game', value: e.metadata.gameTitle, inline: true },
          { name: 'Play Now', value: `[Click to Play](${e.metadata.gameUrl})`, inline: true }
        ]),
      
      high_score: (e) => new EmbedBuilder()
        .setColor('#f59e0b')
        .setDescription(`🏆 **${e.metadata.username}** set a new high score!`)
        .addFields([
          { name: 'Game', value: e.metadata.gameTitle, inline: true },
          { name: 'Score', value: formatNumber(e.metadata.score), inline: true },
          { name: 'Previous Best', value: formatNumber(e.metadata.previousBest), inline: true }
        ]),
      
      achievement_unlocked: (e) => new EmbedBuilder()
        .setColor(this.getRarityColor(e.metadata.rarity))
        .setDescription(`${e.metadata.emoji} **${e.metadata.username}** unlocked **${e.metadata.achievementName}**!`)
        .setThumbnail(e.metadata.badgeUrl)
        .setFooter({ text: `${e.metadata.rarity} achievement • ${e.metadata.percentUnlocked}% have this` }),
      
      viral_moment: (e) => new EmbedBuilder()
        .setColor('#ec4899')
        .setDescription(`🔥 **${e.metadata.gameTitle}** is going viral!`)
        .addFields([
          { name: 'Plays', value: formatNumber(e.metadata.playCount), inline: true },
          { name: 'Shares', value: formatNumber(e.metadata.shareCount), inline: true },
          { name: 'Trending Rank', value: `#${e.metadata.rank}`, inline: true }
        ])
    };
    
    return formatters[event.type]?.(event) || this.defaultFormatter(event);
  }
}
```

## 6. Viral Analytics Specification

### Metrics Tracking
```typescript
interface ViralMetrics {
  // Core viral metrics
  viralCoefficient: number;      // K = new users / existing users
  viralCycleTime: number;        // Average time for viral loop
  
  // Engagement metrics
  shareRate: number;             // % of users who share
  playFromShareRate: number;     // % of share recipients who play
  createFromPlayRate: number;    // % of players who create games
  
  // Conversion metrics
  referralSignupRate: number;    // % of referral clicks that sign up
  referralSubscribeRate: number; // % of referrals that subscribe
  
  // Growth metrics
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  userGrowthRate: number;
  
  // Content metrics
  gamesCreatedDaily: number;
  avgPlaysPerGame: number;
  avgSharesPerGame: number;
  viralGamesCount: number;       // Games with 1000+ plays
}

class ViralAnalyticsService {
  async calculateViralCoefficient(timeframe: Timeframe): Promise<number> {
    const period = this.getTimeframeBounds(timeframe);
    
    // Get new users from referrals/shares
    const newUsersFromViral = await this.prisma.user.count({
      where: {
        createdAt: { gte: period.start, lte: period.end },
        OR: [
          { referralCode: { not: null } },
          { firstGameFromShare: true }
        ]
      }
    });
    
    // Get active users who shared/referred
    const activeSharers = await this.prisma.gameShare.groupBy({
      by: ['sharerId'],
      where: {
        createdAt: { gte: period.start, lte: period.end },
        conversionCount: { gt: 0 }
      }
    });
    
    const k = newUsersFromViral / activeSharers.length;
    
    return Math.round(k * 100) / 100;
  }
  
  async trackViralEvent(event: ViralEvent): Promise<void> {
    // Store event
    await this.prisma.viralEvent.create({
      data: {
        type: event.type,
        userId: event.userId,
        metadata: event.metadata,
        viralScore: this.calculateViralScore(event),
        timestamp: new Date()
      }
    });
    
    // Update real-time metrics
    await this.updateRealtimeMetrics(event);
    
    // Check for viral triggers
    await this.checkViralTriggers(event);
  }
  
  private calculateViralScore(event: ViralEvent): number {
    // Base scores for different actions
    const baseScores = {
      share: 1,
      play_from_share: 2,
      create_from_share: 5,
      referral_signup: 10,
      referral_subscribe: 20,
      viral_game_created: 50
    };
    
    // Multipliers
    const multipliers = [];
    
    // Time-based multiplier (reward quick actions)
    if (event.metadata.timeSinceExposure < 3600) { // Within 1 hour
      multipliers.push(2);
    }
    
    // Network size multiplier
    if (event.metadata.userNetworkSize > 1000) {
      multipliers.push(1.5);
    }
    
    // Quality multiplier
    if (event.metadata.gameRating > 4.5) {
      multipliers.push(1.3);
    }
    
    const baseScore = baseScores[event.type] || 1;
    const totalMultiplier = multipliers.reduce((a, b) => a * b, 1);
    
    return Math.round(baseScore * totalMultiplier);
  }
  
  async generateViralReport(): Promise<ViralReport> {
    const metrics = await this.getCurrentMetrics();
    
    return {
      summary: {
        viralCoefficient: metrics.viralCoefficient,
        status: this.getViralStatus(metrics.viralCoefficient),
        growth: this.calculateGrowthProjection(metrics)
      },
      
      recommendations: this.generateRecommendations(metrics),
      
      topPerformers: {
        games: await this.getTopViralGames(),
        creators: await this.getTopViralCreators(),
        referrers: await this.getTopReferrers()
      },
      
      experiments: await this.getActiveExperiments(),
      
      alerts: await this.checkViralAlerts(metrics)
    };
  }
}
```

## 7. Implementation Checklist

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema migrations
- [ ] Share tracking infrastructure
- [ ] Basic share command
- [ ] Referral code generation
- [ ] Achievement definitions
- [ ] Activity feed setup

### Phase 2: Core Features (Week 3-4)
- [ ] Share analytics
- [ ] Referral rewards
- [ ] Achievement unlocking
- [ ] Challenge system
- [ ] Social proof display
- [ ] Viral notifications

### Phase 3: Optimization (Week 5-6)
- [ ] A/B testing framework
- [ ] Viral coefficient tracking
- [ ] Performance optimization
- [ ] External platform integration
- [ ] Analytics dashboard
- [ ] Growth experiments

---

*For implementation examples, see `docs/growth-hacking-implementation.md`*