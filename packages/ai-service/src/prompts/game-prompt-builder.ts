import { GameSpec, GameTemplate } from '@gamevibe/shared';
import { STANDARDIZED_GAME_TEMPLATE, GAME_TYPE_TEMPLATES } from './templates.js';

type GameTypeKey = 'platformer' | 'shooter' | 'puzzle';

export class GamePromptBuilder {
  buildGameGenerationPrompt(spec: GameSpec, template: GameTemplate & { assets?: Record<string, string> }): string {
    // Use user's actual description, not just the type
    const userDescription = spec.description || spec.originalDescription || spec.type || 'platformer game';
    
    // Include user's description in the prompt so AI understands what they want
    return `Create a custom Phaser.js game based on this description: "${userDescription}"

Requirements:
- Implement the game EXACTLY as described in the description above
- Use Phaser 3.70 with arcade physics
- Generate all graphics textures programmatically (no external images)
- Include: player controls, scoring, lives system, game over state
- ALL code in ONE complete HTML file
- Start with <!DOCTYPE html><html> and end with </html>
- Do NOT include any markdown, explanations, or additional text - ONLY the raw HTML code`;
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
