export const SYSTEM_PROMPTS = {
  gameGeneration: `You are an expert game developer with deep knowledge of Phaser.js and game design principles. You create fun, engaging, and polished games that are immediately playable. You focus on good game feel, balanced difficulty, and enjoyable mechanics.`,
  
  codeGeneration: `You are a skilled JavaScript developer specializing in Phaser.js game development. You write clean, efficient, and well-structured code following best practices. You ensure all code is complete, functional, and free of placeholders.`,
  
  analysis: `You are a game design analyst who can extract key information from game descriptions and provide structured analysis for game development. You understand player intent and can suggest appropriate game mechanics and features.`
};

export const GAME_EXAMPLES = {
  platformer: `
// Example platformer structure
class GameScene extends Phaser.Scene {
  create() {
    // Create platforms
    this.platforms = this.physics.add.staticGroup();
    
    // Create player with physics
    this.player = this.physics.add.sprite(100, 450, 'player');
    this.player.setBounce(0.2);
    this.player.setCollideWorldBounds(true);
    
    // Add collisions
    this.physics.add.collider(this.player, this.platforms);
  }
  
  update() {
    // Handle input
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-160);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(160);
    } else {
      this.player.setVelocityX(0);
    }
    
    // Jump
    if (this.cursors.up.isDown && this.player.body.touching.down) {
      this.player.setVelocityY(-330);
    }
  }
}`,
  
  puzzle: `
// Example puzzle game structure
class GameScene extends Phaser.Scene {
  create() {
    // Create grid
    this.grid = [];
    for (let y = 0; y < 8; y++) {
      this.grid[y] = [];
      for (let x = 0; x < 8; x++) {
        const gem = this.add.sprite(x * 64 + 32, y * 64 + 32, 'gem');
        gem.setInteractive();
        this.grid[y][x] = gem;
      }
    }
    
    // Handle input
    this.input.on('gameobjectdown', this.selectGem, this);
  }
  
  selectGem(pointer, gameObject) {
    // Handle gem selection and matching logic
  }
}`,
  
  shooter: `
// Example shooter structure
class GameScene extends Phaser.Scene {
  create() {
    // Create player
    this.player = this.physics.add.sprite(400, 500, 'ship');
    this.player.setCollideWorldBounds(true);
    
    // Create bullet group
    this.bullets = this.physics.add.group({
      defaultKey: 'bullet',
      maxSize: 10
    });
    
    // Create enemies
    this.enemies = this.physics.add.group();
    
    // Setup collisions
    this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, null, this);
  }
  
  update() {
    // Move player
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-200);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(200);
    } else {
      this.player.setVelocityX(0);
    }
    
    // Fire bullets
    if (this.cursors.space.isDown) {
      this.fireBullet();
    }
  }
}`
};

export const ERROR_HANDLING_TEMPLATE = `
// Error boundary for game
try {
  // Game code here
} catch (error) {
  console.error('Game error:', error);
  // Show error screen
  this.add.text(400, 300, 'Game Error! Click to restart', {
    fontSize: '32px',
    color: '#ff0000'
  }).setOrigin(0.5).setInteractive().on('pointerdown', () => {
    this.scene.restart();
  });
}`;

