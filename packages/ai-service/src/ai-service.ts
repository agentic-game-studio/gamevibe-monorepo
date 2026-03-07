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
const TIMEOUT_MS = 45000;

// Better fallback games with more features
const FALLBACK_GAMES: Record<string, string> = {
  platformer: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Platformer Game</title><script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script></head><body>
<script>
var config = { type: Phaser.AUTO, width: 800, height: 600, physics: { default: 'arcade', arcade: { gravity: { y: 800 }, debug: false } }, scene: { preload, create, update } };
var game = new Phaser.Game(config);
var player, platforms, coins, enemies, cursors, scoreText, livesText, gameState = { score: 0, lives: 3, isGameOver: false };

function preload() {
  var g = this.make.graphics({x:0,y:0,add:false});
  g.fillStyle(0x00ff00,1); g.fillTriangle(20,0,40,40,0,40); g.generateTexture('player',40,40); g.clear();
  g.fillStyle(0x666666,1); g.fillRect(0,0,200,20); g.generateTexture('platform',200,20); g.clear();
  g.fillStyle(0x888888,1); g.fillRect(0,0,100,20); g.generateTexture('platformSmall',100,20); g.clear();
  g.fillStyle(0xffd700,1); g.fillCircle(12,12,12); g.generateTexture('coin',24,24); g.clear();
  g.fillStyle(0xff0000,1); g.fillRect(0,0,30,30); g.generateTexture('enemy',30,30); g.destroy();
}

function create() {
  platforms = this.physics.add.staticGroup();
  platforms.create(400,580,'platform').setScale(4,1).refreshBody();
  platforms.create(150,450,'platformSmall');
  platforms.create(400,380,'platformSmall');
  platforms.create(650,320,'platformSmall');
  platforms.create(200,250,'platformSmall');
  platforms.create(550,180,'platformSmall');

  player = this.physics.add.sprite(100,500,'player');
  player.setBounce(0.1); player.setCollideWorldBounds(true);

  coins = this.physics.add.group({ key: 'coin', repeat: 10 });
  var positions = [[200,420],[400,350],[650,290],[250,220],[550,150],[100,540],[300,540],[500,540],[700,540],[350,540]];
  coins.children.iterate(function(c,i) { if(positions[i]) { c.x=positions[i][0]; c.y=positions[i][1]; c.setBounceY(0.5); } });

  enemies = this.physics.add.group();
  var e1 = enemies.create(400,550,'enemy'); e1.setBounce(1); e1.setCollideWorldBounds(true); e1.setVelocityX(80);
  var e2 = enemies.create(200,220,'enemy'); e2.setBounce(1); e2.setCollideWorldBounds(true); e2.setVelocityX(60);
  var e3 = enemies.create(550,150,'enemy'); e3.setBounce(1); e3.setCollideWorldBounds(true); e3.setVelocityX(100);

  this.physics.add.collider(player,platforms);
  this.physics.add.collider(coins,platforms);
  this.physics.add.collider(enemies,platforms);
  this.physics.add.overlap(player,coins,collectCoin,null,this);
  this.physics.add.overlap(player,enemies,hitEnemy,null,this);

  scoreText = this.add.text(16,16,'Score: 0',{fontSize:'28px',fill:'#fff',stroke:'#000',strokeThickness:3});
  livesText = this.add.text(16,50,'Lives: 3',{fontSize:'28px',fill:'#f00',stroke:'#000',strokeThickness:3});
  this.add.text(400,30,'ARROW KEYS to move/jump | Jump on enemies!',{fontSize:'14px',fill:'#aaa'}).setOrigin(0.5);

  cursors = this.input.keyboard.createCursorKeys();
}

function update() {
  if(gameState.isGameOver) return;
  if(cursors.left.isDown) player.setVelocityX(-200);
  else if(cursors.right.isDown) player.setVelocityX(200);
  else player.setVelocityX(0);
  if(cursors.up.isDown && player.body.touching.down) player.setVelocityY(-450);
  if(player.y > 650) playerHit.call(this);
}

function collectCoin(player,coin) {
  coin.disableBody(true,true);
  gameState.score += 10;
  scoreText.setText('Score: '+gameState.score);
  var p = this.add.particles(coin.x,coin.y,'coin',{speed:100,scale:{start:0.5,end:0},lifespan:300,quantity:8});
  this.time.delayedCall(300,()=>p.destroy());
}

function hitEnemy(player,enemy) {
  if(player.body.velocity.y > 0 && player.y < enemy.y - 10) {
    enemy.disableBody(true,true);
    gameState.score += 50;
    scoreText.setText('Score: '+gameState.score);
    player.setVelocityY(-200);
    this.tweens.add({targets:player,scaleY:0.5,scaleX:1.3,duration:100,yoyo:true});
  } else {
    playerHit.call(this);
  }
}

function playerHit() {
  gameState.lives--;
  livesText.setText('Lives: '+gameState.lives);
  this.cameras.main.shake(150,0.01);
  this.cameras.main.flash(150,255,0,0);

  if(gameState.lives <= 0) {
    gameState.isGameOver = true;
    var c = this.add.container(400,300);
    c.add(this.add.rectangle(0,0,800,600,0,0.85));
    c.add(this.add.text(0,-60,'GAME OVER',{fontSize:'72px',fill:'#ff0000',stroke:'#fff',strokeThickness:6}).setOrigin(0.5));
    c.add(this.add.text(0,10,'Final Score: '+gameState.score,{fontSize:'36px',fill:'#fff'}).setOrigin(0.5));
    var stars = gameState.score >= 200 ? '⭐⭐⭐' : gameState.score >= 100 ? '⭐⭐' : '⭐';
    c.add(this.add.text(0,60,stars,{fontSize:'48px'}).setOrigin(0.5));
    var btn = this.add.rectangle(0,140,180,55,0x00ff00).setInteractive({useHandCursor:true});
    c.add(this.add.text(0,140,'PLAY AGAIN',{fontSize:'22px',fill:'#000',fontWeight:'bold'}).setOrigin(0.5));
    btn.on('pointerdown',()=>this.scene.restart());
  } else {
    player.x = 100; player.y = 500; player.setVelocity(0,0);
  }
}
</script></body></html>`,

  shooter: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Shooter Game</title><script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script></head><body>
<script>
var config = { type: Phaser.AUTO, width: 800, height: 600, physics: { default: 'arcade', debug: false }, scene: { preload, create, update } };
var game = new Phaser.Game(config);
var player, bullets, enemies, cursors, scoreText, livesText, waveText, gameState = { score: 0, lives: 3, isGameOver: false, wave: 1 };
var lastFired = 0;

function preload() {
  var g = this.make.graphics({x:0,y:0,add:false});
  g.fillStyle(0x00ff00,1); g.fillTriangle(25,0,50,50,0,50); g.generateTexture('ship',50,50); g.clear();
  g.fillStyle(0xffff00,1); g.fillRect(0,0,6,18); g.generateTexture('bullet',6,18); g.clear();
  g.fillStyle(0xff0000,1); g.fillCircle(18,18,18); g.generateTexture('enemy',36,36); g.destroy();
}

function create() {
  player = this.physics.add.sprite(400,550,'ship');
  player.setCollideWorldBounds(true);
  bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 });
  enemies = this.physics.add.group();

  for(var i=0;i<5;i++) spawnEnemy.call(this);

  this.physics.add.overlap(bullets,enemies,hitEnemy,null,this);
  this.physics.add.overlap(player,enemies,hitPlayer,null,this);

  scoreText = this.add.text(16,16,'Score: 0',{fontSize:'28px',fill:'#fff',stroke:'#000',strokeThickness:3});
  livesText = this.add.text(16,50,'Lives: 3',{fontSize:'28px',fill:'#f00',stroke:'#000',strokeThickness:3});
  waveText = this.add.text(780,16,'Wave: 1',{fontSize:'20px',fill:'#0ff'}).setOrigin(1,0);
  this.add.text(400,30,'ARROW KEYS to move | SPACE to fire',{fontSize:'14px',fill:'#aaa'}).setOrigin(0.5);

  cursors = this.input.keyboard.createCursorKeys();
  this.input.keyboard.on('keydown-SPACE',fireBullet,this);
  this.time.addEvent({delay:2000,callback:spawnWave,callbackScope:this,loop:true});
}

function spawnEnemy() {
  var x = Phaser.Math.Between(50,750);
  var e = enemies.create(x,0,'enemy');
  e.setVelocityY(Phaser.Math.Between(50,150));
  e.setBounce(1); e.setCollideWorldBounds(true);
}

function spawnWave() {
  if(gameState.isGameOver) return;
  gameState.wave++;
  waveText.setText('Wave: '+gameState.wave);
  for(var i=0;i<3 + Math.min(gameState.wave, 10);i++) spawnEnemy.call(this);
}

function fireBullet() {
  if(gameState.isGameOver) return;
  var b = bullets.create(player.x,player.y-25,'bullet');
  b.setVelocityY(-500);
  this.time.delayedCall(2000,()=>{if(b.active)b.destroy()});
}

function hitEnemy(bullet,enemy) {
  bullet.destroy();
  enemy.destroy();
  gameState.score += 10 + gameState.wave;
  scoreText.setText('Score: '+gameState.score);
  var p = this.add.particles(enemy.x,enemy.y,'enemy',{speed:150,scale:{start:0.6,end:0},lifespan:400,quantity:12});
  this.time.delayedCall(400,()=>p.destroy());
}

function hitPlayer(player,enemy) {
  enemy.destroy();
  gameState.lives--;
  livesText.setText('Lives: '+gameState.lives);
  this.cameras.main.shake(100,0.02);
  this.cameras.main.flash(100,255,0,0);

  if(gameState.lives <= 0) {
    gameState.isGameOver = true;
    var c = this.add.container(400,300);
    c.add(this.add.rectangle(0,0,800,600,0,0.85));
    c.add(this.add.text(0,0,'GAME OVER',{fontSize:'72px',fill:'#ff0000',stroke:'#fff',strokeThickness:6}).setOrigin(0.5));
    c.add(this.add.text(0,60,'Score: '+gameState.score,{fontSize:'36px',fill:'#fff'}).setOrigin(0.5));
    c.add(this.add.text(0,100,'Wave: '+gameState.wave,{fontSize:'24px',fill:'#0ff'}).setOrigin(0.5));
    var btn = this.add.rectangle(0,180,180,55,0x00ff00).setInteractive({useHandCursor:true});
    c.add(this.add.text(0,180,'PLAY AGAIN',{fontSize:'22px',fill:'#000',fontWeight:'bold'}).setOrigin(0.5));
    btn.on('pointerdown',()=>this.scene.restart());
  }
}

function update() {
  if(gameState.isGameOver) return;
  if(cursors.left.isDown) player.setVelocityX(-250);
  else if(cursors.right.isDown) player.setVelocityX(250);
  else player.setVelocityX(0);
  if(cursors.space.isDown && this.time.now > lastFired) { fireBullet.call(this); lastFired = this.time.now + 200; }
}
</script></body></html>`,

  puzzle: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Match-3 Puzzle</title><script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script></head><body>
<script>
var config = { type: Phaser.AUTO, width: 800, height: 600, scene: { preload, create, update } };
var game = new Phaser.Game(config);
var grid = [], selected = null, score = 0, moves = 30, combos = 0, gameState = { isGameOver: false };

function preload() {
  var g = this.make.graphics({x:0,y:0,add:false});
  var colors = [0xff4444,0x44ff44,0x4444ff,0xffff44,0xff44ff,0x44ffff];
  colors.forEach((c,i)=>{g.clear();g.fillStyle(c,1);g.fillStar(25,25,5,25,12);g.generateTexture('gem'+i,50,50);});
  g.destroy();
}

function create() {
  for(var y=0;y<8;y++) { grid[y] = []; for(var x=0;x<8;x++) { var type = getValidGem.call(this,x,y); var s = this.add.sprite(x*60+100,y*60+80,'gem'+type).setInteractive(); s.gridX = x; s.gridY = y; s.gemType = type; s.on('pointerdown',selectGem,this); grid[y][x] = s; } }

  this.scoreText = this.add.text(16,500,'Score: 0',{fontSize:'32px',fill:'#fff',stroke:'#000',strokeThickness:3});
  this.movesText = this.add.text(16,540,'Moves: 30',{fontSize:'28px',fill:'#ff0',stroke:'#000',strokeThickness:2});
  this.add.text(400,30,'Match 3 or more! Click to swap.',{fontSize:'16px',fill:'#aaa'}).setOrigin(0.5);
}

function getValidGem(x,y) { var type; do { type = Phaser.Math.Between(0,5); } while((x>1 && grid[y][x-1]?.gemType===type && grid[y][x-2]?.gemType===type) || (y>1 && grid[y-1][x]?.gemType===type && grid[y-2][x]?.gemType===type)); return type; }

function selectGem(gem) {
  if(gameState.isGameOver || moves<=0) return;
  if(!selected) { selected = gem; gem.setScale(1.15); gem.setStrokeStyle(3,0xffffff); }
  else if(selected === gem) { selected.setScale(1); selected.setStrokeStyle(0); selected = null; }
  else if(Math.abs(selected.gridX - gem.gridX) + Math.abs(selected.gridY - gem.gridY) === 1) { swapGems.call(this,selected,gem); }
  else { selected.setScale(1); selected.setStrokeStyle(0); selected = gem; gem.setScale(1.15); gem.setStrokeStyle(3,0xffffff); }
}

function swapGems(g1,g2) {
  var t = {x:g1.x,y:g1.y,tx:g1.gridX,ty:g1.gridY};
  g1.x = g2.x; g1.y = g2.y; g1.gridX = g2.gridX; g1.gridY = g2.gridY;
  g2.x = t.x; g2.y = t.y; g2.gridX = t.tx; g2.gridY = t.ty;
  g1.setScale(1); g1.setStrokeStyle(0); g2.setScale(1); g2.setStrokeStyle(0); selected = null;
  moves--; this.movesText.setText('Moves: '+moves);
  this.time.delayedCall(200,()=>checkMatches.call(this));
}

function checkMatches() {
  var matches = [];
  for(var y=0;y<8;y++) for(var x=0;x<6;x++) if(grid[y][x] && grid[y][x+1] && grid[y][x+2] && grid[y][x].gemType === grid[y][x+1].gemType && grid[y][x].gemType === grid[y][x+2].gemType) matches.push(grid[y][x],grid[y][x+1],grid[y][x+2]);
  for(var x=0;x<8;x++) for(var y=0;y<6;y++) if(grid[y][x] && grid[y+1][x] && grid[y+2][x] && grid[y][x].gemType === grid[y+1][x].gemType && grid[y][x].gemType === grid[y+2][x].gemType) matches.push(grid[y][x],grid[y+1][x],grid[y+2][x]);

  if(matches.length > 0) {
    var unique = [...new Set(matches)];
    score += unique.length * 10 * (1 + combos * 0.5); combos++;
    this.scoreText.setText('Score: '+score);
    unique.forEach(g => { this.tweens.add({targets:g,scale:0,alpha:0,duration:200,onComplete:()=>{ g.gemType = getValidGem(g.gridX,g.gridY); g.setTexture('gem'+g.gemType); }}); });
    this.time.delayedCall(300,()=>{unique.forEach(g=>{g.setScale(1);g.setAlpha(1);});checkMatches.call(this);});
  } else { combos = 0; if(moves<=0) gameOver.call(this); }
}

function gameOver() {
  gameState.isGameOver = true;
  var c = this.add.container(400,300);
  c.add(this.add.rectangle(0,0,800,600,0,0.85));
  c.add(this.add.text(0,-40,score>=200?'LEVEL CLEAR!':'GAME OVER',{fontSize:'56px',fill:score>=200?'#0f0':'#f00',stroke:'#fff',strokeThickness:4}).setOrigin(0.5));
  c.add(this.add.text(0,20,'Score: '+score,{fontSize:'36px',fill:'#fff'}).setOrigin(0.5));
  var btn = this.add.rectangle(0,100,150,50,0x00ff00).setInteractive({useHandCursor:true});
  c.add(this.add.text(0,100,'PLAY',{fontSize:'24px',fill:'#000'}).setOrigin(0.5));
  btn.on('pointerdown',()=>this.scene.restart());
}

function update() {}
</script></body></html>`
};

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
    return response as AIResponse;
  }

  async analyzeGameRequest(description: string, context?: any): Promise<any> {
    const prompt = this.promptBuilder.buildAnalysisPrompt(description, context);
    const response = await this.generate({ prompt, model: DEFAULT_MODEL, temperature: 0.3, maxTokens: 256 });
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return JSON.parse(response.content);
    } catch {
      return { type: 'platformer', name: 'Game', description, coreMechanics: ['move'], features: ['score'], playerCount: '1', difficulty: 'medium' };
    }
  }

  async generateGameCode(spec: any, template: any): Promise<string> {
    const type = (spec.type || 'platformer').toLowerCase();
    let gameType = 'platformer';
    if (type.includes('shoot')) gameType = 'shooter';
    else if (type.includes('puzzle') || type.includes('match')) gameType = 'puzzle';

    try {
      const prompt = this.promptBuilder.buildGameGenerationPrompt(spec, template);
      const response = await this.generate({ prompt, model: DEFAULT_MODEL, temperature: 1.0, maxTokens: 6000 });
      if (response.content && response.content.includes('Phaser.Game')) return response.content;
    } catch (err) {
      console.log('[AI] Generation failed, using fallback:', err);
    }

    console.log('[AI] Using fallback game for type:', gameType);
    return FALLBACK_GAMES[gameType] || FALLBACK_GAMES.platformer;
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
