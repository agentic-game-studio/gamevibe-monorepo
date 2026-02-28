# Leaderboards System

GameVibe AI includes a comprehensive leaderboards system that tracks player scores and statistics across all games.

## Features

### For Players

- **Game Leaderboards**: View top scores for any game
- **Global Rankings**: See the highest scores across all games
- **Personal Statistics**: Track your gaming performance
- **Real-time Updates**: Scores are submitted automatically when games end

### For Developers

- **Automatic Score Tracking**: Games submit scores via the web runtime
- **Unique Player Scores**: One entry per player per game (highest score kept)
- **Redis Caching**: Fast leaderboard queries with 5-minute cache
- **Rich Metadata**: Store additional game data with scores

## Discord Commands

### `/leaderboard game <game-id>`
View the leaderboard for a specific game.

**Options:**
- `game_id` (required): The game ID or short ID
- `page` (optional): Page number for pagination (10 entries per page)

**Features:**
- Shows top 10 players per page
- Displays your rank if you've played
- Shows game statistics (high score, average, total players)
- Lists recent players

### `/leaderboard global`
View the top scores across all GameVibe games.

**Features:**
- Shows top 10 scores globally
- Displays game name with each score
- Highlights your scores

### `/leaderboard my-stats`
View your personal gaming statistics.

**Features:**
- Total games played
- Total accumulated score
- Best score achieved
- Average score
- Recent games with ranks

## API Endpoints

The bot exposes REST API endpoints for score management:

### Submit Score
```
POST /api/leaderboard/{gameId}/submit
Body: {
  "userId": "discord-user-id",
  "score": 1000,
  "metadata": { "level": 5, "time": 120 }
}
```

### Get Leaderboard
```
GET /api/leaderboard/{gameId}?limit=10&offset=0
Response: {
  "entries": [{
    "user": { "username": "Player1", ... },
    "score": 1000,
    "achievedAt": "2024-01-01T00:00:00Z"
  }]
}
```

### Get User Rank
```
GET /api/leaderboard/{gameId}/rank/{userId}
Response: { "rank": 5 }
```

### Get Game Stats
```
GET /api/leaderboard/{gameId}/stats
Response: {
  "totalPlayers": 100,
  "highestScore": 5000,
  "averageScore": 1200,
  "recentEntries": [...]
}
```

### Get User Stats
```
GET /api/user/{userId}/stats
Response: {
  "totalGamesPlayed": 25,
  "totalScore": 50000,
  "bestScore": 5000,
  "averageScore": 2000,
  "recentGames": [...]
}
```

## Implementation Details

### Database Schema
```prisma
model LeaderboardEntry {
  id         String   @id @default(cuid())
  gameId     String
  userId     String
  score      Int
  metadata   Json     @default("{}")
  achievedAt DateTime @default(now())

  game Game @relation(fields: [gameId], references: [id])
  user User @relation(fields: [userId], references: [id])

  @@unique([gameId, userId])
  @@map("leaderboard_entries")
}
```

### Score Submission Flow

1. **Game Ends**: When a Phaser game ends, it calls the runtime's `handleGameEnd` method
2. **Score Submission**: The web runtime submits the score via the API client
3. **Validation**: The bot validates the user and game exist
4. **Update Logic**: Only updates if the new score is higher than existing
5. **Cache Invalidation**: Clears relevant Redis cache entries
6. **Play Count**: Increments the game's play count

### Caching Strategy

- **Cache Duration**: 5 minutes for all leaderboard queries
- **Cache Keys**:
  - `leaderboard:{gameId}:{limit}:{offset}` - Game leaderboards
  - `leaderboard:global:{limit}` - Global leaderboard
  - `leaderboard:stats:{gameId}` - Game statistics
- **Invalidation**: Cache cleared on new score submission

### Security Considerations

1. **Authentication**: Scores can only be submitted with valid Discord authentication
2. **Rate Limiting**: API endpoints are rate-limited to prevent spam
3. **Score Validation**: Scores must be positive integers
4. **User Verification**: User must exist in database before score submission

## Integration with Games

### Phaser Game Template
```javascript
// In your Phaser game scene
gameOver(finalScore) {
  // Emit score to runtime
  window.parent.postMessage({
    type: 'GAME_END',
    score: finalScore,
    metadata: {
      level: this.currentLevel,
      time: this.elapsedTime,
      coins: this.coinsCollected
    }
  }, '*');
}
```

### Web Runtime Handler
```javascript
// Automatically handled by GameVibeRuntime
private async handleGameEnd(score: number): Promise<void> {
  // Submit to leaderboard
  await this.apiClient.submitScore(this.gameId, score);
  
  // Show game over UI
  this.uiManager.showGameOver(score);
  
  // Update Discord activity
  await this.updateDiscordActivity(score);
}
```

## Best Practices

1. **Score Validation**: Implement client-side validation before submission
2. **Metadata Usage**: Store relevant game data (level, time, achievements)
3. **Error Handling**: Handle API failures gracefully
4. **UI Feedback**: Show score submission status to players
5. **Fair Play**: Consider implementing anti-cheat measures for competitive games

## Future Enhancements

- **Seasonal Leaderboards**: Reset rankings periodically
- **Friend Leaderboards**: Compare scores with Discord friends
- **Achievements System**: Unlock badges for milestones
- **Score Verification**: Server-side game state validation
- **Tournaments**: Organized competitive events