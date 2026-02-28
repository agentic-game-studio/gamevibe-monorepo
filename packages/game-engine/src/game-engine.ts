import { GameSpec, GameTemplate, GameType, ValidationResult } from '@gamevibe/shared';
import { getTemplate, getMultiplayerTemplate, getAllTemplates } from './templates/index.js';
import { GameValidator } from './validators/index.js';
import { GameCompiler } from './compiler.js';

export class GameEngine {
  private validator: GameValidator;
  private compiler: GameCompiler;
  
  constructor() {
    this.validator = new GameValidator();
    this.compiler = new GameCompiler();
  }
  
  async selectTemplate(spec: GameSpec): Promise<GameTemplate> {
    // Check if this is a multiplayer game (more than 1 player)
    if (spec.playerCount !== '1') {
      // Try to get a multiplayer template for this game type
      const multiplayerTemplateId = `multiplayer-${spec.type}`;
      const multiplayerTemplate = getMultiplayerTemplate(multiplayerTemplateId);
      
      if (multiplayerTemplate) {
        console.log(`Using multiplayer template: ${multiplayerTemplateId}`);
        return multiplayerTemplate;
      }
      
      console.warn(`No multiplayer template found for type: ${spec.type}, using single-player template`);
    }
    
    // Get template for the specified game type
    const template = getTemplate(spec.type);
    
    if (!template) {
      // Fallback to a generic template
      console.warn(`No template found for type: ${spec.type}, using platformer as fallback`);
      return getTemplate('platformer')!;
    }
    
    return template;
  }
  
  async compile(code: string, assets?: any): Promise<{ code: string; assets: any }> {
    // Compile and optimize the game code
    const compiled = await this.compiler.compile(code, {
      minify: false, // Keep readable for now
      includePhaserCDN: true,
      assets
    });
    
    return compiled;
  }
  
  async validateCode(code: string): Promise<ValidationResult> {
    return this.validator.validate(code);
  }
  
  async fixGeneratedCode(code: string, errors: string[]): Promise<string> {
    // Attempt to fix common issues in generated code
    let fixedCode = code;
    
    for (const error of errors) {
      if (error.includes('missing semicolon')) {
        // Add missing semicolons
        fixedCode = this.addMissingSemicolons(fixedCode);
      } else if (error.includes('undefined variable')) {
        // Fix undefined variables
        fixedCode = this.fixUndefinedVariables(fixedCode, error);
      } else if (error.includes('syntax error')) {
        // Fix common syntax errors
        fixedCode = this.fixSyntaxErrors(fixedCode);
      }
    }
    
    // Validate the fixed code
    const validation = await this.validateCode(fixedCode);
    if (!validation.valid) {
      console.warn('Could not fix all errors:', validation.error);
    }
    
    return fixedCode;
  }
  
  getAvailableTemplates(): GameTemplate[] {
    return getAllTemplates();
  }
  
  generateAssetManifest(gameType: GameType): any {
    // Generate a manifest of required assets for a game type
    const commonAssets = {
      images: {
        background: { width: 800, height: 600, type: 'gradient' },
        particle: { width: 8, height: 8, type: 'circle' }
      },
      audio: {
        bgm: { type: 'generated', duration: 60 },
        sfx: {
          jump: { type: 'synth', duration: 0.2 },
          collect: { type: 'synth', duration: 0.3 },
          hit: { type: 'synth', duration: 0.2 },
          gameOver: { type: 'synth', duration: 1.0 }
        }
      }
    };
    
    const typeSpecificAssets: Record<GameType, any> = {
      platformer: {
        images: {
          player: { width: 32, height: 48, type: 'sprite' },
          platform: { width: 64, height: 16, type: 'tile' },
          collectible: { width: 24, height: 24, type: 'sprite' }
        }
      },
      puzzle: {
        images: {
          gem: { width: 48, height: 48, type: 'sprite', variants: 6 },
          board: { width: 400, height: 400, type: 'grid' }
        }
      },
      shooter: {
        images: {
          ship: { width: 48, height: 48, type: 'sprite' },
          bullet: { width: 8, height: 16, type: 'sprite' },
          enemy: { width: 32, height: 32, type: 'sprite', variants: 3 }
        }
      },
      rpg: {
        images: {
          hero: { width: 32, height: 48, type: 'sprite' },
          enemy: { width: 32, height: 48, type: 'sprite', variants: 5 },
          tileset: { width: 512, height: 512, type: 'tilemap' }
        }
      },
      'endless-runner': {
        images: {
          runner: { width: 48, height: 48, type: 'sprite' },
          obstacle: { width: 32, height: 64, type: 'sprite', variants: 3 },
          ground: { width: 64, height: 64, type: 'tile' }
        }
      },
      'tower-defense': {
        images: {
          tower: { width: 48, height: 48, type: 'sprite', variants: 3 },
          enemy: { width: 32, height: 32, type: 'sprite', variants: 4 },
          projectile: { width: 16, height: 16, type: 'sprite' },
          path: { width: 64, height: 64, type: 'tile' }
        }
      },
      other: {
        images: {
          sprite: { width: 32, height: 32, type: 'sprite' }
        }
      }
    };
    
    return {
      ...commonAssets,
      ...typeSpecificAssets[gameType]
    };
  }
  
  private addMissingSemicolons(code: string): string {
    // Simple regex to add missing semicolons
    return code.replace(/([})])\s*\n\s*([a-zA-Z])/g, '$1;\n$2');
  }
  
  private fixUndefinedVariables(code: string, error: string): string {
    // Extract variable name from error
    const match = error.match(/undefined variable: (\w+)/);
    if (match) {
      const varName = match[1];
      // Add declaration at the beginning of the create method
      code = code.replace(
        /create\(\)\s*{/,
        `create() {\n    this.${varName} = null; // Auto-fixed undefined variable`
      );
    }
    return code;
  }
  
  private fixSyntaxErrors(code: string): string {
    // Fix common syntax errors
    // Balance braces
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    
    if (openBraces > closeBraces) {
      code += '\n}'.repeat(openBraces - closeBraces);
    }
    
    // Fix trailing commas in objects
    code = code.replace(/,\s*}/g, '}');
    
    return code;
  }
}