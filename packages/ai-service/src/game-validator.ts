/**
 * Game Validator - Comprehensive Error Detection for AI-Generated Game Code
 *
 * Provides multi-layer validation:
 * 1. Static Analysis: Truncation, syntax, hallucinations, missing elements
 * 2. Runtime Testing: Executes code to detect runtime errors
 * 3. Auto-Fix: Attempts to repair known issues
 */

export interface ValidationResult {
  isValid: boolean;
  isTruncated: boolean;
  truncationReason?: string;
  syntaxErrors: string[];
  missingFunctions: string[];
  missingGameElements: string[];
  hallucinations: string[];
  logicErrors: string[];
  runtimeErrors: string[];
}

export interface FixResult {
  fixed: boolean;
  code: string;
  fixes: string[];
}

export class GameValidator {
  // Required functions that must be present in a valid game
  private readonly REQUIRED_FUNCTIONS = [
    'preload',
    'create',
    'update'
  ];

  // Complete list of required game elements
  private readonly REQUIRED_GAME_ELEMENTS = [
    { pattern: /\bplayer\b/i, name: 'player sprite', required: true },
    { pattern: /\b(score|scoreText|gameState\.score)\b/i, name: 'score system', required: true },
    { pattern: /\b(physics|collider|overlap)\b/i, name: 'physics system', required: true },
    { pattern: /\bplatforms?\b/i, name: 'platforms', required: true },
    { pattern: /\b(cursors|arrowKeys|keyDown|keyIsDown)\b/i, name: 'keyboard controls', required: true },
    { pattern: /\b(gravity|setGravity|gravityY)\b/i, name: 'gravity', required: true },
  ];

  // Optional but recommended elements
  private readonly RECOMMENDED_ELEMENTS = [
    { pattern: /\b(enemies?|baddies)\b/i, name: 'enemies' },
    { pattern: /\b(coins?|gems?|collectibles)\b/i, name: 'collectibles' },
    { pattern: /\b(lives?|health|hp)\b/i, name: 'lives/health' },
    { pattern: /\b(gameover|gameOver|isGameOver)\b/i, name: 'game over' },
    { pattern: /\b(restart|restartGame|resetGame)\b/i, name: 'restart capability' },
  ];

