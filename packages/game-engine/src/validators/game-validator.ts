import { ValidationResult } from '@gamevibe/shared';

export class GameValidator {
  private forbiddenPatterns = [
    'eval',
    'Function\\s*\\(',
    'require\\s*\\(',
    'import\\s+',
    'export\\s+',
    'fetch\\s*\\(',
    'XMLHttpRequest',
    'WebSocket',
    '__proto__',
    'constructor\\s*\\[',
    'process\\.',
    'global\\.',
    'window\\.location',
    'document\\.cookie',
    'localStorage',
    'sessionStorage'
  ];
  
  private requiredPatterns = [
    'Phaser\\.Scene',
    'Phaser\\.Game',
    'preload\\s*\\(',
    'create\\s*\\(',
    'update\\s*\\('
  ];
  
  async validate(code: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check for forbidden patterns
    for (const pattern of this.forbiddenPatterns) {
      const regex = new RegExp(pattern, 'gi');
      if (regex.test(code)) {
        errors.push(`Forbidden pattern detected: ${pattern}`);
      }
    }
    
    // Check for required patterns
    for (const pattern of this.requiredPatterns) {
      const regex = new RegExp(pattern, 'g');
      if (!regex.test(code)) {
        errors.push(`Required pattern missing: ${pattern}`);
      }
    }
    
    // Check basic syntax
    try {
      // Use Function constructor to check syntax without executing
      new Function(`
        // Sandbox check only
        return function() {
          ${code}
        }
      `);
    } catch (error: any) {
      errors.push(`Syntax error: ${error.message}`);
    }
    
    // Check for common issues
    if (code.length < 100) {
      errors.push('Code is too short to be a valid game');
    }
    
    if (code.length > 50000) {
      warnings.push('Code is very large, might cause performance issues');
    }
    
    // Check for balanced braces
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }
    
    // Check for balanced parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
    }
    
    // Check for Phaser config
    if (!code.includes('type: Phaser.AUTO') && !code.includes('type: Phaser.CANVAS') && !code.includes('type: Phaser.WEBGL')) {
      warnings.push('No Phaser renderer type specified');
    }
    
    // Check for game dimensions
    if (!code.includes('width:') || !code.includes('height:')) {
      errors.push('Game dimensions not specified');
    }
    
    return {
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
  
  sanitize(code: string): string {
    // Remove any potentially dangerous code
    let sanitized = code;
    
    // Remove console.log in production
    if (process.env.NODE_ENV === 'production') {
      sanitized = sanitized.replace(/console\.(log|error|warn|info)\([^)]*\);?/g, '');
    }
    
    // Ensure code is wrapped properly
    if (!sanitized.includes('game-container')) {
      console.warn('Code does not reference game-container, might not display properly');
    }
    
    return sanitized;
  }
  
  extractMetadata(code: string): {
    hasAudio: boolean;
    hasMultiplayer: boolean;
    hasScore: boolean;
    estimatedComplexity: 'simple' | 'moderate' | 'complex';
  } {
    return {
      hasAudio: code.includes('sound') || code.includes('audio') || code.includes('music'),
      hasMultiplayer: code.includes('multiplayer') || code.includes('socket') || code.includes('network'),
      hasScore: code.includes('score') || code.includes('points'),
      estimatedComplexity: this.estimateComplexity(code)
    };
  }
  
  private estimateComplexity(code: string): 'simple' | 'moderate' | 'complex' {
    const lines = code.split('\n').length;
    const functions = (code.match(/function\s+\w+|=>\s*{|\w+\s*\([^)]*\)\s*{/g) || []).length;
    
    if (lines < 200 && functions < 10) return 'simple';
    if (lines < 500 && functions < 25) return 'moderate';
    return 'complex';
  }
}