export const STANDARDIZED_GAME_TEMPLATE = `
var config = { type: Phaser.AUTO, width: 800, height: 600, physics: { default: 'arcade', arcade: { gravity: { y: 500 }, debug: false } }, scene: { preload, create, update } };
var game = new Phaser.Game(config);
[GLOBAL_VARIABLES]
var gameState = { isGameOver: false, isPaused: false, score: 0, lives: 3 };
var initialPositions = {};
function preload() {
  var g = this.make.graphics({x:0,y:0,add:false});
  g.fillStyle(0x00ff00,1);g.fillTriangle(20,0,40,40,0,40);g.generateTexture('player',40,40);g.clear();
  g.fillStyle(0x666666,1);g.fillRect(0,0,200,20);g.generateTexture('platform',200,20);g.clear();
  g.fillStyle(0xff0000,1);g.fillCircle(15,15,15);g.generateTexture('enemy',30,30);g.clear();
  g.fillStyle(0xffff00,1);g.fillRect(0,0,8,16);g.generateTexture('bullet',8,16);g.clear();
  g.fillStyle(0xffd700,1);g.fillCircle(10,10,10);g.generateTexture('coin',20,20);g.destroy();
}
function create() { resetGameState(); [WORLD_SETUP] [GAME_OBJECTS] storeInitialPositions(); [PHYSICS_SETUP] [UI_SETUP]; this.input.keyboard.on('keydown-ESC',()=>{gameState.isPaused=!gameState.isPaused}); this.input.keyboard.on('keydown-R',()=>{if(gameState.isGameOver)restartGame.call(this)}); }
function update() { if(gameState.isGameOver||gameState.isPaused)return; [INPUT_HANDLING] [GAME_LOGIC] [WIN_LOSE_CHECK] }
function resetGameState() { gameState.isGameOver=false; gameState.isPaused=false; gameState.score=0; gameState.lives=3; }
function storeInitialPositions() { [STORE_POSITIONS] }
function resetGameObjects() { [RESET_OBJECTS] }
function gameOver() { gameState.isGameOver=true; [GAME_OVER_SCREEN] }
function restartGame() { resetGameState(); resetGameObjects(); [RESTART_UI] }
[HELPER_FUNCTIONS]`;

export const GAME_TYPE_TEMPLATES = {
  platformer: {
    globalVariables: `var player,platforms,coins,enemies;`,
    storePositions: `initialPositions={playerX:100,playerY:450};`,
    resetObjects: `player.x=initialPositions.playerX;player.y=initialPositions.playerY;player.setVelocity(0,0);`,
    gameOverScreen: `this.add.rectangle(400,300,800,600,0,0.8);this.add.text(400,250,'GAME OVER',{fontSize:'64px',color:'#f00'}).setOrigin(0.5);this.add.text(400,320,'Score: '+gameState.score,{fontSize:'32px',color:'#fff'}).setOrigin(0.5);var b=this.add.rectangle(400,400,150,50,0).setInteractive();this.add.text(400,400,'RESTART',{fontSize:'24px'}).setOrigin(0.5);b.on('pointerdown',()=>restartGame.call(this));`,
    updateUI: `if(scoreText)scoreText.setText('Score:'+gameState.score);`
  },
  shooter: {
    globalVariables: `var player,bullets,enemies;`,
    storePositions: `initialPositions={playerX:400,playerY:550};`,
    resetObjects: `player.x=initialPositions.playerX;player.y=initialPositions.playerY;bullets.clear(true,true);enemies.clear(true,true);`,
    gameOverScreen: `this.add.rectangle(400,300,800,600,0,0.8);this.add.text(400,300,'GAME OVER',{fontSize:'64px',color:'#f00'}).setOrigin(0.5);`,
    updateUI: `if(scoreText)scoreText.setText('Score:'+gameState.score);`
  },
  puzzle: {
    globalVariables: `var grid=[];`,
    storePositions: ``,
    resetObjects: ``,
    gameOverScreen: `this.add.text(400,300,'GAME OVER',{fontSize:'64px',color:'#f00'}).setOrigin(0.5);`,
    updateUI: `if(scoreText)scoreText.setText('Score:'+gameState.score);`
  }
};

export const DEFAULT_UI_TEMPLATES = {
  pauseScreen: `gameState.isPaused=true;this.add.rectangle(400,300,800,600,0,0.5);this.add.text(400,300,'PAUSED',{fontSize:'48px',color:'#fff'}).setOrigin(0.5);`
};

export const GAME_STRUCTURE_GUIDELINES = '';
export const UI_LAYOUT_GUIDELINES = '';
