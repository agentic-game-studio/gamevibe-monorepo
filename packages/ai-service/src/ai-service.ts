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
const TIMEOUT_MS = 50000; // 50 seconds

// Fallback game templates for when AI is too slow
const FALLBACK_GAMES: Record<string, string> = {
  platformer: `<!DOCTYPE html>
<html><head><script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script></head><body>
<script>
var config = { type: Phaser.AUTO, width: 800, height: 600, physics: { default: 'arcade', arcade: { gravity: { y: 500 } } }, scene: { preload, create, update } };
var game = new Phaser.Game(config);
var player, platforms, cursors, score = 0, scoreText, gameOver = false;
function preload() {
  var g = this.make.graphics({x:0,y:0,add:false});
  g.fillStyle(0x00ff00,1);g.fillTriangle(20,0,40,40,0,40);g.generateTexture('player',40,40);g.clear();
  g.fillStyle(0x666666,1);g.fillRect(0,0,200,20);g.generateTexture('platform',200,20);g.clear();
  g.fillStyle(0xffd700,1);g.fillCircle(10,10,10);g.generateTexture('coin',20,20);g.destroy();
}
function create() {
  platforms = this.physics.add.staticGroup();
  platforms.create(400,580,'platform').setScale(4,1).refreshBody();
  player = this.physics.add.sprite(100,450,'player');
  player.setBounce(0.2); player.setCollideWorldBounds(true);
  this.physics.add.collider(player,platforms);
  var coins = this.physics.add.group({ key: 'coin', repeat: 5, setXY: { x: 150, y: 0, stepX: 110 } });
  coins.children.iterate(function(c) { c.setBounceY(0.6); });
  this.physics.add.collider(coins,platforms);
  this.physics.add.overlap(player,coins,collectCoin,null,this);
  scoreText = this.add.text(16,16,'Score: 0',{fontSize:'32px',fill:'#fff'});
  cursors = this.input.keyboard.createCursorKeys();
}
function update() {
  if(gameOver) return;
  if(cursors.left.isDown) player.setVelocityX(-160);
  else if(cursors.right.isDown) player.setVelocityX(160);
  else player.setVelocityX(0);
  if(cursors.up.isDown && player.body.touching.down) player.setVelocityY(-330);
}
function collectCoin(player,coin) { coin.disableBody(true,true); score += 10; scoreText.setText('Score: '+score); }
</script></body></html>`,

  shooter: `<!DOCTYPE html>
<html><head><script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script></head><body>
<script>
var config = { type: Phaser.AUTO, width: 800, height: 600, physics: { default: 'arcade' }, scene: { preload, create, update } };
var game = new Phaser.Game(config);
var player, bullets, enemies, cursors, score = 0, scoreText, gameOver = false;
function preload() {
  var g = this.make.graphics({x:0,y:0,add:false});
  g.fillStyle(0x00ff00,1);g.fillTriangle(20,0,40,40,0,40);g.generateTexture('player',40,40);g.clear();
  g.fillStyle(0xffff00,1);g.fillRect(0,0,8,16);g.generateTexture('bullet',8,16);g.clear();
  g.fillStyle(0xff0000,1);g.fillCircle(15,15,15);g.generateTexture('enemy',30,30);g.destroy();
}
function create() {
  player = this.physics.add.sprite(400,550,'player');
  player.setCollideWorldBounds(true);
  bullets = this.physics.add.group();
  enemies = this.physics.add.group();
  scoreText = this.add.text(16,16,'Score: 0',{fontSize:'32px',fill:'#fff'});
  cursors = this.input.keyboard.createCursorKeys();
  this.time.addEvent({delay:1000,callback:spawnEnemy,callbackScope:this,loop:true});
  this.physics.add.overlap(bullets,enemies,hitEnemy,null,this);
  this.physics.add.overlap(player,enemies,hitPlayer,null,this);
}
function update() {
  if(gameOver) return;
  if(cursors.left.isDown) player.setVelocityX(-200);
  else if(cursors.right.isDown) player.setVelocityX(200);
  else player.setVelocityX(0);
  if(cursors.space.isDown) fireBullet.call(this);
}
function fireBullet() {
  var b = bullets.create(player.x,player.y,'bullet');
  b.setVelocityY(-400);
}
function spawnEnemy() {
  if(gameOver) return;
  var e = enemies.create(Phaser.Math.Between(50,750),0,'enemy');
  e.setVelocityY(100);
}
function hitEnemy(bullet,enemy) { bullet.destroy(); enemy.destroy(); score += 10; scoreText.setText('Score: '+score); }
function hitPlayer(player,enemy) { enemy.destroy(); gameOver=true; this.add.text(300,300,'GAME OVER',{fontSize:'48px',fill:'#f00'}); }
</script></body></html>`,

  puzzle: `<!DOCTYPE html>
<html><head><script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script></head><body>
<script>
var config = { type: Phaser.AUTO, width: 800, height: 600, scene: { preload, create, update } };
var game = new Phaser.Game(config);
var grid = [], selected = null, score = 0, moves = 20;
function preload() {
  var g = this.make.graphics({x:0,y:0,add:false});
  [0xff0000,0x00ff00,0x0000ff,0xffff00].forEach((c,i)=>{g.clear();g.fillStyle(c,1);g.fillRect(0,0,50,50);g.generateTexture('gem'+i,50,50);});
  g.destroy();
}
function create() {
  for(var y=0;y<8;y++){grid[y]=[];for(var x=0;x<8;x++){var g=Phaser.Math.Between(0,3);var s=this.add.sprite(x*60+80,y*60+80,'gem'+g).setInteractive();s.gridX=x;s.gridY=y;s.gemType=g;s.on('pointerdown',selectGem,this);grid[y][x]=s;}}
  this.scoreText = this.add.text(16,16,'Score: 0',{fontSize:'32px',fill:'#fff'});
  this.movesText = this.add.text(16,50,'Moves: 20',{fontSize:'32px',fill:'#fff'});
}
function selectGem(p) {
  if(moves<=0)return;
  if(!selected){selected=p;p.setScale(1.2);return;}
  if(selected.gemType===p.gemType){score+=10;selected.destroy();p.destroy();selected=null;moves--;this.scoreText.setText('Score: '+score);this.movesText.setText('Moves: '+moves);}
  else{selected.setScale(1);selected=p;p.setScale(1.2);selected=null;}
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.minimaxApiKey
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error ${response.status}: ${error}`);
      }
      return await response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw err;
    }
  }

  async generate(options: GenerateOptions): Promise<AIResponse> {
    const cacheKey = this.getCacheKey(options);
    if (this.cache) {
      const cached = await this.cache.get<AIResponse>(cacheKey);
      if (cached) return cached;
    }

    const response = await this.queue.add(() => this.callAPI(options));

    if (this.cache && response) {
      await this.cache.set(cacheKey, response, 3600);
    }
    return response;
  }

  async analyzeGameRequest(description: string, context?: any): Promise<any> {
    const prompt = this.promptBuilder.buildAnalysisPrompt(description, context);
    const response = await this.generate({
      prompt,
      model: DEFAULT_MODEL,
      temperature: 0.3,
      maxTokens: 256
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return JSON.parse(response.content);
    } catch {
      return { type: 'platformer', name: 'Game', description, coreMechanics: ['move'], features: ['score'], playerCount: '1', difficulty: 'medium' };
    }
  }

  async generateGameCode(spec: any, template: any): Promise<string> {
    // Determine game type
    const type = (spec.type || 'platformer').toLowerCase();
    let gameType = 'platformer';
    if (type.includes('shoot')) gameType = 'shooter';
    else if (type.includes('puzzle')) gameType = 'puzzle';

    // Try AI first
    try {
      const prompt = this.promptBuilder.buildGameGenerationPrompt(spec, template);
      const response = await this.generate({
        prompt,
        model: DEFAULT_MODEL,
        temperature: 1.0, // User requested temperature 1 for better creativity
        maxTokens: 5000
      });
      // Check if we got valid code
      if (response.content && response.content.includes('Phaser.Game')) {
        return response.content;
      }
    } catch (err) {
      console.log('[AI] Generation failed, using fallback:', err);
    }

    // Fallback to pre-generated game
    console.log('[AI] Using fallback game for type:', gameType);
    return FALLBACK_GAMES[gameType] || FALLBACK_GAMES.platformer;
  }

  async health(): Promise<boolean> {
    try {
      await this.generate({ prompt: 'hi', model: DEFAULT_MODEL, maxTokens: 5 });
      return true;
    } catch { return false; }
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

    return {
      content,
      model: options.model || DEFAULT_MODEL,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      } : undefined
    };
  }

  private getCacheKey(options: GenerateOptions | AnalyzeOptions): string {
    return generateCacheKey('ai', options.model, hashStringSync(options.prompt).substring(0, 16));
  }

  getMaxTokensForModel(model: string, requestedTokens: number): number {
    return Math.min(requestedTokens, 8192);
  }
}