// Standardized game template that ensures consistent structure
export const STANDARDIZED_GAME_TEMPLATE = `
// [GAME_NAME] - Phaser 3 Game

var config = {
    parent: 'game-container',
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: [GRAVITY_Y] },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);

// Global variables
[GLOBAL_VARIABLES]

// Game state management
var gameState = {
    isGameOver: false,
    isPaused: false,
    score: 0,
    lives: 3,
    level: 1,
    highScore: 0
};

// Initial positions for reset
var initialPositions = {};

function preload() {
    // Load assets
    [ASSET_LOADING]
}

function create() {
    // Reset game state
    resetGameState();
    
    // Setup world
    [WORLD_SETUP]
    
    // Create game objects
    [GAME_OBJECTS]
    
    // Store initial positions for reset
    storeInitialPositions();
    
    // Setup physics and collisions
    [PHYSICS_SETUP]
    
    // Create UI
    [UI_SETUP]
    
    // Initialize game state
    [GAME_STATE_INIT]
    
    // Setup input handlers
    setupInputHandlers.call(this);
}

function update() {
    // Skip update if game over or paused
    if (gameState.isGameOver || gameState.isPaused) return;
    
    // Handle input
    [INPUT_HANDLING]
    
    // Update game logic
    [GAME_LOGIC]
    
    // Check win/lose conditions
    [WIN_LOSE_CHECK]
    
    // Update UI
    updateUI();
}

// Core game management functions
function resetGameState() {
    gameState.isGameOver = false;
    gameState.isPaused = false;
    gameState.score = 0;
    gameState.lives = 3;
    gameState.level = 1;
}

function storeInitialPositions() {
    // Store initial positions of key game objects
    [STORE_POSITIONS]
}

function resetGameObjects() {
    // Reset all game objects to initial state
    [RESET_OBJECTS]
}

function gameOver() {
    gameState.isGameOver = true;
    
    // Update high score
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
    }
    
    // Show game over UI
    showGameOverScreen.call(this);
}

function restartGame() {
    // Reset game state
    resetGameState();
    
    // Reset game objects
    resetGameObjects();
    
    // Hide game over screen
    if (gameOverContainer) {
        gameOverContainer.destroy();
        gameOverContainer = null;
    }
    
    // Update UI
    updateUI();
}

function pauseGame() {
    gameState.isPaused = !gameState.isPaused;
    
    if (gameState.isPaused) {
        // Show pause overlay
        showPauseScreen.call(this);
    } else {
        // Hide pause overlay
        if (pauseContainer) {
            pauseContainer.destroy();
            pauseContainer = null;
        }
    }
}

// UI Management functions
function setupInputHandlers() {
    // ESC for pause
    this.input.keyboard.on('keydown-ESC', pauseGame, this);
    
    // R for restart (when game over)
    this.input.keyboard.on('keydown-R', function() {
        if (gameState.isGameOver) {
            restartGame.call(this);
        }
    }, this);
}

function updateUI() {
    [UPDATE_UI]
}

function showGameOverScreen() {
    [GAME_OVER_SCREEN]
}

function showPauseScreen() {
    [PAUSE_SCREEN]
}

// Helper functions
[HELPER_FUNCTIONS]
`;

