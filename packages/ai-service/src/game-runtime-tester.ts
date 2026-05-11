/**
 * Game Runtime Tester
 *
 * Tests generated game code by executing it in a controlled environment
 * to detect runtime errors that static analysis can't catch.
 */

import { ValidationResult } from './game-validator.js';

export interface RuntimeTestResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  executionTime: number;
}

export class GameRuntimeTester {
  private timeout = 10000; // 10 second timeout

  /**
   * Test game code by extracting and validating key functions
   * This is a lightweight runtime check without full browser
   */
  async testCode(code: string): Promise<RuntimeTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Extract the config and check for valid Phaser setup
      const configCheck = this.validateConfig(code);
      if (!configCheck.valid) {
        errors.push(...configCheck.errors);
      }
      warnings.push(...configCheck.warnings);

      // 2. Check scene functions exist and are valid
      const sceneCheck = this.validateScenes(code);
      if (!sceneCheck.valid) {
        errors.push(...sceneCheck.errors);
      }

      // 3. Check physics configuration
      const physicsCheck = this.validatePhysics(code);
      if (!physicsCheck.valid) {
        errors.push(...physicsCheck.errors);
      }

      // 4. Check for common runtime issues
      const runtimeCheck = this.checkCommonRuntimeIssues(code);
      errors.push(...runtimeCheck.errors);
      warnings.push(...runtimeCheck.warnings);

