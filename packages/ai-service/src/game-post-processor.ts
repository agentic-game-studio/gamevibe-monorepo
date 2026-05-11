/**
 * Game Post-Processor
 *
 * Automatically enhances generated games with missing features like
 * audio synthesis and combo systems.
 */

export class GamePostProcessor {
  /**
   * Enhance a game with missing features
   */
  enhance(code: string): string {
    let enhanced = code;

    // Fix common AI generation bugs FIRST
    enhanced = this.fixCommonBugs(enhanced);

    // ALWAYS remove broken sound functions and inject clean ones
    // The AI often generates broken audio code with infinite recursion
    enhanced = this.injectAudioSystem(enhanced);

    // Add combo system if not present
    if (!/comboCount|comboMultiplier/i.test(code)) {
      enhanced = this.injectComboSystem(enhanced);
    }

    return enhanced;
  }

  /**
   * Fix common AI generation bugs
   */
  private fixCommonBugs(code: string): string {
    let fixed = code;

    // Fix infinite recursion - remove ANY function that calls itself as first statement
    // Pattern: function name() { name();
    fixed = fixed.replace(
      /function\s+(\w+)\s*\(\)\s*\{\s*\1\s*\(\s*\)\s*;/gi,
      'function $1() {'
    );

    // Also fix the specific case with newlines: function powerUpSound() {\n  powerUpSound();
    fixed = fixed.replace(
      /function\s+(powerUpSound|shootSound|explosionSound)\s*\(\)\s*\{[\s\n\r]*\1\s*\(\)[\s\n\r]*;[\s\S]*?\}/gi,
      ''
    );

    // Fix missing parenthesis: this.add.text(00,'Depth:' -> this.add.text(0,'Depth:'
    fixed = fixed.replace(/this\.add\.text\(\d+0,/g, "this.add.text(0,");

    // Fix truncated refreshBody: .refreshBod} -> .refreshBody()}
    fixed = fixed.replace(/\.refreshBod\}/g, '.refreshBody()}');

    // Fix double commas: ,, -> ,
    fixed = fixed.replace(/,,/g, ',');

    // Fix fontW instead of fontWeight
    fixed = fixed.replace(/fontW\}/g, "fontWeight: 'bold'}");

    // Fix truncated function names: functionObjects -> function spawnObjects
    fixed = fixed.replace(/function\s+Objects\(\)/g, 'function spawnObjects()');

    // Fix truncated gameState: gaState -> gameState
    fixed = fixed.replace(/gaState\./g, 'gameState.');

    // Fix NEW truncated gameState patterns: gameSta. and gameStat.
    fixed = fixed.replace(/gameSta\./g, 'gameState.');
    fixed = fixed.replace(/gameStat\./g, 'gameState.');

    // Fix truncated spawnObjects: spacts() -> spawnObjects()
    fixed = fixed.replace(/function\s+spacts\(\)/g, 'function spawnObjects()');
    fixed = fixed.replace(/spacts\(\)\s*\{/g, 'spawnObjects() {');
    fixed = fixed.replace(/spawnObjcts\(\)\s*\{/g, 'spawnObjects() {');

    // Fix NEW truncation: platforms -> orms (MiniMax truncates at ~16K tokens)
    fixed = fixed.replace(/\.orms\.clear/g, '.platforms.clear');
    fixed = fixed.replace(/\borms\b/g, 'platforms');

    // Fix NEW truncation: gameState -> gaState, gameSta, gameStat
    fixed = fixed.replace(/\bgaState\./g, 'gameState.');
    fixed = fixed.replace(/\bgameSta\./g, 'gameState.');
    fixed = fixed.replace(/\bgameStat\./g, 'gameState.');

    // Fix NEW truncation: platforms array access issues
    fixed = fixed.replace(/orms\[/g, 'platforms[');
    fixed = fixed.replace(/orms\./g, 'platforms.');

    // Fix standalone hasInvincibility = true (truncated from if statement)
    // This pattern appears when AI cuts off mid-condition
    fixed = fixed.replace(/hasInvincibility\s*=\s*true;(?!\s*if)/g, 'hasInvincibility = true;');

    // Fix incomplete camera shake that was misplaced
    fixed = fixed.replace(/this\.cameras\.main\.shake\(\s*$/gm, '');

    // Fix broken fontSize: fontSize:'fill:' -> fontSize + fill separately (more aggressive)
    fixed = fixed.replace(/fontSize:'fill:'#([0-9a-fA-F]+)'/g, "fontSize:'14px',fill:'#$1'");
    fixed = fixed.replace(/fontSize:'fill:'#([0-9a-fA-F]+)'/gi, "fontSize:'14px',fill:'#$1'");

    // Fix truncated fontWe -> fontWeight (more aggressive)
    fixed = fixed.replace(/fontWe\)/g, "fontWeight:'bold'})");
    fixed = fixed.replace(/fontWe\)/gi, "fontWeight:'bold'})");

    // Fix truncated text: this.add.tt( -> this.add.text(
    fixed = fixed.replace(/this\.add\.tt\(/g, 'this.add.text(');

    // Fix typo: this.adtext -> this.add.text
    fixed = fixed.replace(/this\.adtext\(/g, 'this.add.text(');

    // Fix truncated refreshBody: .refre() -> .refreshBody()
    fixed = fixed.replace(/\.refre\(\)/g, '.refreshBody()');

    // Fix truncated function names (without function keyword): functionObjects() -> function spawnObjects()
    fixed = fixed.replace(/functionObjects\(\)\s*\{/g, 'function spawnObjects() {');

    // Fix truncated gameState: gaState -> gameState (more aggressive)
    fixed = fixed.replace(/gaState\./g, 'gameState.');

    // Fix duplicate platform prefixes: platfplatfplatforms -> platforms
    fixed = fixed.replace(/platfplatf(platforms?)/g, '$1');

    // Fix: gameState.gameState.gameState - triple nesting (apply multiple times)
    for (let i = 0; i < 5; i++) {
      const before = fixed;
      fixed = fixed.replace(/gameState\.gameState\./g, 'gameState.');
      if (fixed === before) break;
    }

    // Fix: player.s,0); - truncated from player.setVelocity(0,0)
    fixed = fixed.replace(/player\.s,0\);/g, 'player.setVelocity(0, 0);');

    // Fix: player.s,0 - incomplete setVelocity
    fixed = fixed.replace(/player\.s,0(?!\))/g, 'player.setVelocity(0, 0)');

    // Fix: orms[ -> platforms[ (array access)
    fixed = fixed.replace(/orms\[/g, 'platforms[');

    // Fix: orms. -> platforms. (any property access)
    fixed = fixed.replace(/\borgs\./g, 'platforms.');

    // Fix: var orms = -> var platforms =
    fixed = fixed.replace(/var\s+orms\s*=/g, 'var platforms =');

    // Fix: orms.clear - already handled but be more aggressive
    fixed = fixed.replace(/orms\.clear/g, 'platforms.clear');

    // Fix: platfplatfplatforms - MORE aggressive (multiple times)
    for (let i = 0; i < 5; i++) {
      const before = fixed;
      fixed = fixed.replace(/platfplatf(platforms?)/g, '$1');
      fixed = fixed.replace(/platfplatforms/g, 'platforms');
      if (fixed === before) break;
    }

    // Fix: platfplatfplatforms.clear(true,true); - this specific pattern
    fixed = fixed.replace(/platfplatfplatforms\.clear/g, 'platforms.clear');
    fixed = fixed.replace(/platfplatforms\.clear/g, 'platforms.clear');

    // Fix: platfplatforms.create -> platforms.create
    fixed = fixed.replace(/platfplatforms\.create/g, 'platforms.create');

    // Fix: Phaser.Math.Between(5; - truncated syntax
    fixed = fixed.replace(/Between\(([^)]+);/g, 'Between($1,');

    // NEW: Fix comboCount truncation -> mboCount
    fixed = fixed.replace(/\bmboCount\b/g, 'comboCount');

    // NEW: Fix fontSize truncation -> fpx
    fixed = fixed.replace(/\{ fpx'/g, "{ fontSize:'20px',fill:'#ffffff'");
    fixed = fixed.replace(/fpx'\}/g, "fontSize:'20px'}");

    // NEW: Fix btn truncation -> btn
    fixed = fixed.replace(/\bb\.on\(/g, 'btn.on(');

    // NEW: Fix incomplete text object { fpx'
    fixed = fixed.replace(/\{ fpx[^']*'/g, "{ fontSize:'20px',fill:'#ffffff'");

    // NEW: Fix setScrollFn -> setScrollFactor
    fixed = fixed.replace(/\.setScrollFn/g, '.setScrollFactor');

    // NEW: Fix destroy();this.cameras.main.shake pattern (truncated)
    fixed = fixed.replace(/destroy\(\);this\.cameras\.main\.shake\(\d+,\d+\.\d+\);/g, 'destroy();');

    // NEW: Fix duplicate audio functions (keep class, remove standalone)
    // Remove duplicate function definitions if class exists
    if (/class\s+AudioManager/i.test(fixed)) {
      fixed = fixed.replace(/var audioCtx = null;[\s\S]*?function powerUpSound\(\) \{[\s\S]*?\}\s*/g, '');
    }

    // NEW: Fix truncated ternary expression: (this.isBossLevel (BOSS)' : '')
    // This is truncated from (this.isBossLevel ? 'BOSS' : '')
    fixed = fixed.replace(/\(this\.isBossLevel\s*\(\s*BOSS\s*\)\s*'?\s*:\s*'\)/g, "(this.isBossLevel ? 'BOSS' : '')");

    // NEW: Fix truncated boss level check: isBossLevel (BOSS'
    fixed = fixed.replace(/isBossLevel\s*\(\s*BOSS\s*\)/g, "isBossLevel === 'BOSS'");

    // NEW: Fix incomplete ternary with BOSS
    fixed = fixed.replace(/\(\s*this\.isBossLevel\s*\(\s*BOSS\s*\)\s*'?\s*:\s*''\s*\)/g, "(this.isBossLevel === 'BOSS' ? 'BOSS' : '')");

    // NEW: Fix broken camera shake patterns that break code
    // Pattern: .destroy();this.cameras.main.shake(30,0.002) without proper semicolons
    fixed = fixed.replace(/\.destroy\(\);this\.cameras\.main\.shake\(\d+,\d+\.\d+\)(?!\s*;)/g, '.destroy();');

    // NEW: Fix .destroy();this.cameras.main.shake anywhere it breaks code
    // This pattern appears to be malformed - remove it entirely
    fixed = fixed.replace(/\.destroy\(\);this\.cameras\.main\.shake\(\d+,/g, '.destroy();');

    // NEW: Fix multiple camera shakes that create invalid syntax
    // Remove shake from lines where it breaks the code structure
    fixed = fixed.replace(/(\.destroy\(\));[\s\n]*this\.cameras\.main\.shake\([^)]+\);/g, '$1;');

    // NEW: Fix level text syntax errors - truncated ternary in level display
    fixed = fixed.replace(/'LEVEL: '\s*\+\s*this\.gameState\.level\s*\+\s*\([^)]*isBossLevel[^)]*\)/g, "'LEVEL: ' + this.gameState.level + (this.isBossLevel ? ' BOSS' : '')");

    // NEW: Fix any remaining incomplete camera shakes at end of statements
    fixed = fixed.replace(/this\.cameras\.main\.shake\(\d+,\d+\.\d+\);[\s]*this\.cameras\.main\.shake/g, 'this.cameras.main.shake');

    // NEW: Fix broken camera shake with extra numbers: shake(30,0.002)0.005)
    fixed = fixed.replace(/shake\(\d+,\d+\.\d+\)\d+\.\d+\)/g, 'shake(30,0.002)');

    // NEW: Fix dxt = (should be depthText =)
    fixed = fixed.replace(/dxt\s*=\s*this\.add\.text/g, 'depthText = this.add.text');

    // NEW: Fix gaState -> gameState
    fixed = fixed.replace(/gaState\./g, 'gameState.');

    // NEW: Fix mismatched braces in onComplete callbacks
    fixed = fixed.replace(/onComplete:\(\)=>\{ p\.destroy\(\)\}\);/g, 'onComplete:() => { p.destroy(); }}');

    // NEW: Fix double semicolons
    fixed = fixed.replace(/;;/g, ';');

    // NEW: Fix duplicate variable declarations (e.g., var audioCtx and let audioCtx)
    // Keep only the first declaration and remove duplicates
    const varDeclarations = new Set<string>();
    fixed = fixed.replace(/(var|let|const)\s+(\w+)\s*=/g, (match, keyword, name) => {
      if (name === 'audioCtx' || name === 'gameState' || name === 'scoreText') {
        if (varDeclarations.has(name)) {
          return ''; // Remove duplicate
        }
        varDeclarations.add(name);
      }
      return match;
    });

    // NEW: Fix scene array - use string keys instead of class references
    // Problem: class references before definition causes "Cannot access before initialization"
    // Fix: Change [TitleScene, GameScene] to ['TitleScene', 'GameScene']
    // This works because each class has { key: 'SceneName' }
    fixed = fixed.replace(/scene:\s*\[([A-Z][a-zA-Z]+(?:,\s*[A-Z][a-zA-Z]+)*)\]/g, (match, scenes) => {
      const sceneList = scenes.split(',').map((s: string) => s.trim()).map((s: string) => `'${s}'`);
      return `scene: [${sceneList.join(', ')}]`;
    });

    return fixed;
  }

  /**
   * Remove a function definition, handling nested braces properly
   */
  private removeFunction(code: string, funcName: string): string {
    const regex = new RegExp(`function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{`, 'gi');
    const match = code.match(regex);
    if (!match) return code;

    // Find the function start
    const startIdx = code.search(regex);
    if (startIdx === -1) return code;

    // Count braces to find the matching closing brace
    let braceCount = 0;
    let inFunction = false;
    let endIdx = startIdx;

    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') {
        braceCount++;
        inFunction = true;
      } else if (code[i] === '}') {
        braceCount--;
        if (inFunction && braceCount === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }

    // Remove the entire function
    return code.slice(0, startIdx) + code.slice(endIdx);
  }

  private injectAudioSystem(code: string): string {
    // First, remove any broken sound functions that AI may have generated
    // Use a more robust approach to handle nested braces
    code = this.removeFunction(code, 'powerUpSound');
    code = this.removeFunction(code, 'shootSound');
    code = this.removeFunction(code, 'explosionSound');

    // Find the create() function and add audio initialization
    const audioSystem = `
var audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}
function shootSound() {
  if (!audioCtx) initAudio();
  if (!audioCtx) return;
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(600, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.08);
}
function explosionSound() {
  if (!audioCtx) initAudio();
  if (!audioCtx) return;
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.setValueAtTime(100, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.25);
  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.25);
}
function powerUpSound() {
  if (!audioCtx) initAudio();
  if (!audioCtx) return;
  var notes = [523, 659, 784, 1047];
  notes.forEach(function(freq, i) {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.08);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.08 + 0.1);
    osc.start(audioCtx.currentTime + i * 0.08);
    osc.stop(audioCtx.currentTime + i * 0.08 + 0.1);
  });
}
`;

    // Insert audio system after global variables
    // Match gameState even when declared with other variables
    // Handle: var x, y, gameState = { ... };
    const gameStateMatch = code.match(/gameState\s*=\s*\{[\s\S]*?\};/i);
    if (gameStateMatch) {
      code = code.replace(gameStateMatch[0], gameStateMatch[0] + '\n' + audioSystem);
    } else if (/function create\(\)/i.test(code)) {
      code = code.replace(/(function create\(\)\s*\{)/i, audioSystem + '\n$1');
    }

    // Add shootSound() call to fireBullet or shooting functions
    if (/function.*fireBullet/i.test(code)) {
      code = code.replace(/(function.*fireBullet[^{]*\{)/i, '$1\n  shootSound();');
    }

    // Add explosionSound() call to hitEnemy or enemy death
    if (/function.*hitEnemy/i.test(code)) {
      code = code.replace(/(function.*hitEnemy[^{]*\{)/i, '$1\n  explosionSound();');
    }

    // Add powerUpSound() call to powerup collection - be specific to avoid matching inside function
    // Only inject if not already present in collect function
    if (!/collect.*powerup.*sound/i.test(code)) {
      // Look for collectPowerup function definition (not inside it)
      const collectPowerupMatch = code.match(/function\s+collect(?:ing)?Powerup\s*\([^)]*\)\s*\{/i);
      if (collectPowerupMatch && !code.includes(collectPowerupMatch[0] + '\n  powerUpSound();')) {
        code = code.replace(collectPowerupMatch[0], collectPowerupMatch[0] + '\n  powerUpSound();');
      }
    }

    // Add camera shake ONLY if not already present - and safely
    // Don't add after destroy() as it can break syntax
    if (!/cameras\.main\.shake/i.test(code)) {
      // Add shake to damage/collision - only if there's a proper statement ending
      code = code.replace(
        /(hp|lives|health)\s*-=\s*(\d+);/gi,
        '$1-=$2; this.cameras.main.shake(50,0.003);'
      );
    }

    return code;
  }

  private injectComboSystem(code: string): string {
    const comboSystem = `
// Combo system
var comboCount = 0;
var comboMultiplier = 1;
var comboTimer = null;
var comboText = null;
`;

    // Find gameState and add combo variables after it
    // Handle: var x, y, gameState = { ... };
    const gameStateMatch2 = code.match(/gameState\s*=\s*\{[\s\S]*?\};/i);
    if (gameStateMatch2) {
      code = code.replace(gameStateMatch2[0], gameStateMatch2[0] + '\n' + comboSystem);
    }

    // Find score update and add combo logic
    // Look for patterns like scoreText.setText or gameState.score +=
    if (/scoreText\.setText\('Score:/i.test(code)) {
      code = code.replace(
        /(scoreText\.setText\('Score:\s*'\s*\+[^;]+;)/gi,
        `$1
  // Combo system
  comboCount++;
  comboMultiplier = Math.min(Math.floor(comboCount / 5) + 1, 10);
  var earnedPoints = ${code.includes('gameState.score +') ? '10' : '10'};
  gameState.score += earnedPoints * comboMultiplier;
  if (comboText) {
    comboText.setText('COMBO x' + comboMultiplier);
    this.tweens.add({ targets: comboText, scale: 1.3, duration: 100, yoyo: true });
  }
  if (comboTimer) clearTimeout(comboTimer);
  comboTimer = setTimeout(function() { comboCount = 0; comboMultiplier = 1; if (comboText) comboText.setText(''); }, 3000);`
      );
    }

    // Add comboText to UI (look for scoreText creation)
    if (/scoreText\s*=\s*this\.add\.text/i.test(code)) {
      code = code.replace(
        /(scoreText\s*=\s*this\.add\.text\([^,]+,[^,]+,[^)]+\);)/gi,
        `$1
  comboText = this.add.text(400, 80, '', { fontSize: '28px', color: '#ffff00', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);`
      );
    }

    return code;
  }
}

export default GamePostProcessor;
