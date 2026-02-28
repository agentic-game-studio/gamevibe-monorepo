# 🛠️ Growth Hacking Implementation Guide

## Technical Implementation for Viral Features

### 1. Game Sharing System Implementation

#### Database Schema Updates
```prisma
model GameShare {
  id              String   @id @default(cuid())
  gameId          String
  sharedById      String
  sharedToChannel String?
  sharedToServer  String?
  platform        String   // discord, twitter, embed
  clickCount      Int      @default(0)
  playCount       Int      @default(0)
  conversionCount Int      @default(0)
  createdAt       DateTime @default(now())
  
  game            Game     @relation(fields: [gameId], references: [id])
  
  @@index([gameId, platform])
  @@index([sharedById])
}

model ViralMetrics {
  id              String   @id @default(cuid())
  userId          String
  referralCode    String   @unique
  totalShares     Int      @default(0)
  totalClicks     Int      @default(0)
  totalConversions Int     @default(0)
  creditsEarned   Int      @default(0)
  tier            String   @default("bronze")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([userId])
  @@index([referralCode])
}
```

#### Share Command Implementation
```typescript
// packages/bot/src/commands/share-game.ts
@injectable()
export class ShareGameCommand {
  async execute(interaction: CommandInteraction): Promise<void> {
    const gameId = interaction.options.getString('game_id', true);
    
    // Generate shareable link with tracking
    const shareCode = await this.generateShareCode(interaction.user.id, gameId);
    const shareUrl = `${process.env.WEB_RUNTIME_URL}/play/${gameId}?ref=${shareCode}`;
    
    // Create viral embed
    const embed = new EmbedBuilder()
      .setTitle('🎮 ' + game.title)
      .setDescription(game.description)
      .setImage(game.thumbnailUrl)
      .addFields([
        { name: '👥 Players', value: formatNumber(game.playCount), inline: true },
        { name: '⭐ Rating', value: `${game.rating}/5`, inline: true },
        { name: '🏆 High Score', value: formatNumber(game.highScore), inline: true }
      ])
      .setFooter({ text: `Created by ${game.creator.username} • Click to Play!` });
    
    // Add viral CTAs
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Play Now')
          .setStyle(ButtonStyle.Link)
          .setURL(shareUrl)
          .setEmoji('🎮'),
        new ButtonBuilder()
          .setLabel('Remix This Game')
          .setStyle(ButtonStyle.Primary)
          .setCustomId(`remix:${gameId}`)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setLabel('Challenge Friends')
          .setStyle(ButtonStyle.Secondary)
          .setCustomId(`challenge:${gameId}`)
          .setEmoji('⚔️')
      );
    
    // Track share
    await this.trackShare(interaction.user.id, gameId, 'discord');
    
    // Auto-crosspost to connected channels
    if (game.viralSettings.autoCrosspost) {
      await this.crosspostToChannels(embed, row, interaction.guild!);
    }
    
    await interaction.reply({ embeds: [embed], components: [row] });
  }
}
```

### 2. Creator Rewards Implementation (Server-Based Model)

#### Personal Credit Service
```typescript
// packages/bot/src/services/personal-credits.ts
@injectable()
export class PersonalCreditService {
  // Personal credits work across ALL servers
  async getPersonalCredits(userId: string): Promise<PersonalCredits> {
    const credits = await this.prisma.userCredits.findUnique({
      where: { userId }
    });
    
    return {
      available: credits?.balance || 0,
      tier: this.calculateTier(credits?.totalEarned || 0),
      perks: this.getTierPerks(credits?.tier),
      serversActive: await this.getActiveServers(userId)
    };
  }
  
  async earnCredits(
    userId: string,
    amount: number,
    reason: EarnReason,
    metadata?: any
  ): Promise<void> {
    // Personal credits earned by user actions
    await this.prisma.userCredits.upsert({
      where: { userId },
      create: {
        userId,
        balance: amount,
        totalEarned: amount,
        tier: 'bronze'
      },
      update: {
        balance: { increment: amount },
        totalEarned: { increment: amount }
      }
    });
    
    // Check for tier upgrade
    await this.checkTierUpgrade(userId);
    
    // Track earning event
    await this.trackEarning(userId, amount, reason, metadata);
  }
}

// Server referral service (not user referrals)
@injectable()
export class ServerReferralService {
  async processServerReferral(
    referrerId: string,
    newServerId: string,
    subscriptionTier: string
  ): Promise<void> {
    // Massive rewards for bringing new SERVERS
    const rewards = {
      starter: 500,
      pro: 1000,
      enterprise: 2500
    };
    
    const creditsAwarded = rewards[subscriptionTier] || 0;
    
    // Award personal credits to referrer
    await this.personalCreditService.earnCredits(
      referrerId,
      creditsAwarded,
      'server_referral',
      { serverId: newServerId, tier: subscriptionTier }
    );
    
    // Set up recurring commission (10% monthly)
    await this.setupRecurringCommission(referrerId, newServerId, 0.10);
    
    // Track server referral
    await this.trackServerReferral(referrerId, newServerId);
  }
}
```

