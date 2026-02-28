# 🚀 Viral Growth MVP - 2 Week Sprint Plan

## Goal: Implement Core Viral Loop in 14 Days

### 🎯 MVP Scope
Implement the **minimum viable viral features** to validate growth hypothesis and achieve initial viral coefficient of 1.1+

## Week 1: Core Viral Infrastructure

### Day 1-2: Share Command & Tracking
```typescript
// Simple share command with tracking
/share-game [game-id]
```
- [ ] Add `game_shares` table to track sharing
- [ ] Implement basic `/share-game` command
- [ ] Generate trackable share links with `?ref=` parameter
- [ ] Add share button to game complete screen
- [ ] Track: shares, clicks, plays from shares

### Day 3-4: Play Count & Social Proof
- [ ] Display play count on all game embeds
- [ ] Add "🔥 Trending" badge for games with 50+ plays
- [ ] Show "X players online now" for active games
- [ ] Create game showcase channel template
- [ ] Auto-update game embeds with live stats

### Day 5-7: Personal Credits & Creator Rewards
```typescript
// Personal credit system (works across all servers)
/my-credits
/creator-stats
```
- [ ] Create personal credit balance system
- [ ] Track credits earned from game plays
- [ ] Award 1 credit per 10 plays
- [ ] Award 50 credits for cross-server virality
- [ ] Display creator tier in profile

## Week 2: Amplification & Optimization

### Day 8-9: Achievement Notifications
```typescript
// Viral moments in chat
"🎮 John just created their first game!"
"🔥 Space Blaster reached 100 plays!"
"🏆 New high score in Ninja Run!"
```
- [ ] Create achievement milestones
- [ ] Broadcast achievements to game channel
- [ ] Add opt-in server activity feed
- [ ] Include "Try it yourself" CTAs

### Day 10-11: Challenge System MVP
```typescript
/challenge @user [game-id]
```
- [ ] Simple 1v1 challenge command
- [ ] 24-hour challenge duration
- [ ] Winner gets 10 credits
- [ ] Auto-notify challenged users
- [ ] Share challenge results

### Day 12-13: Quick Wins
- [ ] Add Discord presence ("Playing GameVibe AI")
- [ ] Create "Game of the Day" auto-selection
- [ ] Implement streak system (daily game creation)
- [ ] Add invite rewards (5 credits per server invite)
- [ ] Launch first community challenge

### Day 14: Measurement & Optimization
- [ ] Set up viral analytics dashboard
- [ ] Calculate initial viral coefficient
- [ ] A/B test share message formats
- [ ] Gather user feedback
- [ ] Plan next sprint based on data

## 📊 Success Metrics

### Primary KPIs (Week 1)
- Share rate: 10%+ of game creators share
- Click rate: 30%+ of share recipients click
- Conversion: 5%+ of clickers create games

### Secondary KPIs (Week 2)
- Viral coefficient: 1.1+ (each user brings 1.1 new users)
- Referral adoption: 20%+ users use referral system
- Challenge acceptance: 40%+ accept challenges

## 🛠️ Technical Requirements

### Database Migrations
```sql
-- Viral tracking
CREATE TABLE game_shares (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL,
  sharer_id VARCHAR(255) NOT NULL,
  share_code VARCHAR(20) UNIQUE,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referral system
CREATE TABLE referrals (
  id UUID PRIMARY KEY,
  referrer_id VARCHAR(255) NOT NULL,
  referral_code VARCHAR(10) UNIQUE,
  referred_users JSONB DEFAULT '[]',
  credits_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Viral events
CREATE TABLE viral_events (
  id UUID PRIMARY KEY,
  event_type VARCHAR(50),
  user_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_viral_events_user ON viral_events(user_id);
CREATE INDEX idx_viral_events_type ON viral_events(event_type);
```

### Quick Implementation Files

#### 1. Share Tracking Middleware
```typescript
// packages/web-runtime/src/middleware/share-tracking.ts
export async function trackShareClick(req: Request): Promise<void> {
  const { ref } = req.query;
  if (!ref) return;
  
  await redis.hincrby(`share:${ref}`, 'clicks', 1);
  
  // Set cookie to track conversion
  res.cookie('gamevibe_ref', ref, { 
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}
```

#### 2. Viral Event Emitter
```typescript
// packages/bot/src/services/viral-events.ts
export class ViralEventEmitter {
  emit(event: string, data: any): void {
    // Log event
    this.logViralEvent(event, data);
    
    // Check for viral triggers
    this.checkViralTriggers(event, data);
    
    // Broadcast if needed
    if (this.shouldBroadcast(event)) {
      this.broadcastToActivityFeed(event, data);
    }
  }
}
```

#### 3. Simple Achievement System
```typescript
// packages/bot/src/services/achievements-mvp.ts
const MVP_ACHIEVEMENTS = {
  first_game: { at: 1, credits: 10, message: "created their first game! 🎮" },
  getting_popular: { at: 10, credits: 5, message: "game reached 10 plays! 📈" },
  viral_hit: { at: 100, credits: 20, message: "game went viral with 100 plays! 🔥" },
  creator_streak: { at: 3, credits: 15, message: "created games 3 days in a row! 🔥" }
};
```

## 🚦 Go/No-Go Criteria

### Week 1 Checkpoint
- ✅ Share tracking functional
- ✅ 50+ shares tracked
- ✅ 10%+ share rate achieved
- ✅ Basic referral system working

**If NO → Pivot to different viral mechanics**

### Week 2 Final Results
- ✅ Viral coefficient > 1.0
- ✅ 100+ new users from viral features
- ✅ Positive user feedback
- ✅ Technical performance stable

**If YES → Scale up with full implementation**

## 🎯 Quick Wins for Immediate Impact

### Today (Day 0)
1. **Add to game complete screen**: "Share your score: [link]"
2. **Update bot status**: "X games created today!"
3. **Pin leaderboard**: Auto-pin daily leaderboard

### Tomorrow (Day 1)
1. **Launch message**: Announce viral features
2. **First challenge**: "Create a space game" community challenge
3. **Referral bonus**: Double credits for first 100 users

## 📈 Projected Impact

### Conservative Estimate
- Week 1: +20% user growth
- Week 2: +50% total growth
- Viral coefficient: 1.1

### Optimistic Estimate
- Week 1: +50% user growth
- Week 2: +150% total growth
- Viral coefficient: 1.3+

### Investment
- 2 developers × 2 weeks = 4 dev weeks
- No additional infrastructure costs
- Marketing: $0 (organic only)

### ROI
- CAC reduction: 80% (from paid to viral)
- LTV increase: 30% (better engaged users)
- Payback period: <1 month

---

**Let's ship virality! 🚀**