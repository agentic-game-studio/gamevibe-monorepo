import { GameSpec, GameTemplate } from '@gamevibe/shared';
import { STANDARDIZED_GAME_TEMPLATE, GAME_TYPE_TEMPLATES, DEFAULT_UI_TEMPLATES } from './templates.js';

export class GamePromptBuilder {
  buildGameGenerationPrompt(spec: GameSpec, template: GameTemplate & { assets?: Record<string, string> }): string {
    const gameType = this.normalizeGameType(spec.type);
    const typeTemplates = GAME_TYPE_TEMPLATES[gameType] || GAME_TYPE_TEMPLATES.platformer;

    const templateCode = STANDARDIZED_GAME_TEMPLATE
      .replace('[GLOBAL_VARIABLES]', typeTemplates.globalVariables)
      .replace('[STORE_POSITIONS]', typeTemplates.storePositions)
      .replace('[RESET_OBJECTS]', typeTemplates.resetObjects)
      .replace('[GAME_OVER_SCREEN]', typeTemplates.gameOverScreen)
      .replace('[UPDATE_UI]', typeTemplates.updateUI)
      .replace('[PAUSE_SCREEN]', DEFAULT_UI_TEMPLATES.pauseScreen);

    const mechanics = spec.coreMechanics?.join(', ') || 'move, collect';
    const features = spec.features?.join(', ') || 'score';

    return `Generate a Phaser.js game: ${spec.name}. ${spec.originalDescription}. Type: ${spec.type}. Mechanics: ${mechanics}. Use arrow keys.

Code template (fill in sections):
${templateCode}

Fill these:
- WORLD_SETUP: platforms, boundaries
- GAME_OBJECTS: player, coins, enemies
- PHYSICS_SETUP: colliders
- UI_SETUP: score/lives text
- INPUT_HANDLING: arrow keys
- GAME_LOGIC: movement, collisions
- WIN_LOSE_CHECK: lives <= 0 -> gameOver()
- HELPER_FUNCTIONS: any needed
- RESTART_UI: hide game over

Use globals: player, platforms, coins, enemies, gameState, scoreText, livesText.
Generate ONLY the complete HTML file.`;
  }

  private normalizeGameType(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('shoot')) return 'shooter';
    if (t.includes('puzzle')) return 'puzzle';
    if (t.includes('platform') || t.includes('runner')) return 'platformer';
    return 'platformer';
  }

  buildAnalysisPrompt(description: string, context?: any): string {
    const d = description.toLowerCase();
    let type = 'platformer';
    if (d.includes('shoot')) type = 'shooter';
    else if (d.includes('puzzle')) type = 'puzzle';
    return `{"type":"${type}","name":"Game","description":"${description}","coreMechanics":["move"],"features":["score"],"playerCount":"1","difficulty":"medium"}`;
  }

  buildCodeValidationPrompt(code: string): string {
    return `Valid Phaser? ${code.slice(0, 100)} Return {"valid": true/false}`;
  }

  buildEnhancementPrompt(code: string, enhancementType: string): string {
    return `Enhance: ${code}`;
  }
}
