import { GameSpec, GameTemplate } from '@gamevibe/shared';
import { STANDARDIZED_GAME_TEMPLATE, GAME_TYPE_TEMPLATES } from './templates.js';
import { EXPERT_SYSTEM_PROMPT } from './system-prompt.js';

type GameTypeKey = 'platformer' | 'shooter' | 'puzzle' | 'rpg' | 'tower-defense' | 'endless-runner';

export class GamePromptBuilder {
  buildGameGenerationPrompt(spec: GameSpec, template: GameTemplate & { assets?: Record<string, string> }): string {
    const userDescription = spec.description || spec.originalDescription || spec.type || 'platformer game';
    const gameType = this.detailedGameType(userDescription);

    const typeSpecificRequirements = this.getTypeSpecificRequirements(gameType, userDescription);

    // Build code examples without backticks to avoid template literal issues
    const codeExamples = this.getCodeExamples();

    return `${EXPERT_SYSTEM_PROMPT}

---

## User Request

Create a COMPLEX and UNIQUE Phaser.js game based on this description: "${userDescription}"

${typeSpecificRequirements}

---

## CRITICAL REQUIREMENTS (MUST FOLLOW)

### Visual Effects (Particle Systems)
1. MUST have death explosions with 20+ particles when enemies die
2. MUST have particle trails on all projectiles (bullets, arrows, etc.)
3. MUST have player trail particles when moving fast
4. MUST have power-up glow and pickup sparkle effects
5. MUST have screen shake on player damage and boss kills
6. MUST have screen flash on player death
7. MUST have smooth camera zoom transitions between areas

### Audio (Web Audio API Synthesis - NO external files)
1. MUST synthesize shooting sound: short sine wave burst with frequency sweep from 800Hz to 200Hz
2. MUST synthesize hit sound: white noise burst with 100ms decay
3. MUST synthesize power-up sound: ascending arpeggio (3-4 notes)
4. MUST synthesize explosion: low-frequency noise with low-pass filter sweep down
5. MUST synthesize background music: simple 8-bar loop with bass + melody
6. MUST add reverb to all sounds for depth

### Game Mechanics
1. MUST have multiple unique enemy types with different behaviors (at least 3 types)
2. MUST have power-ups or upgrades (at least 3 types: health, speed, weapon upgrade, shield, etc.)
3. MUST have combo system with multiplier that resets after 3 seconds of no kills
4. MUST have progressive difficulty (enemies get 10% stronger/faster each wave)
5. MUST have boss enemies every 5 waves with multiple attack patterns

### UI/UX
1. MUST have title screen with animated logo, START button, HOW TO PLAY button
2. MUST have health bar with damage animation (flash red, shake)
3. MUST have score display with increment animation (numbers roll up)
4. MUST have wave/level display
5. MUST have combo counter with scale pulse on increment
6. MUST have pause functionality (ESC key or pause button)

---

${codeExamples}

Now create your game following ALL the patterns above. The game must be COMPLEX, POLISHED, and REPLAYABLE.

Output ONLY the raw HTML code starting with <!DOCTYPE html><html> and ending with </html>.`;
  }

