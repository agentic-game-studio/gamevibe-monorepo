# 💎 Personal Credits Implementation Guide

## Overview

GameVibe AI already has a credit system for AI model access tied to subscription tiers. This document describes the **Personal Credit System** - a complementary system where users earn credits through content creation and engagement.

## 🔄 Two Credit Systems Working Together

### 1. **Subscription Credits** (Existing)
- Tied to server subscription tier
- Monthly allocation (FREE: 0, STARTER: $5, PRO: $20, ENTERPRISE: $100)
- Used for AI model access
- Rollover based on tier

### 2. **Personal Credits** (New)
- Tied to individual users
- Earned through viral content and engagement
- Work across ALL servers
- Can be used even in FREE tier servers

**Both systems use the SAME credit pool** - users can spend either type for AI models.

## 📊 Database Schema

```sql
-- Personal credits balance (separate from subscription credits)
CREATE TABLE user_personal_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Balance tracking
  balance INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  
  -- Creator tier based on total earned
  creator_tier VARCHAR(20) DEFAULT 'bronze', -- bronze, silver, gold, diamond
  tier_upgraded_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_credits (user_id),
  INDEX idx_creator_tier (creator_tier)
);

-- Credit earning history
CREATE TABLE personal_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Transaction details
  type VARCHAR(20) NOT NULL, -- 'earned', 'spent', 'expired'
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  
  -- Earning reason (for earned type)
  earning_reason VARCHAR(50), -- 'game_plays', 'cross_server', 'server_referral', etc
  earning_metadata JSONB,
  
  -- Spending details (for spent type)
  spent_on VARCHAR(50), -- 'ai_model', 'premium_template', etc
  server_id VARCHAR(255), -- Where credits were spent
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_transactions (user_id, created_at DESC),
  INDEX idx_earning_reason (earning_reason)
);

-- Server referral tracking
CREATE TABLE server_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id VARCHAR(255) NOT NULL,
  server_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Referral details
  referral_code VARCHAR(20),
  installed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  subscribed_at TIMESTAMP WITH TIME ZONE,
  subscription_tier VARCHAR(20),
  
  -- Rewards tracking
  initial_reward INTEGER DEFAULT 0,
  monthly_commission_rate DECIMAL(3,2) DEFAULT 0.10, -- 10%
  total_commission_earned INTEGER DEFAULT 0,
  
  INDEX idx_referrer (referrer_id),
  INDEX idx_referral_code (referral_code)
);

-- Cross-server game tracking
CREATE TABLE game_server_reach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL,
  server_id VARCHAR(255) NOT NULL,
  
  -- Metrics
  play_count INTEGER DEFAULT 0,
  unique_players INTEGER DEFAULT 0,
  first_played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_played_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(game_id, server_id),
  INDEX idx_game_reach (game_id)
);
```

## 🎮 Implementation

### Enhanced Credit Service
```typescript
// Extend existing CreditService
export class EnhancedCreditService extends CreditService {
  async getCombinedBalance(userId: string, serverId: string): Promise<CreditBalance> {
    // Get subscription credits (existing)
    const subscriptionCredits = await super.getCreditBalance(userId, serverId);
    
    // Get personal credits (new)
    const personalCredits = await this.getPersonalCredits(userId);
    
    // Combine balances
    return {
      subscriptionCredits: subscriptionCredits.availableCredits,
      personalCredits: personalCredits.balance,
      totalAvailable: subscriptionCredits.availableCredits + personalCredits.balance,
      tier: subscriptionCredits.tier,
      creatorTier: personalCredits.creatorTier,
      nextReset: subscriptionCredits.nextReset
    };
  }
  
  async deductCredits(
    userId: string, 
    serverId: string, 
    amount: number,
    reason: string
  ): Promise<void> {
    const balance = await this.getCombinedBalance(userId, serverId);
    
    if (balance.totalAvailable < amount) {
      throw new InsufficientCreditsError();
    }
    
    // Deduct from subscription credits first
    let remainingToDeduct = amount;
    if (balance.subscriptionCredits > 0) {
      const subDeduction = Math.min(balance.subscriptionCredits, remainingToDeduct);
      await super.deductCredits(userId, serverId, subDeduction, reason);
      remainingToDeduct -= subDeduction;
    }
    
    // Then deduct from personal credits
    if (remainingToDeduct > 0) {
      await this.deductPersonalCredits(userId, remainingToDeduct, reason, serverId);
    }
  }
}
```

