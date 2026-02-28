# Challenge System

The GameVibe AI challenge system enables players to compete against each other in various game challenges, creating viral engagement and encouraging continued play.

## Overview

The challenge system allows users to:
- Create challenges for specific games
- Wager personal credits on challenge outcomes
- Compete in different challenge types
- Track challenge statistics and history
- Earn achievements for challenge milestones

## Challenge Types

### 🎯 Beat My Score (SCORE_BEAT)
Players must achieve a higher score than the challenger's target score.
- **Target Required**: Yes (target score to beat)
- **Win Condition**: Highest score among players who beat the target
- **Best For**: High-score games, arcade-style games

### ⚡ Speed Run (SPEED_RUN)
Players must complete the game faster than the challenger's target time.
- **Target Required**: Yes (target time in seconds)
- **Win Condition**: Fastest completion time among players who beat the target
- **Best For**: Platformers, puzzle games with clear completion

### ⚔️ Direct 1v1 (DIRECT_1V1)
Head-to-head competition where highest score wins.
- **Target Required**: No
- **Win Condition**: Highest score between the two players
- **Best For**: Any competitive game type

## Discord Commands

### `/challenge create`
Create a new challenge with the following options:
- **game-id** (required): Game ID or short ID to challenge on
- **type** (required): Challenge type (Beat My Score, Speed Run, Direct 1v1)
- **wager** (required): Personal credits to wager (0-1000)
- **opponent** (optional): Specific user to challenge
- **target-score** (optional): Target score for Beat My Score challenges
- **target-time** (optional): Target time in seconds for Speed Run challenges
- **description** (optional): Custom challenge description

### `/challenge accept`
Accept a pending challenge:
- **challenge-id** (required): The challenge ID to accept

### `/challenge list`
List active challenges with optional filtering:
- **filter** (optional): Filter by type (all, created, received, open)

### `/challenge stats`
View your challenge statistics including:
- Win/loss record and win rate
- Credits won and lost
- Favorite game types
- Performance indicators

### `/challenge history`
View recent completed challenges:
- **limit** (optional): Number of challenges to show (5-25, default 10)

## Challenge Lifecycle

### 1. Creation
- Player creates challenge with wager (credits immediately reserved)
- Challenge expires in 7 days by default
- Open challenges can be accepted by anyone
- Targeted challenges only by specific users

### 2. Acceptance
- Player accepts challenge (credits reserved for accepter)
- Challenge status becomes ACTIVE
- Participants can now play the game

### 3. Completion
- Players submit scores/times by playing the game
- When both players complete, winner is determined
- Credits transferred automatically
- Challenge status becomes COMPLETED

### 4. Expiration
- Unused challenges expire after 7 days
- Credits refunded to original players
- Challenge status becomes EXPIRED

## Credit System Integration

### Wagering
- Players can wager 0-1000 personal credits per challenge
- Credits are immediately reserved when creating/accepting
- No-wager challenges are purely for bragging rights

### Payouts
- Winner takes the full pot (challenger wager + accepter wager)
- Draws result in full refunds to both players
- Credits transferred automatically upon completion

### Achievement Rewards
Challenge-related achievements award additional credits:
- **Challenger** (15 credits): Create your first challenge
- **Victory** (25 credits): Win your first challenge
- **Challenge Master** (150 credits): Win 10 challenges
- **Big Winner** (100 credits): Win a challenge worth 100+ credits

## Database Schema

### Challenge Model
```prisma
model Challenge {
  id              String          @id
  gameId          String
  challengerId    String
  challengeeId    String?
  type            ChallengeType
  status          ChallengeStatus
  wagerAmount     Int
  targetScore     Int?
  targetTime      Int?
  description     String?
  expiresAt       DateTime
  // ... other fields
}
```

### ChallengeParticipant Model
```prisma
model ChallengeParticipant {
  id              String    @id
  challengeId     String
  userId          String
  hasCompleted    Boolean
  finalScore      Int?
  completionTime  Int?
  // ... other fields
}
```

### ChallengeResult Model
```prisma
model ChallengeResult {
  id                String  @id
  challengeId       String
  winnerId          String?
  loserId           String?
  isDraw            Boolean
  creditsTransferred Int
  // ... other fields
}
```

## Implementation Details

### ChallengeService
Core service managing all challenge functionality:
- **createChallenge()**: Create new challenges with validation
- **acceptChallenge()**: Accept pending challenges
- **submitChallengeResult()**: Submit game completion results
- **completeChallenge()**: Determine winners and transfer credits
- **getUserChallengeStats()**: Get user statistics

### Challenge Commands
Discord slash command with 5 subcommands:
- Comprehensive parameter validation
- Rich embeds with challenge details
- Interactive buttons for actions
- Error handling with user-friendly messages

### Game Integration
Automatic challenge result submission:
- **GameTrackingService.trackGameCompletion()**: Submit scores/times
- Detects active challenges for current game and player
- Submits results automatically when games are completed

### Notifications
DM notifications for challenge events:
- Challenge accepted
- Challenge completed (winner/loser notifications)
- Achievement unlocks related to challenges

## Viral Growth Features

### Cross-Server Challenges
- Challenges work across all Discord servers
- Players can challenge anyone they've played with
- Results tracked in global challenge statistics

### Social Pressure
- Public challenge lists create social pressure
- Win rates and statistics encourage competition
- Achievement milestones provide goals

### Credit Incentives
- Personal credit wagering adds stakes
- Achievement rewards encourage participation
- Big winner achievements for high-value challenges

## Security & Fair Play

### Validation
- Credit balance checks before wager reservation
- Game existence validation
- User permission checks (can't challenge yourself)

### Anti-Exploitation
- Automatic result submission prevents cheating
- Challenge expiration prevents abandoned challenges
- Credit reservations prevent double-spending

### Rate Limiting
- Reasonable wager limits (0-1000 credits)
- Challenge expiration (7 days maximum)
- Achievement cooldowns prevent spam

## Analytics & Metrics

### Tracked Metrics
- Challenge creation rate
- Acceptance rate by challenge type
- Average wager amounts
- Win rate distributions
- Time to completion

### Growth Indicators
- Cross-server challenge activity
- Repeat challenger rates
- Credit circulation through challenges
- Achievement unlock rates

## Future Enhancements

### Tournament Mode
- Multi-player elimination brackets
- Seasonal tournaments with special rewards
- Team-based challenges

### Advanced Challenge Types
- Survival challenges (last longest)
- Collection challenges (collect most items)
- Creative challenges (most creative solution)

### Social Features
- Challenge leaderboards
- Challenge replay system
- Spectator mode for live challenges

### Mobile Integration
- Push notifications for challenge events
- Mobile-optimized challenge interface
- Cross-platform challenge compatibility