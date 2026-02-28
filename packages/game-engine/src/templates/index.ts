import { GameTemplate, GameType } from '@gamevibe/shared';
import { platformerTemplate } from './platformer.js';
import { puzzleTemplate } from './puzzle.js';
import { shooterTemplate } from './shooter.js';
import { rpgTemplate } from './rpg.js';
import { endlessRunnerTemplate } from './endless-runner.js';
import { towerDefenseTemplate } from './tower-defense.js';
import { multiplayerShooterTemplate } from './multiplayer/index.js';

const templates: Record<GameType, GameTemplate> = {
  platformer: platformerTemplate,
  puzzle: puzzleTemplate,
  shooter: shooterTemplate,
  rpg: rpgTemplate,
  'endless-runner': endlessRunnerTemplate,
  'tower-defense': towerDefenseTemplate,
  other: platformerTemplate // Use platformer as generic template
};

// Multiplayer templates stored separately
const multiplayerTemplates: Record<string, GameTemplate> = {
  'multiplayer-shooter': multiplayerShooterTemplate
};

export function getTemplate(type: GameType): GameTemplate | null {
  return templates[type] || null;
}

export function getMultiplayerTemplate(templateId: string): GameTemplate | null {
  return multiplayerTemplates[templateId] || null;
}

export function getAllTemplates(): GameTemplate[] {
  return Object.values(templates);
}

export function getAllMultiplayerTemplates(): GameTemplate[] {
  return Object.values(multiplayerTemplates);
}

export * from './platformer.js';
export * from './puzzle.js';
export * from './shooter.js';
export * from './rpg.js';
export * from './endless-runner.js';
export * from './tower-defense.js';
export * from './multiplayer/index.js';