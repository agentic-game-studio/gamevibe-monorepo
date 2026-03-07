export const STANDARDIZED_GAME_TEMPLATE = `
var config = { type: Phaser.AUTO, width: 800, height: 600, physics: { default: 'arcade', arcade: { gravity: { y: 800 }, debug: false } }, scene: { preload, create, update } };
var game = new Phaser.Game(config);
[GLOBAL_VARIABLES]
var gameState = { isGameOver: false, isPaused: false, score: 0, lives: 3, level: 1 };
var initialPositions = {};

function preload() {
  // Generate all textures programmatically
  var g = this.make.graphics({x:0,y:0,add:false});

  // Player (green)
  g.fillStyle(0x00ff00,1); g.fillTriangle(20,0,40,40,0,40); g.generateTexture('player',40,40); g.clear();

  // Platform (gray)
  g.fillStyle(0x666666,1); g.fillRect(0,0,200,20); g.generateTexture('platform',200,20); g.clear();
  g.fillStyle(0x888888,1); g.fillRect(0,0,100,20); g.generateTexture('platformSmall',100,20); g.clear();

  // Coin (gold)
  g.fillStyle(0xffd700,1); g.fillCircle(12,12,12); g.generateTexture('coin',24,24); g.clear();

  // Enemy (red)
  g.fillStyle(0xff0000,1); g.fillRect(0,0,30,30); g.generateTexture('enemy',30,30); g.clear();

  // Bullet (yellow)
  g.fillStyle(0xffff00,1); g.fillRect(0,0,8,16); g.generateTexture('bullet',8,16); g.clear();

  // Gem (various colors)
  [0xff00ff,0x00ffff,0xff8800].forEach((c,i)=>{g.clear();g.fillStyle(c,1);g.fillCircle(10,10,10);g.generateTexture('gem'+i,20,20);});

  g.destroy();
}

function create() {
  resetGameState();

  // Create platforms
  platforms = this.physics.add.staticGroup();
  platforms.create(400,580,'platform').setScale(4,1).refreshBody();
  platforms.create(150,450,'platformSmall');
  platforms.create(400,400,'platformSmall');
  platforms.create(650,350,'platformSmall');
  platforms.create(200,250,'platformSmall');
  platforms.create(550,180,'platformSmall');

  // Player
  player = this.physics.add.sprite(100,500,'player');
  player.setBounce(0.1); player.setCollideWorldBounds(true);

  // Coins
  coins = this.physics.add.group({ key: 'coin', repeat: 8 });
  var coinPositions = [[200,420],[400,370],[650,320],[250,220],[550,150],[600,540],[300,540],[500,540]];
  coins.children.iterate(function(c,i) {
    if(coinPositions[i]) { c.x = coinPositions[i][0]; c.y = coinPositions[i][1]; c.setBounceY(0.5); }
  });

  // Enemies
  enemies = this.physics.add.group();
  var e1 = enemies.create(400,550,'enemy'); e1.setBounce(1); e1.setCollideWorldBounds(true); e1.setVelocityX(100);
  var e2 = enemies.create(200,230,'enemy'); e2.setBounce(1); e2.setCollideWorldBounds(true); e2.setVelocityX(80);

  // Colliders
  this.physics.add.collider(player,platforms);
  this.physics.add.collider(coins,platforms);
  this.physics.add.collider(enemies,platforms);
  this.physics.add.overlap(player,coins,collectCoin,null,this);
  this.physics.add.overlap(player,enemies,hitEnemy,null,this);

  // UI
  scoreText = this.add.text(16,16,'Score: 0',{fontSize:'28px',fill:'#fff',stroke:'#000',strokeThickness:3});
  livesText = this.add.text(16,50,'Lives: 3',{fontSize:'28px',fill:'#f00',stroke:'#000',strokeThickness:3});
  this.add.text(400,30,'ARROW KEYS to move, UP to jump',{fontSize:'16px',fill:'#aaa'}).setOrigin(0.5);

  // Input
  cursors = this.input.keyboard.createCursorKeys();

  // Store initial
  initialPositions.playerX = 100; initialPositions.playerY = 500;
}

function update() {
  if(gameState.isGameOver) return;

  // Movement
  if(cursors.left.isDown) player.setVelocityX(-200);
  else if(cursors.right.isDown) player.setVelocityX(200);
  else player.setVelocityX(0);

  if(cursors.up.isDown && player.body.touching.down) player.setVelocityY(-450);

  // Fall death
  if(player.y > 650) { playerHit.call(this); }
}

function collectCoin(player,coin) {
  coin.disableBody(true,true);
  gameState.score += 10;
  scoreText.setText('Score: '+gameState.score);

  // Particle effect
  var p = this.add.particles(coin.x,coin.y,'coin',{speed:100,scale:{start:0.5,end:0},lifespan:300,quantity:5});
  this.time.delayedCall(300,()=>p.destroy());
}

function hitEnemy(player,enemy) {
  // Check if jumping on top
  if(player.body.velocity.y > 0 && player.y < enemy.y - 15) {
    enemy.disableBody(true,true);
    gameState.score += 50;
    scoreText.setText('Score: '+gameState.score);

    // Bounce
    player.setVelocityY(-200);
  } else {
    playerHit.call(this);
  }
}

function playerHit() {
  gameState.lives--;
  livesText.setText('Lives: '+gameState.lives);

  if(gameState.lives <= 0) {
    gameState.isGameOver = true;
    var cam = this.cameras.main;
    cam.shake(200,0.01);
    cam.flash(200,255,0,0);

    var container = this.add.container(400,300);
    container.add(this.add.rectangle(0,0,800,600,0,0.8));
    container.add(this.add.text(0,-50,'GAME OVER',{fontSize:'64px',fill:'#f00',stroke:'#fff',strokeThickness:4}).setOrigin(0.5));
    container.add(this.add.text(0,20,'Final Score: '+gameState.score,{fontSize:'32px',fill:'#fff'}).setOrigin(0.5));

    var btn = this.add.rectangle(0,100,150,50,0x00ff00).setInteractive({useHandCursor:true});
    container.add(this.add.text(0,100,'RESTART',{fontSize:'24px',fill:'#000'}).setOrigin(0.5));
    btn.on('pointerdown',()=>this.scene.restart());
  } else {
    // Respawn
    player.x = initialPositions.playerX;
    player.y = initialPositions.playerY;
    player.setVelocity(0,0);
  }
}

function resetGameState() {
  gameState = { isGameOver: false, isPaused: false, score: 0, lives: 3, level: 1 };
}
`;

