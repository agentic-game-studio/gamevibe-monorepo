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

    // Add audio system if not present
    if (!/audioCtx|AudioContext/i.test(code)) {
      enhanced = this.injectAudioSystem(enhanced);
    }

    // Add combo system if not present
    if (!/comboCount|comboMultiplier/i.test(code)) {
      enhanced = this.injectComboSystem(enhanced);
    }

    // Add enemy variety if missing
    enhanced = this.injectEnemyVariety(enhanced);

    return enhanced;
  }

  private injectAudioSystem(code: string): string {
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

    // Add powerUpSound() call to powerup collection
    if (/function.*collect.*Powerup/i.test(code) || /function.*powerUp/i.test(code)) {
      code = code.replace(/(function.*(?:collect|powerUp)[^{]*\{)/i, '$1\n  powerUpSound();');
    }

    // Skip automatic bullet sound injection - fireBullet already gets sound
    // The automatic injection causes issues with minified code

    // Add particle effects to any destroy/disable call
    if (!/for.*pi.*add\.circle/i.test(code)) {
      // Look for any .destroy() and add generic particles
      if (/\.destroy\(\)/i.test(code)) {
        code = code.replace(
          /\.destroy\(\)/gi,
          '.destroy();this.cameras.main.shake(30,0.002)'
        );
      }

      // Add camera shake for game feel
      if (!/cameras\.main\.shake/i.test(code)) {
        // Add shake to any damage/collision
        code = code.replace(
          /(hp|lives|health).*-=/gi,
          '$1-=;this.cameras.main.shake(50,0.003)'
        );
      }
    }

    return code;
  }

  private injectEnemyVariety(code: string): string {
    // Add different enemy textures if variety is missing
    // Check if the game already has enemy variety
    const hasEnemyTypes = /enemyFast|enemyTank|enemyShooter|enemyBoss/i.test(code);
    if (hasEnemyTypes) return code;

    // Add enemy texture generation to preload
    if (/function preload\(\)/i.test(code) && !/enemyFast|enemyTank/i.test(code)) {
      // Add more enemy textures after existing textures
      code = code.replace(
        /(g\.generateTexture\('enemy'[^;]*;?)/i,
        "$1\n  g.fillStyle(0x22c55e,1);g.fillCircle(15,15,15);g.generateTexture('enemyFast',30,30);g.clear();\n  g.fillStyle(0xa855f7,1);g.fillRect(0,0,30,30);g.generateTexture('enemyTank',30,30);g.clear();"
      );
    }

    // Modify spawn function to create different enemy types
    if (/function.*spawnEnemies/i.test(code)) {
      // Replace simple enemy creation with varied types
      code = code.replace(
        /(enemies\.create\([^,]+,\s*[^,]+,\s*'enemy'\))/gi,
        "Math.random() < 0.3 ? (Math.random() < 0.5 ? enemies.create($1.replace('enemy','enemyFast')) : enemies.create($1.replace('enemy','enemyTank'))) : enemies.create$1"
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
