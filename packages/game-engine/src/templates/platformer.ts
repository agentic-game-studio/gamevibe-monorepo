import { GameTemplate } from '@gamevibe/shared';

export const platformerTemplate: GameTemplate = {
  id: 'platformer',
  name: 'Platformer',
  type: 'platformer',
  structure: `
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.score = 0;
    this.lives = 3;
    this.gameOver = false;
  }
  
  preload() {
    {{ASSET_LOADING}}
  }
  
  create() {
    // World bounds
    this.physics.world.setBounds(0, 0, 800, 600);
    
    {{WORLD_SETUP}}
    
    {{PLAYER_SETUP}}
    
    {{ENEMIES_SETUP}}
    
    {{COLLECTIBLES_SETUP}}
    
    {{UI_SETUP}}
    
    {{CONTROLS_SETUP}}
    
    {{COLLISION_SETUP}}
    
    {{PARTICLES_SETUP}}
    
    {{AUDIO_SETUP}}
  }
  
  update(time, delta) {
    if (this.gameOver) return;
    
    {{PLAYER_MOVEMENT}}
    
    {{ENEMY_AI}}
    
    {{GAME_STATE_CHECKS}}
    
    {{CAMERA_FOLLOW}}
  }
  
  {{HELPER_METHODS}}
}

// Game configuration
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#87CEEB',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 800 },
      debug: false
    }
  },
  scene: GameScene
};

// Initialize the game
const game = new Phaser.Game(config);`,

  sections: {
    ASSET_LOADING: `
    // Create simple colored rectangles as assets
    this.load.image('player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    this.load.image('ground', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
    this.load.image('star', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    this.load.image('enemy', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');`,
    
    WORLD_SETUP: `
    // Create background
    this.add.rectangle(400, 300, 800, 600, 0x87CEEB);
    
    // Create platforms group
    this.platforms = this.physics.add.staticGroup();
    
    // Ground
    this.platforms.create(400, 568, 'ground').setScale(800, 64).refreshBody().setTint(0x654321);
    
    // Floating platforms
    this.platforms.create(600, 400, 'ground').setScale(200, 20).refreshBody().setTint(0x654321);
    this.platforms.create(50, 250, 'ground').setScale(150, 20).refreshBody().setTint(0x654321);
    this.platforms.create(750, 220, 'ground').setScale(150, 20).refreshBody().setTint(0x654321);`,
    
    PLAYER_SETUP: `
    // Create player sprite
    this.player = this.physics.add.sprite(100, 450, 'player');
    this.player.setScale(32, 48);
    this.player.setTint(0x0000ff);
    this.player.setBounce(0.2);
    this.player.setCollideWorldBounds(true);
    
    // Player properties
    this.player.jumpPower = -500;
    this.player.moveSpeed = 160;`,
    
    ENEMIES_SETUP: `
    // Create enemies group
    this.enemies = this.physics.add.group();
    
    // Add some enemies
    for (let i = 0; i < 3; i++) {
      const x = 200 + (i * 250);
      const enemy = this.enemies.create(x, 300, 'enemy');
      enemy.setScale(32, 32);
      enemy.setTint(0xff0000);
      enemy.setBounce(1);
      enemy.setCollideWorldBounds(true);
      enemy.setVelocity(Phaser.Math.Between(-50, 50), 0);
    }`,
    
    COLLECTIBLES_SETUP: `
    // Create stars group
    this.stars = this.physics.add.group({
      key: 'star',
      repeat: 11,
      setXY: { x: 12, y: 0, stepX: 70 }
    });
    
    this.stars.children.entries.forEach(star => {
      star.setScale(24, 24);
      star.setTint(0xffff00);
      star.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
    });`,
    
    UI_SETUP: `
    // Score text
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '32px',
      color: '#000'
    });
    
    // Lives text
    this.livesText = this.add.text(16, 56, 'Lives: 3', {
      fontSize: '32px',
      color: '#000'
    });
    
    // Game over text (hidden initially)
    this.gameOverText = this.add.text(400, 300, 'GAME OVER!', {
      fontSize: '64px',
      color: '#ff0000'
    }).setOrigin(0.5).setVisible(false);`,
    
    CONTROLS_SETUP: `
    // Create cursor keys
    this.cursors = this.input.keyboard.createCursorKeys();
    
    // Add WASD controls
    this.wasd = this.input.keyboard.addKeys('W,S,A,D');
    
    // Touch/click controls for mobile
    this.input.on('pointerdown', (pointer) => {
      if (pointer.x < 400) {
        this.touchLeft = true;
      } else {
        this.touchRight = true;
      }
      this.touchJump = true;
    });
    
    this.input.on('pointerup', () => {
      this.touchLeft = false;
      this.touchRight = false;
      this.touchJump = false;
    });`,
    
    COLLISION_SETUP: `
    // Player collisions
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.stars, this.platforms);
    
    // Enemy collision with player
    this.physics.add.collider(this.player, this.enemies, this.hitEnemy, null, this);
    
    // Star collection
    this.physics.add.overlap(this.player, this.stars, this.collectStar, null, this);`,
    
    PARTICLES_SETUP: `
    // Create particle emitter for star collection
    this.starParticles = this.add.particles(0, 0, 'star', {
      speed: { min: 100, max: 200 },
      scale: { start: 0.5, end: 0 },
      lifespan: 300,
      tint: 0xffff00
    });
    this.starParticles.stop();`,
    
    AUDIO_SETUP: `
    // Audio placeholders (using console.log for now)
    this.playSound = (sound) => {
      console.log('Playing sound:', sound);
    };`,
    
    PLAYER_MOVEMENT: `
    // Horizontal movement
    if (this.cursors.left.isDown || this.wasd.A.isDown || this.touchLeft) {
      this.player.setVelocityX(-this.player.moveSpeed);
      this.player.flipX = true;
    } else if (this.cursors.right.isDown || this.wasd.D.isDown || this.touchRight) {
      this.player.setVelocityX(this.player.moveSpeed);
      this.player.flipX = false;
    } else {
      this.player.setVelocityX(0);
    }
    
    // Jump
    const canJump = this.player.body.touching.down;
    if ((this.cursors.up.isDown || this.wasd.W.isDown || this.touchJump) && canJump) {
      this.player.setVelocityY(this.player.jumpPower);
      this.playSound('jump');
      this.touchJump = false; // Prevent continuous jumping on touch
    }`,
    
    ENEMY_AI: `
    // Simple enemy AI - reverse direction on world bounds
    this.enemies.children.entries.forEach(enemy => {
      if (enemy.body.touching.left || enemy.body.touching.right) {
        enemy.setVelocityX(-enemy.body.velocity.x);
      }
    });`,
    
    GAME_STATE_CHECKS: `
    // Check if player fell off the world
    if (this.player.y > 600) {
      this.loseLife();
    }
    
    // Check win condition
    if (this.stars.countActive(true) === 0) {
      this.winGame();
    }`,
    
    CAMERA_FOLLOW: `
    // Basic camera follow (optional for larger levels)
    // this.cameras.main.startFollow(this.player);
    // this.cameras.main.setBounds(0, 0, 800, 600);`,
    
    HELPER_METHODS: `
  collectStar(player, star) {
    star.disableBody(true, true);
    
    // Add to score
    this.score += 10;
    this.scoreText.setText('Score: ' + this.score);
    
    // Play particle effect
    this.starParticles.emitParticleAt(star.x, star.y, 10);
    
    // Play sound
    this.playSound('collect');
    
    // Add a new star if all collected
    if (this.stars.countActive(true) === 0) {
      this.stars.children.entries.forEach(star => {
        star.enableBody(true, star.x, 0, true, true);
      });
    }
  }
  
  hitEnemy(player, enemy) {
    // Simple hit detection
    if (player.body.velocity.y > 0 && player.y < enemy.y) {
      // Player jumped on enemy
      enemy.disableBody(true, true);
      this.score += 50;
      this.scoreText.setText('Score: ' + this.score);
      player.setVelocityY(-300);
      this.playSound('enemyHit');
    } else {
      // Player hit by enemy
      this.loseLife();
    }
  }
  
  loseLife() {
    this.lives--;
    this.livesText.setText('Lives: ' + this.lives);
    
    if (this.lives <= 0) {
      this.gameOver = true;
      this.physics.pause();
      this.player.setTint(0xff0000);
      this.gameOverText.setVisible(true);
      this.playSound('gameOver');
      
      // Restart on click
      this.input.once('pointerdown', () => {
        this.scene.restart();
      });
    } else {
      // Reset player position
      this.player.setPosition(100, 450);
      this.player.setVelocity(0, 0);
      
      // Temporary invincibility
      this.player.setTint(0xff00ff);
      this.time.delayedCall(1000, () => {
        this.player.setTint(0x0000ff);
      });
      
      this.playSound('hit');
    }
  }
  
  winGame() {
    this.gameOver = true;
    this.physics.pause();
    
    // Show win message
    this.add.text(400, 300, 'YOU WIN!', {
      fontSize: '64px',
      color: '#00ff00'
    }).setOrigin(0.5);
    
    this.add.text(400, 370, 'Score: ' + this.score, {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    this.playSound('win');
  }`
  }
};