  private getCodeExamples(): string {
    // Use single quotes and concatenate to avoid backtick issues
    return `## CODE EXAMPLES (FOLLOW THESE PATTERNS)

### Particle Emitter Example
[CODE_BLOCK]
// Death particles - emit 30 particles in explosion pattern
const deathParticles = this.add.particles(0, 0, 'particle', {
  speed: { min: 100, max: 300 },
  angle: { min: 0, max: 360 },
  scale: { start: 0.5, end: 0 },
  lifespan: 600,
  gravityY: 200,
  emitting: false
});

// Trigger explosion at enemy position
deathParticles.explode(30, enemy.x, enemy.y);
[/CODE_BLOCK]

### Screen Shake Example
[CODE_BLOCK]
// Camera shake - intensity 0.01-0.02 for hits, 0.03+ for big events
this.cameras.main.shake(200, 0.01);
this.cameras.main.flash(200, 255, 0, 0, false);
[/CODE_BLOCK]

### Web Audio Synthesized Sound Example
[CODE_BLOCK]
// Shoot sound - oscillator with frequency sweep
const ctx = new (window.AudioContext || window.webkitAudioContext)();
const osc = ctx.createOscillator();
const gain = ctx.createGain();
osc.connect(gain);
gain.connect(ctx.destination);
osc.frequency.setValueAtTime(800, ctx.currentTime);
osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
gain.gain.setValueAtTime(0.3, ctx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
osc.start(ctx.currentTime);
osc.stop(ctx.currentTime + 0.1);

// Explosion - noise with filter
const bufferSize = ctx.sampleRate * 0.3;
const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
const data = buffer.getChannelData(0);
for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
const noise = ctx.createBufferSource();
noise.buffer = buffer;
const filter = ctx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.setValueAtTime(1000, ctx.currentTime);
filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
const noiseGain = ctx.createGain();
noiseGain.gain.setValueAtTime(0.5, ctx.currentTime);
noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
noise.connect(filter);
filter.connect(noiseGain);
noiseGain.connect(ctx.destination);
noise.start();
[/CODE_BLOCK]

### Tween Animation Example
[CODE_BLOCK]
// Score increment with tween (numbers roll up smoothly)
this.tweens.add({
  targets: { value: this.score },
  value: this.score + points,
  duration: 300,
  ease: 'Cubic.easeOut',
  onUpdate: (tween) => {
    scoreText.setText(Math.floor(tween.getValue()).toString());
  }
});

// Combo counter pulse
this.tweens.add({
  targets: comboText,
  scale: 1.3,
  duration: 100,
  yoyo: true,
  ease: 'Back.easeOut'
});
[/CODE_BLOCK]

### Scene Structure Example
[CODE_BLOCK]
class TitleScene extends Phaser.Scene {
  create() {
    // Animated title
    this.add.text(400, 200, 'GAME TITLE', { fontSize: '64px', color: '#00ff00' })
      .setOrigin(0.5);

    // Start button
    const startBtn = this.add.text(400, 400, 'START', { fontSize: '32px' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startBtn.on('pointerover', () => startBtn.setScale(1.1));
    startBtn.on('pointerout', () => startBtn.setScale(1));
    startBtn.on('pointerdown', () => this.scene.start('GameScene'));
  }
}

class GameScene extends Phaser.Scene {
  preload() {
    // Generate graphics programmatically - NO external assets
  }

  create() {
    // Setup player, enemies, UI, audio
  }

  update(time, delta) {
    // Game logic
  }
}

class GameOverScene extends Phaser.Scene {
  create(data) {
    this.add.text(400, 300, 'GAME OVER', { fontSize: '48px', color: '#ff0000' }).setOrigin(0.5);
    this.add.text(400, 400, 'Score: ' + data.score, { fontSize: '32px' }).setOrigin(0.5);
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scene: [TitleScene, GameScene, GameOverScene],
  physics: { default: 'arcade', arcade: { gravity: { y: 300 }, debug: false } }
};
[/CODE_BLOCK]`;
  }

  private detailedGameType(description: string): GameTypeKey {
    const d = description.toLowerCase();
    if (d.includes('shoot') || d.includes('space') || d.includes('invader')) return 'shooter';
    if (d.includes('tower') || d.includes('defense')) return 'tower-defense';
    if (d.includes('runner') || d.includes('endless') || d.includes('dash')) return 'endless-runner';
    if (d.includes('rpg') || d.includes('adventure') || d.includes('dungeon')) return 'rpg';
    if (d.includes('puzzle') || d.includes('match') || d.includes('gem')) return 'puzzle';
    return 'platformer';
  }

  private getTypeSpecificRequirements(type: GameTypeKey, description: string): string {
    switch (type) {
      case 'shooter':
        return `SHOOTER GAME REQUIREMENTS:
- Player ship with 3 weapon types: machine gun, spread shot, laser
- Weapon switching with number keys 1, 2, 3
- Enemies: basic (straight down), shooter (fires back), fast (zigzag), tank (slow, high HP), boss (every 5 waves)
- Bullet trails with glow effects
- Enemy formations and patterns
- Shield system (absorbs hits)
- Rapid fire and triple shot power-ups`;
      case 'tower-defense':
        return `TOWER DEFENSE REQUIREMENTS:
- Multiple tower types: arrow (fast, low dmg), cannon (splash damage), ice (slows enemies), lightning (chains), fire (burn damage)
- Tower upgrade system (click existing tower to upgrade)
- Enemy types: basic, fast, tank, flying, boss
- Path with multiple routes
- Money/energy system to buy towers
- Wave preview and skip options
- Tower range visualization on hover`;
      case 'endless-runner':
        return `ENDLESS RUNNER REQUIREMENTS:
- Triple jump ability
- Ground, aerial, and wall obstacles
- Boost pads and teleporters
- Character skins unlocked by score
- Speed increases over time
- Coin collection for points
- Near-miss bonus points
- Dash ability with cooldown`;
      case 'rpg':
        return `RPG ADVENTURE REQUIREMENTS:
- Top-down movement with attack
- Multiple enemy types with AI
- Equipment system (sword, armor, accessories)
- Level up and stat progression
- Multiple item types (health potions, mana, keys)
- Treasure chests with random loot
- Boss enemies with multiple phases`;
      case 'puzzle':
        return `PUZZLE GAME REQUIREMENTS:
- 8x8 or larger grid
- Special gems: bomb (clears area), lightning (clears row/col), fire (clears color)
- Chain reactions with cascade scoring
- Time attack and moves limit modes
- Special combo animations
- Hint system`;
      default:
        return `PLATFORMER REQUIREMENTS:
- Double jump and wall jump
- Multiple enemy types with different behaviors
- Boss levels every 3 levels
- Collectibles: coins (score), gems (bonus), keys (unlock areas)
- Power-ups: invincibility, speed boost, double jump
- Particle effects on jumps and landings`;
    }
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
