import fs from 'fs/promises';
import path from 'path';
import type { WorldConfig, ValidationResult } from '@/types/world';
import { getCitizensDir, getWorldDir } from './world';

export async function validateWorldConfig(config: WorldConfig): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const citizensDir = getCitizensDir();
  const worldDir = getWorldDir();

  // Check each citizen has matching sprites
  for (const citizen of config.citizens) {
    try {
      await fs.access(path.join(citizensDir, `${citizen.sprite}_walk.png`));
    } catch {
      errors.push(`Citizen "${citizen.name}" missing walk sprite: ${citizen.sprite}_walk.png`);
    }
    try {
      await fs.access(path.join(citizensDir, `${citizen.sprite}_actions.png`));
    } catch {
      warnings.push(`Citizen "${citizen.name}" missing actions sprite: ${citizen.sprite}_actions.png`);
    }
  }

  // Check citizens ↔ characters sync
  for (const citizen of config.citizens) {
    if (!config.characters[citizen.agentId]) {
      errors.push(`Citizen "${citizen.name}" (${citizen.agentId}) not found in characters map`);
    }
  }
  for (const agentId of Object.keys(config.characters)) {
    if (!config.citizens.find(c => c.agentId === agentId)) {
      errors.push(`Character "${agentId}" exists in characters map but not in citizens array`);
    }
  }

  // Check position references point to valid anchors
  const allAnchors = config.props.flatMap(p => (p.anchors || []).map(a => a.name));
  for (const citizen of config.citizens) {
    if (!allAnchors.includes(citizen.position)) {
      errors.push(`Citizen "${citizen.name}" references unknown anchor: ${citizen.position}`);
    }
  }

  // Check floor tile references
  const tileIds = Object.keys(config.tiles);
  for (let r = 0; r < config.floor.length; r++) {
    for (let c = 0; c < config.floor[r].length; c++) {
      if (!tileIds.includes(config.floor[r][c])) {
        errors.push(`Floor[${r}][${c}] references unknown tile: ${config.floor[r][c]}`);
      }
    }
  }

  // Check prop images exist
  for (const prop of config.props) {
    if (!config.propImages[prop.id]) {
      errors.push(`Prop instance "${prop.id}" has no image in propImages`);
    }
  }
  for (const [id, relativePath] of Object.entries(config.propImages)) {
    try {
      await fs.access(path.join(worldDir, relativePath));
    } catch {
      errors.push(`Prop image file missing: ${relativePath} (for "${id}")`);
    }
  }

  // Check tile files exist
  for (const [id, relativePath] of Object.entries(config.tiles)) {
    try {
      await fs.access(path.join(worldDir, relativePath));
    } catch {
      errors.push(`Tile file missing: ${relativePath} (for "${id}")`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