### 3. Viral Game Mechanics

#### Challenge System
```typescript
// packages/bot/src/services/challenge.ts
@injectable()
export class ChallengeService {
  async createChallenge(
    challengerId: string,
    gameId: string,
    targetUsers: string[]
  ): Promise<Challenge> {
    const challenge = await this.prisma.challenge.create({
      data: {
        gameId,
        challengerId,
        targetUsers,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        rewards: {
          winner: 20, // credits
          participants: 5
        }
      }
    });
    
    // Send challenge notifications
    for (const userId of targetUsers) {
      await this.sendChallengeNotification(userId, challenge);
    }
    
    // Create viral moment
    await this.createViralMoment('challenge_created', {
      challengerId,
      gameId,
      playerCount: targetUsers.length
    });
    
    return challenge;
  }
  
  async completeChallenge(
    challengeId: string,
    userId: string,
    score: number
  ): Promise<void> {
    const challenge = await this.getChallenge(challengeId);
    
    // Update scores
    await this.updateChallengeScore(challengeId, userId, score);
    
    // Check if challenge complete
    if (await this.isChallengeComplete(challengeId)) {
      const results = await this.calculateResults(challengeId);
      
      // Award rewards
      await this.awardChallengeRewards(results);
      
      // Create viral moment
      await this.createViralMoment('challenge_completed', {
        winner: results.winner,
        gameId: challenge.gameId,
        totalPlayers: results.participants.length
      });
      
      // Prompt rematch
      await this.promptRematch(challenge, results);
    }
  }
}
```

### 4. Social Proof Implementation

#### Activity Feed Service
```typescript
// packages/bot/src/services/activity-feed.ts
@injectable()
export class ActivityFeedService {
  private activities: Activity[] = [];
  private subscribers: Set<string> = new Set();
  
  async broadcast(activity: Activity): Promise<void> {
    // Add to feed
    this.activities.unshift(activity);
    this.activities = this.activities.slice(0, 100); // Keep last 100
    
    // Format activity message
    const message = this.formatActivity(activity);
    
    // Broadcast to subscribed channels
    for (const channelId of this.subscribers) {
      try {
        const channel = await this.client.channels.fetch(channelId);
        if (channel?.isTextBased()) {
          await channel.send({
            embeds: [this.createActivityEmbed(activity)],
            flags: MessageFlags.SuppressNotifications
          });
        }
      } catch (error) {
        // Remove invalid channels
        this.subscribers.delete(channelId);
      }
    }
    
    // Update server stats
    await this.updateServerStats(activity);
  }
  
  private createActivityEmbed(activity: Activity): EmbedBuilder {
    const emojis = {
      game_created: '🎮',
      high_score: '🏆',
      remix_created: '🔄',
      challenge_won: '⚔️',
      milestone_reached: '🎯',
      trending_game: '🔥'
    };
    
    return new EmbedBuilder()
      .setColor(this.getActivityColor(activity.type))
      .setDescription(
        `${emojis[activity.type]} **${activity.user.username}** ${activity.description}`
      )
      .setTimestamp()
      .setFooter({ text: `${activity.serverName} • ${activity.gameCount} games created today` });
  }
}
```

### 5. Gamification System

#### Achievement Service
```typescript
// packages/bot/src/services/achievements.ts
@injectable()
export class AchievementService {
  private readonly achievements = {
    first_game: {
      id: 'first_game',
      name: 'Game Creator',
      description: 'Create your first game',
      emoji: '🎮',
      credits: 10,
      shareable: true
    },
    viral_hit: {
      id: 'viral_hit',
      name: 'Viral Sensation',
      description: 'Your game reached 1000 plays',
      emoji: '🔥',
      credits: 100,
      shareable: true,
      rare: true
    },
    remix_master: {
      id: 'remix_master',
      name: 'Remix Master',
      description: 'Create 10 successful remixes',
      emoji: '🔄',
      credits: 50,
      unlocks: ['special_template']
    }
    // ... more achievements
  };
  
  async checkAchievements(userId: string, context: any): Promise<Achievement[]> {
    const unlocked: Achievement[] = [];
    const userStats = await this.getUserStats(userId);
    
    for (const [id, achievement] of Object.entries(this.achievements)) {
      if (await this.isAchievementUnlocked(userId, id)) continue;
      
      if (this.checkCondition(achievement, userStats, context)) {
        await this.unlockAchievement(userId, achievement);
        unlocked.push(achievement);
      }
    }
    
    // Create viral moments for rare achievements
    for (const achievement of unlocked.filter(a => a.rare)) {
      await this.createViralAchievementMoment(userId, achievement);
    }
    
    return unlocked;
  }
  
  private async createViralAchievementMoment(
    userId: string, 
    achievement: Achievement
  ): Promise<void> {
    // Broadcast to activity feed
    await this.activityFeed.broadcast({
      type: 'rare_achievement',
      user: { id: userId },
      description: `unlocked the rare achievement **${achievement.name}**!`,
      achievement
    });
    
    // Create shareable image
    const shareImage = await this.generateAchievementImage(userId, achievement);
    
    // Auto-share option
    await this.promptAchievementShare(userId, achievement, shareImage);
  }
}
```