export const GAME_TYPE_TEMPLATES = {
  platformer: {
    globalVariables: `var player, platforms, coins, enemies, cursors, scoreText, livesText;`,
    storePositions: `initialPositions={playerX:100,playerY:500};`,
    resetObjects: `player.x=initialPositions.playerX;player.y=initialPositions.playerY;player.setVelocity(0,0);`,
    gameOverScreen: `gameState.isGameOver=true;this.add.text(400,300,'GAME OVER',{fontSize:'64px',fill:'#f00'});`,
    updateUI: `scoreText.setText('Score:'+gameState.score);livesText.setText('Lives:'+gameState.lives);`
  },
  shooter: {
    globalVariables: `var player,bullets,enemies;`,
    storePositions: `initialPositions={playerX:400,playerY:550};`,
    resetObjects: `player.x=initialPositions.playerX;player.y=initialPositions.playerY;`,
    gameOverScreen: `gameState.isGameOver=true;this.add.text(400,300,'GAME OVER',{fontSize:'64px',fill:'#f00'});`,
    updateUI: `scoreText.setText('Score:'+gameState.score);`
  },
  puzzle: {
    globalVariables: `var grid=[];`,
    storePositions: ``,
    resetObjects: ``,
    gameOverScreen: `gameState.isGameOver=true;this.add.text(400,300,'GAME OVER',{fontSize:'64px',fill:'#f00'});`,
    updateUI: `scoreText.setText('Score:'+gameState.score);`
  }
};

export const DEFAULT_UI_TEMPLATES = {
  pauseScreen: `gameState.isPaused=true;this.add.text(400,300,'PAUSED',{fontSize:'48px',fill:'#fff'});`
};

export const GAME_STRUCTURE_GUIDELINES = '';
export const UI_LAYOUT_GUIDELINES = '';