### Earning Credits Implementation
```typescript
interface EarningRules {
  game_plays: {
    per: 10,      // Every 10 plays
    reward: 1,    // Earn 1 credit
    daily_cap: 100
  },
  viral_game: {
    thresholds: [
      { plays: 100, reward: 10 },
      { plays: 1000, reward: 100 },
      { plays: 10000, reward: 1000 }
    ]
  },
  cross_server: {
    servers: 5,
    reward: 50,
    additional_per_server: 5
  },
  server_referral: {
    install: 100,
    subscribe: {
      starter: 500,
      pro: 1000,
      enterprise: 2500
    }
  },
  engagement_boost: {
    threshold: 0.5, // 50% increase
    reward: 200
  }
}

export class PersonalCreditEarningService {
  async processGamePlay(gameId: string, serverId: string): Promise<void> {
    const game = await this.getGame(gameId);
    const playCount = await this.incrementPlayCount(gameId);
    
    // Check play count milestones
    if (playCount % 10 === 0) {
      await this.earnCredits(
        game.creatorId,
        1,
        'game_plays',
        { gameId, playCount }
      );
    }
    
    // Check viral thresholds
    for (const threshold of EarningRules.viral_game.thresholds) {
      if (playCount === threshold.plays) {
        await this.earnCredits(
          game.creatorId,
          threshold.reward,
          'viral_game',
          { gameId, milestone: threshold.plays }
        );
        
        // Create viral moment
        await this.createViralAchievement(game, threshold.plays);
      }
    }
    
    // Check cross-server reach
    await this.checkCrossServerReach(gameId, serverId);
  }
  
  private async checkCrossServerReach(gameId: string, newServerId: string): Promise<void> {
    // Track game in new server
    await this.prisma.gameServerReach.upsert({
      where: { gameId_serverId: { gameId, serverId: newServerId } },
      create: { gameId, serverId: newServerId, playCount: 1 },
      update: { playCount: { increment: 1 } }
    });
    
    // Count servers
    const serverCount = await this.prisma.gameServerReach.count({
      where: { gameId }
    });
    
    // Reward at milestones
    if (serverCount === 5) {
      const game = await this.getGame(gameId);
      await this.earnCredits(
        game.creatorId,
        50,
        'cross_server',
        { gameId, serverCount: 5 }
      );
    } else if (serverCount > 5 && serverCount % 10 === 0) {
      const game = await this.getGame(gameId);
      await this.earnCredits(
        game.creatorId,
        50,
        'cross_server_bonus',
        { gameId, serverCount }
      );
    }
  }
}
```

### Creator Tier System
```typescript
const CREATOR_TIERS = {
  bronze: {
    threshold: 0,
    earning_multiplier: 1.0,
    perks: []
  },
  silver: {
    threshold: 1000,
    earning_multiplier: 1.1, // 10% bonus
    perks: ['exclusive_template_1', 'priority_queue']
  },
  gold: {
    threshold: 10000,
    earning_multiplier: 1.25, // 25% bonus
    perks: ['exclusive_template_1', 'exclusive_template_2', 'priority_queue', 'custom_branding']
  },
  diamond: {
    threshold: 100000,
    earning_multiplier: 1.5, // 50% bonus
    perks: ['all_exclusive_templates', 'priority_queue', 'custom_branding', 'early_access']
  }
};

export class CreatorTierService {
  async checkTierUpgrade(userId: string): Promise<void> {
    const credits = await this.getUserPersonalCredits(userId);
    const currentTier = credits.creatorTier;
    
    // Find new tier based on total earned
    let newTier = 'bronze';
    for (const [tier, config] of Object.entries(CREATOR_TIERS)) {
      if (credits.totalEarned >= config.threshold) {
        newTier = tier;
      }
    }
    
    // Upgrade if needed
    if (newTier !== currentTier && this.isTierHigher(newTier, currentTier)) {
      await this.upgradeTier(userId, newTier);
      await this.notifyTierUpgrade(userId, currentTier, newTier);
      
      // Award bonus credits
      const bonusCredits = {
        silver: 100,
        gold: 500,
        diamond: 2000
      };
      
      if (bonusCredits[newTier]) {
        await this.earnCredits(userId, bonusCredits[newTier], 'tier_upgrade_bonus');
      }
    }
  }
}
```

