# Enhanced Template System - Quick Reference

## 🚀 Quick Start

### Testing the System
```bash
# Test shooter games (restart & bullets)
/create-game space shooter with 3 lives

# Test platformer games (coin reset & respawn)
/create-game mario-style platformer

# Test puzzle games (grid reset)
/create-game match-3 puzzle game
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `packages/ai-service/src/prompts/templates.ts` | Template definitions and UI guidelines |
| `packages/ai-service/src/prompts/game-prompt-builder.ts` | Template selection and prompt generation |
| `packages/web-runtime/src/game/loader.ts` | Asset generation and game loading |

## 🎮 Game Type Detection

```typescript
// Keywords that trigger each game type:
shooter: 'shoot', 'bullet', 'laser'
platformer: 'platform', 'jump', 'coin'
puzzle: 'puzzle', 'gem', 'match'
```

## 🎨 Generated Assets by Type

### Shooter
- Dark space background (gradient)
- Spaceship sprites (with animation)
- Enemy ships (pulsing effect)
- Bullets (rounded rectangles)
- Explosions (particle effects)

### Platformer
- Sky background (blue gradient)
- Textured ground/platforms
- Character sprites (walking animation)
- Rotating coins
- Spike hazards

### Puzzle
- Grid background pattern
- Gem shapes (5 colors)
- Shine effects
- Match burst animations

## 📋 Mandatory Functions

Every generated game MUST include:
```javascript
function resetGameState()
function storeInitialPositions()
function resetGameObjects()
function gameOver()
function restartGame()
function pauseGame()
function setupInputHandlers()
function updateUI()
function showGameOverScreen()
function showPauseScreen()
```

## ⌨️ Controls

| Key | Action |
|-----|--------|
| ESC | Toggle pause |
| R | Restart (when game over) |
| Click Restart Button | Restart game |

## 🎯 UI Positioning

| Element | Position | Style |
|---------|----------|-------|
| Score | (20, 20) | 24-32px, white with black stroke |
| Lives | (780, 20) | 24-32px, white with black stroke |
| Title | (400, 30) | 36-48px, centered |
| Game Over | (400, 300) | Container centered |
| UI Depth | 100+ | Ensures proper layering |

## 🔧 Adding New Game Types

1. Add to `GAME_TYPE_TEMPLATES` in templates.ts:
```typescript
export const GAME_TYPE_TEMPLATES = {
  racing: {
    globalVariables: `var car, track, checkpoints;`,
    storePositions: `initialPositions.carX = 400;`,
    resetObjects: `car.x = initialPositions.carX;`,
    gameOverScreen: `// Racing specific UI`,
    updateUI: `// Update lap times`
  }
};
```

2. Add detection keywords in loader.ts:
```typescript
else if (codeStr.includes('race') || codeStr.includes('car')) {
  gameType = 'racing';
}
```

3. Add asset generation:
```typescript
else if (gameType === 'racing') {
  textures = [
    { key: 'car', width: 40, height: 60, color: 0xff0000, shape: 'car' },
    { key: 'track', width: 800, height: 600, pattern: 'track' }
  ];
}
```

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "gameOverContainer is not defined" | Loader now injects global UI variables |
| Player doesn't respawn | Template enforces resetGameObjects() |
| UI looks weird | Follow UI_LAYOUT_GUIDELINES positioning |
| Generic assets | Game type detection creates specific assets |

## 📊 Testing Checklist

- [ ] Game loads without errors
- [ ] Player respawns at correct position on death
- [ ] Score/lives display in correct positions
- [ ] ESC pauses the game
- [ ] R restarts when game over
- [ ] Game over screen shows with restart button
- [ ] Assets match game type
- [ ] All collectibles/enemies reset on restart

## 💡 Pro Tips

1. **Test Different Descriptions**: Try variations to ensure game type detection works
2. **Check Console**: Loader logs detected game type and asset generation
3. **Verify Functions**: Check generated code includes all mandatory functions
4. **UI Consistency**: All text should have stroke for visibility
5. **State Management**: gameState object tracks all game variables