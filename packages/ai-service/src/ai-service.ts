import PQueue from 'p-queue';
import {
  GenerateOptions,
  AIResponse,
  AnalyzeOptions,
  hashStringSync,
  generateCacheKey
} from '@gamevibe/shared';
import { GamePromptBuilder } from './prompts/index.js';

export interface AIServiceConfig {
  minimaxApiKey: string;
  redis?: {
    get: <T>(key: string) => Promise<T | null>;
    set: (key: string, value: any, ttl?: number) => Promise<void>;
  };
}

const DEFAULT_MODEL = 'MiniMax-M2.5-Lightning';
const TIMEOUT_MS = 120000; // 2 minute timeout for complex game generation

// Multiple complex fallback games for variety
const FALLBACK_GAMES: Record<string, string[]> = {
  platformer: [
    // Platformer 1: Classic with power-ups
    `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Epic Platformer</title><script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script></head><body>
<script>
var config = { type: Phaser.AUTO, width: 800, height: 600, physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } }, scene: { preload, create, update } };
var game = new Phaser.Game(config);
var player, platforms, coins, enemies, powerups, cursors, scoreText, livesText, levelText, comboText, gameState = { score: 0, lives: 3, isGameOver: false, level: 1, combo: 0, maxCombo: 0, hasInvincibility: false, hasDoubleJump: false, hasSpeedBoost: false };
var canDoubleJump = false, lastJumpTime = 0;

function preload() {
  var g = this.make.graphics({x:0,y:0,add:false});
  // Player - cyan triangle with glow
  g.fillStyle(0x00ffff,1); g.fillTriangle(20,0,40,40,0,40); g.generateTexture('player',40,40); g.clear();
  // Platforms - gradient look
  g.fillStyle(0x4a90d9,1); g.fillRect(0,0,200,25); g.generateTexture('platform',200,25); g.clear();
  g.fillStyle(0x5ba0e9,1); g.fillRect(0,0,120,20); g.generateTexture('platformSmall',120,20); g.clear();
  g.fillStyle(0x6ab0f9,1); g.fillRect(0,0,80,15); g.generateTexture('platformTiny',80,15); g.clear();
  // Coins - multiple types
  g.fillStyle(0xffd700,1); g.fillCircle(10,10,10); g.generateTexture('coinGold',20,20); g.clear();
  g.fillStyle(0xc0c0c0,1); g.fillCircle(10,10,10); g.generateTexture('coinSilver',20,20); g.clear();
  g.fillStyle(0xcd7f32,1); g.fillCircle(10,10,10); g.generateTexture('coinBronze',20,20); g.clear();
  // Enemies - different types
  g.fillStyle(0xff4444,1); g.fillRect(0,0,28,28); g.generateTexture('enemyBasic',28,28); g.clear();
  g.fillStyle(0xff00ff,1); g.fillCircle(14,14,14); g.generateTexture('enemyFast',28,28); g.clear();
  g.fillStyle(0xff8800,1); g.fillRect(0,0,35,35); g.generateTexture('enemyTank',35,35); g.clear();
  // Power-ups
  g.fillStyle(0x00ff00,1); g.fillTriangle(15,0,30,15,0,15); g.generateTexture('powerStar',30,30); g.clear();
  g.fillStyle(0xff0000,1); g.fillCircle(12,12,12); g.generateTexture('powerHeart',24,24); g.clear();
  g.fillStyle(0xffff00,1); g.fillRect(8,0,16,24); g.generateTexture('powerBolt',16,24); g.clear();
  g.fillStyle(0x00ffff,1); g.fillCircle(12,12,12); g.generateTexture('powerShield',24,24); g.destroy();
}

function create() {
  platforms = this.physics.add.staticGroup();
  createLevel.call(this);

  player = this.physics.add.sprite(100,450,'player');
  player.setBounce(0.05); player.setCollideWorldBounds(true); player.setDragX(800);

  coins = this.physics.add.group();
  enemies = this.physics.add.group();
  powerups = this.physics.add.group();
  spawnCoins.call(this);
  spawnEnemies.call(this);
  spawnPowerups.call(this);

  this.physics.add.collider(player,platforms);
  this.physics.add.collider(coins,platforms);
  this.physics.add.collider(enemies,platforms);
  this.physics.add.collider(powerups,platforms);
  this.physics.add.overlap(player,coins,collectCoin,null,this);
  this.physics.add.overlap(player,enemies,hitEnemy,null,this);
  this.physics.add.overlap(player,powerups,collectPowerup,null,this);

  scoreText = this.add.text(16,16,'Score: 0',{fontSize:'28px',fill:'#fff',stroke:'#000',strokeThickness:4});
  livesText = this.add.text(16,50,'❤❤❤',{fontSize:'24px'});
  levelText = this.add.text(780,16,'Level: 1',{fontSize:'20px',fill:'#0ff'}).setOrigin(1,0);
  comboText = this.add.text(400,60,'COMBO x1',{fontSize:'18px',fill:'#ff0',stroke:'#000',strokeThickness:2}).setOrigin(0.5);
  this.add.text(400,30,'ARROWS: move/jump | R: restart',{fontSize:'14px',fill:'#888'}).setOrigin(0.5);

  cursors = this.input.keyboard.createCursorKeys();
  this.input.keyboard.on('keydown-R',()=>this.scene.restart());
}

function createLevel() {
  platforms.clear(true,true);
  var layout = gameState.level === 1 ? [
    [400,585,4,1],[100,480,1,1],[300,420,1,1],[500,380,1,1],[700,340,1,1],
    [150,280,1,1],[400,220,1,1],[650,180,1,1],[250,120,1,1],[550,80,1,1]
  ] : gameState.level === 2 ? [
    [400,585,4,1],[200,500,1,1],[600,450,1,1],[100,380,1,1],[400,320,1,1],
    [700,260,1,1],[200,200,1,1],[500,140,1,1],[100,80,1,1],[650,60,1,1]
  ] : [
    [400,585,4,1],[150,520,1,1],[350,480,1,1],[550,440,1,1],[750,400,1,1],
    [100,340,1,1],[300,280,1,1],[500,220,1,1],[700,160,1,1],[200,100,1,1],[600,40,1,1]
  ];
  layout.forEach(p => { var plat = platforms.create(p[0],p[1],p[3]===1?'platformSmall':(p[2]>2?'platform':'platformTiny')); if(p[2]>1||p[3]>1) plat.setScale(p[2]||1,p[3]||1).refreshBody(); });
}

function spawnCoins() {
  coins.clear(true,true);
  var positions = gameState.level === 1 ? [[150,450],[350,380],[550,340],[200,250],[450,180],[600,80],[80,540],[250,540],[500,540],[700,540]] :
                  gameState.level === 2 ? [[250,460],[650,410],[150,340],[450,280],[750,220],[250,160],[550,100],[150,40],[700,20],[400,540]] :
                  [[200,480],[400,440],[600,400],[150,300],[350,240],[550,180],[750,120],[250,60],[650,540],[450,540]];
  var types = ['coinGold','coinGold','coinSilver','coinGold','coinBronze','coinGold','coinSilver','coinGold','coinBronze','coinGold'];
  positions.forEach((p,i) => { var c = coins.create(p[0],p[1],types[i]||'coinGold'); c.setBounceY(0.4); c.setData('points',types[i]==='coinGold'?50:(types[i]==='coinSilver'?25:10)); });
}

function spawnEnemies() {
  enemies.clear(true,true);
  var eTypes = [['enemyBasic',80],['enemyFast',120],['enemyTank',50]];
  var positions = gameState.level === 1 ? [[400,540],[200,230],[550,130]] : gameState.level === 2 ? [[500,540],[150,170],[550,60]] : [[300,540],[400,170],[650,60]];
  positions.forEach((p,i) => { var et = eTypes[(i+eTypes.length)%eTypes.length]; var e = enemies.create(p[0],p[1],et[0]); e.setBounce(1); e.setCollideWorldBounds(true); e.setVelocityX(et[1]*(Math.random()>0.5?1:-1)); e.setData('speed',et[1]); });
}

function spawnPowerups() {
  powerups.clear(true,true);
  var types = ['powerStar','powerHeart','powerBolt'];
  var positions = [[300,400],[500,200],[650,80]];
  positions.forEach((p,i) => { var pw = powerups.create(p[0],p[1],types[i]); pw.setBounceY(0.3); pw.setData('type',types[i]); });
}

function update() {
  if(gameState.isGameOver) return;

  // Movement with acceleration
  if(cursors.left.isDown) { player.setAccelerationX(-1200); if(gameState.hasSpeedBoost) player.setAccelerationX(-2000); }
  else if(cursors.right.isDown) { player.setAccelerationX(1200); if(gameState.hasSpeedBoost) player.setAccelerationX(2000); }
  else { player.setAccelerationX(0); player.setDragX(1200); }

  // Jumping with double jump
  if(cursors.up.isDown && player.body.touching.down) {
    player.setVelocityY(-500);
    spawnJumpParticles.call(this);
    canDoubleJump = true; lastJumpTime = this.time.now;
  } else if(cursors.up.isDown && canDoubleJump && this.time.now - lastJumpTime > 200 && (gameState.hasDoubleJump || gameState.level >= 2)) {
    player.setVelocityY(-450);
    canDoubleJump = false;
    spawnJumpParticles.call(this);
  }

  // Enemy AI - some chase player
  enemies.children.each(e => {
    if(e.active && e.body) {
      if(e.texture.key === 'enemyFast' && player.x < e.x) e.setVelocityX(-e.getData('speed'));
      else if(e.texture.key === 'enemyFast') e.setVelocityX(e.getData('speed'));
    }
  });

  // Fall death
  if(player.y > 650) playerHit.call(this);

  // Invincibility blink
  if(gameState.hasInvincibility && Math.floor(this.time.now / 100) % 2 === 0) player.setAlpha(0.5);
  else player.setAlpha(1);
}

function spawnJumpParticles() {
  for(var i=0;i<8;i++) {
    var p = this.add.circle(player.x, player.y + 20, 4, 0x00ffff);
    this.tweens.add({targets:p, x: player.x + (Math.random()-0.5)*40, y: player.y + 20 + Math.random()*20, alpha: 0, scale: 0, duration: 300, onComplete:()=>p.destroy()});
  }
}

function collectCoin(player,coin) {
  coin.disableBody(true,true);
  var pts = coin.getData('points') || 10;
  gameState.combo++;
  if(gameState.combo > gameState.maxCombo) gameState.maxCombo = gameState.combo;
  var multiplier = Math.min(Math.floor(gameState.combo / 5), 4);
  gameState.score += pts * (1 + multiplier);

  scoreText.setText('Score: ' + gameState.score);
  comboText.setText('COMBO x' + (1 + multiplier));
  comboText.setColor(multiplier > 2 ? '#ff0' : '#fff');

  // Particle burst
  for(var i=0;i<12;i++) {
    var p = this.add.circle(coin.x, coin.y, 6, coin.texture.key==='coinGold'?0xffd700:(coin.texture.key==='coinSilver'?0xc0c0c0:0xcd7f32));
    this.tweens.add({targets:p, x: coin.x + (Math.random()-0.5)*60, y: coin.y + (Math.random()-0.5)*60, alpha: 0, scale: 0, duration: 400, onComplete:()=>p.destroy()});
  }

  this.tweens.add({targets:player, scaleX:1.2, scaleY:0.8, duration:50, yoyo:true});

  // Level complete check
  if(coins.countActive() === 0) {
    gameState.level++;
    levelText.setText('Level: ' + gameState.level);
    this.cameras.main.shake(200,0.01);
    this.cameras.main.flash(200,0,255,255);
    createLevel.call(this);
    spawnCoins.call(this);
    spawnEnemies.call(this);
  }
}

function collectPowerup(player,powerup) {
  var type = powerup.getData('type');
  powerup.disableBody(true,true);

  // Particle effect
  for(var i=0;i<15;i++) {
    var p = this.add.circle(powerup.x, powerup.y, 8, 0x00ffff);
    this.tweens.add({targets:p, x: powerup.x + (Math.random()-0.5)*80, y: powerup.y + (Math.random()-0.5)*80, alpha: 0, duration: 500, onComplete:()=>p.destroy()});
  }

  if(type === 'powerStar') { gameState.hasInvincibility = true; this.time.delayedCall(5000,()=>gameState.hasInvincibility=false); }
  else if(type === 'powerHeart') { gameState.lives = Math.min(gameState.lives + 1, 5); updateLivesText(); }
  else if(type === 'powerBolt') { gameState.hasSpeedBoost = true; this.time.delayedCall(8000,()=>gameState.hasSpeedBoost=false); }

  this.tweens.add({targets:player, scale:1.3, duration:100, yoyo:true});
}

function hitEnemy(player,enemy) {
  if(gameState.hasInvincibility) {
    enemy.disableBody(true,true);
    gameState.score += 100;
    scoreText.setText('Score: ' + gameState.score);
    this.cameras.main.shake(100,0.01);
    return;
  }

  if(player.body.velocity.y > 0 && player.y < enemy.y - 10) {
    enemy.disableBody(true,true);
    gameState.score += 50 + gameState.level * 10;
    scoreText.setText('Score: ' + gameState.score);
    player.setVelocityY(-250);
    this.cameras.main.shake(80,0.008);

    // Death particles
    for(var i=0;i<10;i++) {
      var p = this.add.circle(enemy.x, enemy.y, 5, 0xff0000);
      this.tweens.add({targets:p, x: enemy.x + (Math.random()-0.5)*50, y: enemy.y + (Math.random()-0.5)*50, alpha: 0, duration: 300, onComplete:()=>p.destroy()});
    }
  } else {
    playerHit.call(this);
  }
}

function playerHit() {
  if(gameState.hasInvincibility) return;

  gameState.lives--;
  gameState.combo = 0;
  comboText.setText('COMBO x1');
  updateLivesText();
  this.cameras.main.shake(200,0.015);
  this.cameras.main.flash(200,255,0,0);

  if(gameState.lives <= 0) {
    gameState.isGameOver = true;
    var c = this.add.container(400,300);
    c.add(this.add.rectangle(0,0,800,600,0,0.9));
    c.add(this.add.text(0,-80,'GAME OVER',{fontSize:'72px',fill:'#ff0000',stroke:'#fff',strokeThickness:6}).setOrigin(0.5));
    c.add(this.add.text(0,-10,'Score: ' + gameState.score,{fontSize:'36px',fill:'#fff'}).setOrigin(0.5));
    c.add(this.add.text(0,40,'Level: ' + gameState.level,{fontSize:'28px',fill:'#0ff'}).setOrigin(0.5));
    c.add(this.add.text(0,90,'Max Combo: x' + (gameState.maxCombo + 1),{fontSize:'22px',fill:'#ff0'}).setOrigin(0.5));

    var stars = gameState.score >= 500 ? '⭐⭐⭐' : gameState.score >= 200 ? '⭐⭐' : '⭐';
    c.add(this.add.text(0,140,stars,{fontSize:'48px'}).setOrigin(0.5));

    var btn = this.add.rectangle(0,210,200,55,0x00ff00).setInteractive({useHandCursor:true});
    c.add(this.add.text(0,210,'PLAY AGAIN',{fontSize:'24px',fill:'#000',fontWeight:'bold'}).setOrigin(0.5));
    btn.on('pointerdown',()=>this.scene.restart());
  } else {
    player.x = 100; player.y = 450; player.setVelocity(0,0);
    gameState.hasInvincibility = true;
    this.time.delayedCall(1500,()=>gameState.hasInvincibility=false);
  }
}

function updateLivesText() {
  var hearts = ''; for(var i=0;i<gameState.lives;i++) hearts += '❤';
  livesText.setText(hearts);
}
</script></body></html>`,

    // Platformer 2: Roguelike style
    `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Dungeon Runner</title><script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script></head><body>
<script>
var config = { type: Phaser.AUTO, width: 800, height: 600, physics: { default: 'arcade', arcade: { gravity: { y: 1000 }, debug: false } }, scene: { preload, create, update } };
var game = new Phaser.Game(config);
var player, platforms, coins, gems, enemies, cursors, scoreText, livesText, depthText, gameState = { score: 0, lives: 3, isGameOver: false, depth: 1, hasKey: false, weaponLevel: 1 };
var weapon, lastFire = 0, bullets;

function preload() {
  var g = this.make.graphics({x:0,y:0,add:false});
  g.fillStyle(0x8b5cf6,1); g.fillRect(5,0,30,35); g.generateTexture('player',35,35); g.clear();
  g.fillStyle(0x374151,1); g.fillRect(0,0,200,30); g.generateTexture('platform',200,30); g.clear();
  g.fillStyle(0x4b5563,1); g.fillRect(0,0,100,20); g.generateTexture('platformSmall',100,20); g.clear();
  g.fillStyle(0xfbbf24,1); g.fillCircle(8,8,8); g.generateTexture('coin',16,16); g.clear();
  g.fillStyle(0x06b6d4,1); g.fillTriangle(10,0,20,10,0,10); g.generateTexture('gem',20,20); g.clear();
  g.fillStyle(0xef4444,1); g.fillRect(0,0,25,25); g.generateTexture('enemy',25,25); g.clear();
  g.fillStyle(0xf97316,1); g.fillCircle(10,10,10); g.generateTexture('bat',20,20); g.clear();
  g.fillStyle(0x84cc16,1); g.fillRect(0,0,30,20); g.generateTexture('slime',30,20); g.clear();
  g.fillStyle(0xfacc15,1); g.fillRect(0,0,6,12); g.generateTexture('bullet',6,12); g.clear();
  g.fillStyle(0xec4899,1); g.fillRect(8,4,16,12); g.generateTexture('key',16,12); g.destroy();
}

function create() {
  platforms = this.physics.add.staticGroup();
  generateLevel.call(this, 1);

  player = this.physics.add.sprite(100,500,'player');
  player.setCollideWorldBounds(true); player.setDragX(1000);

  bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 20 });

  coins = this.physics.add.group();
  gems = this.physics.add.group();
  enemies = this.physics.add.group();
  spawnObjects.call(this);

  this.physics.add.collider(player,platforms);
  this.physics.add.collider(bullets,platforms,(b)=>b.destroy());
  this.physics.add.collider(enemies,platforms);
  this.physics.add.overlap(player,coins,collectCoin,null,this);
  this.physics.add.overlap(player,gems,collectGem,null,this);
  this.physics.add.overlap(player,enemies,hitEnemy,null,this);
  this.physics.add.overlap(bullets,enemies,bulletHit,null,this);
  this.physics.add.overlap(player,this.physics.add.staticGroup().create(750,540,'key'),collectKey,null,this);

  scoreText = this.add.text(16,16,'Gold: 0',{fontSize:'24px',fill:'#fbbf24',stroke:'#000',strokeThickness:3});
  livesText = this.add.text(16,45,'❤❤❤',{fontSize:'20px'});
  depthText = this.add.text(780,16,'Depth: 1',{fontSize:'22px',fill:'#8b5cf6'}).setOrigin(1,0);
  this.add.text(400,30,'ARROWS: move/jump | SPACE: shoot',{fontSize:'14px',fill:'#888'}).setOrigin(0.5);

  cursors = this.input.keyboard.createCursorKeys();
  this.input.keyboard.on('keydown-SPACE',fireBullet,this);
}

function generateLevel(depth) {
  platforms.clear(true,true);
  var numPlatforms = 6 + Math.min(depth, 10);
  for(var i=0;i<numPlatforms;i++) {
    var x = Phaser.Math.Between(50,750);
    var y = Phaser.Math.Between(100,550);
    var w = Phaser.Math.Between(80,200);
    var p = platforms.create(x,y,i===0?'platform':'platformSmall');
    if(w > 100) p.setScale(w/200,1).refreshBody();
  }
  platforms.create(400,590,'platform').setScale(4,1).refreshBody();
}

function spawnObjects() {
  coins.clear(true,true);
  gems.clear(true,true);
  enemies.clear(true,true);

  for(var i=0;i<8 + gameState.depth;i++) {
    var x = Phaser.Math.Between(50,750);
    var y = Phaser.Math.Between(80,530);
    var c = coins.create(x,y,'coin');
    c.setBounceY(0.3); c.setData('value',Phaser.Math.Between(5,15));
  }

  for(var i=0;i<3 + Math.floor(gameState.depth/2);i++) {
    var x = Phaser.Math.Between(50,750);
    var y = Phaser.Math.Between(80,530);
    var types = ['enemy','bat','slime'];
    var e = enemies.create(x,y,types[Phaser.Math.Between(0,types.length-1)]);
    e.setBounce(1); e.setCollideWorldBounds(true);
    e.setVelocityX(Phaser.Math.Between(-100,100));
    e.setData('type',e.texture.key);
  }
}

function fireBullet() {
  if(gameState.isGameOver || this.time.now - lastFire < 300) return;
  lastFire = this.time.now;
  var b = bullets.create(player.x, player.y-10,'bullet');
  b.setVelocityY(-600);
}

function bulletHit(bullet,enemy) {
  bullet.destroy();
  enemy.destroy();
  gameState.score += 25;
  scoreText.setText('Gold: ' + gameState.score);
  this.cameras.main.shake(50,0.005);

  // Particles
  for(var i=0;i<8;i++) {
    var p = this.add.circle(enemy.x,enemy.y,4,0xff0000);
    this.tweens.add({targets:p, alpha:0, duration:200, onComplete:()=>p.destroy()});
  }
}

function collectCoin(player,coin) {
  coin.disableBody(true,true);
  gameState.score += coin.getData('value');
  scoreText.setText('Gold: ' + gameState.score);
  this.tweens.add({targets:player, scaleX:1.1, scaleY:1.1, duration:50, yoyo:true});
}

function collectGem(player,gem) {
  gem.disableBody(true,true);
  gameState.score += 100;
  scoreText.setText('Gold: ' + gameState.score);
  this.cameras.main.flash(100,0,255,255);
}

function collectKey(player,key) {
  key.disableBody(true,true);
  gameState.hasKey = true;
  gameState.lives++;
  this.cameras.main.flash(200,0,255,0);
  // Go deeper
  gameState.depth++;
  depthText.setText('Depth: ' + gameState.depth);
  generateLevel.call(this, gameState.depth);
  spawnObjects.call(this);
  player.x = 100; player.y = 500;
}

function hitEnemy(player,enemy) {
  enemy.disableBody(true,true);
  gameState.lives--;
  livesText.setText(Array(gameState.lives+1).join('❤'));
  this.cameras.main.shake(150,0.01);
  this.cameras.main.flash(150,255,0,0);

  if(gameState.lives <= 0) {
    gameOver.call(this);
  } else {
    player.x = 100; player.y = 500;
  }
}

function gameOver() {
  gameState.isGameOver = true;
  var c = this.add.container(400,300);
  c.add(this.add.rectangle(0,0,800,600,0,0.9));
  c.add(this.add.text(0,-60,'GAME OVER',{fontSize:'64px',fill:'#ef4444',stroke:'#fff',strokeThickness:5}).setOrigin(0.5));
  c.add(this.add.text(0,10,'Gold: ' + gameState.score,{fontSize:'32px',fill:'#fbbf24'}).setOrigin(0.5));
  c.add(this.add.text(0,60,'Depth: ' + gameState.depth,{fontSize:'28px',fill:'#8b5cf6'}).setOrigin(0.5));
  var btn = this.add.rectangle(0,140,180,50,0x22c55e).setInteractive({useHandCursor:true});
  c.add(this.add.text(0,140,'TRY AGAIN',{fontSize:'24px',fill:'#fff'}).setOrigin(0.5));
  btn.on('pointerdown',()=>{ gameState.score=0; gameState.lives=3; gameState.depth=1; gameState.isGameOver=false; this.scene.restart(); });
}

function update() {
  if(gameState.isGameOver) return;

  if(cursors.left.isDown) player.setAccelerationX(-1500);
  else if(cursors.right.isDown) player.setAccelerationX(1500);
  else { player.setAccelerationX(0); player.setDragX(1000); }

  if(cursors.up.isDown && player.body.touching.down) player.setVelocityY(-550);

  if(player.y > 620) { gameState.lives = 0; gameOver.call(this); }

  // Enemy AI
  enemies.children.each(e => {
    if(e.active && e.body) {
      if(e.getData('type') === 'bat') {
        // Fly toward player slowly
        if(player.x < e.x) e.setVelocityX(-60);
        else e.setVelocityX(60);
        if(player.y < e.y) e.setVelocityY(-40);
        else e.setVelocityY(40);
      }
    }
  });
}
</script></body></html>`
  ],

  shooter: [
    // Shooter 1: Space shooter with waves
    `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Space Defender</title><script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script></head><body>
<script>
var config = { type: Phaser.AUTO, width: 800, height: 600, physics: { default: 'arcade', debug: false }, scene: { preload, create, update } };
var game = new Phaser.Game(config);
var player, bullets, enemies, powerups, cursors, scoreText, livesText, waveText, gameState = { score: 0, lives: 3, isGameOver: false, wave: 1, hasTriple: false, hasRapid: false, hasShield: false };
var lastFire = 0, lastEnemyFire = 0, enemyBullets;

function preload() {
  var g = this.make.graphics({x:0,y:0,add:false});
  g.fillStyle(0x3b82f6,1); g.fillTriangle(25,0,50,50,0,50); g.generateTexture('ship',50,50); g.clear();
  g.fillStyle(0xfbbf24,1); g.fillRect(0,0,6,16); g.generateTexture('bullet',6,16); g.clear();
  g.fillStyle(0xef4444,1); g.fillCircle(15,15,15); g.generateTexture('enemyBasic',30,30); g.clear();
  g.fillStyle(0xa855f7,1); g.fillRect(0,0,25,35); g.generateTexture('enemyShooter',25,35); g.clear();
  g.fillStyle(0x22c55e,1); g.fillCircle(20,20,20); g.generateTexture('enemyFast',40,40); g.clear();
  g.fillStyle(0xfacc15,1); g.fillRect(0,0,8,16); g.generateTexture('enemyBullet',8,16); g.clear();
  g.fillStyle(0x06b6d4,1); g.fillCircle(12,12,12); g.generateTexture('powerTriple',24,24); g.clear();
  g.fillStyle(0xec4899,1); g.fillCircle(12,12,12); g.generateTexture('powerRapid',24,24); g.clear();
  g.fillStyle(0x14b8a6,1); g.fillCircle(12,12,12); g.generateTexture('powerShield',24,24); g.destroy();
}

function create() {
  player = this.physics.add.sprite(400,550,'ship');
  player.setCollideWorldBounds(true);

  bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 50 });
  enemyBullets = this.physics.add.group({ defaultKey: 'enemyBullet', maxSize: 30 });
  enemies = this.physics.add.group();
  powerups = this.physics.add.group();

  spawnWave.call(this);

  this.physics.add.overlap(bullets,enemies,hitEnemy,null,this);
  this.physics.add.overlap(player,enemies,hitPlayer,null,this);
  this.physics.add.overlap(player,enemyBullets,hitPlayer,null,this);
  this.physics.add.overlap(player,powerups,collectPowerup,null,this);

  scoreText = this.add.text(16,16,'Score: 0',{fontSize:'28px',fill:'#fff',stroke:'#000',strokeThickness:3});
  livesText = this.add.text(16,50,'❤❤❤',{fontSize:'22px'});
  waveText = this.add.text(780,16,'Wave: 1',{fontSize:'24px',fill:'#0ff'}).setOrigin(1,0);
  this.add.text(400,30,'ARROWS: move | SPACE: fire',{fontSize:'14px',fill:'#888'}).setOrigin(0.5);

  cursors = this.input.keyboard.createCursorKeys();
  this.input.keyboard.on('keydown-SPACE',fireBullet,this);
}

function spawnWave() {
  var numEnemies = 4 + Math.min(gameState.wave * 2, 20);
  for(var i=0;i<numEnemies;i++) {
    var x = Phaser.Math.Between(50,750);
    var y = Phaser.Math.Between(-200, -50);
    var types = ['enemyBasic','enemyShooter','enemyFast'];
    var type = types[Math.min(Math.floor(gameState.wave/3), types.length-1)];
    var e = enemies.create(x,y,type);
    e.setData('type',type);
    e.setVelocityY(Phaser.Math.Between(30,80) + gameState.wave * 5);
    e.setBounce(1); e.setCollideWorldBounds(true);
    if(type === 'enemyFast') e.setVelocityX(Phaser.Math.Between(-60,60));
  }

  // Spawn powerup occasionally
  if(Math.random() < 0.3) {
    var p = powerups.create(Phaser.Math.Between(100,700), -50, ['powerTriple','powerRapid','powerShield'][Phaser.Math.Between(0,2)]);
    p.setVelocityY(50);
  }
}

function fireBullet() {
  if(gameState.isGameOver) return;
  var now = this.time.now;
  var delay = gameState.hasRapid ? 100 : 250;
  if(now - lastFire < delay) return;
  lastFire = now;

  if(gameState.hasTriple) {
    bullets.create(player.x, player.y-20,'bullet').setVelocityY(-600);
    bullets.create(player.x-15, player.y-10,'bullet').setVelocity(-100,-550);
    bullets.create(player.x+15, player.y-10,'bullet').setVelocity(100,-550);
  } else {
    bullets.create(player.x, player.y-20,'bullet').setVelocityY(-600);
  }
}

function hitEnemy(bullet,enemy) {
  bullet.destroy();
  enemy.destroy();
  gameState.score += 10 + gameState.wave * 2;
  scoreText.setText('Score: ' + gameState.score);

  // Explosion particles
  for(var i=0;i<10;i++) {
    var p = this.add.circle(enemy.x,enemy.y,5,0xff6600);
    this.tweens.add({targets:p, alpha:0, x: enemy.x+(Math.random()-0.5)*40, y: enemy.y+(Math.random()-0.5)*40, duration:300, onComplete:()=>p.destroy()});
  }

  this.cameras.main.shake(30,0.003);

  if(enemies.countActive() === 0) {
    gameState.wave++;
    waveText.setText('Wave: ' + gameState.wave);
    this.cameras.main.flash(300,0,255,255);
    this.time.delayedCall(1500,()=>spawnWave.call(this));
  }
}

function hitPlayer(player,enemyOrBullet) {
  if(gameState.hasShield) {
    gameState.hasShield = false;
    enemyOrBullet.destroy();
    this.cameras.main.shake(100,0.01);
    return;
  }

  if(enemyOrBullet.texture) enemyOrBullet.destroy();
  gameState.lives--;
  livesText.setText(Array(gameState.lives+1).join('❤'));
  this.cameras.main.shake(200,0.015);
  this.cameras.main.flash(200,255,0,0);

  if(gameState.lives <= 0) {
    gameOver.call(this);
  }
}

function collectPowerup(player,powerup) {
  var type = powerup.texture.key;
  powerup.destroy();

  if(type === 'powerTriple') gameState.hasTriple = true;
  else if(type === 'powerRapid') gameState.hasRapid = true;
  else if(type === 'powerShield') gameState.hasShield = true;

  this.cameras.main.flash(150,0,255,0);
}

function gameOver() {
  gameState.isGameOver = true;
  var c = this.add.container(400,300);
  c.add(this.add.rectangle(0,0,800,600,0,0.9));
  c.add(this.add.text(0,-60,'GAME OVER',{fontSize:'72px',fill:'#ef4444',stroke:'#fff',strokeThickness:6}).setOrigin(0.5));
  c.add(this.add.text(0,10,'Score: ' + gameState.score,{fontSize:'36px',fill:'#fff'}).setOrigin(0.5));
  c.add(this.add.text(0,60,'Wave: ' + gameState.wave,{fontSize:'28px',fill:'#0ff'}).setOrigin(0.5));
  var btn = this.add.rectangle(0,140,180,55,0x22c55e).setInteractive({useHandCursor:true});
  c.add(this.add.text(0,140,'PLAY AGAIN',{fontSize:'24px',fill:'#fff'}).setOrigin(0.5));
  btn.on('pointerdown',()=>this.scene.restart());
}

function update() {
  if(gameState.isGameOver) return;

  if(cursors.left.isDown) player.setVelocityX(-300);
  else if(cursors.right.isDown) player.setVelocityX(300);
  else player.setVelocityX(0);

  if(cursors.up.isDown && player.y > 50) player.setVelocityY(-250);
  else if(cursors.down.isDown && player.y < 550) player.setVelocityY(250);

  // Enemy shooting
  var now = this.time.now;
  if(now - lastEnemyFire > 2000 - gameState.wave * 100) {
    lastEnemyFire = now;
    enemies.children.each(e => {
      if(e.active && e.getData('type') === 'enemyShooter' && e.y > 0 && e.y < 400) {
        var b = enemyBullets.create(e.x,e.y+15,'enemyBullet');
        b.setVelocityY(250);
      }
    });
  }

  // Cleanup off-screen
  bullets.children.each(b => { if(b.y < -20) b.destroy(); });
  enemyBullets.children.each(b => { if(b.y > 620) b.destroy(); });
  powerups.children.each(p => { if(p.y > 620) p.destroy(); });
}
</script></body></html>`
  ],

  puzzle: [
    // Puzzle: Match-3 with special gems
    `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Gem Matcher</title><script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script></head><body>
<script>
var config = { type: Phaser.AUTO, width: 800, height: 600, scene: { preload, create, update } };
var game = new Phaser.Game(config);
var grid = [], selected = null, score = 0, moves = 30, timeLeft = 60, combos = 0, gameState = { isGameOver: false };
var timerEvent, scoreText, movesText, timeText, comboText;

function preload() {
  var g = this.make.graphics({x:0,y:0,add:false});
  var colors = [0xff4444,0x44ff44,0x4488ff,0xffff44,0xff44ff,0x44ffff];
  colors.forEach((c,i)=>{g.clear();g.fillStyle(c,1);g.fillCircle(22,22,18);g.generateTexture('gem'+i,44,44);});
  // Special gems
  g.clear();g.fillStyle(0xffffff,1);g.fillCircle(22,22,20);g.fillStyle(0xff0000,1);g.fillCircle(22,22,10);g.generateTexture('bomb',44,44);g.clear();
  g.clear();g.fillStyle(0xffff00,1);g.fillRect(10,0,24,44);g.generateTexture('lightning',44,44);g.clear();
  g.clear();g.fillStyle(0xff0000,1);g.fillCircle(22,22,20);g.fillStyle(0xffffff,1);g.fillRect(18,10,8,24);g.generateTexture('fire',44,44);g.destroy();
}

function create() {
  for(var y=0;y<8;y++) { grid[y] = []; for(var x=0;x<8;x++) { var type = getValidGem(x,y); var s = this.add.sprite(x*60+85,y*60+65,'gem'+type).setInteractive(); s.gridX = x; s.gridY = y; s.gemType = type; s.on('pointerdown',selectGem,this); grid[y][x] = s; } }

  scoreText = this.add.text(16,500,'Score: 0',{fontSize:'32px',fill:'#fff',stroke:'#000',strokeThickness:3});
  movesText = this.add.text(16,545,'Moves: 30',{fontSize:'28px',fill:'#ff0'});
  timeText = this.add.text(780,500,'Time: 60',{fontSize:'28px',fill:'#0ff'}).setOrigin(1,0);
  comboText = this.add.text(400,560,'Combo: x1',{fontSize:'22px',fill:'#f0f'}).setOrigin(0.5);
  this.add.text(400,30,'Match 3+ gems! Special: ⚡=clear row, 💣=clear area, 🔥=fireball',{fontSize:'14px',fill:'#888'}).setOrigin(0.5);

  timerEvent = this.time.addEvent({delay:1000,callback:()=>{ timeLeft--; timeText.setText('Time: '+timeLeft); if(timeLeft<=0) gameOver.call(this); },loop:true});
}

function getValidGem(x,y) { var type; do { type = Phaser.Math.Between(0,5); } while((x>1 && grid[y][x-1]?.gemType===type && grid[y][x-2]?.gemType===type) || (y>1 && grid[y-1][x]?.gemType===type && grid[y-2][x]?.gemType===type)); return type; }

function selectGem(gem) {
  if(gameState.isGameOver || moves<=0 || timeLeft<=0) return;
  if(!selected) { selected = gem; gem.setScale(1.15); gem.setStrokeStyle(4,0xffffff); this.tweens.add({targets:gem, angle:10, duration:100, yoyo:true, repeat:-1}); }
  else if(selected === gem) { selected.setScale(1); selected.setStrokeStyle(0); selected.setAngle(0); selected = null; }
  else if(Math.abs(selected.gridX - gem.gridX) + Math.abs(selected.gridY - gem.gridY) === 1) { swapGems.call(this,selected,gem); }
  else { selected.setScale(1); selected.setStrokeStyle(0); selected.setAngle(0); selected = gem; gem.setScale(1.15); gem.setStrokeStyle(4,0xffffff); this.tweens.add({targets:gem, angle:10, duration:100, yoyo:true, repeat:-1}); }
}

function swapGems(g1,g2) {
  selected.setScale(1); selected.setStrokeStyle(0); selected.setAngle(0); selected = null;

  var t = {x:g1.x,y:g1.y,tx:g1.gridX,ty:g1.gridY,type:g1.gemType};
  this.tweens.add({targets:g1, x:g2.x, y:g2.y, duration:150});
  this.tweens.add({targets:g2, x:t.x, y:t.y, duration:150, onComplete:()=>{
    g1.x=t.x; g1.y=t.y; g1.gridX=t.tx; g1.gridY=t.ty;
    g2.x=g2.x; g2.y=g2.y; g2.gridX=g2.x>0?Math.round((g2.x-85)/60):0; g2.gridY=g2.y>0?Math.round((g2.y-65)/60):0;
    var temp = {x:g1.gridX,y:g1.gridY,type:g1.gemType};
    g1.gridX=g2.gridX; g1.gridY=g2.gridY; g1.gemType=g2.gemType;
    g2.gridX=temp.x; g2.gridY=temp.y; g2.gemType=temp.type;
    grid[g1.gridY][g1.gridX]=g1; grid[g2.gridY][g2.gridX]=g2;
    moves--; movesText.setText('Moves: '+moves);
    this.time.delayedCall(200,()=>checkMatches.call(this));
  }});
}

function checkMatches() {
  var matches = [];
  for(var y=0;y<8;y++) for(var x=0;x<6;x++) if(grid[y][x] && grid[y][x+1] && grid[y][x+2] && grid[y][x].gemType === grid[y][x+1].gemType && grid[y][x].gemType === grid[y][x+2].gemType) matches.push(grid[y][x],grid[y][x+1],grid[y][x+2]);
  for(var x=0;x<8;x++) for(var y=0;y<6;y++) if(grid[y][x] && grid[y+1][x] && grid[y+2][x] && grid[y][x].gemType === grid[y+1][x].gemType && grid[y][x].gemType === grid[y+2][x].gemType) matches.push(grid[y][x],grid[y+1][x],grid[y+2][x]);

  if(matches.length > 0) {
    var unique = [...new Set(matches)];
    combos++; var mult = Math.min(combos,5);

    // Handle special gems
    unique.forEach(g => {
      if(g.gemType === 6) { // Bomb - clear 3x3
        for(var by=g.gridY-1;by<=g.gridY+1;by++) for(var bx=g.gridX-1;bx<=g.gridX+1;by++) if(grid[by]&&grid[by][bx]) { matches.push(grid[by][bx]); score+=50; }
      } else if(g.gemType === 7) { // Lightning - clear row and column
        for(var i=0;i<8;i++) { if(grid[g.gridY][i]) matches.push(grid[g.gridY][i]); if(grid[i]&&grid[i][g.gridX]) matches.push(grid[i][g.gridX]); }
      }
    });

    score += unique.length * 10 * mult;
    scoreText.setText('Score: '+score);
    comboText.setText('Combo: x'+mult);

    unique.forEach(g => {
      this.tweens.add({targets:g, scale:0, alpha:0, duration:200, onComplete:()=>{
        g.gemType = getValidGem(g.gridX,g.gridY);
        g.setTexture('gem'+g.gemType);
      }});
    });

    this.time.delayedCall(250,()=>{unique.forEach(g=>{g.setScale(1);g.setAlpha(1);});checkMatches.call(this);});
  } else { combos = 0; comboText.setText('Combo: x1'); if(moves<=0 || timeLeft<=0) gameOver.call(this); }
}

function gameOver() {
  gameState.isGameOver = true;
  timerEvent.remove();
  var c = this.add.container(400,300);
  c.add(this.add.rectangle(0,0,800,600,0,0.85));
  var isWin = score >= 500;
  c.add(this.add.text(0,-60,isWin?'LEVEL CLEAR!':'GAME OVER',{fontSize:'56px',fill:isWin?'#0f0':'#f00',stroke:'#fff',strokeThickness:4}).setOrigin(0.5));
  c.add(this.add.text(0,10,'Score: '+score,{fontSize:'36px',fill:'#fff'}).setOrigin(0.5));
  c.add(this.add.text(0,60,'Moves: '+moves+' | Time: '+timeLeft,{fontSize:'24px',fill:'#ff0'}).setOrigin(0.5));
  var btn = this.add.rectangle(0,140,150,50,0x00ff00).setInteractive({useHandCursor:true});
  c.add(this.add.text(0,140,'PLAY',{fontSize:'24px',fill:'#000'}).setOrigin(0.5));
  btn.on('pointerdown',()=>this.scene.restart());
}

function update() {}
</script></body></html>`
  ]
};