### 6. Analytics & Optimization

#### Viral Analytics Service
```typescript
// packages/bot/src/services/viral-analytics.ts
@injectable()
export class ViralAnalyticsService {
  async trackViralEvent(event: ViralEvent): Promise<void> {
    // Real-time tracking
    await this.prisma.viralEvent.create({
      data: {
        type: event.type,
        userId: event.userId,
        metadata: event.metadata,
        viralScore: this.calculateViralScore(event)
      }
    });
    
    // Update viral coefficient
    await this.updateViralCoefficient(event.userId);
    
    // Check for viral triggers
    await this.checkViralTriggers(event);
  }
  
  private calculateViralScore(event: ViralEvent): number {
    const weights = {
      share: 1,
      play_from_share: 2,
      remix: 3,
      challenge_accepted: 4,
      new_user_from_referral: 10
    };
    
    const baseScore = weights[event.type] || 1;
    const multipliers = this.getMultipliers(event);
    
    return baseScore * multipliers.reduce((a, b) => a * b, 1);
  }
  
  async getViralCoefficient(timeframe: 'day' | 'week' | 'month'): Promise<number> {
    const metrics = await this.prisma.viralMetrics.aggregate({
      where: {
        createdAt: { gte: this.getTimeframeStart(timeframe) }
      },
      _sum: {
        totalShares: true,
        totalConversions: true
      }
    });
    
    const k = metrics._sum.totalConversions! / metrics._sum.totalShares!;
    return Math.round(k * 100) / 100;
  }
}
```

### 7. External Distribution

#### SEO Service
```typescript
// packages/web-runtime/src/services/seo.ts
export class SEOService {
  generateGamePage(game: Game): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>${game.title} - Play on GameVibe AI</title>
  <meta name="description" content="${game.description}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${game.title}">
  <meta property="og:description" content="${game.description}">
  <meta property="og:image" content="${game.thumbnailUrl}">
  <meta property="og:type" content="game">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${game.title}">
  <meta name="twitter:image" content="${game.thumbnailUrl}">
  
  <!-- Game Metadata -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": "${game.title}",
    "description": "${game.description}",
    "creator": {
      "@type": "Person",
      "name": "${game.creator.username}"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "${game.rating}",
      "ratingCount": "${game.ratingCount}"
    },
    "interactionStatistic": {
      "@type": "InteractionCounter",
      "interactionType": "https://schema.org/PlayAction",
      "userInteractionCount": "${game.playCount}"
    }
  }
  </script>
</head>
<body>
  <!-- Game embed with viral CTAs -->
  <div id="game-container">
    <iframe src="/embed/${game.id}" frameborder="0"></iframe>
  </div>
  
  <div class="viral-actions">
    <button onclick="shareGame()">Share This Game</button>
    <button onclick="remixGame()">Create Your Own Version</button>
    <button onclick="joinDiscord()">Play More Games on Discord</button>
  </div>
  
  <!-- Analytics -->
  <script>
    gtag('event', 'page_view', {
      game_id: '${game.id}',
      referrer: new URLSearchParams(window.location.search).get('ref')
    });
  </script>
</body>
</html>
    `;
  }
}
```

## 🚀 Quick Implementation Checklist

### Week 1
- [ ] Add share tracking to database schema
- [ ] Implement basic share command
- [ ] Create referral code generation
- [ ] Add play count display
- [ ] Set up activity feed infrastructure

### Week 2
- [ ] Implement achievement system
- [ ] Create challenge mechanics
- [ ] Add viral analytics tracking
- [ ] Launch referral rewards
- [ ] Set up SEO pages

### Week 3
- [ ] Release social proof features
- [ ] Implement tier upgrades
- [ ] Add cross-posting functionality
- [ ] Create shareable badges
- [ ] Launch first viral event

### Week 4
- [ ] Full viral loop optimization
- [ ] A/B testing framework
- [ ] External platform integration
- [ ] Content creator tools
- [ ] Performance optimization

## 📊 Success Metrics

```typescript
interface ViralMetrics {
  viralCoefficient: number;      // Target: 1.2+
  shareRate: number;             // Target: 30%+
  playFromShareRate: number;     // Target: 50%+
  referralConversionRate: number;// Target: 15%+
  avgSharesPerGame: number;      // Target: 5+
  viralCycleTime: number;        // Target: <48 hours
}
```

---

*Implementation time: 4-6 weeks for full viral system*