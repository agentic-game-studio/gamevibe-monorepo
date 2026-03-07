import { GameSpec, GameTemplate } from '@gamevibe/shared';
import { STANDARDIZED_GAME_TEMPLATE, GAME_TYPE_TEMPLATES } from './templates.js';

type GameTypeKey = 'platformer' | 'shooter' | 'puzzle';

export class GamePromptBuilder {
  buildGameGenerationPrompt(spec: GameSpec, template: GameTemplate & { assets?: Record<string, string> }): string {
    const gameType = this.normalizeGameType(spec.type);
    const typeTemplates = GAME_TYPE_TEMPLATES[gameType as GameTypeKey] || GAME_TYPE_TEMPLATES.platformer;

    const mechanics = spec.coreMechanics?.join(', ') || 'move, jump, collect';
    const features = spec.features?.join(', ') || 'score, coins, enemies';
    const isRoguelike = spec.type?.toLowerCase().includes('roguelike') || spec.description?.toLowerCase().includes('roguelike');
    const isPlatformer = gameType === 'platformer';

    let gameInstructions = '';

    if (isRoguelike) {
      gameInstructions = ` roguelike elements: random level generation, permadeath, increasing difficulty, collect powerups`;
    }

    if (isPlatformer || isRoguelike) {
      gameInstructions += ` - multiple platform heights - moving platforms - enemies with simple AI (patrol left/right) - jump on enemy heads to kill - different coin types (bronze/silver/gold)`;
    }

    return `Create a complete Phaser.js platformer game: "${spec.name}"

Description: ${spec.originalDescription}
Mechanics: ${mechanics}
Features: ${features}${gameInstructions}
Difficulty: ${spec.difficulty || 'medium'}

IMPORTANT: Generate a FULL, COMPLETE, PLAYABLE game. Not a skeleton.

Required features:
1. Player with smooth movement and jumping physics
2. Multiple platforms at different heights
3. Collectibles (coins/gems) with score
4. Enemies that patrol and can be defeated
5. Game over when falling or hit by enemy
6. Score display and lives
7. Restart functionality (press R)
8. Nice visual effects (particles, tween animations)

Use these graphics (generated in code):
- Player: green triangle/sprite
- Platforms: gray rectangles
- Coins: gold circles
- Enemies: red shapes
- Bullets (if shoot): yellow rectangles

Physics: arcade physics with gravity.
Controls: Arrow keys to move/jump, Space to shoot (if applicable).

Generate complete HTML with Phaser game. Include everything in one file.`;
  }

  private normalizeGameType(type: string | undefined): string {
    const t = type?.toLowerCase() || '';
    if (t.includes('shoot')) return 'shooter';
    if (t.includes('puzzle')) return 'puzzle';
    if (t.includes('platform') || t.includes('runner') || t.includes('roguelike')) return 'platformer';
    return 'platformer';
  }

  buildAnalysisPrompt(description: string, context?: any): string {
    const d = description.toLowerCase();
    let type = 'platformer';
    if (d.includes('shoot')) type = 'shooter';
    else if (d.includes('puzzle')) type = 'puzzle';
    return `{"type":"${type}","name":"Game","description":"${description}","coreMechanics":["move","collect","jump"],"features":["score","enemies"],"playerCount":"1","difficulty":"medium"}`;
  }

  buildCodeValidationPrompt(code: string): string {
    return `Valid Phaser game? Return {"valid": true}`;
  }

  buildEnhancementPrompt(code: string, enhancementType: string): string {
    return `Enhance: ${code}`;
  }
}
