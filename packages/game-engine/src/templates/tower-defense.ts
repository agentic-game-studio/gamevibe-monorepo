import { GameTemplate } from '@gamevibe/shared';

export const towerDefenseTemplate: GameTemplate = {
  id: 'tower-defense',
  name: 'Tower Defense',
  type: 'tower-defense',
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
    this.add.text(400, 300, 'Tower Defense Template', {
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