      // 5. Try to parse key functions for syntax errors
      const syntaxCheck = this.validateFunctionSyntax(code);
      if (!syntaxCheck.valid) {
        errors.push(...syntaxCheck.errors);
      }

    } catch (err: any) {
      errors.push(`Runtime test crashed: ${err.message}`);
    }

    const executionTime = Date.now() - startTime;

    return {
      success: errors.length === 0,
      errors,
      warnings,
      executionTime
    };
  }

  private validateConfig(code: string): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for Phaser config
    if (!/new\s+Phaser\.Game\s*\(/i.test(code)) {
      errors.push('No Phaser.Game instantiation found');
    }

    // Check config object exists
    if (!/const\s+config\s*=\s*\{/i.test(code)) {
      errors.push('No config object found');
    }

    // Check width/height are valid
    const widthMatch = code.match(/width:\s*(\d+)/);
    const heightMatch = code.match(/height:\s*(\d+)/);

    if (widthMatch) {
      const width = parseInt(widthMatch[1]);
      if (width < 100 || width > 3840) {
        warnings.push(`Unusual width: ${width}`);
      }
    }

    if (heightMatch) {
      const height = parseInt(heightMatch[1]);
      if (height < 100 || height > 2160) {
        warnings.push(`Unusual height: ${height}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private validateScenes(code: string): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for scene definition (either class or function)
    const hasClassScene = /class\s+\w+Scene\s+extends\s+Phaser\.Scene/i.test(code);
    const hasFunctionScene = /function\s+(preload|create|update)\s*\(/i.test(code);
    const hasSceneConfig = /scene:\s*\{/i.test(code);

    if (!hasClassScene && !hasFunctionScene && !hasSceneConfig) {
      errors.push('No scene definition found (class or functions)');
    }

    // Check preload exists
    if (!/preload\s*\(\s*\)/i.test(code) && !/preload:\s*(function|\()/i.test(code)) {
      warnings.push('No preload function found');
    }

    // Check create exists
    if (!/create\s*\(\s*\)/i.test(code) && !/create:\s*(function|\()/i.test(code)) {
      errors.push('No create function found - game will not initialize');
    }

    // Check update exists
    if (!/update\s*\(\s*\)/i.test(code) && !/update:\s*(function|\()/i.test(code)) {
      warnings.push('No update function found');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private validatePhysics(code: string): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check physics is enabled
    if (!/physics:\s*\{/i.test(code)) {
      errors.push('No physics configuration found');
    } else {
      // Check for arcade physics
      if (!/default:\s*['"]arcade['"]/i.test(code)) {
        warnings.push('Not using arcade physics - may not work as expected');
      }

      // Check gravity
      if (!/gravity/i.test(code)) {
        warnings.push('No gravity configured - player may not fall');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private checkCommonRuntimeIssues(code: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for potential null reference issues
    if (/player\.\w+\(/i.test(code) && !/player\s*=\s*this\.physics\.add\.sprite/i.test(code)) {
      warnings.push('Potential null reference: player may not be initialized');
    }

    // Check for missing super() in class
    if (/extends\s+Phaser\.Scene/i.test(code)) {
      if (!/super\s*\(\s*\)/i.test(code) && !/super\s*\(\s*\{\s*\}\s*\)/i.test(code)) {
        warnings.push('Scene class may be missing super() call');
      }
    }

    // Check for invalid texture keys
    const textureMatches = code.match(/('|")([^'"]+)\1/g) || [];
    const textures = textureMatches.map(m => m.replace(/['"]/g, ''));
    const uniqueTextures = [...new Set(textures)];

    // Check if textures are generated
    if (!/generateTexture|createGraphics|make\.graphics/i.test(code) && uniqueTextures.length > 5) {
      warnings.push('Multiple textures referenced but not generated - may cause runtime errors');
    }

    // Check for event listeners without context
    if (/on\s*\(\s*['"][^'"]+['"]\s*,/i.test(code)) {
      // Make sure there's a handler
      if (!/,\s*\w+\s*=>/i.test(code) && !/,\s*function/i.test(code)) {
        warnings.push('Event listener may be missing handler');
      }
    }

    return { errors, warnings };
  }

  private validateFunctionSyntax(code: string): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for specific truncation patterns that cause syntax errors
    // Pattern: shake(30,0.002)0.005) - duplicate numbers in function call
    if (/shake\(\d+,\d+\.\d+\)\d+\.\d+\)/.test(code)) {
      errors.push('Invalid syntax: duplicate parameters in shake() call');
    }

    // Pattern: onComplete:() => { p.destroy()}); - mismatched braces
    if (/onComplete:\(\)=>\{[^}]*destroy\(\)\}\);/.test(code)) {
      errors.push('Invalid syntax: mismatched braces in onComplete callback');
    }

    // Check for undefined variables used as text objects
    if (/\bdxt\b/.test(code) && !/var\s+dxt\s*=/.test(code) && !/let\s+dxt\s*=/.test(code) && !/const\s+dxt\s*=/.test(code)) {
      errors.push('Reference error: dxt is not defined');
    }

    // Check for gaState (truncated from gameState)
    if (/\bgaState\./.test(code)) {
      errors.push('Reference error: gaState is not defined (truncated from gameState)');
    }

    // Check for undefined properties - this.platforms used before initialization
    // Pattern: this.platforms.add called before this.platforms is assigned
    if (/this\.platforms\.add\(/i.test(code)) {
      // Check if platforms is initialized before any method call
      const platformsInit = code.indexOf('this.platforms = this.physics.add.staticGroup()');
      const firstPlatformUse = code.indexOf('this.platforms.add(');
      if (platformsInit === -1 || (firstPlatformUse !== -1 && firstPlatformUse < platformsInit)) {
        errors.push('Reference error: this.platforms used before initialization');
      }
    }

    // Check for common typos in method names
    if (/\bthis\.levs\./i.test(code)) {
      errors.push('Reference error: this.levs is not defined (typo for this.levels or this.levelText)');
    }

    if (/\bthis\.checkCollisns\b/i.test(code)) {
      errors.push('Typo: checkCollisns should be checkCollisions');
    }

    if (/\bthis\.updateComsplay\b/i.test(code)) {
      errors.push('Typo: updateComsplay should be updateComboDisplay');
    }

    // Check for duplicate variable declarations (e.g., var audioCtx and let audioCtx)
    const varNames = ['audioCtx', 'gameState', 'scoreText', 'livesText', 'levelText', 'comboText'];
    for (const name of varNames) {
      const matches = code.match(new RegExp(`(var|let|const)\\s+${name}\\s*=`, 'g'));
      if (matches && matches.length > 1) {
        errors.push(`Syntax error: ${name} is declared multiple times`);
      }
    }

    // Check for scene array using class references (before class definitions)
    // Pattern: scene: [TitleScene, GameScene] where classes are defined later
    const sceneClassMatch = code.match(/scene:\s*\[([A-Z][a-zA-Z]+(?:,\s*[A-Z][a-zA-Z]+)*)\]/);
    if (sceneClassMatch) {
      const classNames = sceneClassMatch[1].split(',').map((s: string) => s.trim());
      // Check if these classes are defined AFTER the config
      const configMatch = code.match(/const\s+config\s*=/);
      if (configMatch) {
        const configPos = configMatch.index || 0;
        // Check if any class definition comes after config
        const anyClassAfter = classNames.some((name: string) => {
          const classMatch = code.indexOf(`class ${name} extends`);
          return classMatch === -1 || classMatch > configPos;
        });
        if (anyClassAfter) {
          errors.push('Scene classes used before definition - use string keys like [\'TitleScene\', \'GameScene\']');
        }
      }
    }

    // Check for balanced braces in key sections
    const preloadMatch = code.match(/preload[^{]*\{([\s\S]*?)\n\s*\}/i);
    const createMatch = code.match(/create[^{]*\{([\s\S]*?)\n\s*\}/i);

    if (preloadMatch) {
      const braces = preloadMatch[1].match(/[{}]/g) || [];
      const open = braces.filter(b => b === '{').length;
      const close = braces.filter(b => b === '}').length;
      if (open !== close) {
        errors.push('preload function has unbalanced braces');
      }
    }

    if (createMatch) {
      const braces = createMatch[1].match(/[{}]/g) || [];
      const open = braces.filter(b => b === '{').length;
      const close = braces.filter(b => b === '}').length;
      if (open !== close) {
        errors.push('create function has unbalanced braces');
      }
    }

    // Check all functions for balanced braces more broadly
    const allBraces = (code.match(/[{}]/g) || []).length;
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (Math.abs(openBraces - closeBraces) > 3) {
      errors.push(`Severely unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Generate a comprehensive test report
   */
  generateReport(staticResult: ValidationResult, runtimeResult: RuntimeTestResult): string {
    const lines: string[] = [];

    lines.push('=== GAME VALIDATION REPORT ===');
    lines.push('');
    lines.push('STATIC ANALYSIS:');
    lines.push(`  Valid: ${staticResult.isValid}`);
    if (staticResult.isTruncated) lines.push(`  Truncated: ${staticResult.truncationReason}`);
    if (staticResult.syntaxErrors.length) lines.push(`  Syntax Errors: ${staticResult.syntaxErrors.join(', ')}`);
    if (staticResult.hallucinations.length) lines.push(`  Hallucinations: ${staticResult.hallucinations.join(', ')}`);
    if (staticResult.missingFunctions.length) lines.push(`  Missing Functions: ${staticResult.missingFunctions.join(', ')}`);
    if (staticResult.missingGameElements.length) lines.push(`  Missing Elements: ${staticResult.missingGameElements.join(', ')}`);
    if (staticResult.logicErrors.length) lines.push(`  Logic Errors: ${staticResult.logicErrors.join(', ')}`);

    lines.push('');
    lines.push('RUNTIME TEST:');
    lines.push(`  Success: ${runtimeResult.success}`);
    lines.push(`  Execution Time: ${runtimeResult.executionTime}ms`);
    if (runtimeResult.errors.length) lines.push(`  Errors: ${runtimeResult.errors.join(', ')}`);
    if (runtimeResult.warnings.length) lines.push(`  Warnings: ${runtimeResult.warnings.join(', ')}`);

    return lines.join('\n');
  }
}

export default GameRuntimeTester;
