# GameVibe AI Multiplayer API Documentation

This document describes the multiplayer API available to game developers when creating multiplayer games with GameVibe AI.

## Table of Contents

1. [Overview](#overview)
2. [GameVibe Multiplayer API](#gamevibe-multiplayer-api)
3. [Server-Side API](#server-side-api)
4. [Game Templates](#game-templates)
5. [Examples](#examples)

## Overview

GameVibe AI uses [Colyseus](https://colyseus.io/) for real-time multiplayer functionality. Games communicate with the multiplayer server through a WebSocket connection, with automatic state synchronization and player management.

### Architecture

```
Discord Bot <---> Multiplayer Server <---> Web Runtime
     |                    |                     |
     v                    v                     v
  Game DB            Colyseus              Game Engine
                     + Redis
```

## GameVibe Multiplayer API

The `window.GameVibe` object provides the following multiplayer methods when `isMultiplayer` is true:

### Core Properties

```javascript
// Check if game is multiplayer
GameVibe.isMultiplayer // boolean
```

### Player Management

```javascript
// Get local player ID
GameVibe.getLocalPlayerId() // returns string

// Get all players
GameVibe.getPlayers() // returns Map<playerId, playerData>
```

### Communication Methods

```javascript
// Send player movement
GameVibe.sendMove(x, y)

// Send custom action
GameVibe.sendAction(action, payload)
// Example: GameVibe.sendAction('shoot', { angle: 45, power: 100 })

// Send message to other players
GameVibe.sendMessage(data)
```

### Event Listeners

```javascript
// Player joined
GameVibe.onPlayerJoined((data) => {
  // data: { player: { id, username, avatar, x, y, score, state } }
})

// Player left
GameVibe.onPlayerLeft((data) => {
  // data: { player: { id, username, ... } }
})

// Player updated (position, state, etc.)
GameVibe.onPlayerUpdated((data) => {
  // data: { playerId, player: { ... } }
})

// Custom messages
GameVibe.onMessage((data) => {
  // data: any custom data sent by other players
})
```

### Game Control

```javascript
// Update score (automatically synced)
GameVibe.updateScore(score)

// End game with final score
GameVibe.endGame(finalScore)
```

### Phaser Scene Events

When using Phaser, the following events are emitted on the scene:

```javascript
// Game started
this.events.on('gameStart', () => {
  // Start gameplay
})

// Player joined
this.events.on('playerJoined', (player) => {
  // Add player sprite
})

// Player left  
this.events.on('playerLeft', (player) => {
  // Remove player sprite
})

// Player update
this.events.on('playerUpdate', ({ playerId, player }) => {
  // Update player position/state
})

// Remote player action
this.events.on('remoteAction', (data) => {
  // Handle action from other player
  // data: { playerId, action, payload }
})

// Score update
this.events.on('scoreUpdate', ({ playerId, score }) => {
  // Update scoreboard
})
```

## Server-Side API

### Room Schema

The multiplayer server uses the following state schema:

```typescript
interface GameState {
  gameId: string
  gameName: string
  gameType: string
  status: 'waiting' | 'playing' | 'finished'
  startTime: number
  elapsedTime: number
  players: Map<string, Player>
  winnerId?: string
  maxPlayers: number
}

interface Player {
  id: string
  username: string
  avatar?: string
  x: number
  y: number
  score: number
  isReady: boolean
  state: string
}
```

### Messages

Client to Server:
- `player_ready` - Mark player as ready to start
- `player_move` - Update player position
- `player_action` - Custom game action
- `update_score` - Update player score

Server to Client:
- `joined` - Confirmation of joining room
- `ready_check` - Enough players to start
- `game_started` - Game has begun
- `game_ended` - Game finished with results
- `score_updated` - Player score changed
- `player_action` - Broadcast of player actions

## Game Templates

### Creating a Multiplayer Game Template

1. Place template in `packages/game-engine/src/templates/multiplayer/`
2. Use the multiplayer API pattern:

```javascript
export const multiplayerGameTemplate: GameTemplate = {
  id: 'multiplayer-game-type',
  name: 'Multiplayer Game Type',
  type: 'game-type',
  structure: `
class GameScene extends Phaser.Scene {
  create() {
    // Setup multiplayer if available
    if (window.GameVibe && window.GameVibe.isMultiplayer) {
      this.setupMultiplayer();
    } else {
      this.startSinglePlayer();
    }
  }
  
  setupMultiplayer() {
    // Listen for multiplayer events
    window.GameVibe.onPlayerJoined(({ player }) => {
      this.addPlayer(player);
    });
    
    // Mark as ready when loaded
    window.GameVibe.sendAction('ready');
  }
}
  `
}
```

### Template Best Practices

1. **Always provide single-player fallback**
2. **Handle disconnections gracefully**
3. **Minimize network traffic** - only send necessary updates
4. **Use interpolation** for smooth movement
5. **Validate inputs** on both client and server

## Examples

### Basic Multiplayer Movement

```javascript
// In update loop
update() {
  if (this.localPlayer) {
    // Handle input
    if (this.cursors.left.isDown) {
      this.localPlayer.x -= 5;
    }
    
    // Send position to server
    if (window.GameVibe && window.GameVibe.isMultiplayer) {
      window.GameVibe.sendMove(this.localPlayer.x, this.localPlayer.y);
    }
  }
}
```

### Shooting with Multiplayer Sync

```javascript
shoot() {
  // Create bullet locally
  const bullet = this.bullets.create(this.player.x, this.player.y);
  
  // Notify other players
  if (window.GameVibe && window.GameVibe.isMultiplayer) {
    window.GameVibe.sendAction('shoot', {
      x: this.player.x,
      y: this.player.y,
      angle: this.player.rotation
    });
  }
}

// Handle remote player shooting
this.events.on('remoteAction', (data) => {
  if (data.action === 'shoot') {
    this.createBullet(data.payload.x, data.payload.y, data.payload.angle);
  }
});
```

### Turn-Based Game Example

```javascript
class TurnBasedScene extends Phaser.Scene {
  setupMultiplayer() {
    this.currentTurn = null;
    
    // Listen for turn changes
    window.GameVibe.onMessage((data) => {
      if (data.type === 'turn_change') {
        this.currentTurn = data.playerId;
        this.updateTurnIndicator();
      }
    });
  }
  
  makeMove(x, y) {
    if (this.currentTurn !== window.GameVibe.getLocalPlayerId()) {
      return; // Not our turn
    }
    
    // Make move
    window.GameVibe.sendAction('move', { x, y });
  }
}
```

## Discord Integration

### Creating Multiplayer Games

```
/create-multiplayer-game prompt:"game description" max-players:4 mode:competitive private:false
```

Options:
- `prompt` - Game description for AI generation
- `max-players` - Maximum players (2-8)
- `mode` - competitive, cooperative, or freeplay
- `private` - Require room code to join

### Joining Games

```
/join-game code:ABC123
```

The room code is displayed when creating a game and can be shared with other players.

## Performance Considerations

1. **State Updates**: Limit to 10-20 updates per second
2. **Message Size**: Keep payloads under 1KB
3. **Player Limit**: Recommended max 8 players per room
4. **Interpolation**: Use client-side prediction and interpolation
5. **Compression**: Large data should be compressed

## Error Handling

```javascript
// Connection errors
window.GameVibe.on('error', (error) => {
  console.error('Multiplayer error:', error);
  // Show error to player
  // Fallback to single-player if needed
});

// Disconnection
window.GameVibe.on('disconnected', () => {
  // Handle graceful disconnection
  // Save game state if possible
});
```

## Security

- All players are authenticated via Discord OAuth
- JWT tokens expire after 24 hours
- Room codes are randomly generated and unique
- State validation happens server-side
- No direct player-to-player connections

## Future Enhancements

- Voice chat integration
- Spectator mode
- Tournament system
- Replay system
- Custom room settings
- Persistent game sessions