### Discord Commands Update
```typescript
// Update existing /credits command
export class EnhancedCreditsCommand extends CreditsCommand {
  async showCreditBalance(interaction: CommandInteraction): Promise<void> {
    const balance = await this.creditService.getCombinedBalance(
      interaction.user.id,
      interaction.guildId!
    );
    
    const embed = new EmbedBuilder()
      .setTitle('💎 Your Credits')
      .setDescription('Subscription and personal credits combined')
      .addFields([
        {
          name: '💳 Subscription Credits',
          value: `${balance.subscriptionCredits.toLocaleString()} credits`,
          inline: true
        },
        {
          name: '⭐ Personal Credits',
          value: `${balance.personalCredits.toLocaleString()} credits`,
          inline: true
        },
        {
          name: '💰 Total Available',
          value: `**${balance.totalAvailable.toLocaleString()}** credits`,
          inline: true
        },
        {
          name: '🎯 Subscription Tier',
          value: this.formatTier(balance.tier),
          inline: true
        },
        {
          name: '🏆 Creator Tier',
          value: this.formatCreatorTier(balance.creatorTier),
          inline: true
        },
        {
          name: '📈 Earning Multiplier',
          value: `${CREATOR_TIERS[balance.creatorTier].earning_multiplier}x`,
          inline: true
        }
      ]);
    
    // Add earning opportunities
    embed.addFields([{
      name: '💡 How to Earn Personal Credits',
      value: [
        '• Create games that get played (1 credit/10 plays)',
        '• Reach viral milestones (10-1000 credits)',
        '• Spread games across servers (50+ credits)',
        '• Refer new servers (100-2500 credits)',
        '• Win challenges (20+ credits)'
      ].join('\n')
    }]);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

// New command: /creator-stats
export class CreatorStatsCommand {
  async execute(interaction: CommandInteraction): Promise<void> {
    const stats = await this.getCreatorStats(interaction.user.id);
    
    const embed = new EmbedBuilder()
      .setTitle('🏆 Your Creator Statistics')
      .setDescription(`Creator Tier: **${stats.tier}**`)
      .addFields([
        {
          name: '🎮 Games Created',
          value: stats.gamesCreated.toString(),
          inline: true
        },
        {
          name: '👥 Total Plays',
          value: formatNumber(stats.totalPlays),
          inline: true
        },
        {
          name: '🌍 Servers Reached',
          value: stats.serversReached.toString(),
          inline: true
        },
        {
          name: '💎 Credits Earned',
          value: formatNumber(stats.creditsEarned),
          inline: true
        },
        {
          name: '🔥 Viral Games',
          value: stats.viralGames.toString(),
          inline: true
        },
        {
          name: '🏰 Servers Referred',
          value: stats.serversReferred.toString(),
          inline: true
        }
      ]);
    
    // Add top games
    if (stats.topGames.length > 0) {
      embed.addFields([{
        name: '🎯 Your Top Games',
        value: stats.topGames
          .slice(0, 3)
          .map((g, i) => `${i + 1}. **${g.title}** - ${formatNumber(g.plays)} plays`)
          .join('\n')
      }]);
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
```

## 🚀 Migration Strategy

### Phase 1: Add Personal Credits (No Breaking Changes)
1. Deploy new tables
2. Add personal credit tracking
3. Update UI to show combined balances
4. Start earning system

### Phase 2: Integrate with Existing System
1. Update credit deduction logic
2. Add personal credits to all credit checks
3. Update analytics to track both types

### Phase 3: Launch Creator Economy
1. Enable earning rules
2. Launch creator tiers
3. Add leaderboards
4. Promote to users

## 📊 Analytics & Monitoring

```typescript
interface PersonalCreditMetrics {
  // User metrics
  activeEarners: number;          // Users who earned this month
  averageBalance: number;         // Average personal credit balance
  totalCirculation: number;       // Total personal credits in system
  
  // Earning metrics
  creditsEarnedDaily: number;
  topEarningReasons: Map<string, number>;
  viralGamesCount: number;
  
  // Spending metrics
  personalCreditsSpent: number;
  spendingByServer: Map<string, number>;
  modelUsageByCredits: Map<string, number>;
  
  // Economic health
  earnToSpendRatio: number;      // Should be ~1.0 for balance
  inflationRate: number;          // Credit supply growth
  tierDistribution: Map<string, number>;
}
```

---

**Key Implementation Notes**:
1. Personal credits are ADDITIONAL to subscription credits
2. Both types can be used for the same purposes
3. Deduction prioritizes subscription credits first
4. Personal credits never expire
5. Creator tiers are permanent achievements