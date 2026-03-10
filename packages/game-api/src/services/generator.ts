import { nanoid } from 'nanoid';
import {
  GeneratedGame,
  GameSpec,
  GameType,
  generateGameId
} from '@gamevibe/shared';
import { AIService } from '@gamevibe/ai-service';
import { GameEngine } from '@gamevibe/game-engine';
import { Logger } from '../utils/logger.js';
import { IPFSService } from './ipfs.js';
import { GameGenerationRequest } from '../types.js';

// Repair known AI truncation bugs in generated code
function repairGeneratedCode(code: string): string {
  let repaired = code;

  // Fix: .s.setOrigin -> .setOrigin (MUST BE FIRST)
  repaired = repaired.replace(/\.s\.setOrigin/g, '.setOrigin');

  // Fix function name truncation: functionObjects -> spawnObjects
  repaired = repaired.replace(/functionObjects\s*\(/g, 'spawnObjects(');
  repaired = repaired.replace(/function\s+functionObjects\s*\(/g, 'function spawnObjects(');
  repaired = repaired.replace(/function\s+spacts\s*\(/g, 'function spawnObjects(');
  repaired = repaired.replace(/function\s+spawnObjcts\s*\(/g, 'function spawnObjects(');

  // Fix variable name truncation: gaState -> gameState
  repaired = repaired.replace(/gaState\./g, 'gameState.');
  repaired = repaired.replace(/gameSta\./g, 'gameState.');
  repaired = repaired.replace(/gameStat\./g, 'gameState.');

  // Fix fontWeight truncation: fontWe -> fontWeight
  repaired = repaired.replace(/fontWe\}/g, "fontWeight:'bold'}");
  repaired = repaired.replace(/fontWe\)/g, "fontWeight:'bold')");
  repaired = repaired.replace(/fontWe:/g, "fontWeight:");
  repaired = repaired.replace(/fontW}/g, "fontWeight:'bold'}");
  repaired = repaired.replace(/fontWe'/g, "fontWeight:'bold'");
  repaired = repaired.replace(/fontWe ,/g, "fontWeight:'bold',");

  // Fix this.add.text truncation: this.add.tt -> this.add.text
  repaired = repaired.replace(/this\.add\.tt\(/g, 'this.add.text(');

  // Fix fill quote nesting: 'fill:'# -> fill: '#
  repaired = repaired.replace(/'fill:'#([^']+)'/g, "fill:'#$1'");

  // Fix arrow function without braces: ()=>x;y -> ()=>{ x; y; }
  // Pattern: onComplete:()=>something;somethingElse
  repaired = repaired.replace(/onComplete:\(\)=>([^;{]+);([^}]+)}/g, (match, first, second) => {
    return `onComplete:() => { ${first.trim()}; ${second.trim()}; }`;
  });

  // Fix: onComplete:()=>p.destroy();this.cameras -> onComplete:() => { p.destroy(); this.cameras... }
  repaired = repaired.replace(/onComplete:\(\)=>(\w+\.destroy\(\));this\.cameras\.main\.shake/g,
    'onComplete:() => { $1; this.cameras.main.shake');

  // Fix: (b)=>b.destroy();this.cameras -> (b) => { b.destroy(); this.cameras... }
  repaired = repaired.replace(/\(b\)=>b\.destroy\(\);this\.cameras\.main\.shake/g,
    '(b) => { b.destroy(); this.cameras.main.shake');

  // Fix: ()=>enemy.destroy();this.cameras -> () => { enemy.destroy(); this.cameras... }
  repaired = repaired.replace(/\(\)=>enemy\.destroy\(\);this\.cameras\.main\.shake/g,
    '() => { enemy.destroy(); this.cameras.main.shake');

  // Fix: ()=>p.destroy();this.cameras -> () => { p.destroy(); this.cameras... }
  repaired = repaired.replace(/\(\)=>p\.destroy\(\);this\.cameras\.main\.shake/g,
    '() => { p.destroy(); this.cameras.main.shake');

  // Fix double semicolons: ;; -> ;
  repaired = repaired.replace(/;;/g, ';');

  // Fix double commas: ,, -> ,
  repaired = repaired.replace(/,,/g, ',');

  // Fix this.add.text(00, -> this.add.text(0,
  repaired = repaired.replace(/this\.add\.text\(0+0,/g, 'this.add.text(0,');

  // Fix: .refreshBod} -> .refreshBody()}
  repaired = repaired.replace(/\.refreshBod\}/g, '.refreshBody()}');

  // Fix: pointerdwn -> pointerdown
  repaired = repaired.replace(/pointerdwn/g, 'pointerdown');

  // Fix: .destroy(); - remove stray semicolon before closing brace
  repaired = repaired.replace(/\.destroy\(\);(\s*)\}/g, '.destroy();$1}');

  // Fix: fontSill -> fontSize (do this first before other font fixes)
  repaired = repaired.replace(/fontSill:/g, 'fontSize:');
  repaired = repaired.replace(/fontSill/g, 'fontSize');

  // Fix broken fontSize with fill nesting: fontSize:'fill:'#888' -> fontSize:'14px',fill:'#888'
  // Only if there's no existing fontSize before
  repaired = repaired.replace(/fontSize:'fill:'#([^']+)'/g, "fontSize:'14px',fill:'#$1'");

  // Fix: {fontSize:'fill:'#888'} -> {fontSize:'14px',fill:'#888'}
  repaired = repaired.replace(/{fontSize:'fill:'#([^']+)'}/g, "{fontSize:'14px',fill:'#$1'}");

  // Remove duplicate fontSize keys: fontSize:'14px',fontSize:'14px' -> fontSize:'14px'
  repaired = repaired.replace(/fontSize:'([^']+)',fontSize:'([^']+)'/g, "fontSize:'$1'");

  // Fix: {b) -> {(b)
  repaired = repaired.replace(/\(b\)->/g, '(b) =>');

  // Fix: .setSc1) -> .setScale(4,1)
  repaired = repaired.replace(/\.setSc1\)/g, '.setScale(4,1)');

  // Fix: etOrigin -> .setOrigin
  repaired = repaired.replace(/etOrigin/g, '.setOrigin');

  // Fix: missing closing brace in arrow function - )} -> ) })
  repaired = repaired.replace(/\)\s*}$/g, ') });');

  return repaired;
}

// Detect game type from description using keyword matching
function detectGameTypeFromDescription(description: string): string {
  const desc = description.toLowerCase();

  // Shooter keywords
  if (desc.includes('shoot') || desc.includes('space') || desc.includes('invader') ||
      desc.includes('galaga') || desc.includes('asteroid') || desc.includes('alien') ||
      desc.includes('bullet') || desc.includes('laser') || desc.includes('spaceship')) {
    return 'shooter';
  }

  // Endless runner keywords
  if (desc.includes('run') || desc.includes('runner') || desc.includes('endless') ||
      desc.includes('dash') || desc.includes('avoid')) {
    return 'endless-runner';
  }

  // Tower defense keywords
  if (desc.includes('tower') || desc.includes('defense') || desc.includes('defend') ||
      desc.includes('fortress') || desc.includes('base')) {
    return 'tower-defense';
  }

  // RPG/Adventure keywords
  if (desc.includes('rpg') || desc.includes('adventure') || desc.includes('explore') ||
      desc.includes('dungeon') || desc.includes('roguelike') || desc.includes('quest') ||
      desc.includes('dragon') || desc.includes('magic')) {
    return 'rpg';
  }

  // Puzzle keywords
  if (desc.includes('puzzle') || desc.includes('match') || desc.includes('gem') ||
      desc.includes('candy') || desc.includes('color') || desc.includes('tile') ||
      desc.includes('block') || desc.includes('connect')) {
    return 'puzzle';
  }

  // Platformer keywords (default for jump/collect)
  if (desc.includes('platform') || desc.includes('jump') || desc.includes('collect') ||
      desc.includes('coin') || desc.includes('hero') || desc.includes('level')) {
    return 'platformer';
  }

  return 'other';
}

export interface GameGeneratorConfig {
  minimaxApiKey: string;
  ipfs?: {
    pinataApiKey: string;
    pinataSecretKey: string;
  };
}

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

    // Detect type from description if not provided
    const detectedType = detectGameTypeFromDescription(request.description);
    this.logger.info('Detected game type from description', { detectedType });

    const gameSpec = await this.analyzeGameRequest(request.description, {
      type: request.type,
      playerCount: request.playerCount
    });

    // Use detected type to override AI's type guess (which may be wrong)
    const finalType = (detectedType !== 'other' ? detectedType : gameSpec.type || 'other') as GameType;

    const completeSpec: GameSpec = {
      ...gameSpec,
      type: finalType,
      originalDescription: request.description,
      playerCount: request.playerCount || gameSpec.playerCount || '1'
    };

    const template = await this.engine.selectTemplate(completeSpec);
    this.logger.info('Generating game code', { templateId: template?.id, finalType });

    // Get game code from AI service (includes fallback if AI fails)
    const generatedCode = await this.aiService.generateGameCode(completeSpec, template);

    // Repair known AI truncation bugs
    const repairedCode = repairGeneratedCode(generatedCode);
    this.logger.info('Repaired AI truncation bugs in generated code');

    const compiled = await this.engine.compile(repairedCode, {
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
      type: finalType,
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
