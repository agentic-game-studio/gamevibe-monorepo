/**
 * Game Validator - Detects truncation and validates game code syntax
 *
 * Provides real-time detection of AI output truncation and validation
 * of generated game code before returning to users.
 */

export interface ValidationResult {
  isValid: boolean;
  isTruncated: boolean;
  truncationReason?: string;
  syntaxErrors: string[];
  missingFunctions: string[];
}

export class GameValidator {
  // Required functions that must be present in a valid game
  private readonly REQUIRED_FUNCTIONS = [
    'preload',
    'create',
    'update'
  ];

  // Known truncation markers that indicate incomplete code
  private readonly TRUNCATION_PATTERNS = [
    { pattern: /,\s*$/, reason: 'ends with trailing comma' },
    { pattern: /"\s*$/, reason: 'ends with unclosed string' },
    { pattern: /'\s*$/, reason: 'ends with unclosed string' },
    { pattern: /\(\s*$/, reason: 'ends with unclosed parenthesis' },
    { pattern: /this\.cameras\.main\.shake\(\s*$/, reason: 'incomplete camera shake call' },
    { pattern: /gameState\.\s*$/, reason: 'incomplete gameState access' },
    { pattern: /if\s*\(\s*$/, reason: 'incomplete if statement' },
    { pattern: /for\s*\(\s*$/, reason: 'incomplete for loop' },
  ];

  /**
   * Main validation function - checks for truncation and syntax issues
   */
  validate(code: string): ValidationResult {
    const syntaxErrors: string[] = [];
    const missingFunctions: string[] = [];

    // Check for truncation patterns
    const truncationCheck = this.detectTruncation(code);
    if (truncationCheck.isTruncated) {
      return {
        isValid: false,
        isTruncated: true,
        truncationReason: truncationCheck.reason,
        syntaxErrors,
        missingFunctions: this.findMissingFunctions(code)
      };
    }

    // Check for balanced braces
    const braceCheck = this.checkBalancedBraces(code);
    if (!braceCheck.balanced) {
      syntaxErrors.push(`Unbalanced braces: ${braceCheck.openCount} open, ${braceCheck.closeCount} close`);
    }

    // Check for balanced parentheses
    const parenCheck = this.checkBalancedParens(code);
    if (!parenCheck.balanced) {
      syntaxErrors.push(`Unbalanced parentheses: ${parenCheck.openCount} open, ${parenCheck.closeCount} close`);
    }

    // Check for balanced strings
    const stringCheck = this.checkBalancedStrings(code);
    if (!stringCheck.balanced) {
      syntaxErrors.push('Unbalanced quotes detected');
    }

    // Check for required Phaser functions
    const missing = this.findMissingFunctions(code);
    if (missing.length > 0) {
      missingFunctions.push(...missing);
    }

    const isValid = syntaxErrors.length === 0 && missingFunctions.length === 0;

    return {
      isValid,
      isTruncated: false,
      syntaxErrors,
      missingFunctions
    };
  }

  /**
   * Detect if the code appears to be truncated
   */
  detectTruncation(code: string): { isTruncated: boolean; reason?: string } {
    // Very short code is likely truncated or incomplete
    if (!code || code.length < 30) {
      return { isTruncated: true, reason: 'code too short' };
    }

    // Check known truncation patterns (these indicate AI was cut off)
    for (const { pattern, reason } of this.TRUNCATION_PATTERNS) {
      if (pattern.test(code)) {
        return { isTruncated: true, reason };
      }
    }

    // Check for severely unbalanced braces (more than 5 difference is suspicious)
    const braceCheck = this.checkBalancedBraces(code);
    if (Math.abs(braceCheck.openCount - braceCheck.closeCount) > 5) {
      return { isTruncated: true, reason: `severely unbalanced braces (${braceCheck.openCount - braceCheck.closeCount} more opens)` };
    }

    // Check if code ends abruptly (no closing for last 100 chars)
    const lastChars = code.slice(-100);
    if (/[a-zA-Z0-9_]$/.test(lastChars) && !lastChars.includes(';') && !lastChars.includes('}')) {
      // Only flag if the code is substantial - this is a heuristic
      if (code.length > 1000) {
        return { isTruncated: true, reason: 'code ends abruptly without statement termination' };
      }
    }

    // Check for known truncated variable names
    const truncatedVars = [
      { pattern: /\borms\b/, replacement: 'platforms', context: 'platform array' },
      { pattern: /\bgaState\b/, replacement: 'gameState', context: 'game state object' },
      { pattern: /\bgameSta\./, replacement: 'gameState.', context: 'game state access' },
      { pattern: /\bspacts\(\)/, replacement: 'spawnObjects()', context: 'spawn function' },
    ];

    for (const { pattern, replacement, context } of truncatedVars) {
      if (pattern.test(code)) {
        // This is a truncation indicator, not necessarily the whole code being truncated
        console.log(`[Validator] Detected truncated variable pattern: ${pattern} -> ${replacement} (${context})`);
      }
    }

    return { isTruncated: false };
  }

  /**
   * Check for balanced curly braces
   */
  private checkBalancedBraces(code: string): { balanced: boolean; openCount: number; closeCount: number } {
    const openCount = (code.match(/{/g) || []).length;
    const closeCount = (code.match(/}/g) || []).length;
    return {
      balanced: openCount === closeCount,
      openCount,
      closeCount
    };
  }

  /**
   * Check for balanced parentheses
   */
  private checkBalancedParens(code: string): { balanced: boolean; openCount: number; closeCount: number } {
    const openCount = (code.match(/\(/g) || []).length;
    const closeCount = (code.match(/\)/g) || []).length;
    return {
      balanced: openCount === closeCount,
      openCount,
      closeCount
    };
  }

  /**
   * Check for balanced string quotes
   */
  private checkBalancedStrings(code: string): { balanced: boolean } {
    // Simple check: count quotes
    const singleQuotes = (code.match(/'/g) || []).length;
    const doubleQuotes = (code.match(/"/g) || []).length;
    const templateQuotes = (code.match(/`/g) || []).length;

    // Allow for template literals with ${} inside
    return {
      balanced: (singleQuotes % 2 === 0) && (doubleQuotes % 2 === 0) && (templateQuotes % 2 === 0)
    };
  }

  /**
   * Find missing required functions
   */
  private findMissingFunctions(code: string): string[] {
    const missing: string[] = [];

    for (const func of this.REQUIRED_FUNCTIONS) {
      // Check for function name( or name = function(
      const pattern = new RegExp(`function\\s+${func}\\s*\\(|${func}\\s*=\\s*function\\s*\\(|this\\.scene\\.start\\(['"]${func}['"]`, 'i');
      if (!pattern.test(code)) {
        missing.push(func);
      }
    }

    return missing;
  }

  /**
   * Get a continuation prompt for completing truncated code
   */
  getContinuationPrompt(code: string, reason: string): string {
    const lastChars = code.slice(-800);

    return `Continue the game code from where it was cut off. The code was truncated because: ${reason}

Start with the incomplete section and complete it properly. Make sure to close all braces, parentheses, and strings.

The last part of the code so far:
${lastChars}

Continue the code, completing any unfinished functions, statements, or expressions. Return only the continuation, not the full code.`;
  }
}

export default GameValidator;
