import { GameTemplate } from '@gamevibe/shared';

export const rpgTemplate: GameTemplate = {
  id: 'rpg',
  name: 'RPG',
  type: 'rpg',
  structure: `
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }
  
  preload() {
    // Load assets
  }
  
  create() {
    // Create game objects
    this.add.text(400, 300, 'RPG Game Template', {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);
  }
  
  update() {
    // Game logic
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  scene: GameScene
};

const game = new Phaser.Game(config);`,
  sections: {}
};