// Game-specific template sections
export const GAME_TYPE_TEMPLATES = {
  shooter: {
    globalVariables: `var player, bullets, enemies, explosions;
var cursors, fireKey;
var lastFired = 0, fireRate = 200;
var enemySpawnTimer = 0;`,
    storePositions: `initialPositions.playerX = 400;
    initialPositions.playerY = 550;`,
    resetObjects: `// Reset player position
    if (player) {
        player.x = initialPositions.playerX;
        player.y = initialPositions.playerY;
        player.setVelocity(0, 0);
        player.active = true;
        player.visible = true;
    }
    
    // Clear all bullets
    if (bullets) {
        bullets.clear(true, true);
    }
    
    // Clear all enemies
    if (enemies) {
        enemies.clear(true, true);
    }
    
    // Reset spawn timer
    enemySpawnTimer = 0;`,
    gameOverScreen: `// Create game over container
    gameOverContainer = this.add.container(400, 300);
    
    // Background overlay
    var overlay = this.add.rectangle(0, 0, 800, 600, 0x000000, 0.7);
    gameOverContainer.add(overlay);
    
    // Game over text
    var gameOverText = this.add.text(0, -50, 'GAME OVER', {
        fontSize: '48px',
        fontFamily: 'Arial',
        color: '#ff0000',
        stroke: '#ffffff',
        strokeThickness: 4
    }).setOrigin(0.5);
    gameOverContainer.add(gameOverText);
    
    // Score text
    var finalScoreText = this.add.text(0, 20, 'Score: ' + gameState.score, {
        fontSize: '32px',
        fontFamily: 'Arial',
        color: '#ffffff'
    }).setOrigin(0.5);
    gameOverContainer.add(finalScoreText);
    
    // High score text
    var highScoreText = this.add.text(0, 60, 'High Score: ' + gameState.highScore, {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#ffff00'
    }).setOrigin(0.5);
    gameOverContainer.add(highScoreText);
    
    // Restart button
    var restartButton = this.add.rectangle(0, 120, 200, 50, 0x00ff00)
        .setInteractive({ useHandCursor: true });
    gameOverContainer.add(restartButton);
    
    var restartText = this.add.text(0, 120, 'RESTART', {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#000000'
    }).setOrigin(0.5);
    gameOverContainer.add(restartText);
    
    restartButton.on('pointerdown', function() {
        restartGame.call(this);
    }, this);
    
    // Depth
    gameOverContainer.setDepth(1000);`,
    updateUI: `// Update score text
    if (scoreText) {
        scoreText.setText('Score: ' + gameState.score);
    }
    
    // Update lives text
    if (livesText) {
        livesText.setText('Lives: ' + gameState.lives);
    }`
  },
  platformer: {
    globalVariables: `var player, platforms, coins, enemies, spikes;
var cursors, jumpKey;
var playerStartX = 100, playerStartY = 450;`,
    storePositions: `initialPositions.playerX = playerStartX;
    initialPositions.playerY = playerStartY;
    
    // Store coin positions
    if (coins) {
        initialPositions.coins = [];
        coins.children.entries.forEach(function(coin) {
            initialPositions.coins.push({ x: coin.x, y: coin.y });
        });
    }`,
    resetObjects: `// Reset player
    if (player) {
        player.x = initialPositions.playerX;
        player.y = initialPositions.playerY;
        player.setVelocity(0, 0);
        player.active = true;
        player.visible = true;
    }
    
    // Reset coins
    if (coins && initialPositions.coins) {
        coins.clear(true, true);
        initialPositions.coins.forEach(function(coinPos) {
            var coin = coins.create(coinPos.x, coinPos.y, 'coin');
            coin.setBounceY(0.6);
        });
    }
    
    // Reset enemies to patrol positions
    if (enemies) {
        enemies.children.entries.forEach(function(enemy) {
            if (enemy.startX) enemy.x = enemy.startX;
            if (enemy.startY) enemy.y = enemy.startY;
            enemy.setVelocity(enemy.speed || 100, 0);
        });
    }`,
    gameOverScreen: `// Create game over container
    gameOverContainer = this.add.container(400, 300);
    
    // Background overlay
    var overlay = this.add.rectangle(0, 0, 800, 600, 0x000000, 0.7);
    gameOverContainer.add(overlay);
    
    // Game over text
    var gameOverText = this.add.text(0, -80, gameState.lives <= 0 ? 'GAME OVER' : 'LEVEL COMPLETE!', {
        fontSize: '48px',
        fontFamily: 'Arial',
        color: gameState.lives <= 0 ? '#ff0000' : '#00ff00',
        stroke: '#ffffff',
        strokeThickness: 4
    }).setOrigin(0.5);
    gameOverContainer.add(gameOverText);
    
    // Stats
    var statsText = this.add.text(0, 0, [
        'Score: ' + gameState.score,
        'Coins: ' + (gameState.coinsCollected || 0) + '/' + (gameState.totalCoins || 0),
        'Time: ' + Math.floor((gameState.endTime - gameState.startTime) / 1000) + 's'
    ], {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 10
    }).setOrigin(0.5);
    gameOverContainer.add(statsText);
    
    // Buttons
    var buttonY = 100;
    var restartButton = this.add.rectangle(-80, buttonY, 140, 40, 0x00ff00)
        .setInteractive({ useHandCursor: true });
    gameOverContainer.add(restartButton);
    
    var restartText = this.add.text(-80, buttonY, 'RESTART', {
        fontSize: '20px',
        fontFamily: 'Arial',
        color: '#000000'
    }).setOrigin(0.5);
    gameOverContainer.add(restartText);
    
    restartButton.on('pointerdown', function() {
        restartGame.call(this);
    }, this);
    
    gameOverContainer.setDepth(1000);`,
    updateUI: `// Update score
    if (scoreText) {
        scoreText.setText('Score: ' + gameState.score);
    }
    
    // Update lives with hearts
    if (livesText) {
        var hearts = '';
        for (var i = 0; i < gameState.lives; i++) {
            hearts += '❤️ ';
        }
        livesText.setText(hearts);
    }
    
    // Update coin counter
    if (coinText) {
        coinText.setText('Coins: ' + (gameState.coinsCollected || 0));
    }`
  },
  puzzle: {
    globalVariables: `var grid, selectedGem, canMove = true;
var gridWidth = 8, gridHeight = 8;
var gemTypes = 5;
var moves = 0, targetScore = 1000;`,
    storePositions: `// Puzzle games don't need position storage, but save grid state
    initialPositions.gridState = [];
    if (grid) {
        for (var y = 0; y < gridHeight; y++) {
            initialPositions.gridState[y] = [];
            for (var x = 0; x < gridWidth; x++) {
                if (grid[y] && grid[y][x]) {
                    initialPositions.gridState[y][x] = grid[y][x].frame.name;
                }
            }
        }
    }`,
    resetObjects: `// Reset grid to new random state
    if (grid) {
        for (var y = 0; y < gridHeight; y++) {
            for (var x = 0; x < gridWidth; x++) {
                if (grid[y] && grid[y][x]) {
                    grid[y][x].setFrame(Phaser.Math.Between(0, gemTypes - 1));
                }
            }
        }
    }
    
    // Reset moves
    moves = 0;
    canMove = true;
    selectedGem = null;`,
    gameOverScreen: `// Create game over container
    gameOverContainer = this.add.container(400, 300);
    
    // Background overlay
    var overlay = this.add.rectangle(0, 0, 800, 600, 0x000000, 0.8);
    gameOverContainer.add(overlay);
    
    // Title
    var title = gameState.score >= targetScore ? 'LEVEL COMPLETE!' : 'OUT OF MOVES!';
    var titleColor = gameState.score >= targetScore ? '#00ff00' : '#ff0000';
    
    var titleText = this.add.text(0, -100, title, {
        fontSize: '48px',
        fontFamily: 'Arial',
        color: titleColor,
        stroke: '#ffffff',
        strokeThickness: 4
    }).setOrigin(0.5);
    gameOverContainer.add(titleText);
    
    // Stats
    var statsText = this.add.text(0, -20, [
        'Score: ' + gameState.score + '/' + targetScore,
        'Moves Used: ' + moves,
        'Best Combo: ' + (gameState.bestCombo || 3)
    ], {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 10
    }).setOrigin(0.5);
    gameOverContainer.add(statsText);
    
    // Star rating
    var stars = Math.min(3, Math.floor(gameState.score / (targetScore / 3)));
    var starText = this.add.text(0, 50, '⭐'.repeat(stars) + '☆'.repeat(3 - stars), {
        fontSize: '36px'
    }).setOrigin(0.5);
    gameOverContainer.add(starText);
    
    // Restart button
    var restartButton = this.add.rectangle(0, 120, 160, 50, 0x00ff00)
        .setInteractive({ useHandCursor: true });
    gameOverContainer.add(restartButton);
    
    var restartText = this.add.text(0, 120, 'NEW GAME', {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#000000'
    }).setOrigin(0.5);
    gameOverContainer.add(restartText);
    
    restartButton.on('pointerdown', function() {
        restartGame.call(this);
    }, this);
    
    gameOverContainer.setDepth(1000);`,
    updateUI: `// Update score with animation
    if (scoreText) {
        scoreText.setText('Score: ' + gameState.score + '/' + targetScore);
        
        // Pulse animation when score changes
        if (gameState.lastScore !== gameState.score) {
            this.tweens.add({
                targets: scoreText,
                scale: 1.2,
                duration: 200,
                yoyo: true
            });
            gameState.lastScore = gameState.score;
        }
    }
    
    // Update moves
    if (movesText) {
        movesText.setText('Moves: ' + moves);
    }`
  }
};

