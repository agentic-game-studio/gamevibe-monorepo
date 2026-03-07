import { GameSpec, GameTemplate } from '@gamevibe/shared';
import { STANDARDIZED_GAME_TEMPLATE, GAME_TYPE_TEMPLATES } from './templates.js';

type GameTypeKey = 'platformer' | 'shooter' | 'puzzle';

export class GamePromptBuilder {
  buildGameGenerationPrompt(spec: GameSpec, template: GameTemplate & { assets?: Record<string, string> }): string {
    const gameType = this.normalizeGameType(spec.type);
    const isShooter = gameType === 'shooter';
    const isPuzzle = gameType === 'puzzle';

    let gameCode = '';

    if (isShooter) {
      gameCode = `Create a complete Phaser.js space shooter game. Requirements:
- Player ship at bottom, moves left/right with arrow keys
- Space to shoot bullets upward
- Enemies spawn from top, move downward
- Collision: bullet kills enemy (+10 points), enemy hits player (-1 life)
- 3 lives, game over when 0
- Score display at top left
- Restart button on game over
- Use Phaser 3 arcade physics
- Graphics: generate textures with graphics (ship=triangle, bullet=rectangle, enemy=circle)
- ALL in one HTML file with Phaser 3.70`;
    } else if (isPuzzle) {
      gameCode = `Create a complete Phaser.js match-3 puzzle game. Requirements:
- 8x8 grid of colored gems
- Click two adjacent gems to swap
- Match 3+ same color to clear and score
- New gems fall from top after clear
- 30 moves to get high score
- Score display at top
- Game over when moves = 0
- Use Phaser 3
- ALL in one HTML file with Phaser 3.70`;
    } else {
      gameCode = `Create a complete Phaser.js platformer game. Requirements:
- Player (green triangle) at left, moves with arrow keys
- Jump with up arrow, gravity pulls down
- Multiple platforms at different heights
- Collect coins (gold circles) for +10 points each
- Enemies (red squares) patrol left/right
- Jump on enemies to kill (+50 points), touch from side = lose life
- 3 lives, game over when 0
- Score and lives displayed at top
- Restart button on game over
- Use Phaser 3 arcade physics with gravity
- Graphics: generate textures with graphics (player=triangle, platform=rect, coin=circle, enemy=square)
- ALL code in one HTML file with Phaser 3.70`;
    }

    return gameCode;
  }

  private normalizeGameType(type: string | undefined): string {
    const t = type?.toLowerCase() || '';
    if (t.includes('shoot')) return 'shooter';
    if (t.includes('puzzle') || t.includes('match')) return 'puzzle';
    return 'platformer';
  }

  buildAnalysisPrompt(description: string, context?: any): string {
    const d = description.toLowerCase();
    let type = 'platformer';
    if (d.includes('shoot')) type = 'shooter';
    else if (d.includes('puzzle') || d.includes('match')) type = 'puzzle';
    return `{"type":"${type}","name":"Game","description":"${description}","coreMechanics":["move","collect","jump"],"features":["score","enemies"],"playerCount":"1","difficulty":"medium"}`;
  }

  buildCodeValidationPrompt(code: string): string {
    return `Valid Phaser game? Return {"valid": true}`;
  }

  buildEnhancementPrompt(code: string, enhancementType: string): string {
    return `Enhance: ${code}`;
  }
}
