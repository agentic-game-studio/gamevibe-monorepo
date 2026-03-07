import { GameSpec, GameTemplate } from '@gamevibe/shared';
import { STANDARDIZED_GAME_TEMPLATE, GAME_TYPE_TEMPLATES } from './templates.js';

type GameTypeKey = 'platformer' | 'shooter' | 'puzzle';

export class GamePromptBuilder {
  buildGameGenerationPrompt(spec: GameSpec, template: GameTemplate & { assets?: Record<string, string> }): string {
    const gameType = this.normalizeGameType(spec.type);
    const typeTemplates = GAME_TYPE_TEMPLATES[gameType as GameTypeKey] || GAME_TYPE_TEMPLATES.platformer;

    const mechanics = spec.coreMechanics?.join(', ') || 'move, jump, collect, dodge';
    const features = spec.features?.join(', ') || 'score, coins, enemies, powerups';
    const isRoguelike = spec.type?.toLowerCase().includes('roguelike') || spec.description?.toLowerCase().includes('roguelike');
    const isPlatformer = gameType === 'platformer';
    const isShooter = gameType === 'shooter';
    const isPuzzle = gameType === 'puzzle';

    let gameInstructions = '';

    if (isRoguelike) {
      gameInstructions = `
roguelike elements (CRITICAL):
- Random procedural level generation - platforms/enemies placed randomly each run
- Permadeath - when you die, game restarts completely
- Increasing difficulty - each level gets harder (more enemies, faster speed)
- Power-ups: speed boost (blue), double jump (purple), shield (cyan), magnet (yellow)
- Multiple enemy types: slime (green, slow), bat (red, flies), skeleton (white, fast)
- Each run is different - randomized platforms and enemy placements`;
    }

    if (isPlatformer || isRoguelike) {
      gameInstructions += `
platformer enhancements:
- Multiple platform types: static gray, moving horizontal, moving vertical, falling/breaking
- At least 3-5 different enemy types with distinct behaviors
- Power-up system: invincibility (star), extra life (heart), score multiplier (x2), speed boost (lightning)
- Particle effects on: player jump, coin collect, enemy death, landing, power-up collect
- Screen shake on enemy hit and death
- Smooth camera follow with slight lead
- Double jump ability
- Wall jump or slide mechanics
- Enemy AI: some patrol, some chase player, some shoot projectiles`;
    }

    if (isShooter) {
      gameInstructions += `
shooter enhancements:
- Multiple weapon types: basic shot, spread shot, laser, missiles
- Enemy waves with increasing difficulty
- Boss battles every 5 waves
- Power-ups: triple shot, rapid fire, shield, speed up, score multiplier
- Different enemy types: basic, fast, tank, shooter enemies
- Particle explosions on enemy death
- Screen effects: shake on hit, flash on damage`;
    }

    if (isPuzzle) {
      gameInstructions += `
puzzle enhancements:
- Multiple puzzle mechanics: match-3, swap, falling blocks, gravity
- Special gems with effects: bomb (clears area), lightning (clears row/col), rainbow (any color match)
- Chain reactions with bonus points
- Time-based challenges
- Limited moves with strategy
- Combo system with multipliers`;
    }

    return `Create an EXCITING, FUN, and COMPLETE Phaser.js game: "${spec.name || 'Game'}"

Description: ${spec.originalDescription || spec.description || 'A fun action game'}
Mechanics: ${mechanics}
Features: ${features}
Difficulty: ${spec.difficulty || 'medium'}

${gameInstructions}

CRITICAL REQUIREMENTS - Your game MUST have:
1. Smooth, responsive controls (no lag or delay)
2. At least 3 different enemy types with unique behaviors
3. Power-up/upgrade system with visual feedback
4. Particle effects for: jumping, collecting, hitting enemies, getting hit, winning
5. Sound-like visual feedback (screen shake, flash, color changes)
6. Score system with combo multipliers
7. Lives system (start with 3)
8. Game over screen with final score and restart button
9. Progressive difficulty - gets harder over time
10. At least 30-60 seconds of engaging gameplay per run

Graphics (generate programmatically):
- Player: distinctive shape with trail effect when moving
- Platforms: varied sizes, some with colors indicating type
- Coins/gems: multiple types (bronze=10pts, silver=25pts, gold=50pts, gem=100pts)
- Enemies: visually distinct by type (use different colors/shapes)
- Power-ups: glowing/bobbing animations with particle auras

Physics: Arcade physics with gravity, proper collision detection.

Controls: Arrow keys to move/jump, Space to shoot/action.

Generate COMPLETE, PLAYABLE HTML file with Phaser 3. Include ALL code in one file. Make it FUN and EXCITING!`;
  }

  private normalizeGameType(type: string | undefined): string {
    const t = type?.toLowerCase() || '';
    if (t.includes('shoot')) return 'shooter';
    if (t.includes('puzzle') || t.includes('match')) return 'puzzle';
    if (t.includes('platform') || t.includes('runner') || t.includes('roguelike')) return 'platformer';
    return 'platformer';
  }

  buildAnalysisPrompt(description: string, context?: any): string {
    const d = description.toLowerCase();
    let type = 'platformer';
    if (d.includes('shoot')) type = 'shooter';
    else if (d.includes('puzzle') || d.includes('match')) type = 'puzzle';
    return `{"type":"${type}","name":"Game","description":"${description}","coreMechanics":["move","collect","jump"],"features":["score","enemies","powerups"],"playerCount":"1","difficulty":"medium"}`;
  }

  buildCodeValidationPrompt(code: string): string {
    return `Valid Phaser game? Return {"valid": true}`;
  }

  buildEnhancementPrompt(code: string, enhancementType: string): string {
    return `Enhance: ${code}`;
  }
}
