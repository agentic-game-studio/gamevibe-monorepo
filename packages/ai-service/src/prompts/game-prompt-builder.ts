import { GameSpec, GameTemplate } from '@gamevibe/shared';
import { STANDARDIZED_GAME_TEMPLATE, GAME_TYPE_TEMPLATES } from './templates.js';

type GameTypeKey = 'platformer' | 'shooter' | 'puzzle' | 'rpg' | 'tower-defense' | 'endless-runner';

export class GamePromptBuilder {
  buildGameGenerationPrompt(spec: GameSpec, template: GameTemplate & { assets?: Record<string, string> }): string {
    const userDescription = spec.description || spec.originalDescription || spec.type || 'platformer game';
    const gameType = this.detailedGameType(userDescription);

    const typeSpecificRequirements = this.getTypeSpecificRequirements(gameType, userDescription);

    return `Create a COMPLEX and UNIQUE Phaser.js game based on this description: "${userDescription}"

${typeSpecificRequirements}

CRITICAL REQUIREMENTS:
1. MUST have multiple unique enemy types with different behaviors (at least 3 types)
2. MUST have power-ups or upgrades (at least 3 types: health, speed, weapon upgrade, etc.)
3. MUST have combo system or multiplier
4. MUST have visual particle effects when enemies die or player gets power-ups
5. MUST have smooth camera effects (shake, flash, zoom)
6. MUST have progressive difficulty (enemies get stronger/faster each wave/level)
7. MUST have particle trails on bullets
8. MUST have sound effects using Web Audio API (shoot, hit, powerup, game over)
9. MUST have unique visual style with gradients and glow effects
10. MUST have a title screen with "START" and "HOW TO PLAY" buttons
11. MUST have health bar, score display, wave/level display, and combo counter
12. MUST be at least 300 lines of meaningful game code

The game must feel polished, exciting, and replayable. Don't create generic basic games!

Output ONLY the raw HTML code starting with <!DOCTYPE html><html> and ending with </html>`;
  }

  private detailedGameType(description: string): GameTypeKey {
    const d = description.toLowerCase();
    if (d.includes('shoot') || d.includes('space') || d.includes('invader')) return 'shooter';
    if (d.includes('tower') || d.includes('defense')) return 'tower-defense';
    if (d.includes('runner') || d.includes('endless') || d.includes('dash')) return 'endless-runner';
    if (d.includes('rpg') || d.includes('adventure') || d.includes('dungeon')) return 'rpg';
    if (d.includes('puzzle') || d.includes('match') || d.includes('gem')) return 'puzzle';
    return 'platformer';
  }

  private getTypeSpecificRequirements(type: GameTypeKey, description: string): string {
    switch (type) {
      case 'shooter':
        return `SHOOTER GAME REQUIREMENTS:
- Player ship with 3 weapon types: machine gun, spread shot, laser
- Weapon switching with number keys 1, 2, 3
- Enemies: basic (straight down), shooter (fires back), fast (zigzag), tank (slow, high HP), boss (every 5 waves)
- Bullet trails with glow effects
- Enemy formations and patterns
- Shield system (absorbs hits)
- Rapid fire and triple shot power-ups`;
      case 'tower-defense':
        return `TOWER DEFENSE REQUIREMENTS:
- Multiple tower types: arrow (fast, low dmg), cannon (splash damage), ice (slows enemies), lightning (chains), fire (burn damage)
- Tower upgrade system (click existing tower to upgrade)
- Enemy types: basic, fast, tank, flying, boss
- Path with multiple routes
- Money/energy system to buy towers
- Wave preview and skip options
- Tower range visualization on hover`;
      case 'endless-runner':
        return `ENDLESS RUNNER REQUIREMENTS:
- Triple jump ability
- Ground, aerial, and wall obstacles
- Boost pads and teleporters
- Character skins unlocked by score
- Speed increases over time
- Coin collection for points
- Near-miss bonus points
- Dash ability with cooldown`;
      case 'rpg':
        return `RPG ADVENTURE REQUIREMENTS:
- Top-down movement with attack
- Multiple enemy types with AI
- Equipment system (sword, armor, accessories)
- Level up and stat progression
- Multiple item types (health potions, mana, keys)
- Treasure chests with random loot
- Boss enemies with multiple phases`;
      case 'puzzle':
        return `PUZZLE GAME REQUIREMENTS:
- 8x8 or larger grid
- Special gems: bomb (clears area), lightning (clears row/col), fire (clears color)
- Chain reactions with cascade scoring
- Time attack and moves limit modes
- Special combo animations
- Hint system`;
      default:
        return `PLATFORMER REQUIREMENTS:
- Double jump and wall jump
- Multiple enemy types with different behaviors
- Boss levels every 3 levels
- Collectibles: coins (score), gems (bonus), keys (unlock areas)
- Power-ups: invincibility, speed boost, double jump
- Particle effects on jumps and landings`;
    }
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
