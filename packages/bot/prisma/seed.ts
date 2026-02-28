import { PrismaClient, GameType } from '../src/generated/prisma.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create game templates
  const platformerTemplate = await prisma.gameTemplate.upsert({
    where: { id: 'platformer-basic' },
    update: {},
    create: {
      id: 'platformer-basic',
      name: 'Basic Platformer',
      type: GameType.PLATFORMER,
      structure: `
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // {{ASSETS}}
  }

  create() {
    // {{WORLD_SETUP}}
    // {{PLAYER_SETUP}}
    // {{ENEMIES_SETUP}}
    // {{UI_SETUP}}
  }

  update() {
    // {{GAME_LOGIC}}
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 500 },
      debug: false
    }
  },
  scene: GameScene
};

const game = new Phaser.Game(config);
      `,
      sections: {
        'ASSETS': 'Asset loading section',
        'WORLD_SETUP': 'World and platform setup',
        'PLAYER_SETUP': 'Player character setup',
        'ENEMIES_SETUP': 'Enemy setup',
        'UI_SETUP': 'User interface setup',
        'GAME_LOGIC': 'Game logic and collision detection'
      },
      defaultAssets: [
        'player-sprite',
        'platform-tiles',
        'background',
        'collectible-items'
      ]
    }
  });

  const puzzleTemplate = await prisma.gameTemplate.upsert({
    where: { id: 'puzzle-basic' },
    update: {},
    create: {
      id: 'puzzle-basic',
      name: 'Basic Puzzle',
      type: GameType.PUZZLE,
      structure: `
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // {{ASSETS}}
  }

  create() {
    // {{GRID_SETUP}}
    // {{PUZZLE_PIECES}}
    // {{INPUT_HANDLING}}
    // {{UI_SETUP}}
  }

  update() {
    // {{PUZZLE_LOGIC}}
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  scene: GameScene
};

const game = new Phaser.Game(config);
      `,
      sections: {
        'ASSETS': 'Asset loading section',
        'GRID_SETUP': 'Puzzle grid setup',
        'PUZZLE_PIECES': 'Puzzle pieces setup',
        'INPUT_HANDLING': 'Mouse/touch input handling',
        'UI_SETUP': 'User interface setup',
        'PUZZLE_LOGIC': 'Puzzle solving logic'
      },
      defaultAssets: [
        'puzzle-pieces',
        'grid-background',
        'ui-elements'
      ]
    }
  });

  console.log('Created game templates:', {
    platformer: platformerTemplate.id,
    puzzle: puzzleTemplate.id
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });