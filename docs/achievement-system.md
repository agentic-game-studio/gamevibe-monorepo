# Achievement System

The GameVibe AI achievement system rewards users for various actions and milestones, encouraging engagement and providing goals for creators.

## Overview

Achievements are unlocked automatically as users interact with the bot. Each achievement awards personal credits when unlocked and can only be earned once per user.

## Achievement Categories

### 🎮 Creator Achievements
Rewards for creating games:
- **First Steps** (Common) - Create your first game (10 credits)
- **Game Designer** (Uncommon) - Create 5 games (50 credits)
- **Prolific Creator** (Rare) - Create 25 games (250 credits)
- **Master Developer** (Epic) - Create 100 games (1000 credits)

### ▶️ Player Achievements
Rewards based on game plays:
- **Casual Player** (Common) - Your games played 100 times (25 credits)
- **Popular Creator** (Uncommon) - Your games played 1,000 times (100 credits)
- **Hit Maker** (Rare) - Your games played 10,000 times (500 credits)

### 🔗 Social Achievements
Rewards for sharing and viral growth:
- **Sharing is Caring** (Common) - Share your first game (15 credits)
- **Going Viral** (Rare) - Have a game reach 100+ plays (200 credits)
- **Server Hopper** (Uncommon) - Have games played in 5+ servers (75 credits)

### 🏆 Milestone Achievements
Major progression milestones:
- **Silver Creator** (Uncommon) - Reach Silver tier (100 credits)
- **Gold Creator** (Rare) - Reach Gold tier (500 credits)
- **Diamond Creator** (Legendary) - Reach Diamond tier (2500 credits)

## Discord Commands

### `/achievements list [category]`
View all achievements and your progress. Optionally filter by category.

### `/achievements stats`
View your achievement statistics including:
- Total achievements unlocked
- Completion percentage
- Credits earned from achievements
- Category breakdown

### `/achievements recent`
View your recently unlocked achievements.

## Implementation Details

### Achievement Progress Tracking
The system tracks progress for different achievement types:
- `games_created` - Incremented when creating games
- `total_plays` - Incremented when your games are played
- `games_shared` - Incremented when sharing games
- `viral_game` - Checked when a game reaches 100 plays
- `creator_tier` - Checked when tier upgrades occur
- `server_reach` - Tracked through game sharing analytics

### Database Schema

```prisma
model Achievement {
  id            String              @id
  key           String              @unique
  name          String
  description   String
  category      AchievementCategory
  rarity        AchievementRarity
  creditReward  Int
  targetType    String?
  targetValue   Int?
  iconEmoji     String
}

model UserAchievement {
  userId        String
  achievementId String
  unlockedAt    DateTime
  creditsClaimed Boolean
}

model AchievementProgress {
  userId        String
  achievementId String
  currentValue  Int
  targetValue   Int
}
```

### Integration Points

1. **Game Creation** (`create-game.ts`)
   - Tracks `games_created` progress
   - Notifies users of unlocked achievements

2. **Game Playing** (`game-tracking.ts`)
   - Tracks `total_plays` for creators
   - Checks for viral game achievements

3. **Game Sharing** (`share.ts`)
   - Tracks `games_shared` progress
   - Updates server reach metrics

4. **Tier Upgrades** (`personal-credits.ts`)
   - Tracks `creator_tier` achievements
   - Awards bonus credits for tier milestones

### Notification System

When achievements are unlocked:
1. DM notification sent to user (if DMs enabled)
2. Achievement name shown in command response
3. Credits automatically added to balance

## Technical Architecture

### Services
- **AchievementService** - Core achievement logic
- **PersonalCreditService** - Credit rewards integration
- **AnalyticsService** - Achievement tracking analytics

### Caching
- User achievement lists cached for 5 minutes
- Progress tracking updated in real-time

### Performance
- Batch achievement checks per action
- Async notifications to avoid blocking
- Efficient database queries with indexes

## Future Enhancements

1. **Seasonal Achievements** - Limited-time achievements
2. **Team Achievements** - Server-wide collaborative goals
3. **Achievement Badges** - Visual badges for profiles
4. **Achievement Leaderboards** - Compare with other creators
5. **Custom Achievements** - Server-specific achievements