/**
 * Quality Validator for AI-Generated Games
 *
 * Validates that generated games meet minimum quality standards.
 */

export interface QualityValidationResult {
  passed: boolean;
  score: number;
  issues: string[];
  details: {
    codeLines: number;
    hasParticles: boolean;
    hasSoundEffects: boolean;
    hasCameraEffects: boolean;
    hasComboSystem: boolean;
    hasMultipleEnemies: boolean;
    hasPowerUps: boolean;
    hasTitleScreen: boolean;
    hasHealthBar: boolean;
    hasScoreDisplay: boolean;
  };
}

export class QualityValidator {
  private readonly MIN_CODE_LINES = 400;
  private readonly MIN_ENEMY_TYPES = 3;
  private readonly MIN_POWER_UPS = 3;

  validate(code: string): QualityValidationResult {
    const issues: string[] = [];
    let score = 0;

    // Count meaningful code lines (excluding empty lines and comments)
    const codeLines = this.countCodeLines(code);

    // Check for required features
    const hasParticles = this.checkPattern(code, [
      'particle',
      'explode',
      'add.particles',
      'emitter'
    ]);

    const hasSoundEffects = this.checkPattern(code, [
      'AudioContext',
      'createOscillator',
      'createGain',
      'osc.frequency'
    ]);

    const hasCameraEffects = this.checkPattern(code, [
      'cameras.main.shake',
      'cameras.main.flash',
      'camera.shake',
      'camera.flash'
    ]);

    const hasComboSystem = this.checkPattern(code, [
      'combo',
      'multiplier',
      'comboCount',
      'comboMultiplier'
    ]);

    const hasMultipleEnemies = this.checkPattern(code, [
      'enemyType',
      'enemy.type',
      'enemyTypes',
      'ENEMY_TYPES'
    ], true);

    const hasPowerUps = this.checkPattern(code, [
      'powerUp',
      'power-up',
      'powerup',
      'PowerUp'
    ], true);

    const hasTitleScreen = this.checkPattern(code, [
      'TitleScene',
      'titleScene',
      'START',
      'StartGame',
      'startBtn'
    ]);

    const hasHealthBar = this.checkPattern(code, [
      'healthBar',
      'health',
      'hpBar',
      'lifeBar',
      'setHealth'
    ]);

    const hasScoreDisplay = this.checkPattern(code, [
      'scoreText',
      'scoreDisplay',
      'setScore',
      'addScore',
      'score:'
    ]);

    // Calculate score
    if (codeLines >= this.MIN_CODE_LINES) score += 20;
    else issues.push(`Code too short: ${codeLines} lines (minimum ${this.MIN_CODE_LINES})`);

    if (hasParticles) score += 15;
    else issues.push('Missing particle effects (death explosions, trails)');

    if (hasSoundEffects) score += 15;
    else issues.push('Missing synthesized sound effects');

    if (hasCameraEffects) score += 10;
    else issues.push('Missing camera effects (shake, flash)');

    if (hasComboSystem) score += 10;
    else issues.push('Missing combo/multiplier system');

    if (hasMultipleEnemies) score += 10;
    else issues.push(`Missing multiple enemy types (minimum ${this.MIN_ENEMY_TYPES})`);

    if (hasPowerUps) score += 10;
    else issues.push(`Missing power-ups (minimum ${this.MIN_POWER_UPS})`);

    if (hasTitleScreen) score += 5;
    else issues.push('Missing title screen');

    if (hasHealthBar) score += 3;
    else issues.push('Missing health bar');

    if (hasScoreDisplay) score += 2;
    else issues.push('Missing score display');

    const passed = score >= 60 && codeLines >= this.MIN_CODE_LINES;

    return {
      passed,
      score,
      issues,
      details: {
        codeLines,
        hasParticles,
        hasSoundEffects,
        hasCameraEffects,
        hasComboSystem,
        hasMultipleEnemies,
        hasPowerUps,
        hasTitleScreen,
        hasHealthBar,
        hasScoreDisplay
      }
    };
  }

  private countCodeLines(code: string): number {
    const lines = code.split('\n');
    let count = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and pure comment lines
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
        count++;
      }
    }

    return count;
  }

  private checkPattern(code: string, patterns: string[], countMultiple = false): boolean {
    const matches = patterns.filter(pattern =>
      code.toLowerCase().includes(pattern.toLowerCase())
    );

    if (countMultiple) {
      // For enemy types and power-ups, check if there are multiple
      return matches.length >= 1;
    }

    return matches.length > 0;
  }

  /**
   * Generate a report string for debugging
   */
  generateReport(result: QualityValidationResult): string {
    let report = `Quality Score: ${result.score}/100\n`;
    report += `Status: ${result.passed ? 'PASSED' : 'FAILED'}\n\n`;
    report += `Details:\n`;
    report += `- Code Lines: ${result.details.codeLines}\n`;
    report += `- Particles: ${result.details.hasParticles ? 'YES' : 'NO'}\n`;
    report += `- Sound Effects: ${result.details.hasSoundEffects ? 'YES' : 'NO'}\n`;
    report += `- Camera Effects: ${result.details.hasCameraEffects ? 'YES' : 'NO'}\n`;
    report += `- Combo System: ${result.details.hasComboSystem ? 'YES' : 'NO'}\n`;
    report += `- Multiple Enemies: ${result.details.hasMultipleEnemies ? 'YES' : 'NO'}\n`;
    report += `- Power-ups: ${result.details.hasPowerUps ? 'YES' : 'NO'}\n`;
    report += `- Title Screen: ${result.details.hasTitleScreen ? 'YES' : 'NO'}\n`;
    report += `- Health Bar: ${result.details.hasHealthBar ? 'YES' : 'NO'}\n`;
    report += `- Score Display: ${result.details.hasScoreDisplay ? 'YES' : 'NO'}\n`;

    if (result.issues.length > 0) {
      report += `\nIssues:\n`;
      for (const issue of result.issues) {
        report += `- ${issue}\n`;
      }
    }

    return report;
  }
}

export default QualityValidator;
