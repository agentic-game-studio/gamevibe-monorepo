import { GameTemplate } from '@gamevibe/shared';

export const multiplayerShooterTemplate: GameTemplate = {
  id: 'multiplayer-shooter',
  name: 'Multiplayer Shooter',
  type: 'shooter',
  structure: `
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.players = new Map();
    this.bullets = null;
    this.enemies = null;
    this.localPlayer = null;
    this.score = 0;
    this.gameStarted = false;
  }
  
  preload() {
    // Create simple shapes for sprites
    this.load.html('nameform', 'nameform.html');
  }
  
  create() {
    // Set world bounds
    this.physics.world.setBounds(0, 0, 800, 600);
    
    // Create background
    this.add.rectangle(400, 300, 800, 600, 0x001133);
    
    // Create star field
    for (let i = 0; i < 100; i++) {
      const x = Phaser.Math.Between(0, 800);
      const y = Phaser.Math.Between(0, 600);
      this.add.circle(x, y, 1, 0xffffff, 0.5);
    }
    
    // Create groups
    this.bullets = this.physics.add.group({
      defaultKey: 'bullet',
      maxSize: 50
    });
    
    this.enemies = this.physics.add.group({
      defaultKey: 'enemy',
      maxSize: 20
    });
    
    // Score display
    this.scoreText = this.add.text(10, 10, 'Score: 0', {
      fontSize: '20px',
      color: '#ffffff'
    });
    
    // Waiting text
    this.waitingText = this.add.text(400, 300, 'Waiting for players...', {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Setup multiplayer if available
    if (window.GameVibe && window.GameVibe.isMultiplayer) {
      this.setupMultiplayer();
    } else {
      // Single player fallback
      this.startSinglePlayer();
    }
    
    // Input controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    
    // Enemy spawn timer
    this.time.addEvent({
      delay: 2000,
      callback: this.spawnEnemy,
      callbackScope: this,
      loop: true
    });
  }
  
  setupMultiplayer() {
    const localPlayerId = window.GameVibe.getLocalPlayerId();
    
    // Listen for game start
    window.GameVibe.onPlayerJoined(({ player }) => {
      this.addPlayer(player);
    });
    
    window.GameVibe.onPlayerLeft(({ player }) => {
      this.removePlayer(player.id);
    });
    
    window.GameVibe.onPlayerUpdated(({ playerId, player }) => {
      this.updatePlayer(playerId, player);
    });
    
    // Listen for game events
    this.events.on('gameStart', () => {
      this.waitingText.destroy();
      this.gameStarted = true;
    });
    
    this.events.on('remoteAction', (data) => {
      if (data.action === 'shoot' && data.playerId !== localPlayerId) {
        this.createBullet(data.payload.x, data.payload.y, data.payload.angle, data.playerId);
      }
    });
    
    // Mark as ready
    setTimeout(() => {
      window.GameVibe.sendAction('ready');
    }, 1000);
  }
  
  startSinglePlayer() {
    this.waitingText.destroy();
    this.gameStarted = true;
    this.createLocalPlayer(400, 500);
  }
  
  createLocalPlayer(x, y) {
    const player = this.physics.add.sprite(x, y, 'player');
    player.setCollideWorldBounds(true);
    
    // Create player as triangle
    const graphics = this.add.graphics();
    graphics.fillStyle(0x00ff00, 1);
    graphics.beginPath();
    graphics.moveTo(0, -15);
    graphics.lineTo(-10, 15);
    graphics.lineTo(10, 15);
    graphics.closePath();
    graphics.fillPath();
    
    const texture = graphics.generateTexture('player', 20, 30);
    graphics.destroy();
    
    player.setTexture('player');
    this.localPlayer = player;
    
    // Collision with enemies
    this.physics.add.overlap(this.enemies, this.localPlayer, this.hitPlayer, null, this);
  }
  
  addPlayer(playerData) {
    if (playerData.id === window.GameVibe.getLocalPlayerId()) {
      this.createLocalPlayer(400, 500);
      return;
    }
    
    const player = this.add.sprite(playerData.x || 400, playerData.y || 300, 'player');
    
    // Create player as triangle
    const graphics = this.add.graphics();
    graphics.fillStyle(0x0099ff, 1);
    graphics.beginPath();
    graphics.moveTo(0, -15);
    graphics.lineTo(-10, 15);
    graphics.lineTo(10, 15);
    graphics.closePath();
    graphics.fillPath();
    
    const texture = graphics.generateTexture('remote-player', 20, 30);
    graphics.destroy();
    
    player.setTexture('remote-player');
    
    // Add username label
    const nameText = this.add.text(player.x, player.y - 30, playerData.username, {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    this.players.set(playerData.id, { sprite: player, nameText });
  }
  
  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.sprite.destroy();
      player.nameText.destroy();
      this.players.delete(playerId);
    }
  }
  
  updatePlayer(playerId, playerData) {
    const player = this.players.get(playerId);
    if (player) {
      player.sprite.x = playerData.x;
      player.sprite.y = playerData.y;
      player.nameText.x = playerData.x;
      player.nameText.y = playerData.y - 30;
    }
  }
  
  spawnEnemy() {
    if (!this.gameStarted) return;
    
    const x = Phaser.Math.Between(50, 750);
    const enemy = this.enemies.create(x, -50, 'enemy');
    
    // Create enemy as red square
    const graphics = this.add.graphics();
    graphics.fillStyle(0xff0000, 1);
    graphics.fillRect(0, 0, 30, 30);
    const texture = graphics.generateTexture('enemy', 30, 30);
    graphics.destroy();
    
    enemy.setTexture('enemy');
    enemy.setVelocityY(100);
    
    // Collision with bullets
    this.physics.add.overlap(this.bullets, enemy, this.hitEnemy, null, this);
  }
  
  createBullet(x, y, angle, playerId) {
    const bullet = this.bullets.create(x, y, 'bullet');
    
    // Create bullet as yellow circle
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffff00, 1);
    graphics.fillCircle(5, 5, 5);
    const texture = graphics.generateTexture('bullet', 10, 10);
    graphics.destroy();
    
    bullet.setTexture('bullet');
    bullet.setVelocityY(-500);
    bullet.playerId = playerId;
    
    // Auto-destroy after 2 seconds
    this.time.delayedCall(2000, () => {
      bullet.destroy();
    });
  }
  
  hitEnemy(bullet, enemy) {
    bullet.destroy();
    enemy.destroy();
    
    // Update score if it's our bullet
    if (bullet.playerId === window.GameVibe.getLocalPlayerId() || !bullet.playerId) {
      this.score += 10;
      this.scoreText.setText('Score: ' + this.score);
      
      // Update score in multiplayer
      if (window.GameVibe && window.GameVibe.isMultiplayer) {
        window.GameVibe.updateScore(this.score);
      }
    }
    
    // Create explosion effect
    const explosion = this.add.circle(enemy.x, enemy.y, 5, 0xffa500);
    this.tweens.add({
      targets: explosion,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 300,
      onComplete: () => explosion.destroy()
    });
  }
  
  hitPlayer(player, enemy) {
    // Game over
    enemy.destroy();
    player.setTint(0xff0000);
    
    this.time.delayedCall(1000, () => {
      this.gameOver();
    });
  }
  
  gameOver() {
    this.physics.pause();
    
    this.add.text(400, 250, 'GAME OVER', {
      fontSize: '48px',
      color: '#ff0000'
    }).setOrigin(0.5);
    
    this.add.text(400, 320, 'Final Score: ' + this.score, {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // End game
    if (window.GameVibe) {
      window.GameVibe.endGame(this.score);
    }
  }
  
  update() {
    if (!this.gameStarted || !this.localPlayer) return;
    
    // Player movement
    const speed = 200;
    
    if (this.cursors.left.isDown) {
      this.localPlayer.setVelocityX(-speed);
    } else if (this.cursors.right.isDown) {
      this.localPlayer.setVelocityX(speed);
    } else {
      this.localPlayer.setVelocityX(0);
    }
    
    if (this.cursors.up.isDown) {
      this.localPlayer.setVelocityY(-speed);
    } else if (this.cursors.down.isDown) {
      this.localPlayer.setVelocityY(speed);
    } else {
      this.localPlayer.setVelocityY(0);
    }
    
    // Send position updates in multiplayer
    if (window.GameVibe && window.GameVibe.isMultiplayer) {
      window.GameVibe.sendMove(this.localPlayer.x, this.localPlayer.y);
    }
    
    // Shooting
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.createBullet(this.localPlayer.x, this.localPlayer.y - 20, 0);
      
      // Notify other players
      if (window.GameVibe && window.GameVibe.isMultiplayer) {
        window.GameVibe.sendAction('shoot', {
          x: this.localPlayer.x,
          y: this.localPlayer.y - 20,
          angle: 0
        });
      }
    }
    
    // Clean up off-screen enemies
    this.enemies.children.entries.forEach(enemy => {
      if (enemy.y > 650) {
        enemy.destroy();
      }
    });
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: GameScene
};

const game = new Phaser.Game(config);`,
  sections: {
    preload: "function preload() { /* lines 18-22: Load assets */ }",
    create: "function create() { /* lines 24-72: Setup game objects */ }",
    update: "function update() { /* lines 262-315: Game loop */ }"
  }
};