// Get random fallback game based on type
function getRandomFallback(gameType: string): string {
  const games = FALLBACK_GAMES[gameType] || FALLBACK_GAMES.platformer;
  return games[Math.floor(Math.random() * games.length)];
}

export class AIService {
  private minimaxApiKey: string;
  private queue: PQueue;
  private cache?: AIServiceConfig['redis'];
  private promptBuilder: GamePromptBuilder;

  constructor(config: AIServiceConfig) {
    this.minimaxApiKey = config.minimaxApiKey;
    this.cache = config.redis;
    this.promptBuilder = new GamePromptBuilder();
    this.queue = new PQueue({ concurrency: 2, interval: 1000, intervalCap: 3 });
  }

  private async fetchWithTimeout(url: string, body: object): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.minimaxApiKey },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`API error ${response.status}`);
      return await response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error('Request timed out');
      throw err;
    }
  }

  async generate(options: GenerateOptions): Promise<AIResponse> {
    const cacheKey = this.getCacheKey(options);
    if (this.cache) {
      const cached = await this.cache.get<AIResponse>(cacheKey);
      if (cached) return cached;
    }
    const response = await this.queue.add(async () => this.callAPI(options)) as unknown as AIResponse;
    if (this.cache && response) await this.cache.set(cacheKey, response, 3600);
    return response;
  }

  async analyzeGameRequest(description: string, context?: any): Promise<any> {
    const prompt = this.promptBuilder.buildAnalysisPrompt(description, context);
    const response = await this.generate({ prompt, model: DEFAULT_MODEL, temperature: 0.3, maxTokens: 256 });
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return JSON.parse(response.content);
    } catch {
      return { type: 'platformer', name: 'Game', description, coreMechanics: ['move'], features: ['score', 'enemies'], playerCount: '1', difficulty: 'medium' };
    }
  }

  async generateGameCode(spec: any, template: any): Promise<string> {
    const type = (spec.type || 'platformer').toLowerCase();
    let gameType = 'platformer';
    if (type.includes('shoot')) gameType = 'shooter';
    else if (type.includes('puzzle') || type.includes('match')) gameType = 'puzzle';
    else if (type.includes('roguelike') || type.includes('dungeon')) gameType = 'platformer'; // Roguelike uses platformer

    try {
      const prompt = this.promptBuilder.buildGameGenerationPrompt(spec, template);
      const response = await this.generate({ prompt, model: DEFAULT_MODEL, temperature: 1.0, maxTokens: 8000 });
      if (response.content && response.content.includes('Phaser.Game')) return response.content;
    } catch (err) {
      console.log('[AI] Generation failed, using fallback:', err);
    }

    console.log('[AI] Using fallback game for type:', gameType);
    return getRandomFallback(gameType);
  }

  async health(): Promise<boolean> {
    try { await this.generate({ prompt: 'hi', model: DEFAULT_MODEL, maxTokens: 5 }); return true; } catch { return false; }
  }

  private async callAPI(options: GenerateOptions): Promise<AIResponse> {
    const data = await this.fetchWithTimeout('https://api.minimax.io/anthropic/v1/messages', {
      model: options.model || DEFAULT_MODEL,
      max_tokens: Math.min(options.maxTokens || 4096, 8192),
      temperature: options.temperature || 0.7,
      messages: [{ role: 'user', content: options.prompt }]
    });

    let content = '';
    if (data.content) {
      for (const c of data.content) {
        if (c.type === 'text' && c.text) content += c.text;
      }
    }

    return { content, model: options.model || DEFAULT_MODEL, usage: data.usage ? { promptTokens: data.usage.input_tokens, completionTokens: data.usage.output_tokens, totalTokens: data.usage.input_tokens + data.usage.output_tokens } : undefined };
  }

  private getCacheKey(options: GenerateOptions | AnalyzeOptions): string {
    return generateCacheKey('ai', options.model, hashStringSync(options.prompt).substring(0, 16));
  }
}
