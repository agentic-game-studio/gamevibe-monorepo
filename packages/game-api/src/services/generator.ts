import { nanoid } from 'nanoid';
import {
  GeneratedGame,
  GameSpec,
  generateGameId
} from '@gamevibe/shared';
import { AIService } from '@gamevibe/ai-service';
import { GameEngine } from '@gamevibe/game-engine';
import { Logger } from '../utils/logger.js';
import { IPFSService } from './ipfs.js';
import { GameGenerationRequest } from '../types.js';

export interface GameGeneratorConfig {
  minimaxApiKey: string;
  ipfs?: {
    pinataApiKey: string;
    pinataSecretKey: string;
  };
}

// Hardcoded reliable fallback
const RELIABLE_FALLBACK = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Platformer Adventure</title><script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script></head><body>
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
</script></body></html>`;

export class GameGeneratorService {
  private logger = new Logger('GameGenerator');
  private aiService: AIService;
  private engine: GameEngine;
  private ipfsService?: IPFSService;

  constructor(config: GameGeneratorConfig) {
    this.aiService = new AIService({ minimaxApiKey: config.minimaxApiKey });
    this.engine = new GameEngine();

    if (config.ipfs) {
      this.ipfsService = new IPFSService({
        pinataApiKey: config.ipfs.pinataApiKey,
        pinataSecretKey: config.ipfs.pinataSecretKey
      });
    }
  }

  async generateGame(
    request: GameGenerationRequest,
    creatorWallet?: string
  ): Promise<GeneratedGame & { ipfsCid?: string; transactionHash?: string }> {
    this.logger.info('Starting game generation', {
      description: request.description.slice(0, 50) + '...',
      type: request.type,
      playerCount: request.playerCount
    });

    const gameSpec = await this.analyzeGameRequest(request.description, {
      type: request.type,
      playerCount: request.playerCount
    });

    const completeSpec: GameSpec = {
      ...gameSpec,
      originalDescription: request.description,
      playerCount: request.playerCount || gameSpec.playerCount || '1'
    };

    const template = await this.engine.selectTemplate(completeSpec);
    this.logger.info('Generating game code', { templateId: template?.id });

    const codeGeneration = await this.aiService.generateGameCode(completeSpec, template);
    let generatedCode = codeGeneration;

    // Validate the generated code
    let validation = await this.engine.validateCode(generatedCode);
    if (!validation.valid && validation.error) {
      this.logger.warn('Generated code has issues, attempting fix', { error: validation.error });
      const fixedCode = await this.engine.fixGeneratedCode(generatedCode, [validation.error]);

      // Re-validate after fix
      validation = await this.engine.validateCode(fixedCode);
      if (validation.valid) {
        generatedCode = fixedCode;
        this.logger.info('Code fixed successfully');
      } else {
        // Use hardcoded reliable fallback immediately (AI fallback takes too long)
        this.logger.warn('Using hardcoded reliable fallback');
        generatedCode = RELIABLE_FALLBACK;
      }
    }

    const compiled = await this.engine.compile(generatedCode, {
      includePhaserCDN: true,
      metadata: { name: completeSpec.name, description: completeSpec.description }
    });

    const gameId = await generateGameId();
    const shortId = nanoid(8);

    const game: GeneratedGame & { ipfsCid?: string; transactionHash?: string } = {
      id: gameId,
      shortId,
      name: completeSpec.name,
      description: completeSpec.description,
      type: completeSpec.type,
      code: compiled.code,
      playUrl: `https://gamevibe.ai/play/${shortId}`,
      thumbnailUrl: undefined
    };

    if (this.ipfsService && request.creatorWallet) {
      try {
        const ipfsResult = await this.ipfsService.uploadGame(game);
        game.ipfsCid = ipfsResult.cid;
        this.logger.info('Game uploaded to IPFS', { gameId, cid: ipfsResult.cid });
      } catch (ipfsError) {
        this.logger.warn('IPFS upload failed, continuing without IPFS', { error: ipfsError });
      }
    }

    this.logger.info('Game generated successfully', { gameId, shortId, type: game.type, hasIpfsCid: !!game.ipfsCid });
    return game;
  }

  private async analyzeGameRequest(description: string, context?: { type?: string; playerCount?: string }): Promise<GameSpec> {
    const result = await this.aiService.analyzeGameRequest(description, context);
    return {
      type: result.type || 'other',
      name: result.name || 'Untitled Game',
      description: result.description || description,
      originalDescription: description,
      coreMechanics: result.coreMechanics || [],
      features: result.features || [],
      playerCount: result.playerCount || '1',
      difficulty: result.difficulty || 'medium'
    };
  }

  async health(): Promise<boolean> {
    try {
      return await this.aiService.health();
    } catch {
      return false;
    }
  }
}