  // COMPLETE hallucination patterns - all known AI mistakes
  private readonly KNOWN_HALLUCINATIONS = [
    // Typoes
    { pattern: /\.adtext\(/, fix: '.add.text(', reason: 'typo: adtext -> add.text' },
    { pattern: /\.setSc1\)/, fix: '.setScale(', reason: 'typo: setSc1 -> setScale' },
    { pattern: /pointerdwn/, fix: 'pointerdown', reason: 'typo: pointerdwn -> pointerdown' },
    { pattern: /fontSill:/, fix: 'fontSize:', reason: 'typo: fontSill -> fontSize' },
    { pattern: /fontWe\}/, fix: "fontWeight:'bold'}", reason: 'truncated: fontWe -> fontWeight' },
    { pattern: /fontWe\)/, fix: "fontWeight:'bold'})", reason: 'truncated: fontWe -> fontWeight' },
    { pattern: /fontW}/, fix: "fontWeight:'bold'}", reason: 'truncated: fontW -> fontWeight' },
    { pattern: /this\.add\.tt\(/, fix: 'this.add.text(', reason: 'typo: add.tt -> add.text' },

    // Truncation bugs - platforms
    { pattern: /\borgs\./, fix: 'platforms.', reason: 'truncated: orms -> platforms' },
    { pattern: /\borgs\b/, fix: 'platforms', reason: 'truncated: orms -> platforms' },
    { pattern: /platfplatfplatforms/, fix: 'platforms', reason: 'truncated: duplicate platforms' },
    { pattern: /platfplatforms\./, fix: 'platforms.', reason: 'truncated: platfplatforms -> platforms' },
    { pattern: /platfplatforms\b/, fix: 'platforms', reason: 'truncated: platfplatforms -> platforms' },

    // Truncation bugs - gameState
    { pattern: /gameState\.gameState\./, fix: 'gameState.', reason: 'truncated: duplicate gameState' },
    { pattern: /\bgaState\./, fix: 'gameState.', reason: 'truncated: gaState -> gameState' },
    { pattern: /\bgameSta\./, fix: 'gameState.', reason: 'truncated: gameSta -> gameState' },
    { pattern: /\bgameStat\./, fix: 'gameState.', reason: 'truncated: gameStat -> gameState' },

    // Truncation bugs - player
    { pattern: /player\.s,0/, fix: 'player.setVelocity(0, 0)', reason: 'truncated: player.s,0 -> setVelocity' },
    { pattern: /player\.s,\s*0\)/, fix: 'player.setVelocity(0, 0)', reason: 'truncated: player.s,0 -> setVelocity' },
    { pattern: /player\.s,/, fix: 'player.setVelocity(', reason: 'truncated: player.s -> setVelocity' },

    // Truncation bugs - comboCount
    { pattern: /\bmboCount\b/, fix: 'comboCount', reason: 'truncated: mboCount -> comboCount' },

    // Truncation bugs - fontSize
    { pattern: /\{ fpx/, fix: "{ fontSize:'20px'", reason: 'truncated: fontSize -> fpx' },
    { pattern: /fpx'/, fix: "fontSize:'20px'", reason: 'truncated: fontSize -> fpx' },

    // Truncation bugs - btn
    { pattern: /\bb\.on\(/, fix: 'btn.on(', reason: 'truncated: btn -> b' },

    // Truncation bugs - functions
    { pattern: /functionObjects\s*\(/, fix: 'spawnObjects(', reason: 'truncated: functionObjects -> spawnObjects' },
    { pattern: /function\s+spacts\s*\(/, fix: 'function spawnObjects(', reason: 'truncated: spacts -> spawnObjects' },
    { pattern: /spacts\(\)\s*\{/, fix: 'spawnObjects() {', reason: 'truncated: spacts -> spawnObjects' },
    { pattern: /spawnObjcts\(\)\s*\{/, fix: 'spawnObjects() {', reason: 'truncated: spawnObjcts -> spawnObjects' },
    { pattern: /fu\s+/, fix: 'function ', reason: 'truncated: fu -> function' },

    // Truncation bugs - setScrollFn
    { pattern: /\.setScrollFn/g, fix: '.setScrollFactor', reason: 'truncated: setScrollFn -> setScrollFactor' },

    // Truncation bugs - misc
    { pattern: /this\.cameras\.main\.shake\(\d+,/, fix: 'this.cameras.main.shake(30,0.002)', reason: 'misplaced camera shake' },
    { pattern: /Phaser\.Math\.Between\(/, fix: 'Phaser.Math.Between(', reason: 'needs full method' },

    // Invalid Phaser APIs
    { pattern: /\.refreshBod\}/, fix: '.refreshBody()}', reason: 'truncated: refreshBod -> refreshBody' },
    { pattern: /\.refre\(\)/, fix: '.refreshBody()', reason: 'truncated: refre -> refreshBody' },

    // Syntax errors
    { pattern: /;;/g, fix: ';', reason: 'double semicolon' },
    { pattern: /,,/g, fix: ',', reason: 'double comma' },
    { pattern: /this\.add\.text\(0+0,/, fix: 'this.add.text(0,', reason: 'extra zeros in coordinates' },
    { pattern: /fontSize:'fill:'#/, fix: "fontSize:'14px',fill:'#", reason: 'nested fontSize and fill' },

    // Invalid properties
    { pattern: /player\.s\.setOrigin/, fix: 'player.setOrigin', reason: 'double property access' },
    { pattern: /\.s\.setOrigin/g, fix: '.setOrigin', reason: 'truncated: .s.setOrigin -> .setOrigin' },
  ];

  // Known truncation markers
  private readonly TRUNCATION_PATTERNS: { pattern: RegExp; reason: string }[] = [
    { pattern: /,\s*$/, reason: 'ends with trailing comma' },
    { pattern: /"\s*$/, reason: 'ends with unclosed string' },
    { pattern: /'\s*$/, reason: 'ends with unclosed string' },
    { pattern: /\(\s*$/, reason: 'ends with unclosed parenthesis' },
    { pattern: /this\.cameras\.main\.shake\(\s*$/, reason: 'incomplete camera shake' },
    { pattern: /gameState\.\s*$/, reason: 'incomplete gameState access' },
    { pattern: /if\s*\(\s*$/, reason: 'incomplete if statement' },
    { pattern: /for\s*\(\s*$/, reason: 'incomplete for loop' },
    { pattern: /\w+\.\w+\([^)]*;$/, reason: 'incomplete function call' },
    { pattern: /\w+\([^)]*;$/, reason: 'incomplete function call' },
  ];

  // Logic error patterns
  private readonly LOGIC_ERROR_PATTERNS = [
    { pattern: /gravity:\s*0(?!\d)/, reason: 'zero gravity - game will not work properly' },
    { pattern: /gravityY:\s*0(?!\d)/, reason: 'zero gravity - game will not work properly' },
    { pattern: /width:\s*0(?![,\d])/, reason: 'zero width - game canvas will be invisible' },
    { pattern: /height:\s*0(?![,\d])/, reason: 'zero height - game canvas will be invisible' },
    { pattern: /setCollideWorldBounds\(false\)(?![,;])/i, reason: 'player can leave screen' },
    { pattern: /player\.setInteractive\([^)]*\)(?![,;])\s*[^}]/i, reason: 'player not interactive without handler' },
  ];

  /**
   * Main validation function - comprehensive check
   */
  validate(code: string): ValidationResult {
    const syntaxErrors: string[] = [];
    const missingFunctions: string[] = [];
    const missingGameElements: string[] = [];
    const hallucinations: string[] = [];
    const logicErrors: string[] = [];
    const runtimeErrors: string[] = [];

    // 1. Check for truncation
    const truncationCheck = this.detectTruncation(code);
    if (truncationCheck.isTruncated) {
      return {
        isValid: false,
        isTruncated: true,
        truncationReason: truncationCheck.reason,
        syntaxErrors,
        missingFunctions: this.findMissingFunctions(code),
        missingGameElements: this.findMissingGameElements(code),
        hallucinations: this.detectHallucinations(code),
        logicErrors,
        runtimeErrors
      };
    }

    // 2. Check balanced braces
    const braceCheck = this.checkBalancedBraces(code);
    if (!braceCheck.balanced) {
      syntaxErrors.push(`Unbalanced braces: ${braceCheck.openCount} open, ${braceCheck.closeCount} close`);
    }

    // 3. Check balanced parentheses
    const parenCheck = this.checkBalancedParens(code);
    if (!parenCheck.balanced) {
      syntaxErrors.push(`Unbalanced parentheses: ${parenCheck.openCount} open, ${parenCheck.closeCount} close`);
    }

    // 4. Check balanced strings
    const stringCheck = this.checkBalancedStrings(code);
    if (!stringCheck.balanced) {
      syntaxErrors.push('Unbalanced quotes detected');
    }

    // 5. Check for hallucinations/typos
    const hallu = this.detectHallucinations(code);
    if (hallu.length > 0) {
      hallucinations.push(...hallu);
    }

    // 6. Check for missing functions
    const missing = this.findMissingFunctions(code);
    if (missing.length > 0) {
      missingFunctions.push(...missing);
    }

    // 7. Check for missing game elements
    const missingElements = this.findMissingGameElements(code);
    if (missingElements.length > 0) {
      missingGameElements.push(...missingElements);
    }

    // 8. Check for logic errors
    const logicErrs = this.detectLogicErrors(code);
    if (logicErrs.length > 0) {
      logicErrors.push(...logicErrs);
    }

    const isValid = syntaxErrors.length === 0 &&
                    missingFunctions.length === 0 &&
                    missingGameElements.length === 0 &&
                    hallucinations.length === 0 &&
                    logicErrors.length === 0;

    return {
      isValid,
      isTruncated: false,
      syntaxErrors,
      missingFunctions,
      missingGameElements,
      hallucinations,
      logicErrors,
      runtimeErrors
    };
  }

  /**
   * Auto-fix all detected issues
   */
  fix(code: string): FixResult {
    let fixed = code;
    const fixes: string[] = [];

    // Apply all hallucination fixes
    for (const { pattern, fix, reason } of this.KNOWN_HALLUCINATIONS) {
      const before = fixed;
      fixed = fixed.replace(pattern, fix);
      if (fixed !== before) {
        fixes.push(`Fixed: ${reason}`);
      }
    }

    // Apply multiple passes for nested issues
    for (let i = 0; i < 3; i++) {
      const before = fixed;
      // Fix nested gameState.gameState
      fixed = fixed.replace(/gameState\.gameState\./g, 'gameState.');
      // Fix nested platform issues
      fixed = fixed.replace(/platfplatf(platforms?)/g, '$1');
      if (fixed === before) break;
    }

    // Fix double semicolons and commas
    fixed = fixed.replace(/;;/g, ';');
    fixed = fixed.replace(/,,/g, ',');

    // Fix arrow function without braces
    fixed = fixed.replace(/onComplete:\(\)=>([^;{]+);([^}]+)}/g, (_, a, b) =>
      `onComplete:() => { ${a.trim()}; ${b.trim()}; }`);

    const isFixed = fixes.length > 0 || fixed !== code;

    return {
      fixed: isFixed,
      code: fixed,
      fixes
    };
  }

  /**
   * Detect truncation patterns
   */
  private detectTruncation(code: string): { isTruncated: boolean; reason?: string } {
    if (!code || code.length < 100) {
      return { isTruncated: true, reason: 'code too short' };
    }

    for (const { pattern, reason } of this.TRUNCATION_PATTERNS) {
      if (pattern.test(code)) {
        return { isTruncated: true, reason };
      }
    }

    const braceCheck = this.checkBalancedBraces(code);
    if (Math.abs(braceCheck.openCount - braceCheck.closeCount) > 5) {
      return { isTruncated: true, reason: `severely unbalanced braces (${braceCheck.openCount - braceCheck.closeCount})` };
    }

    return { isTruncated: false };
  }

  /**
   * Detect hallucinations/typos
   */
  private detectHallucinations(code: string): string[] {
    const found: string[] = [];

    for (const { pattern, reason } of this.KNOWN_HALLUCINATIONS) {
      if (pattern.test(code)) {
        found.push(reason);
      }
    }

    return [...new Set(found)]; // Dedupe
  }

  /**
   * Find missing required functions
   */
  private findMissingFunctions(code: string): string[] {
    const missing: string[] = [];
    const isClassBased = /class\s+\w+Scene\s+extends\s+Phaser\.Scene/i.test(code);

    for (const func of this.REQUIRED_FUNCTIONS) {
      let found = false;

      if (isClassBased) {
        found = /\b(preload|create|update)\s*\(\s*\)\s*\{/i.test(code) ||
                new RegExp(`${func}\\s*:\\s*function`).test(code);
      } else {
        found = new RegExp(`function\\s+${func}\\s*\\(|${func}\\s*=\\s*function`).test(code);
      }

      if (!found) missing.push(func);
    }

    return missing;
  }

  /**
   * Find missing game elements
   */
  private findMissingGameElements(code: string): string[] {
    const missing: string[] = [];

    for (const { pattern, name, required } of this.REQUIRED_GAME_ELEMENTS) {
      if (!pattern.test(code) && required) {
        missing.push(name);
      }
    }

    return missing;
  }

  /**
   * Detect logic errors
   */
  private detectLogicErrors(code: string): string[] {
    const errors: string[] = [];

    for (const { pattern, reason } of this.LOGIC_ERROR_PATTERNS) {
      if (pattern.test(code)) {
        errors.push(reason);
      }
    }

    return errors;
  }

  /**
   * Check balanced braces
   */
  private checkBalancedBraces(code: string): { balanced: boolean; openCount: number; closeCount: number } {
    const openCount = (code.match(/{/g) || []).length;
    const closeCount = (code.match(/}/g) || []).length;
    return { balanced: openCount === closeCount, openCount, closeCount };
  }

  /**
   * Check balanced parentheses
   */
  private checkBalancedParens(code: string): { balanced: boolean; openCount: number; closeCount: number } {
    const openCount = (code.match(/\(/g) || []).length;
    const closeCount = (code.match(/\)/g) || []).length;
    return { balanced: openCount === closeCount, openCount, closeCount };
  }

  /**
   * Check balanced strings
   */
  private checkBalancedStrings(code: string): { balanced: boolean } {
    const singleQuotes = (code.match(/'/g) || []).length;
    const doubleQuotes = (code.match(/"/g) || []).length;
    return { balanced: singleQuotes % 2 === 0 && doubleQuotes % 2 === 0 };
  }

  /**
   * Get summary of all issues for debugging
   */
  getValidationSummary(result: ValidationResult): string {
    const issues: string[] = [];

    if (result.isTruncated) issues.push(`TRUNCATED: ${result.truncationReason}`);
    if (result.syntaxErrors.length) issues.push(`SYNTAX: ${result.syntaxErrors.join('; ')}`);
    if (result.hallucinations.length) issues.push(`HALLUCINATIONS: ${result.hallucinations.join('; ')}`);
    if (result.missingFunctions.length) issues.push(`MISSING FUNCS: ${result.missingFunctions.join('; ')}`);
    if (result.missingGameElements.length) issues.push(`MISSING ELEMENTS: ${result.missingGameElements.join('; ')}`);
    if (result.logicErrors.length) issues.push(`LOGIC: ${result.logicErrors.join('; ')}`);
    if (result.runtimeErrors.length) issues.push(`RUNTIME: ${result.runtimeErrors.join('; ')}`);

    return issues.length ? issues.join(' | ') : 'VALID';
  }

  /**
   * Get continuation prompt for truncated code
   */
  getContinuationPrompt(code: string, reason: string): string {
    const lastChars = code.slice(-500);
    return `Continue the game code from where it was cut off.

The code was truncated because: ${reason}

Last part of code:
${lastChars}

Continue and complete the game code. Include any incomplete functions or statements. Output ONLY the raw HTML code starting with <!DOCTYPE html>.`;
  }

  /**
   * Get reflexion prompt for fixing errors
   */
  getReflexionPrompt(code: string, validation: ValidationResult): string {
    const lastChars = code.slice(-1000);
    const issues: string[] = [];

    if (validation.isTruncated && validation.truncationReason) {
      issues.push(`TRUNCATION: ${validation.truncationReason}`);
    }
    if (validation.syntaxErrors.length) {
      issues.push(`SYNTAX ERRORS: ${validation.syntaxErrors.join('; ')}`);
    }
    if (validation.hallucinations.length) {
      issues.push(`HALLUCINATIONS: ${validation.hallucinations.join('; ')}`);
    }
    if (validation.missingFunctions.length) {
      issues.push(`MISSING FUNCTIONS: ${validation.missingFunctions.join('; ')}`);
    }
    if (validation.missingGameElements.length) {
      issues.push(`MISSING ELEMENTS: ${validation.missingGameElements.join('; ')}`);
    }

    return `Fix the following issues in the game code:

Issues found:
${issues.join('\n')}

Code to fix (last 1000 chars):
${lastChars}

Fix ONLY the issues above while keeping the rest of the code intact. Output ONLY the raw HTML code starting with <!DOCTYPE html>.`;
  }
}

export default GameValidator;
