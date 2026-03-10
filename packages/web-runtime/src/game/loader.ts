import * as Phaser from 'phaser';
import { EventEmitter } from '../utils/event-emitter.js';
import { APIClient } from '../api/client.js';
import { MultiplayerManager } from '../multiplayer/manager.js';
import { Game } from '@gamevibe/shared';

export interface GameInstance {
  game: Phaser.Game;
  data: Game;
  scene?: Phaser.Scene;
}

export class GameLoader extends EventEmitter {
  private currentGame: GameInstance | null = null;
  private container: HTMLElement;
  private apiClient: APIClient;
  private multiplayerManager: MultiplayerManager | null = null;

  constructor(apiClient: APIClient) {
    super();
    this.apiClient = apiClient;
    this.container = document.getElementById('game-container')!;
    
    if (!this.container) {
      throw new Error('Game container element not found');
    }
  }

  async loadGame(gameData: Game, multiplayerManager?: MultiplayerManager): Promise<void> {
    this.multiplayerManager = multiplayerManager || null;
    try {
      // Clean up previous game
      if (this.currentGame) {
        this.unloadGame();
      }

      console.log(`🎮 Loading game: ${gameData.name}`);
      console.log('📊 GameData object:', {
        hasCode: 'code' in gameData,
        codeType: typeof gameData.code,
        codeLength: gameData.code?.length,
        gameDataKeys: Object.keys(gameData)
      });

      // Prepare container
      this.prepareContainer();

      // Extract and prepare game code
      let gameCode = gameData.code || '';
      console.log('🔍 Initial gameCode length:', gameCode.length);
      console.log('🔍 First 200 chars of gameCode:', gameCode.substring(0, 200));

      // Apply bug fixes to ALL code (before and after HTML extraction)
      // 1. Remove infinite recursion in sound functions - more aggressive pattern
      // Match function name followed by () with anything in between until closing brace
      gameCode = gameCode.replace(
        /function\s+(powerUpSound|shootSound|explosionSound)\s*\(\)\s*\{[^}]*?\1\s*\(\)[^}]*?\}/gi,
        ''
      );
      // Also fix simple case on single line
      gameCode = gameCode.replace(
        /function\s+(powerUpSound|shootSound|explosionSound)\s*\(\)\s*\{\s*\1\s*\(\s*\)\s*;/gi,
        'function $1() {'
      );
      // Also handle case where recursive call is on its own line with more code after
      gameCode = gameCode.replace(
        /function\s+(powerUpSound|shootSound|explosionSound)\s*\(\)\s*\{[\s\n\r]*\1\s*\(\)[\s\n\r]*;[\s\S]*?\}/gi,
        ''
      );
      // 2. Fix truncated text: this.add.tt( -> this.add.text(
      gameCode = gameCode.replace(/this\.add\.tt\(/g, 'this.add.text(');
      // 3. Fix invalid numbers: this.add.text(00, -> this.add.text(0,
      gameCode = gameCode.replace(/this\.add\.text\(\d+0,/g, 'this.add.text(0,');
      // 4. Fix truncated refreshBody: .refreshBod} -> .refreshBody()
      gameCode = gameCode.replace(/\.refreshBod\}/g, '.refreshBody()}');
      // 5. Fix truncated refreshBody: .refre() -> .refreshBody()
      gameCode = gameCode.replace(/\.refre\(\)/g, '.refreshBody()');
      // 6. Fix fontW -> fontWeight
      gameCode = gameCode.replace(/fontW\}/g, "fontWeight: 'bold'}");
      // 7. Fix missing colon: ,bold' -> ,fontWeight:'bold'
      gameCode = gameCode.replace(/,bold'\}/g, ",fontWeight:'bold'}");
      // 8. Fix truncated function names: functionObjects -> function spawnObjects
      gameCode = gameCode.replace(/function\s+Objects\(\)/g, 'function spawnObjects()');
      // 9. Fix truncated gameState: gaState -> gameState
      gameCode = gameCode.replace(/gaState\./g, 'gameState.');
      // 9b. Fix NEW truncated gameState patterns: gameSta. and gameStat.
      gameCode = gameCode.replace(/gameSta\./g, 'gameState.');
      gameCode = gameCode.replace(/gameStat\./g, 'gameState.');
      // 9c. Fix truncated spawnObjects: spacts() -> spawnObjects()
      gameCode = gameCode.replace(/function\s+spacts\(\)/g, 'function spawnObjects()');
      gameCode = gameCode.replace(/spacts\(\)\s*\{/g, 'spawnObjects() {');
      gameCode = gameCode.replace(/spawnObjcts\(\)\s*\{/g, 'spawnObjects() {');
      // 10. Fix broken fontSize: fontSize:'fill:' -> fontSize + fill separately
      gameCode = gameCode.replace(/fontSize:'fill:'#([0-9a-fA-F]+)'/g, "fontSize:'14px',fill:'#$1'");
      // 11. Fix truncated fontWe -> fontWeight
      gameCode = gameCode.replace(/fontWe\)/g, "fontWeight:'bold'})");

      console.log('🧹 After pre-fix, checking for HTML...');

      // Check if code contains HTML
      if (gameCode.includes('<!DOCTYPE html>') || gameCode.includes('<html>')) {
        console.log('📄 HTML detected, extracting JavaScript...');
        // Find the last script tag (in case there are multiple)
        const scriptMatches = [...gameCode.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
        
        if (scriptMatches.length > 0) {
          // Get the last script tag content
          const lastScript = scriptMatches[scriptMatches.length - 1];
          console.log('📜 Found', scriptMatches.length, 'script tags, using the last one');
          gameCode = lastScript[1];
          console.log('📜 Script content length before cleanup:', gameCode.length);
          console.log('📜 Script preview:', gameCode.substring(0, 100));
          
          // Remove markdown code blocks if present
          // First remove the opening markdown with any text after it
          gameCode = gameCode.replace(/```javascript[\s\S]*?\n/g, '');
          gameCode = gameCode.replace(/```js[\s\S]*?\n/g, '');
          gameCode = gameCode.replace(/```\n/g, '');
          // Then remove closing markdown blocks
          gameCode = gameCode.replace(/\n```/g, '');
          gameCode = gameCode.replace(/```$/g, '');
          
          // Trim whitespace
          gameCode = gameCode.trim();

          // Fix common AI generation bugs
          // 1. Remove infinite recursion in sound functions (entire function)
          gameCode = gameCode.replace(
            /function\s+(powerUpSound|shootSound|explosionSound)\s*\(\)\s*\{[^}]*\{[^}]*\}[^}]*\}/gi,
            ''
          );
          // Simpler approach: just remove the recursive call lines
          gameCode = gameCode.replace(
            /function\s+(powerUpSound|shootSound|explosionSound)\s*\(\)\s*\{\s*\1\s*\(\s*\)\s*;/gi,
            'function $1() {'
          );
          // Also handle multi-line recursive calls
          gameCode = gameCode.replace(
            /function\s+(powerUpSound|shootSound|explosionSound)\s*\(\)\s*\{[\s\n\r]*\1\s*\(\)[^}]*\}/gi,
            'function $1() {'
          );
          // 2. Fix truncated text: this.add.tt( -> this.add.text(
          gameCode = gameCode.replace(/this\.add\.tt\(/g, 'this.add.text(');
          // 3. Fix truncated refreshBody: .refre() -> .refreshBody()
          gameCode = gameCode.replace(/\.refre\(\)/g, '.refreshBody()');
          // 4. Fix fontW -> fontWeight
          gameCode = gameCode.replace(/fontW\}/g, "fontWeight: 'bold'}");
          // 5. Fix missing colon: ,bold' -> ,fontWeight:'bold'
          gameCode = gameCode.replace(/,bold'\}/g, ",fontWeight:'bold'}");
          // 6. Fix leftover semicolons after function removal
          gameCode = gameCode.replace(/\}\s*;function/g, '} function');
          // 7. Fix double semicolons
          gameCode = gameCode.replace(/;;/g, ';');
          // 8. Fix truncated function names: functionObjects -> function spawnObjects
          gameCode = gameCode.replace(/functionObjects\(\)/g, 'function spawnObjects()');
          // 9. Fix truncated gameState: gaState -> gameState
          gameCode = gameCode.replace(/gaState\./g, 'gameState.');
          // 9b. Fix NEW truncated gameState patterns: gameSta. and gameStat.
          gameCode = gameCode.replace(/gameSta\./g, 'gameState.');
          gameCode = gameCode.replace(/gameStat\./g, 'gameState.');
          // 9c. Fix truncated spawnObjects: spacts() -> spawnObjects()
          gameCode = gameCode.replace(/function\s+spacts\(\)/g, 'function spawnObjects()');
          gameCode = gameCode.replace(/spacts\(\)\s*\{/g, 'spawnObjects() {');
          gameCode = gameCode.replace(/spawnObjcts\(\)\s*\{/g, 'spawnObjects() {');
          // 10. Fix broken fontSize: fontSize:'fill:' -> fontSize + fill separately
          gameCode = gameCode.replace(/fontSize:'fill:'#([0-9a-fA-F]+)'/g, "fontSize:'14px',fill:'#$1'");
          // 11. Fix truncated fontWe -> fontWeight
          gameCode = gameCode.replace(/fontWe\)/g, "fontWeight:'bold'})");

          console.log('🧹 After bug fixes, length:', gameCode.length);
          console.log('🧹 Cleaned code preview:', gameCode.substring(0, 100));
        } else {
          console.log('❌ No script tag found in HTML');
        }
      }
      
      // Inject parent container if not present
      if (!gameCode.includes("parent:") && !gameCode.includes("parent :")) {
        const configMatch = gameCode.match(/var\s+config\s*=\s*{/);
        if (configMatch) {
          gameCode = gameCode.replace(
            /var\s+config\s*=\s*{/,
            `var config = {\n    parent: 'game-container',`
          );
          console.log('💉 Injected parent container');
        }
      }
      
      // Skip broken asset injection - let asset generation handle it
      console.log('⚠️ Skipping asset injection - using runtime asset generation instead');
      
      // Convert Phaser 2 syntax to Phaser 3
      if (gameCode.includes('new Phaser.Game(') && !gameCode.includes('new Phaser.Game({')) {
        console.log('🔄 Converting Phaser 2 syntax to Phaser 3...');
        
        // FIRST: Apply all Phaser 2 to 3 API conversions before the constructor conversion
        // This ensures the functions have the right syntax when they're parsed
        
        // Replace game.load with this.load in preload
        gameCode = gameCode.replace(/game\.load\./g, 'this.load.');
        
        // Replace game.add with this.add in create
        gameCode = gameCode.replace(/game\.add\./g, 'this.add.');
        
        // IMPORTANT: Convert physics.arcade.overlap FIRST before other arcade replacements
        // This ensures we catch the full pattern before it gets partially replaced
        gameCode = gameCode.replace(/game\.physics\.arcade\.overlap/g, 'this.physics.world.overlap');
        
        // Now replace remaining game.physics.arcade with this.physics
        gameCode = gameCode.replace(/game\.physics\.arcade\./g, 'this.physics.');
        
        // Replace game.physics with this.physics
        gameCode = gameCode.replace(/game\.physics\./g, 'this.physics.');
        
        // Fix any remaining physics.overlap calls
        gameCode = gameCode.replace(/this\.physics\.overlap/g, 'this.physics.world.overlap');
        
        // Replace Phaser.Physics.ARCADE with 'arcade'
        gameCode = gameCode.replace(/Phaser\.Physics\.ARCADE/g, "'arcade'");
        
        // Replace game.physics.startSystem(Phaser.Physics.ARCADE) with proper Phaser 3 physics
        gameCode = gameCode.replace(/this\.physics\.startSystem\s*\([^)]+\)/g, '// Physics already initialized in config');
        
        // Replace game.physics.enable with this.physics.add.existing
        gameCode = gameCode.replace(/this\.physics\.enable\s*\(([^,]+),\s*[^)]+\)/g, 'this.physics.add.existing($1)');
        
        // Replace game.add.audio with this.sound.add
        gameCode = gameCode.replace(/this\.add\.audio/g, 'this.sound.add');
        
        // Replace sprite enableBody with physics body
        gameCode = gameCode.replace(/(\w+)\.enableBody\s*=\s*true/g, '// Physics enabled on group creation');
        
        // Fix group creation syntax
        gameCode = gameCode.replace(/(\w+)\s*=\s*this\.add\.group\(\)/g, '$1 = this.physics.add.group()');
        
        // Fix sprite creation in groups
        gameCode = gameCode.replace(/(\w+)\.create\(/g, '$1.create(');
        
        // Fix getFirstExists for bullets
        gameCode = gameCode.replace(/(\w+)\.getFirstExists\(false\)/g, '$1.getFirstDead()');
        
        // Fix checkWorldBounds and outOfBoundsKill
        gameCode = gameCode.replace(/(\w+)\.checkWorldBounds\s*=\s*true/g, '$1.setCollideWorldBounds(true)');
        gameCode = gameCode.replace(/(\w+)\.outOfBoundsKill\s*=\s*true/g, '// Auto-kill when out of bounds');
        
        // Fix sprite.reset
        gameCode = gameCode.replace(/(\w+)\.reset\(/g, '$1.setPosition(');
        
        // Fix sprite.kill() - in Phaser 3 use destroy()
        // Handle both .kill() and .kill(arguments)
        console.log('🔍 Looking for .kill() calls in code...');
        const killMatches = gameCode.match(/(\w+)\.kill\s*\([^)]*\)/g);
        if (killMatches) {
          console.log('🎯 Found kill() calls:', killMatches);
        }
        gameCode = gameCode.replace(/(\w+)\.kill\s*\([^)]*\)/g, '$1.destroy()');
        
        // Fix sprite.revive() - in Phaser 3 use setActive(true).setVisible(true)
        gameCode = gameCode.replace(/(\w+)\.revive\s*\([^)]*\)/g, '$1.setActive(true).setVisible(true)');
        
        // Fix sprite.alive - in Phaser 3 use active
        gameCode = gameCode.replace(/(\w+)\.alive/g, '$1.active');
        
        // Fix sprite.exists - in Phaser 3 use active
        gameCode = gameCode.replace(/(\w+)\.exists/g, '$1.active');
        
        // Replace game.add.tileSprite with this.add.tileSprite
        gameCode = gameCode.replace(/this\.add\.tileSprite/g, 'this.add.tileSprite');
        
        // Replace game.rnd.between with Phaser.Math.Between
        gameCode = gameCode.replace(/game\.rnd\.between/g, 'Phaser.Math.Between');
        gameCode = gameCode.replace(/this\.rnd\.between/g, 'Phaser.Math.Between');
        
        // Replace game.time.events.add with this.time.addEvent
        // This is more complex because we need to handle nested parentheses in the delay parameter
        // First, let's handle the conversion in a more robust way
        const convertTimeEvents = (code: string): string => {
          // Function to find matching parenthesis
          const findMatchingParen = (str: string, start: number): number => {
            let count = 1;
            for (let i = start + 1; i < str.length; i++) {
              if (str[i] === '(') count++;
              else if (str[i] === ')') count--;
              if (count === 0) return i;
            }
            return -1;
          };
          
          // Find all time.events.add occurrences
          const pattern = /(game|this)\.time\.events\.add\s*\(/g;
          let result = code;
          let match;
          let replacements: Array<{start: number, end: number, replacement: string}> = [];
          
          while ((match = pattern.exec(code)) !== null) {
            const startPos = match.index + match[0].length - 1; // Position of opening (
            const endPos = findMatchingParen(code, startPos);
            
            if (endPos !== -1) {
              // Extract the full function call content
              const argsStr = code.substring(startPos + 1, endPos);
              
              // Parse arguments - we need to be careful with commas inside function calls
              const args: string[] = [];
              let currentArg = '';
              let parenDepth = 0;
              let inString = false;
              let stringChar = '';
              
              for (let i = 0; i < argsStr.length; i++) {
                const char = argsStr[i];
                
                if (!inString && (char === '"' || char === "'")) {
                  inString = true;
                  stringChar = char;
                } else if (inString && char === stringChar && argsStr[i-1] !== '\\') {
                  inString = false;
                }
                
                if (!inString) {
                  if (char === '(') parenDepth++;
                  else if (char === ')') parenDepth--;
                  else if (char === ',' && parenDepth === 0) {
                    args.push(currentArg.trim());
                    currentArg = '';
                    continue;
                  }
                }
                
                currentArg += char;
              }
              if (currentArg.trim()) {
                args.push(currentArg.trim());
              }
              
              // Build the Phaser 3 syntax
              if (args.length >= 3) {
                const delay = args[0];
                const callback = args[1];
                const context = args[2];
                const extraArgs = args.slice(3);
                
                let replacement = `this.time.addEvent({
                  delay: ${delay},
                  callback: ${callback},
                  callbackScope: ${context}`;
                
                if (extraArgs.length > 0) {
                  replacement += `,
                  args: [${extraArgs.join(', ')}]`;
                }
                
                replacement += `
                })`;
                
                replacements.push({
                  start: match.index,
                  end: endPos + 1,
                  replacement: replacement
                });
              }
            }
          }
          
          // Apply replacements in reverse order to maintain positions
          replacements.reverse().forEach(rep => {
            result = result.substring(0, rep.start) + rep.replacement + result.substring(rep.end);
          });
          
          return result;
        };
        
        gameCode = convertTimeEvents(gameCode);
        
        // Fix Phaser.Timer.SECOND references
        gameCode = gameCode.replace(/Phaser\.Timer\.SECOND/g, '1000');
        
        // Replace game.input.keyboard with this.input.keyboard
        gameCode = gameCode.replace(/game\.input\.keyboard/g, 'this.input.keyboard');
        
        // Replace Phaser.Keyboard with Phaser.Input.Keyboard.KeyCodes
        gameCode = gameCode.replace(/Phaser\.Keyboard\.SPACEBAR/g, 'Phaser.Input.Keyboard.KeyCodes.SPACE');
        gameCode = gameCode.replace(/Phaser\.Keyboard\./g, 'Phaser.Input.Keyboard.KeyCodes.');
        
        // Special handling for cursors assignment to ensure it's globally accessible
        gameCode = gameCode.replace(
          /cursors\s*=\s*this\.input\.keyboard\.createCursorKeys\(\)/g, 
          'cursors = this.input.keyboard.createCursorKeys(); window.cursors = cursors'
        );
        
        // Also fix Phaser.Math.Between syntax - add parentheses for function calls
        gameCode = gameCode.replace(/Phaser\.Math\.Between\s+(\d+),\s*(\d+)/g, 'Phaser.Math.Between($1, $2)');
        
        // Add global variable declarations and scene reference
        // First, add a scene reference that standalone functions can use
        if (!gameCode.includes('var scene;')) {
          gameCode = gameCode.replace(/var game = new Phaser\.Game/, 'var scene;\nvar game = new Phaser.Game');
        }
        
        // Find all global variables that need to be declared
        const globalVars = [];
        
        // Helper function to check if a variable is already declared
        const isVariableDeclared = (varName: string) => {
          // Check for various declaration patterns:
          // var varName, var varName =, var varName;, var x, varName, y;
          const patterns = [
            new RegExp(`\\bvar\\s+${varName}\\b`),           // var varName
            new RegExp(`\\bvar\\s+[^;]*\\b${varName}\\b`),   // var x, varName, y
            new RegExp(`\\blet\\s+${varName}\\b`),           // let varName  
            new RegExp(`\\bconst\\s+${varName}\\b`),         // const varName
          ];
          return patterns.some(pattern => pattern.test(gameCode));
        };
        
        // Check for cursors
        if ((gameCode.includes('cursors =') || gameCode.includes('cursors.')) && !isVariableDeclared('cursors')) {
          globalVars.push('cursors');
        }
        
        // Check for other common variables
        if (gameCode.includes('fireButton') && !isVariableDeclared('fireButton')) {
          globalVars.push('fireButton');
        }
        
        if (gameCode.includes('music') && !isVariableDeclared('music')) {
          globalVars.push('music');
        }
        
        if (gameCode.includes('sfx') && !isVariableDeclared('sfx')) {
          globalVars.push('sfx');
        }
        
        // Add global declarations at the beginning
        if (globalVars.length > 0) {
          const globalDeclaration = `var ${globalVars.join(', ')};`;
          // Insert after the game variable declaration
          gameCode = gameCode.replace(/var game = new Phaser\.Game/, `var game = new Phaser.Game`);
          // Add globals before the first function
          gameCode = gameCode.replace(/function preload/, `${globalDeclaration}\n\nfunction preload`);
        }
        
        // Store scene reference in create function so standalone functions can use it
        gameCode = gameCode.replace(/function create\(\) {/, `function create() {\n    scene = this;`);
        
        // NOW convert the Phaser 2 constructor to Phaser 3
        // Pattern to match Phaser 2 constructor: new Phaser.Game(width, height, renderer, parent, state)
        const phaser2Pattern = /new\s+Phaser\.Game\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*([^,]+)\s*,\s*(['"]?)([^'"]*)\4\s*,\s*({[^}]+})\s*\)/g;
        
        gameCode = gameCode.replace(phaser2Pattern, (match, width, height, renderer, quote, parent, state) => {
          console.log('🔄 Found Phaser 2 game constructor');
          console.log('  Width:', width);
          console.log('  Height:', height);
          console.log('  Renderer:', renderer);
          console.log('  Parent:', parent || 'game-container');
          
          // Build Phaser 3 config
          const config = `{
    type: ${renderer},
    width: ${width},
    height: ${height},
    parent: '${parent || 'game-container'}',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: ${state}
}`;
          
          return `new Phaser.Game(${config})`;
        });
        
        console.log('🔄 Phaser 2 to 3 conversion complete');
        
        // Now update the time event conversion to use scene instead of this in standalone functions
        // Check if we're in a standalone function by looking for function declarations
        const standaloneFunctionPattern = /^function\s+\w+\s*\(/m;
        const lines = gameCode.split('\n');
        let inStandaloneFunction = false;
        let updatedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          
          // Check if we're entering a standalone function
          if (standaloneFunctionPattern.test(line.trim())) {
            inStandaloneFunction = true;
          }
          
          // Check if we're in a scene method (preload, create, update)
          if (/function\s+(preload|create|update)\s*\(/.test(line.trim())) {
            inStandaloneFunction = false;
          }
          
          // Replace this.time.addEvent with scene.time.addEvent in standalone functions
          if (inStandaloneFunction && line.includes('this.time.addEvent')) {
            line = line.replace(/this\.time\.addEvent/g, 'scene.time.addEvent');
          }
          
          updatedLines.push(line);
        }
        
        gameCode = updatedLines.join('\n');
        
        console.log('🔄 Phaser 2 API conversion complete');
        
        // Debug: Log conversion results
        console.log('📝 Checking conversion results...');
        if (gameCode.includes('game.physics.arcade.overlap')) {
          console.error('❌ FAILED: game.physics.arcade.overlap still exists after conversion!');
        }
        if (gameCode.includes('this.physics.overlap')) {
          console.error('❌ FAILED: this.physics.overlap still exists after conversion!');
        }
        if (gameCode.includes('this.physics.world.overlap')) {
          console.log('✅ SUCCESS: Found this.physics.world.overlap in converted code');
        }
        
        // Log a sample of the update function
        const updateStart = gameCode.indexOf('function update()');
        if (updateStart > -1) {
          const snippet = gameCode.substring(updateStart, updateStart + 500);
          console.log('📝 Update function snippet after conversion:', snippet);
        }
      }
      
      // Remove hardcoded patches - we'll handle this more dynamically
      // Just log that we detected physics group usage
      if (gameCode.includes('fish.countActive') || gameCode.includes('fish.children.iterate')) {
        console.log('🔧 Detected physics group usage in game code');
      }
      
      // Find all asset keys that the game is trying to load
      console.log('🔍 Analyzing asset requirements...');
      
      const imageAssets = new Set<string>();
      const audioAssets = new Set<string>();
      
      // Extract image asset keys using various patterns
      const imagePatterns = [
        /(this|game)\.load\.image\s*\(\s*['"]([^'"]+)['"]/g,
        /(this|game)\.load\.spritesheet\s*\(\s*['"]([^'"]+)['"]/g,
        /(this|game)\.add\.(sprite|image|tileSprite)\s*\([^,]*,\s*[^,]*,\s*['"]([^'"]+)['"]/g
      ];
      
      for (const pattern of imagePatterns) {
        let match;
        while ((match = pattern.exec(gameCode)) !== null) {
          const key = match[match.length - 1]; // Last capture group
          imageAssets.add(key);
          console.log('📸 Found image asset:', key);
        }
      }
      
      // Also check for assets referenced in the gameData
      if (gameData.assets) {
        for (const key of Object.keys(gameData.assets)) {
          if (!key.includes('audio')) {
            imageAssets.add(key);
            console.log('📸 Found asset from gameData:', key);
          }
        }
      }
      
      console.log('📦 Total unique image assets:', imageAssets.size);
      
      // Build dynamic asset generation code
      const assetGenerationCode = `function preload() {
    console.log('🎨 Preload - generating runtime textures');
    
    try {
        // Create graphics object for texture generation
        const graphics = this.add.graphics();
        
        // Asset keys found in game code
        const imageAssets = ${JSON.stringify(Array.from(imageAssets))};
        console.log('📦 Generating textures for:', imageAssets);
        
        // Define colors and sizes for common asset types
        const assetConfig = {
            // Characters
            'sprite_character': { width: 40, height: 40, color: 0x00ff00, shape: 'rect' },
            'sprite_enemy': { width: 35, height: 35, color: 0xff0000, shape: 'rect' },
            'sprite_boss': { width: 60, height: 60, color: 0x8b0000, shape: 'rect' },
            
            // Effects
            'effect_particle': { width: 16, height: 16, color: 0xffffff, shape: 'circle' },
            'effect_explosion': { width: 48, height: 48, color: 0xff6600, shape: 'circle' },
            
            // Environment
            'background_environment': { width: 800, height: 600, color: 0x000033, shape: 'rect' },
            'bg_environment': { width: 800, height: 600, color: 0x000033, shape: 'rect' },
            
            // Default configs for common names
            player: { width: 40, height: 40, color: 0x00ff00, shape: 'rect' },
            enemy: { width: 35, height: 35, color: 0xff0000, shape: 'rect' },
            bullet: { width: 8, height: 16, color: 0x00ffff, shape: 'rect' },
            playerBullet: { width: 8, height: 16, color: 0x00ffff, shape: 'rect' },
            enemyBullet: { width: 8, height: 16, color: 0xff6600, shape: 'rect' },
            powerup: { width: 24, height: 24, color: 0xffd700, shape: 'star' },
            background: { width: 800, height: 600, color: 0x000033, shape: 'rect' },
            sky: { width: 800, height: 600, color: 0x87CEEB, shape: 'rect' },
            ground: { width: 400, height: 64, color: 0x654321, shape: 'rect' },
            platform: { width: 400, height: 50, color: 0x8B4513, shape: 'rect' },
            coin: { width: 24, height: 24, color: 0xffd700, shape: 'circle' },
            fish: { width: 32, height: 32, color: 0xffd700, shape: 'circle' },
            gem: { width: 20, height: 20, color: 0x00ff00, shape: 'diamond' },
            spike: { width: 32, height: 32, color: 0x808080, shape: 'triangle' }
        };
        
        // Helper to get config for an asset
        function getAssetConfig(key) {
            // Check exact match first
            if (assetConfig[key]) return assetConfig[key];
            
            // Check partial matches
            for (const [configKey, config] of Object.entries(assetConfig)) {
                if (key.includes(configKey) || configKey.includes(key)) {
                    return config;
                }
            }
            
            // Default fallback
            return { width: 32, height: 32, color: 0x808080, shape: 'rect' };
        }
        
        // Generate textures for all found assets
        imageAssets.forEach(key => {
            try {
                const config = getAssetConfig(key);
                
                // Clear graphics
                graphics.clear();
                graphics.fillStyle(config.color);
                
                // Draw shape
                if (config.shape === 'circle') {
                    graphics.fillCircle(config.width/2, config.height/2, Math.min(config.width, config.height)/2);
                } else if (config.shape === 'star') {
                    // Draw star
                    const cx = config.width/2;
                    const cy = config.height/2;
                    const spikes = 5;
                    const outerRadius = Math.min(config.width, config.height)/2;
                    const innerRadius = outerRadius/2;
                    
                    graphics.beginPath();
                    for (let i = 0; i < spikes * 2; i++) {
                        const radius = i % 2 === 0 ? outerRadius : innerRadius;
                        const angle = (i * Math.PI) / spikes - Math.PI/2;
                        const x = cx + Math.cos(angle) * radius;
                        const y = cy + Math.sin(angle) * radius;
                        if (i === 0) graphics.moveTo(x, y);
                        else graphics.lineTo(x, y);
                    }
                    graphics.closePath();
                    graphics.fill();
                } else if (config.shape === 'diamond') {
                    // Draw diamond
                    graphics.beginPath();
                    graphics.moveTo(config.width/2, 0);
                    graphics.lineTo(config.width, config.height/2);
                    graphics.lineTo(config.width/2, config.height);
                    graphics.lineTo(0, config.height/2);
                    graphics.closePath();
                    graphics.fill();
                } else if (config.shape === 'triangle') {
                    // Draw triangle
                    graphics.beginPath();
                    graphics.moveTo(config.width/2, 0);
                    graphics.lineTo(config.width, config.height);
                    graphics.lineTo(0, config.height);
                    graphics.closePath();
                    graphics.fill();
                } else {
                    // Default rectangle
                    graphics.fillRect(0, 0, config.width, config.height);
                }
                
                // Generate texture
                graphics.generateTexture(key, config.width, config.height);
                console.log('✅ Generated texture:', key, '(' + config.width + 'x' + config.height + ')');
                
            } catch (err) {
                console.error('❌ Failed to create texture', key + ':', err);
                // Create a fallback texture
                graphics.clear();
                graphics.fillStyle(0xff00ff); // Magenta for errors
                graphics.fillRect(0, 0, 32, 32);
                graphics.generateTexture(key, 32, 32);
            }
        });
        
        // Clean up
        graphics.destroy();
        console.log('🎨 All textures generated successfully');
        
    } catch (error) {
        console.error('❌ Asset generation failed:', error);
    }
}`;

      // Replace the existing preload function
      const preloadRegex = /function preload\(\)\s*\{[^}]*\}/;
      if (preloadRegex.test(gameCode)) {
        gameCode = gameCode.replace(preloadRegex, assetGenerationCode);
        console.log('✅ Replaced preload function with asset generation');
      } else {
        console.log('⚠️ Could not find preload function to replace');
      }
      
      // Log important info
      console.log('🎮 Game code includes parent?:', gameCode.includes('parent:'));
      console.log('📍 Container element exists?:', document.getElementById('game-container') !== null);
      
      // Log the final converted code before execution
      console.log('🚀 About to execute game code with length:', gameCode.length);
      console.log('🚀 Code contains game.physics.arcade.overlap?', gameCode.includes('game.physics.arcade.overlap'));
      console.log('🚀 Code contains this.physics.world.overlap?', gameCode.includes('this.physics.world.overlap'));
      console.log('🚀 Code contains preload function?', gameCode.includes('function preload'));
      console.log('🚀 Code contains create function?', gameCode.includes('function create'));
      console.log('🚀 Code contains update function?', gameCode.includes('function update'));
      console.log('🚀 Code contains Phaser.Game?', gameCode.includes('Phaser.Game'));
      console.log('🚀 Final code preview (first 500 chars):', gameCode.substring(0, 500));
      
      // Check if Phaser is available
      console.log('🎲 Phaser availability check:', {
        windowPhaser: !!(window as any).Phaser,
        phaserGame: !!(window as any).Phaser?.Game,
        phaserVersion: (window as any).Phaser?.VERSION || 'unknown'
      });
      
      // Execute game code
      console.log('⚡ Calling executeGameCode...');
      const gameInstance = await this.executeGameCode(gameCode);
      console.log('⚡ executeGameCode returned:', gameInstance ? 'SUCCESS' : 'FAILED');
      
      if (!gameInstance) {
        throw new Error('Failed to create game instance');
      }

      this.currentGame = {
        game: gameInstance,
        data: gameData,
        scene: gameInstance.scene ? (gameInstance.scene.getScene('GameScene') || gameInstance.scene.scenes[0]) : null
      };

      // Setup game event listeners
      this.setupGameEvents();

      // Track game start
      await this.apiClient.trackGameStart(gameData.id);

      this.emit('gameLoaded', gameData);
      console.log(`✅ Game loaded successfully: ${gameData.name}`);

    } catch (error) {
      this.emit('gameError', error);
      throw error;
    }
  }

  private prepareContainer(): void {
    this.container.innerHTML = '';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.display = 'flex';
    this.container.style.justifyContent = 'center';
    this.container.style.alignItems = 'center';
    this.container.style.background = '#1a1a1a';
  }

  private createGameConfig(gameData: Game): Phaser.Types.Core.GameConfig {
    return {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: this.container,
      backgroundColor: '#000000',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 500 },
          debug: false
        }
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 600
      },
      audio: {
        disableWebAudio: false
      }
    };
  }

  private setupGameEvents(): void {
    if (!this.currentGame) return;

    const game = this.currentGame.game;
    const scene = this.currentGame.scene;

    // Monitor game events
    game.events.on('ready', () => {
      this.emit('gameReady');
    });

    game.events.on('destroy', () => {
      this.emit('gameDestroyed');
    });

    // Monitor scene events if available
    if (scene) {
      scene.events.on('create', () => {
        // Scene created
      });

      scene.events.on('update', () => {
        // Can be used for performance monitoring
      });
    }
  }

  handleLayoutChange(layoutMode: string): void {
    if (!this.currentGame) return;

    // Adjust game scale based on Discord layout mode
    const scale = this.currentGame.game.scale;
    
    switch (layoutMode) {
      case 'PIP': // Picture in Picture
        scale.setGameSize(400, 300);
        break;
      case 'FOCUSED': // Full screen
        scale.setGameSize(800, 600);
        break;
      default:
        scale.setGameSize(600, 450);
    }

    this.emit('layoutChanged', layoutMode);
  }

  updateGameState(state: any): void {
    if (!this.currentGame || !this.currentGame.scene) return;

    // Update game state for multiplayer synchronization
    const scene = this.currentGame.scene;
    
    // Emit custom event that games can listen to
    scene.events.emit('stateUpdate', state);
  }

  unloadGame(): void {
    if (!this.currentGame) return;

    try {
      this.currentGame.game.destroy(true);
      this.container.innerHTML = '';
      this.currentGame = null;
      
      this.emit('gameUnloaded');
    } catch (error) {
      // Error unloading game
    }
  }

  getCurrentGame(): GameInstance | null {
    return this.currentGame;
  }

  isGameLoaded(): boolean {
    return this.currentGame !== null;
  }

  
  private async executeGameCode(gameCode: string): Promise<any> {
    return new Promise((resolve) => {
      // Track created games
      let capturedGame: any = null;
      
      // Store original Phaser.Game
      const OriginalPhaserGame = (window as any).Phaser.Game;
      
      // Override Phaser.Game to capture instances and add physics group compatibility
      (window as any).Phaser.Game = function(config: any) {
        console.log('🎮 Phaser.Game constructor called with config:', config);
        
        // Also need to wrap scene configuration if it exists
        if (config && config.scene) {
          // Store reference to original scene methods
          const originalCreate = config.scene.create;
          const originalUpdate = config.scene.update;
          
          config.scene.create = function() {
            console.log('🎨 Create intercepted - setting up physics wrapper');
            
            // Add global UI containers to avoid reference errors
            (window as any).gameOverContainer = null;
            (window as any).pauseContainer = null;
            (window as any).scoreText = null;
            (window as any).livesText = null;
            
            // Wrap sound.add to return mock audio objects
            const originalSoundAdd = this.sound.add.bind(this.sound);
            this.sound.add = function(key: string, config?: any) {
              console.log(`🔊 Mock audio created for: ${key}`);
              // Return a mock audio object with common methods and event emitter functionality
              return {
                key: key,
                isPlaying: false,
                isPaused: false,
                loop: false,
                volume: 1,
                // Event emitter mock
                _events: {} as Record<string, ((...args: any[]) => void)[]>,
                on: function(event: string, callback: (...args: any[]) => void) {
                  if (!this._events[event]) this._events[event] = [];
                  this._events[event].push(callback);
                  return this;
                },
                once: function(event: string, callback: (...args: any[]) => void) {
                  const onceWrapper = (...args: any[]) => {
                    this.off(event, onceWrapper);
                    callback.apply(this, args);
                  };
                  return this.on(event, onceWrapper);
                },
                off: function(event: string, callback?: (...args: any[]) => void) {
                  if (!this._events[event]) return this;
                  if (!callback) {
                    this._events[event] = [];
                  } else {
                    this._events[event] = this._events[event].filter((cb) => cb !== callback);
                  }
                  return this;
                },
                emit: function(event: string, ...args: any[]) {
                  if (!this._events[event]) return this;
                  this._events[event].forEach((callback) => {
                    try {
                      callback.apply(this, args);
                    } catch (error) {
                      console.warn(`Mock audio event error:`, error);
                    }
                  });
                  return this;
                },
                play: function(markerName?: string, config?: any) {
                  this.isPlaying = true;
                  console.log(`🔊 Mock audio playing: ${key}`);
                  // Emit events that Phaser expects
                  setTimeout(() => {
                    this.emit('play');
                    // Simulate audio completion after a short delay
                    setTimeout(() => {
                      this.isPlaying = false;
                      this.emit('complete');
                    }, 100);
                  }, 0);
                  return this;
                },
                pause: function() {
                  this.isPaused = true;
                  this.isPlaying = false;
                  this.emit('pause');
                  return this;
                },
                resume: function() {
                  this.isPaused = false;
                  this.isPlaying = true;
                  this.emit('resume');
                  return this;
                },
                stop: function() {
                  this.isPlaying = false;
                  this.isPaused = false;
                  this.emit('stop');
                  return this;
                },
                destroy: function() {
                  console.log(`🔊 Mock audio destroyed: ${key}`);
                  this.emit('destroy');
                  this._events = {};
                  return this;
                }
              };
            };
            
            // Wrap input.keyboard.createCursorKeys to ensure it returns valid cursor keys
            const originalCreateCursorKeys = this.input.keyboard.createCursorKeys.bind(this.input.keyboard);
            this.input.keyboard.createCursorKeys = function() {
              const keys = originalCreateCursorKeys();
              console.log('🎮 Cursor keys created:', keys);
              
              // Store in global variable to ensure it's accessible
              (window as any).cursors = keys;
              
              return keys;
            };
            
            // Wrap physics.add.group BEFORE anything else
            const scene = this;
            if (scene.physics && scene.physics.add && scene.physics.add.group) {
              const originalGroup = scene.physics.add.group.bind(scene.physics.add);
              
              scene.physics.add.group = function(config?: any) {
                console.log('🔧 Intercepted physics.add.group call');
                const group = originalGroup(config);
                
                // Ensure countActive method exists (handle both old and new Phaser APIs)
                if (!group.countActive) {
                  group.countActive = function(value = true) {
                    // Modern Phaser uses getChildren()
                    if (this.getChildren) {
                      const children = this.getChildren();
                      const count = children.filter((child: any) => child && child.active === value).length;
                      console.log(`countActive(${value}) = ${count} (using getChildren)`);
                      return count;
                    }
                    // Older Phaser uses children.entries
                    else if (this.children && this.children.entries) {
                      const count = this.children.entries.filter((child: any) => child && child.active === value).length;
                      console.log(`countActive(${value}) = ${count} (using children.entries)`);
                      return count;
                    }
                    return 0;
                  };
                }
                
                // Ensure children structure exists for compatibility
                if (!group.children && group.getChildren) {
                  // Create a compatibility layer for old-style code
                  group.children = {
                    entries: group.getChildren(),
                    iterate: function(callback: any) {
                      group.getChildren().forEach(callback);
                    }
                  };
                } else if (group.children && !group.children.iterate) {
                  // Add iterate if missing
                  group.children.iterate = function(callback: any) {
                    if (this.entries && Array.isArray(this.entries)) {
                      this.entries.forEach(callback);
                    } else if (group.getChildren) {
                      group.getChildren().forEach(callback);
                    }
                  };
                }
                
                console.log('✅ Physics group compatibility layer added');
                return group;
              };
            }
            
            try {
              // Create placeholder graphics
              const graphics = this.make.graphics({ add: false });
              
              // Detect game type from code or default to generic
              let gameType = 'generic';
              const codeStr = gameCode.toLowerCase();
              if (codeStr.includes('shoot') || codeStr.includes('bullet') || codeStr.includes('laser')) {
                gameType = 'shooter';
              } else if (codeStr.includes('platform') || codeStr.includes('jump') || codeStr.includes('coin')) {
                gameType = 'platformer';
              } else if (codeStr.includes('puzzle') || codeStr.includes('gem') || codeStr.includes('match')) {
                gameType = 'puzzle';
              }
              
              console.log('🎮 Detected game type:', gameType);
              
              // Define texture interface
              interface TextureConfig {
                key: string;
                width: number;
                height: number;
                color: number;
                gradient?: boolean;
                pattern?: string;
                shape?: string;
                circle?: boolean;
              }
              
              // Generate game-type-specific textures
              let textures: TextureConfig[] = [];
              
              if (gameType === 'shooter') {
                textures = [
                  { key: 'sky', width: 800, height: 600, color: 0x000033, gradient: true },
                  { key: 'ground', width: 800, height: 100, color: 0x1a1a1a },
                  { key: 'player', width: 40, height: 30, color: 0x00ff00, shape: 'ship' },
                  { key: 'enemy', width: 30, height: 30, color: 0xff0000, shape: 'enemy' },
                  { key: 'bullet', width: 6, height: 12, color: 0xffff00, shape: 'bullet' },
                  { key: 'explosion', width: 48, height: 48, color: 0xff6600, shape: 'explosion' },
                  { key: 'powerup', width: 24, height: 24, color: 0x00ffff, shape: 'star' }
                ];
              } else if (gameType === 'platformer') {
                textures = [
                  { key: 'sky', width: 800, height: 600, color: 0x87CEEB, gradient: true },
                  { key: 'ground', width: 400, height: 64, color: 0x654321, pattern: 'ground' },
                  { key: 'platform', width: 200, height: 20, color: 0x8B4513, pattern: 'brick' },
                  { key: 'coin', width: 24, height: 24, color: 0xFFD700, shape: 'coin' },
                  { key: 'gem', width: 20, height: 20, color: 0x00ff00, shape: 'diamond' },
                  { key: 'spike', width: 32, height: 32, color: 0x808080, shape: 'spike' },
                  { key: 'spring', width: 32, height: 32, color: 0x00ff00, shape: 'spring' },
                  { key: 'key', width: 24, height: 24, color: 0xFFD700, shape: 'key' },
                  { key: 'door', width: 64, height: 96, color: 0x8B4513, pattern: 'door' }
                ];
              } else if (gameType === 'puzzle') {
                textures = [
                  { key: 'background', width: 800, height: 600, color: 0x2a2a2a, pattern: 'grid' },
                  { key: 'gem1', width: 48, height: 48, color: 0xff0000, shape: 'gem' },
                  { key: 'gem2', width: 48, height: 48, color: 0x00ff00, shape: 'gem' },
                  { key: 'gem3', width: 48, height: 48, color: 0x0000ff, shape: 'gem' },
                  { key: 'gem4', width: 48, height: 48, color: 0xffff00, shape: 'gem' },
                  { key: 'gem5', width: 48, height: 48, color: 0xff00ff, shape: 'gem' },
                  { key: 'board', width: 480, height: 480, color: 0x333333, pattern: 'board' },
                  { key: 'particle', width: 16, height: 16, color: 0xffffff, shape: 'star' }
                ];
              } else {
                // Generic textures
                textures = [
                  { key: 'sky', width: 800, height: 600, color: 0x87CEEB },
                  { key: 'ground', width: 400, height: 50, color: 0x8B4513 },
                  { key: 'platform', width: 400, height: 50, color: 0x8B4513 },
                  { key: 'fish', width: 32, height: 32, color: 0xFFD700, circle: true },
                  { key: 'coin', width: 32, height: 32, color: 0xFFD700, circle: true },
                  { key: 'player', width: 32, height: 32, color: 0x00ff00 }
                ];
              }
              
              // Helper function to draw shapes
              const drawShape = (shape: string, x: number, y: number, width: number, height: number, color: number) => {
                graphics.fillStyle(color);
                graphics.lineStyle(2, 0xffffff, 0.3);
                
                switch (shape) {
                  case 'ship':
                    // Draw a simple spaceship
                    graphics.beginPath();
                    graphics.moveTo(x + width/2, y);
                    graphics.lineTo(x + width, y + height);
                    graphics.lineTo(x + width/2, y + height * 0.8);
                    graphics.lineTo(x, y + height);
                    graphics.closePath();
                    graphics.fill();
                    graphics.stroke();
                    break;
                    
                  case 'enemy':
                    // Draw enemy ship
                    graphics.fillCircle(x + width/2, y + height/2, width/2);
                    graphics.fillStyle(0xffffff);
                    graphics.fillCircle(x + width/3, y + height/3, 3);
                    graphics.fillCircle(x + width*2/3, y + height/3, 3);
                    break;
                    
                  case 'bullet':
                    graphics.fillRoundedRect(x, y, width, height, 3);
                    break;
                    
                  case 'coin':
                    graphics.fillCircle(x + width/2, y + height/2, width/2);
                    graphics.fillStyle(0xffffcc);
                    graphics.fillCircle(x + width/2, y + height/2, width/3);
                    break;
                    
                  case 'gem':
                    graphics.beginPath();
                    graphics.moveTo(x + width/2, y);
                    graphics.lineTo(x + width, y + height/3);
                    graphics.lineTo(x + width * 0.8, y + height);
                    graphics.lineTo(x + width * 0.2, y + height);
                    graphics.lineTo(x, y + height/3);
                    graphics.closePath();
                    graphics.fill();
                    graphics.stroke();
                    break;
                    
                  case 'spike':
                    for (let i = 0; i < 4; i++) {
                      graphics.beginPath();
                      graphics.moveTo(x + i * width/4 + width/8, y + height);
                      graphics.lineTo(x + i * width/4, y);
                      graphics.lineTo(x + i * width/4 + width/4, y + height);
                      graphics.closePath();
                      graphics.fill();
                    }
                    break;
                    
                  case 'star':
                    const cx = x + width/2;
                    const cy = y + height/2;
                    const spikes = 5;
                    const outerRadius = width/2;
                    const innerRadius = width/4;
                    
                    graphics.beginPath();
                    for (let i = 0; i < spikes * 2; i++) {
                      const radius = i % 2 === 0 ? outerRadius : innerRadius;
                      const angle = (i * Math.PI) / spikes;
                      const px = cx + Math.cos(angle - Math.PI/2) * radius;
                      const py = cy + Math.sin(angle - Math.PI/2) * radius;
                      if (i === 0) graphics.moveTo(px, py);
                      else graphics.lineTo(px, py);
                    }
                    graphics.closePath();
                    graphics.fill();
                    break;
                    
                  case 'diamond':
                    graphics.beginPath();
                    graphics.moveTo(x + width/2, y);
                    graphics.lineTo(x + width, y + height/2);
                    graphics.lineTo(x + width/2, y + height);
                    graphics.lineTo(x, y + height/2);
                    graphics.closePath();
                    graphics.fill();
                    graphics.stroke();
                    break;
                    
                  default:
                    graphics.fillRect(x, y, width, height);
                }
              };
              
              textures.forEach(tex => {
                if (tex.gradient) {
                  // Create gradient background using Phaser 3 gradient style
                  if (tex.key === 'sky' && gameType === 'shooter') {
                    // Dark space gradient
                    graphics.fillGradientStyle(0x000033, 0x000033, 0x000066, 0x000066, 1);
                  } else {
                    // Sky gradient
                    graphics.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x98D8E8, 0x98D8E8, 1);
                  }
                  graphics.fillRect(0, 0, tex.width, tex.height);
                } else if (tex.pattern) {
                  graphics.fillStyle(tex.color);
                  graphics.fillRect(0, 0, tex.width, tex.height);
                  
                  // Add patterns
                  if (tex.pattern === 'ground') {
                    graphics.fillStyle(0x543210);
                    for (let i = 0; i < tex.width; i += 20) {
                      graphics.fillRect(i, 0, 2, 10);
                      graphics.fillRect(i + 10, 10, 2, 10);
                    }
                  } else if (tex.pattern === 'brick') {
                    graphics.lineStyle(1, 0x654321);
                    for (let y = 0; y < tex.height; y += 10) {
                      for (let x = 0; x < tex.width; x += 20) {
                        graphics.strokeRect(x + (y/10 % 2) * 10, y, 20, 10);
                      }
                    }
                  } else if (tex.pattern === 'grid') {
                    graphics.lineStyle(1, 0x444444, 0.5);
                    for (let i = 0; i < tex.width; i += 50) {
                      graphics.lineBetween(i, 0, i, tex.height);
                    }
                    for (let i = 0; i < tex.height; i += 50) {
                      graphics.lineBetween(0, i, tex.width, i);
                    }
                  }
                } else if (tex.shape) {
                  drawShape(tex.shape, 0, 0, tex.width, tex.height, tex.color);
                } else if (tex.circle) {
                  graphics.fillStyle(tex.color);
                  graphics.fillCircle(tex.width/2, tex.height/2, tex.width/2);
                } else {
                  graphics.fillStyle(tex.color);
                  graphics.fillRect(0, 0, tex.width, tex.height);
                }
                
                graphics.generateTexture(tex.key, tex.width, tex.height);
                graphics.clear();
              });
              
              // Define spritesheet interface
              interface SpritesheetConfig {
                key: string;
                frameWidth: number;
                frameHeight: number;
                frames: number;
                color: number;
                type: string;
              }
              
              // Create game-type-specific sprite sheets
              let spritesheets: SpritesheetConfig[] = [];
              
              if (gameType === 'shooter') {
                spritesheets = [
                  { key: 'player_ship', frameWidth: 40, frameHeight: 30, frames: 4, color: 0x00ff00, type: 'ship' },
                  { key: 'enemy_ship', frameWidth: 30, frameHeight: 30, frames: 4, color: 0xff0000, type: 'enemy' },
                  { key: 'explosion_anim', frameWidth: 48, frameHeight: 48, frames: 6, color: 0xff6600, type: 'explosion' }
                ];
              } else if (gameType === 'platformer') {
                spritesheets = [
                  { key: 'player', frameWidth: 32, frameHeight: 48, frames: 8, color: 0x0066ff, type: 'character' },
                  { key: 'enemy', frameWidth: 32, frameHeight: 32, frames: 4, color: 0xff0066, type: 'enemy' },
                  { key: 'coin_spin', frameWidth: 24, frameHeight: 24, frames: 8, color: 0xffd700, type: 'coin' }
                ];
              } else if (gameType === 'puzzle') {
                spritesheets = [
                  { key: 'gem_shine', frameWidth: 48, frameHeight: 48, frames: 4, color: 0xffffff, type: 'shine' },
                  { key: 'match_effect', frameWidth: 64, frameHeight: 64, frames: 8, color: 0x00ffff, type: 'burst' }
                ];
              } else {
                // Default sprite sheets
                spritesheets = [
                  { key: 'cat', frameWidth: 32, frameHeight: 32, frames: 9, color: 0xFF6600, type: 'character' },
                  { key: 'player', frameWidth: 32, frameHeight: 32, frames: 9, color: 0x00ff00, type: 'character' }
                ];
              }
              
              spritesheets.forEach(sheet => {
                try {
                  // Create a texture large enough for all frames
                  const totalWidth = sheet.frameWidth * sheet.frames;
                  
                  // Draw frames based on sprite type
                  for (let i = 0; i < sheet.frames; i++) {
                    const x = i * sheet.frameWidth;
                    const frameProgress = i / (sheet.frames - 1);
                    
                    if (sheet.type === 'character') {
                      // Character animation - walking/idle
                      const yOffset = Math.sin(i * 0.7) * 3;
                      graphics.fillStyle(sheet.color);
                      
                      // Body
                      const bodyHeight = sheet.frameHeight * 0.6;
                      const bodyY = sheet.frameHeight - bodyHeight + yOffset;
                      graphics.fillRect(x + sheet.frameWidth * 0.25, bodyY, sheet.frameWidth * 0.5, bodyHeight);
                      
                      // Head
                      const headSize = sheet.frameWidth * 0.4;
                      graphics.fillCircle(x + sheet.frameWidth/2, bodyY - headSize/2, headSize/2);
                      
                      // Eyes
                      graphics.fillStyle(0xFFFFFF);
                      graphics.fillCircle(x + sheet.frameWidth*0.4, bodyY - headSize/2, 2);
                      graphics.fillCircle(x + sheet.frameWidth*0.6, bodyY - headSize/2, 2);
                      
                      // Legs animation
                      const legOffset = Math.sin(i * 1.5) * 4;
                      graphics.fillStyle(sheet.color);
                      graphics.fillRect(x + sheet.frameWidth*0.3, sheet.frameHeight - 8 + legOffset, 4, 8);
                      graphics.fillRect(x + sheet.frameWidth*0.6, sheet.frameHeight - 8 - legOffset, 4, 8);
                      
                    } else if (sheet.type === 'ship') {
                      // Ship animation - slight tilt
                      const tilt = Math.sin(i * 0.5) * 0.1;
                      graphics.save();
                      graphics.translateCanvas(x + sheet.frameWidth/2, sheet.frameHeight/2);
                      graphics.rotateCanvas(tilt);
                      graphics.translateCanvas(-(x + sheet.frameWidth/2), -sheet.frameHeight/2);
                      
                      drawShape('ship', x, 0, sheet.frameWidth, sheet.frameHeight, sheet.color);
                      
                      // Engine glow
                      graphics.fillStyle(0x00ffff);
                      graphics.globalAlpha = 0.5 + Math.sin(i * 2) * 0.3;
                      graphics.fillRect(x + sheet.frameWidth*0.3, sheet.frameHeight - 4, sheet.frameWidth*0.4, 4 + i % 3);
                      graphics.globalAlpha = 1;
                      
                      graphics.restore();
                      
                    } else if (sheet.type === 'enemy') {
                      // Enemy animation - pulsing
                      const scale = 1 + Math.sin(i * 0.8) * 0.1;
                      
                      graphics.fillStyle(sheet.color);
                      graphics.fillCircle(x + sheet.frameWidth/2, sheet.frameHeight/2, sheet.frameWidth/2 * scale);
                      
                      // Eyes that look around
                      const eyeOffset = Math.cos(i * 0.5) * 2;
                      graphics.fillStyle(0xFFFFFF);
                      graphics.fillCircle(x + sheet.frameWidth*0.3 + eyeOffset, sheet.frameHeight*0.3, 3);
                      graphics.fillCircle(x + sheet.frameWidth*0.7 + eyeOffset, sheet.frameHeight*0.3, 3);
                      
                      graphics.fillStyle(0x000000);
                      graphics.fillCircle(x + sheet.frameWidth*0.3 + eyeOffset + 1, sheet.frameHeight*0.3, 1);
                      graphics.fillCircle(x + sheet.frameWidth*0.7 + eyeOffset + 1, sheet.frameHeight*0.3, 1);
                      
                    } else if (sheet.type === 'coin') {
                      // Coin rotation animation
                      const scaleX = Math.cos(i * Math.PI / 4);
                      const width = Math.abs(scaleX) * sheet.frameWidth;
                      
                      graphics.fillStyle(sheet.color);
                      graphics.fillEllipse(x + sheet.frameWidth/2, sheet.frameHeight/2, width/2, sheet.frameHeight/2);
                      
                      // Inner circle
                      if (Math.abs(scaleX) > 0.3) {
                        graphics.fillStyle(0xffffcc);
                        graphics.fillEllipse(x + sheet.frameWidth/2, sheet.frameHeight/2, width/3, sheet.frameHeight/3);
                      }
                      
                    } else if (sheet.type === 'explosion') {
                      // Explosion animation
                      const progress = frameProgress;
                      const numParticles = Math.floor(8 * (1 - progress));
                      
                      graphics.fillStyle(sheet.color);
                      graphics.globalAlpha = 1 - progress * 0.7;
                      
                      for (let p = 0; p < numParticles; p++) {
                        const angle = (p / numParticles) * Math.PI * 2;
                        const distance = progress * sheet.frameWidth/2;
                        const px = x + sheet.frameWidth/2 + Math.cos(angle) * distance;
                        const py = sheet.frameHeight/2 + Math.sin(angle) * distance;
                        const size = (1 - progress) * 6;
                        
                        graphics.fillCircle(px, py, size);
                      }
                      
                      // Center flash
                      if (progress < 0.3) {
                        graphics.fillStyle(0xffff00);
                        graphics.fillCircle(x + sheet.frameWidth/2, sheet.frameHeight/2, (1 - progress) * sheet.frameWidth/3);
                      }
                      
                      graphics.globalAlpha = 1;
                      
                    } else if (sheet.type === 'shine') {
                      // Gem shine effect
                      graphics.fillStyle(sheet.color);
                      graphics.globalAlpha = 0.3 + Math.sin(i * Math.PI / sheet.frames) * 0.7;
                      
                      const numRays = 8;
                      for (let r = 0; r < numRays; r++) {
                        const angle = (r / numRays) * Math.PI * 2 + i * 0.2;
                        const length = sheet.frameWidth/2 + Math.sin(i * 0.5) * 10;
                        
                        graphics.beginPath();
                        graphics.moveTo(x + sheet.frameWidth/2, sheet.frameHeight/2);
                        const x1 = x + sheet.frameWidth/2 + Math.cos(angle) * length;
                        const y1 = sheet.frameHeight/2 + Math.sin(angle) * length;
                        graphics.lineTo(x1, y1);
                        graphics.lineStyle(2, sheet.color, graphics.globalAlpha);
                        graphics.stroke();
                      }
                      
                      graphics.globalAlpha = 1;
                      
                    } else if (sheet.type === 'burst') {
                      // Match burst effect
                      const scale = 0.5 + frameProgress * 1.5;
                      graphics.fillStyle(sheet.color);
                      graphics.globalAlpha = 1 - frameProgress;
                      
                      const numStars = 6;
                      for (let s = 0; s < numStars; s++) {
                        const angle = (s / numStars) * Math.PI * 2;
                        const dist = scale * sheet.frameWidth/3;
                        const sx = x + sheet.frameWidth/2 + Math.cos(angle) * dist;
                        const sy = sheet.frameHeight/2 + Math.sin(angle) * dist;
                        
                        drawShape('star', sx - 8, sy - 8, 16, 16, sheet.color);
                      }
                      
                      graphics.globalAlpha = 1;
                    }
                  }
                  
                  // Generate the sprite sheet texture
                  graphics.generateTexture(sheet.key, totalWidth, sheet.frameHeight);
                  
                  // Get the texture from the texture manager and add frames
                  const textureManager = this.textures;
                  const texture = textureManager.get(sheet.key);
                  
                  if (texture) {
                    // Add frames to the texture
                    for (let i = 0; i < sheet.frames; i++) {
                      texture.add(i, 0, i * sheet.frameWidth, 0, sheet.frameWidth, sheet.frameHeight);
                    }
                  }
                  
                  graphics.clear();
                } catch (err) {
                  console.warn(`Failed to create sprite sheet ${sheet.key}:`, err);
                  // Create a simple single-frame texture as fallback
                  graphics.fillStyle(sheet.color);
                  graphics.fillRect(0, 0, sheet.frameWidth, sheet.frameHeight);
                  graphics.generateTexture(sheet.key, sheet.frameWidth, sheet.frameHeight);
                  graphics.clear();
                }
              });
              
              graphics.destroy();
              
              // Set background
              this.cameras.main.setBackgroundColor('#87CEEB');
              
            } catch (err) {
              console.error('Error creating placeholder assets:', err);
            }
            
            // Always call original create
            if (originalCreate) {
              try {
                originalCreate.call(this);
                
                // After create, check all scene properties for physics groups
                console.log('🔍 Checking for physics groups after create...');
                const scene = this;
                Object.keys(scene).forEach(key => {
                  const obj = scene[key];
                  if (obj && obj.children && obj.children.entries && !obj.countActive) {
                    console.log(`🔧 Found group "${key}" without countActive, adding it...`);
                    obj.countActive = function(value = true) {
                      if (!this.children || !this.children.entries) {
                        return 0;
                      }
                      return this.children.entries.filter((child: any) => child.active === value).length;
                    };
                    
                    if (!obj.children.iterate) {
                      obj.children.iterate = function(callback: any) {
                        if (this.entries) {
                          this.entries.forEach(callback);
                        }
                      };
                    }
                  }
                });
                
              } catch (err) {
                console.error('Error in original create:', err);
                // Try to fix common issues
                if (err instanceof Error && err.message && err.message.includes('countActive')) {
                  console.log('🔧 Attempting to fix physics group methods...');
                  // Find all physics groups and add missing methods
                  const scene = this;
                  Object.keys(scene).forEach(key => {
                    const obj = scene[key];
                    if (obj && obj.children && Array.isArray(obj.children.entries)) {
                      // This looks like a physics group
                      if (!obj.countActive) {
                        obj.countActive = function(value = true) {
                          return this.children.entries.filter((child: any) => child.active === value).length;
                        };
                        console.log(`🔧 Added countActive method to ${key}`);
                      }
                    }
                  });
                  // Retry the create function
                  try {
                    originalCreate.call(this);
                  } catch (retryErr) {
                    console.error('Retry failed:', retryErr);
                  }
                }
              }
            }
          };
          
          // Also wrap update to catch any late group usage
          if (originalUpdate) {
            let firstUpdate = true;
            config.scene.update = function(...args: any[]) {
              if (firstUpdate) {
                firstUpdate = false;
                console.log('🔍 First update - checking for any missed groups...');
                
                // Check global scope for groups
                if ((window as any).fish && !(window as any).fish.countActive) {
                  console.log('🔧 Found global fish group, adding methods...');
                  (window as any).fish.countActive = function(value = true) {
                    if (!this.children || !this.children.entries) {
                      return 0;
                    }
                    return this.children.entries.filter((child: any) => child.active === value).length;
                  };
                }
                
                // Check scene properties again
                const scene = this;
                Object.keys(scene).forEach(key => {
                  const obj = scene[key];
                  if (obj && obj.children && obj.children.entries && !obj.countActive) {
                    console.log(`🔧 Found group "${key}" in update, adding countActive...`);
                    obj.countActive = function(value = true) {
                      if (!this.children || !this.children.entries) {
                        return 0;
                      }
                      return this.children.entries.filter((child: any) => child.active === value).length;
                    };
                  }
                });
              }
              
              // Call original update
              return originalUpdate.apply(this, args);
            };
          }
        }
        
        const instance = new OriginalPhaserGame(config);
        capturedGame = instance;
        console.log('✅ Game instance created and captured');
        return instance;
      };
      
      // Copy prototype
      (window as any).Phaser.Game.prototype = OriginalPhaserGame.prototype;
      
      try {
        // First, let's analyze the game code structure
        console.log('🔍 Analyzing game code structure...');
        console.log('🔍 Code length:', gameCode.length);
        console.log('🔍 Contains "new Phaser.Game":', gameCode.includes('new Phaser.Game'));
        console.log('🔍 Contains "= new Phaser.Game":', gameCode.includes('= new Phaser.Game'));
        console.log('🔍 Contains "var game":', gameCode.includes('var game'));
        console.log('🔍 Contains "const game":', gameCode.includes('const game'));
        console.log('🔍 Contains "let game":', gameCode.includes('let game'));
        console.log('🔍 First 1000 chars:', gameCode.substring(0, 1000));
        
        // Check if the code is wrapped in an IIFE or function
        let processedCode = gameCode;
        
        // If the code starts with a function declaration, we need to call it
        if (gameCode.trim().startsWith('(function') || gameCode.trim().startsWith('function')) {
          console.log('🔍 Code appears to be wrapped in a function');
          processedCode = `(${gameCode})();`;
        }
        
        // Create a function that executes the game code with proper scope
        // Note: Don't declare 'game' here since it's likely declared in the game code
        const executeCode = new Function('Phaser', 'window', `
          // Create variables in this scope (except 'game' which is declared in the code)
          var myGame;
          
          // Execute the game code
          ${processedCode}
          
          // Try to find and return the game instance
          if (typeof game !== 'undefined' && game) {
            console.log('✅ Found game variable:', game);
            return game;
          }
          
          // Check window.game
          if (window.game) {
            console.log('✅ Found window.game:', window.game);
            return window.game;
          }
          
          // Check for other common game variable names
          if (typeof myGame !== 'undefined' && myGame) {
            console.log('✅ Found myGame variable:', myGame);
            return myGame;
          }
          
          // Check if any Phaser games were created
          if (Phaser.GAMES && Phaser.GAMES.length > 0) {
            console.log('✅ Found game in Phaser.GAMES:', Phaser.GAMES[0]);
            return Phaser.GAMES[0];
          }
          
          console.log('❌ No game instance found in executed code');
          return null;
        `);
        
        // Execute the code
        console.log('🚀 Executing game code...');
        
        let result;
        try {
          result = executeCode(Phaser, window);
          console.log('📦 Execution result:', result);
        } catch (execError) {
          console.error('❌ Error during code execution:', execError);
          if (execError instanceof Error) {
            console.error('❌ Error stack:', execError.stack);
          }
          throw execError;
        }
        
        console.log('📦 Captured game:', capturedGame);
        
        // Check if Phaser.GAMES exists
        console.log('📦 Phaser.GAMES:', (window as any).Phaser?.GAMES);
        
        // Function to check for game instance
        const checkForGame = () => {
          if (result) {
            return result;
          }
          if (capturedGame) {
            return capturedGame;
          }
          if ((window as any).game) {
            return (window as any).game;
          }
          if ((window as any).Phaser?.GAMES?.length > 0) {
            return (window as any).Phaser.GAMES[0];
          }
          return null;
        };
        
        let gameInstance = checkForGame();
        
        if (gameInstance) {
          // Restore original Phaser.Game
          (window as any).Phaser.Game = OriginalPhaserGame;
          resolve(gameInstance);
        } else {
          // Check if window.onload is set (game might be waiting for page load)
          if (window.onload) {
            console.log('🔍 Found window.onload, triggering it...');
            const onloadFunc = window.onload;
            window.onload = null;
            onloadFunc.call(window, new Event('load'));
          }
          
          // Wait a bit for async game creation
          let attempts = 0;
          const maxAttempts = 10;
          
          const checkInterval = setInterval(() => {
            attempts++;
            gameInstance = checkForGame();
            
            if (gameInstance || attempts >= maxAttempts) {
              clearInterval(checkInterval);
              // Restore original Phaser.Game
              (window as any).Phaser.Game = OriginalPhaserGame;
              
              if (gameInstance) {
                console.log('✅ Game instance found after', attempts, 'attempts');
                resolve(gameInstance);
              } else {
                console.log('❌ No game instance found after', attempts, 'attempts');
                resolve(null);
              }
            }
          }, 100);
        }
      } catch (error) {
        console.error('❌ Error executing game code:', error);
        // Restore original Phaser.Game
        (window as any).Phaser.Game = OriginalPhaserGame;
        throw error;
      }
    });
  }


  // Multiplayer-related methods
  handlePlayerJoined(player: any): void {
    if (!this.currentGame || !this.currentGame.scene) return;
    this.currentGame.scene.events.emit('playerJoined', player);
  }

  handlePlayerLeft(player: any): void {
    if (!this.currentGame || !this.currentGame.scene) return;
    this.currentGame.scene.events.emit('playerLeft', player);
  }

  handlePlayerUpdate(playerId: string, player: any): void {
    if (!this.currentGame || !this.currentGame.scene) return;
    this.currentGame.scene.events.emit('playerUpdate', { playerId, player });
  }

  startGame(): void {
    if (!this.currentGame || !this.currentGame.scene) return;
    this.currentGame.scene.events.emit('gameStart');
  }

  updatePlayerScore(playerId: string, score: number): void {
    if (!this.currentGame || !this.currentGame.scene) return;
    this.currentGame.scene.events.emit('scoreUpdate', { playerId, score });
  }

  handleRemotePlayerAction(data: any): void {
    if (!this.currentGame || !this.currentGame.scene) return;
    this.currentGame.scene.events.emit('remoteAction', data);
  }
}