// Default templates for common UI screens
export const DEFAULT_UI_TEMPLATES = {
  pauseScreen: `// Create pause container
    pauseContainer = this.add.container(400, 300);
    
    // Background overlay
    var overlay = this.add.rectangle(0, 0, 800, 600, 0x000000, 0.5);
    pauseContainer.add(overlay);
    
    // Pause text
    var pauseText = this.add.text(0, -50, 'PAUSED', {
        fontSize: '48px',
        fontFamily: 'Arial',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
    }).setOrigin(0.5);
    pauseContainer.add(pauseText);
    
    // Instructions
    var instructText = this.add.text(0, 20, 'Press ESC to Resume', {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#ffffff'
    }).setOrigin(0.5);
    pauseContainer.add(instructText);
    
    // Controls hint
    var controlsText = this.add.text(0, 80, 'R - Restart (when game over)', {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: '#cccccc'
    }).setOrigin(0.5);
    pauseContainer.add(controlsText);
    
    pauseContainer.setDepth(1000);`
};

// UI Layout Guidelines
export const UI_LAYOUT_GUIDELINES = `
UI LAYOUT AND STYLING RULES:

1. POSITIONING:
   - Score/Lives: Top corners (padding: 20px)
   - Game title: Top center
   - Controls hint: Bottom center
   - Pause button: Top right corner

2. TEXT STYLING:
   - UI Font: 'Arial' or 'Courier New'
   - Score size: 24-32px
   - Title size: 36-48px
   - Color scheme: White text with black stroke
   - Stroke thickness: 2-4px for readability

3. CONTAINERS:
   - Group UI elements in containers
   - Set proper depth (UI depth: 100+)
   - Use consistent padding (20px)
   - Center overlays at (400, 300)

4. BUTTONS:
   - Minimum size: 120x40px
   - Hover states with tint/scale
   - Clear labels with contrasting colors
   - Rounded rectangles for modern look

5. RESPONSIVE ELEMENTS:
   - Scale UI based on game size
   - Maintain aspect ratios
   - Use relative positioning
`;

