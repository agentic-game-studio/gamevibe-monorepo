import { GameTemplate } from '@gamevibe/shared';

export const puzzleTemplate: GameTemplate = {
  id: 'puzzle',
  name: 'Puzzle',
  type: 'puzzle',
  structure: `
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.score = 0;
    this.moves = 0;
    this.gameOver = false;
    this.gridSize = 8;
    this.tileSize = 64;
  }
  
  preload() {
    {{ASSET_LOADING}}
  }
  
  create() {
    {{WORLD_SETUP}}
    
    {{GRID_SETUP}}
    
    {{UI_SETUP}}
    
    {{INPUT_SETUP}}
    
    {{ANIMATION_SETUP}}
  }
  
  update(time, delta) {
    {{UPDATE_LOGIC}}
  }
  
  {{HELPER_METHODS}}
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#2d2d2d',
  scene: GameScene
};

const game = new Phaser.Game(config);`,

  sections: {
    ASSET_LOADING: `
    // Create colored gem assets
    this.load.image('gem1', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    this.load.image('gem2', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    this.load.image('gem3', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    this.load.image('gem4', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    this.load.image('gem5', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');`,
    
    WORLD_SETUP: `
    // Create background
    this.add.rectangle(400, 300, 800, 600, 0x1a1a1a);
    
    // Create board background
    const boardX = 400 - (this.gridSize * this.tileSize) / 2;
    const boardY = 300 - (this.gridSize * this.tileSize) / 2;
    this.add.rectangle(400, 300, this.gridSize * this.tileSize + 20, this.gridSize * this.tileSize + 20, 0x333333);`,
    
    GRID_SETUP: `
    // Initialize grid
    this.grid = [];
    this.gems = this.add.group();
    
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
    const gemTypes = ['gem1', 'gem2', 'gem3', 'gem4', 'gem5'];
    
    // Create grid
    const startX = 400 - (this.gridSize * this.tileSize) / 2 + this.tileSize / 2;
    const startY = 300 - (this.gridSize * this.tileSize) / 2 + this.tileSize / 2;
    
    for (let row = 0; row < this.gridSize; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.gridSize; col++) {
        const x = startX + col * this.tileSize;
        const y = startY + row * this.tileSize;
        
        // Create random gem
        const gemType = Phaser.Math.Between(0, 4);
        const gem = this.add.sprite(x, y, gemTypes[gemType]);
        gem.setScale(48, 48);
        gem.setTint(colors[gemType]);
        gem.setInteractive();
        
        // Store gem data
        gem.gridX = col;
        gem.gridY = row;
        gem.gemType = gemType;
        
        this.gems.add(gem);
        this.grid[row][col] = gem;
      }
    }
    
    this.selectedGem = null;
    this.isProcessing = false;`,
    
    UI_SETUP: `
    // Score display
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '32px',
      color: '#ffffff'
    });
    
    // Moves display
    this.movesText = this.add.text(16, 56, 'Moves: 0', {
      fontSize: '24px',
      color: '#ffffff'
    });
    
    // Instructions
    this.add.text(400, 550, 'Click gems to swap and match 3 or more!', {
      fontSize: '20px',
      color: '#cccccc'
    }).setOrigin(0.5);`,
    
    INPUT_SETUP: `
    // Handle gem selection
    this.input.on('gameobjectdown', this.selectGem, this);`,
    
    ANIMATION_SETUP: `
    // Selection indicator
    this.selectionBox = this.add.rectangle(0, 0, this.tileSize, this.tileSize);
    this.selectionBox.setStrokeStyle(4, 0xffffff);
    this.selectionBox.setVisible(false);`,
    
    UPDATE_LOGIC: `
    // Update selection box position
    if (this.selectedGem && this.selectionBox.visible) {
      this.selectionBox.x = this.selectedGem.x;
      this.selectionBox.y = this.selectedGem.y;
    }`,
    
    HELPER_METHODS: `
  selectGem(pointer, gem) {
    if (this.isProcessing || this.gameOver) return;
    
    if (!this.selectedGem) {
      // First selection
      this.selectedGem = gem;
      this.selectionBox.setVisible(true);
      this.selectionBox.x = gem.x;
      this.selectionBox.y = gem.y;
    } else {
      // Second selection
      const dx = Math.abs(gem.gridX - this.selectedGem.gridX);
      const dy = Math.abs(gem.gridY - this.selectedGem.gridY);
      
      // Check if adjacent
      if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        this.swapGems(this.selectedGem, gem);
      }
      
      // Reset selection
      this.selectedGem = null;
      this.selectionBox.setVisible(false);
    }
  }
  
  swapGems(gem1, gem2) {
    this.isProcessing = true;
    this.moves++;
    this.movesText.setText('Moves: ' + this.moves);
    
    // Swap positions in grid
    const tempX = gem1.gridX;
    const tempY = gem1.gridY;
    gem1.gridX = gem2.gridX;
    gem1.gridY = gem2.gridY;
    gem2.gridX = tempX;
    gem2.gridY = tempY;
    
    // Update grid array
    this.grid[gem1.gridY][gem1.gridX] = gem1;
    this.grid[gem2.gridY][gem2.gridX] = gem2;
    
    // Animate swap
    const tempPosX = gem1.x;
    const tempPosY = gem1.y;
    
    this.tweens.add({
      targets: gem1,
      x: gem2.x,
      y: gem2.y,
      duration: 300,
      ease: 'Power2'
    });
    
    this.tweens.add({
      targets: gem2,
      x: tempPosX,
      y: tempPosY,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        // Check for matches after swap
        const matches = this.checkMatches();
        if (matches.length > 0) {
          this.removeMatches(matches);
        } else {
          // Swap back if no matches
          this.swapGems(gem1, gem2);
        }
        this.isProcessing = false;
      }
    });
  }
  
  checkMatches() {
    const matches = [];
    
    // Check horizontal matches
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize - 2; col++) {
        const gem1 = this.grid[row][col];
        const gem2 = this.grid[row][col + 1];
        const gem3 = this.grid[row][col + 2];
        
        if (gem1 && gem2 && gem3 && 
            gem1.gemType === gem2.gemType && 
            gem2.gemType === gem3.gemType) {
          matches.push(gem1, gem2, gem3);
        }
      }
    }
    
    // Check vertical matches
    for (let col = 0; col < this.gridSize; col++) {
      for (let row = 0; row < this.gridSize - 2; row++) {
        const gem1 = this.grid[row][col];
        const gem2 = this.grid[row + 1][col];
        const gem3 = this.grid[row + 2][col];
        
        if (gem1 && gem2 && gem3 && 
            gem1.gemType === gem2.gemType && 
            gem2.gemType === gem3.gemType) {
          if (!matches.includes(gem1)) matches.push(gem1);
          if (!matches.includes(gem2)) matches.push(gem2);
          if (!matches.includes(gem3)) matches.push(gem3);
        }
      }
    }
    
    return matches;
  }
  
  removeMatches(matches) {
    // Score points
    this.score += matches.length * 10;
    this.scoreText.setText('Score: ' + this.score);
    
    // Remove matched gems
    matches.forEach(gem => {
      // Particle effect
      for (let i = 0; i < 5; i++) {
        const particle = this.add.circle(
          gem.x + Phaser.Math.Between(-10, 10),
          gem.y + Phaser.Math.Between(-10, 10),
          4,
          gem.tintTopLeft
        );
        
        this.tweens.add({
          targets: particle,
          x: particle.x + Phaser.Math.Between(-50, 50),
          y: particle.y + Phaser.Math.Between(-50, 50),
          alpha: 0,
          duration: 500,
          onComplete: () => particle.destroy()
        });
      }
      
      // Remove gem
      this.grid[gem.gridY][gem.gridX] = null;
      gem.destroy();
    });
    
    // Drop gems and refill
    this.time.delayedCall(500, () => {
      this.dropGems();
      this.fillGrid();
    });
  }
  
  dropGems() {
    // Simple drop logic - gems fall down to fill empty spaces
    for (let col = 0; col < this.gridSize; col++) {
      for (let row = this.gridSize - 1; row >= 0; row--) {
        if (!this.grid[row][col]) {
          // Find gem above
          for (let searchRow = row - 1; searchRow >= 0; searchRow--) {
            if (this.grid[searchRow][col]) {
              // Move gem down
              const gem = this.grid[searchRow][col];
              this.grid[row][col] = gem;
              this.grid[searchRow][col] = null;
              gem.gridY = row;
              
              // Animate drop
              this.tweens.add({
                targets: gem,
                y: gem.y + (row - searchRow) * this.tileSize,
                duration: 300,
                ease: 'Bounce'
              });
              break;
            }
          }
        }
      }
    }
  }
  
  fillGrid() {
    // Fill empty spots with new gems
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
    const gemTypes = ['gem1', 'gem2', 'gem3', 'gem4', 'gem5'];
    const startX = 400 - (this.gridSize * this.tileSize) / 2 + this.tileSize / 2;
    const startY = 300 - (this.gridSize * this.tileSize) / 2 + this.tileSize / 2;
    
    for (let col = 0; col < this.gridSize; col++) {
      for (let row = 0; row < this.gridSize; row++) {
        if (!this.grid[row][col]) {
          const x = startX + col * this.tileSize;
          const y = startY + row * this.tileSize;
          
          const gemType = Phaser.Math.Between(0, 4);
          const gem = this.add.sprite(x, y - 400, gemTypes[gemType]);
          gem.setScale(48, 48);
          gem.setTint(colors[gemType]);
          gem.setInteractive();
          
          gem.gridX = col;
          gem.gridY = row;
          gem.gemType = gemType;
          
          this.gems.add(gem);
          this.grid[row][col] = gem;
          
          // Animate fall
          this.tweens.add({
            targets: gem,
            y: y,
            duration: 500,
            ease: 'Bounce',
            delay: row * 50
          });
        }
      }
    }
    
    // Check for new matches after filling
    this.time.delayedCall(600, () => {
      const newMatches = this.checkMatches();
      if (newMatches.length > 0) {
        this.removeMatches(newMatches);
      }
    });
  }`
  }
};