// GameVibe AI Remix Templates Service
// Provides predefined modification templates for easy remixing

import { GameType, RemixType } from '../generated/prisma/index.js';
import { GameModification } from './game-remix.js';

export interface ModificationTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;
  modifications: GameModification[];
  gameTypes: GameType[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export class RemixTemplatesService {
  /**
   * Get all available modification templates
   */
  static getModificationTemplates(): ModificationTemplate[] {
    return [
      // Style Templates
      {
        id: 'neon_style',
        name: 'Neon Cyberpunk',
        description: 'Transform your game with glowing neon colors and cyberpunk aesthetics',
        emoji: '🌈',
        modifications: [
          {
            type: 'style',
            description: 'Applied neon cyberpunk color scheme with glowing effects',
            newValue: {
              colorScheme: {
                primary: '0x00ffff',
                secondary: '0xff00ff',
                background: '0x0a0a0a',
                accent: '0x00ff00'
              },
              effects: ['glow', 'neon', 'scan_lines']
            }
          }
        ],
        gameTypes: ['PLATFORMER', 'SHOOTER', 'ENDLESS_RUNNER'],
        difficulty: 'easy'
      },
      {
        id: 'retro_pixel',
        name: 'Retro Pixel Art',
        description: 'Classic 8-bit pixel art style with vintage colors',
        emoji: '👾',
        modifications: [
          {
            type: 'style',
            description: 'Applied retro pixel art styling with classic game colors',
            newValue: {
              colorScheme: {
                primary: '0x8b4513',
                secondary: '0x228b22',
                background: '0x87ceeb',
                accent: '0xffd700'
              },
              pixelated: true,
              scanLines: true
            }
          }
        ],
        gameTypes: ['PLATFORMER', 'PUZZLE', 'SHOOTER'],
        difficulty: 'easy'
      },
      {
        id: 'pastel_cute',
        name: 'Pastel Kawaii',
        description: 'Soft pastel colors with cute, friendly aesthetics',
        emoji: '🌸',
        modifications: [
          {
            type: 'style',
            description: 'Applied cute pastel color scheme with soft aesthetics',
            newValue: {
              colorScheme: {
                primary: '0xffb6c1',
                secondary: '0x98fb98',
                background: '0xf0f8ff',
                accent: '0xdda0dd'
              },
              rounded: true,
              particles: 'hearts'
            }
          }
        ],
        gameTypes: ['PUZZLE', 'PLATFORMER', 'ENDLESS_RUNNER'],
        difficulty: 'easy'
      },

      // Mechanics Templates
      {
        id: 'speed_demon',
        name: 'Speed Demon',
        description: 'Increase movement speed and make everything faster',
        emoji: '⚡',
        modifications: [
          {
            type: 'mechanics',
            description: 'Increased movement speed by 50% for fast-paced gameplay',
            oldValue: { speed: 200 },
            newValue: { speed: 300 }
          }
        ],
        gameTypes: ['PLATFORMER', 'ENDLESS_RUNNER', 'SHOOTER'],
        difficulty: 'medium'
      },
      {
        id: 'floaty_jumps',
        name: 'Moon Gravity',
        description: 'Reduce gravity for floaty, moon-like jumping',
        emoji: '🌙',
        modifications: [
          {
            type: 'mechanics',
            description: 'Reduced gravity by 40% for floaty jumping mechanics',
            oldValue: { gravity: 800, jumpHeight: 350 },
            newValue: { gravity: 480, jumpHeight: 450 }
          }
        ],
        gameTypes: ['PLATFORMER'],
        difficulty: 'medium'
      },
      {
        id: 'precision_mode',
        name: 'Precision Challenge',
        description: 'Increase precision requirements and reduce margin for error',
        emoji: '🎯',
        modifications: [
          {
            type: 'mechanics',
            description: 'Increased precision requirements and reduced player size',
            newValue: {
              playerSize: 0.8,
              hitboxPrecision: 'high',
              movementPrecision: 'high'
            }
          }
        ],
        gameTypes: ['PLATFORMER', 'PUZZLE'],
        difficulty: 'hard'
      },

      // Theme Templates
      {
        id: 'space_adventure',
        name: 'Space Adventure',
        description: 'Transform the setting to outer space with cosmic themes',
        emoji: '🚀',
        modifications: [
          {
            type: 'theme',
            description: 'Transformed setting to outer space with cosmic elements',
            newValue: {
              theme: 'space',
              background: 'starfield',
              music: 'ambient_space',
              enemies: 'aliens',
              collectibles: 'crystals'
            }
          }
        ],
        gameTypes: ['PLATFORMER', 'SHOOTER', 'ENDLESS_RUNNER'],
        difficulty: 'easy'
      },
      {
        id: 'underwater_world',
        name: 'Underwater World',
        description: 'Dive deep into an underwater adventure',
        emoji: '🌊',
        modifications: [
          {
            type: 'theme',
            description: 'Created underwater world with aquatic themes',
            newValue: {
              theme: 'underwater',
              physics: 'water',
              background: 'ocean_depths',
              enemies: 'sea_creatures',
              effects: ['bubbles', 'currents']
            }
          }
        ],
        gameTypes: ['PLATFORMER', 'ENDLESS_RUNNER'],
        difficulty: 'medium'
      },
      {
        id: 'medieval_fantasy',
        name: 'Medieval Fantasy',
        description: 'Enter a world of knights, castles, and magic',
        emoji: '⚔️',
        modifications: [
          {
            type: 'theme',
            description: 'Transformed into medieval fantasy setting',
            newValue: {
              theme: 'medieval',
              setting: 'castle',
              enemies: 'monsters',
              weapons: 'sword',
              magic: true
            }
          }
        ],
        gameTypes: ['PLATFORMER', 'RPG', 'SHOOTER'],
        difficulty: 'easy'
      },

      // Difficulty Templates
      {
        id: 'casual_mode',
        name: 'Casual Mode',
        description: 'Make the game more relaxed and accessible',
        emoji: '😊',
        modifications: [
          {
            type: 'difficulty',
            description: 'Reduced difficulty for casual, relaxed gameplay',
            newValue: {
              difficulty: 'easy',
              enemySpeed: 0.7,
              enemyDamage: 0.5,
              playerHealth: 1.5,
              checkpoints: 'frequent'
            }
          }
        ],
        gameTypes: ['PLATFORMER', 'SHOOTER', 'PUZZLE'],
        difficulty: 'easy'
      },
      {
        id: 'nightmare_mode',
        name: 'Nightmare Mode',
        description: 'Ultimate challenge for hardcore gamers',
        emoji: '💀',
        modifications: [
          {
            type: 'difficulty',
            description: 'Extreme difficulty for hardcore challenge',
            newValue: {
              difficulty: 'nightmare',
              enemySpeed: 1.5,
              enemyDamage: 2.0,
              playerHealth: 0.5,
              checkpoints: 'rare',
              permadeath: true
            }
          }
        ],
        gameTypes: ['PLATFORMER', 'SHOOTER', 'ENDLESS_RUNNER'],
        difficulty: 'hard'
      },
      {
        id: 'time_pressure',
        name: 'Time Attack',
        description: 'Add time limits and speed challenges',
        emoji: '⏰',
        modifications: [
          {
            type: 'difficulty',
            description: 'Added time pressure and speed challenges',
            newValue: {
              timeLimit: true,
              timerVisible: true,
              speedBonus: true,
              timeAttack: true
            }
          }
        ],
        gameTypes: ['PLATFORMER', 'PUZZLE', 'ENDLESS_RUNNER'],
        difficulty: 'medium'
      },

      // Combination Templates
      {
        id: 'psychedelic_chaos',
        name: 'Psychedelic Chaos',
        description: 'Wild colors, crazy physics, and unpredictable gameplay',
        emoji: '🌀',
        modifications: [
          {
            type: 'style',
            description: 'Applied psychedelic visual effects',
            newValue: {
              colorScheme: { rotating: true, rainbow: true },
              effects: ['color_shift', 'screen_shake', 'kaleidoscope']
            }
          },
          {
            type: 'mechanics',
            description: 'Added chaotic physics and random effects',
            newValue: {
              gravity: 'variable',
              physics: 'chaotic',
              randomEvents: true
            }
          }
        ],
        gameTypes: ['PLATFORMER', 'ENDLESS_RUNNER'],
        difficulty: 'hard'
      },
      {
        id: 'minimalist_zen',
        name: 'Minimalist Zen',
        description: 'Clean, simple design focused on pure gameplay',
        emoji: '⚪',
        modifications: [
          {
            type: 'style',
            description: 'Applied minimalist design with clean aesthetics',
            newValue: {
              colorScheme: {
                primary: '0x000000',
                secondary: '0xffffff',
                background: '0xf5f5f5'
              },
              minimal: true,
              noise: false
            }
          },
          {
            type: 'theme',
            description: 'Removed decorative elements for pure focus',
            newValue: {
              decorations: false,
              particles: false,
              sounds: 'minimal'
            }
          }
        ],
        gameTypes: ['PUZZLE', 'PLATFORMER'],
        difficulty: 'easy'
      }
    ];
  }

  /**
   * Get templates suitable for a specific game type
   */
  static getTemplatesForGameType(gameType: GameType): ModificationTemplate[] {
    return this.getModificationTemplates().filter(template => 
      template.gameTypes.includes(gameType)
    );
  }

  /**
   * Get templates by difficulty
   */
  static getTemplatesByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): ModificationTemplate[] {
    return this.getModificationTemplates().filter(template => 
      template.difficulty === difficulty
    );
  }

  /**
   * Get template by ID
   */
  static getTemplateById(id: string): ModificationTemplate | undefined {
    return this.getModificationTemplates().find(template => template.id === id);
  }

  /**
   * Get random templates
   */
  static getRandomTemplates(count: number = 5): ModificationTemplate[] {
    const templates = this.getModificationTemplates();
    const shuffled = templates.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Search templates by name or description
   */
  static searchTemplates(query: string): ModificationTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.getModificationTemplates().filter(template =>
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery)
    );
  }
}