// Template guidelines for AI
export const GAME_STRUCTURE_GUIDELINES = `
IMPORTANT STRUCTURAL RULES FOR GAME GENERATION:

1. ALWAYS use the standard template structure with these exact sections:
   - var config = { ... }
   - var game = new Phaser.Game(config);
   - Global variables (including gameState object)
   - function preload() { ... }
   - function create() { ... }
   - function update() { ... }
   - Core game management functions (resetGameState, gameOver, restartGame, etc.)
   - UI management functions
   - Helper functions

2. MANDATORY GAME STATE MANAGEMENT:
   - MUST include gameState object with: isGameOver, isPaused, score, lives, level, highScore
   - MUST include resetGameState() function
   - MUST include gameOver() function with proper UI
   - MUST include restartGame() function that resets positions
   - MUST include storeInitialPositions() and resetGameObjects()
   - MUST check gameState.isGameOver in update() to stop game logic

3. PHYSICS GROUP CREATION:
   - Always use: this.physics.add.group() for dynamic groups
   - Always use: this.physics.add.staticGroup() for static groups
   - Groups will automatically have countActive() and children.iterate() methods
   - Store groups in global variables for easy access

4. GLOBAL VARIABLES:
   - Declare all game objects as global variables BEFORE the functions
   - Include UI containers: var gameOverContainer, pauseContainer;
   - Include UI elements: var scoreText, livesText, titleText;
   - Example: var player, enemies, bullets, platforms;

5. UI REQUIREMENTS:
   - Score display: Top-left corner (20, 20)
   - Lives display: Top-right corner (780, 20)
   - Game title: Top center (400, 30)
   - All UI text must have stroke for visibility
   - UI elements must have depth 100+
   - Game over screen must be centered at (400, 300)

6. ASSET LOADING:
   - Use simple asset keys without paths
   - Placeholder assets will be auto-generated by the loader
   - Focus on game logic, not asset URLs

7. PHYSICS COLLISIONS:
   - Always set up collisions in create() after creating objects
   - Use collision callbacks for game events
   - Example: this.physics.add.collider(player, enemies, hitEnemy, null, this);

8. INPUT HANDLING:
   - MUST include ESC key for pause
   - MUST include R key for restart (when game over)
   - Include clear control instructions in UI

9. OBJECT LIFECYCLE:
   - Store initial positions in create() using storeInitialPositions()
   - Reset objects properly in resetGameObjects()
   - Clear/destroy groups when restarting
   - Set proper active/visible states

10. ERROR PREVENTION:
    - Always check if objects exist before using them
    - Always bind 'this' context for callbacks
    - Use arrow functions or .bind(this) for event handlers
    - Initialize all variables before use

11. DO NOT:
    - Use class-based scenes (use function-based approach)
    - Create nested functions inside create/update
    - Use async/await or promises
    - Reference undefined variables
    - Forget to implement game over conditions
    - Skip the restart functionality

${UI_LAYOUT_GUIDELINES}
`;