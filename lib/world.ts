import fs from 'fs/promises';
import path from 'path';
import type { WorldConfig } from '@/types/world';

const PROJECT_PATH = process.env.WORLD_PROJECT_PATH || '';
const WORLD_ID = process.env.WORLD_ID || 'a-digiworld-like-the-digimon-g';

export function getProjectPath() {
  return PROJECT_PATH;
}

export function getWorldDir() {
  return path.join(PROJECT_PATH, 'public', 'worlds', WORLD_ID);
}

export function getCitizensDir() {
  return path.join(PROJECT_PATH, 'public', 'universal_assets', 'citizens');
}

export function getWorldId() {
  return WORLD_ID;
}

// Read world.json
export async function readWorldConfig(): Promise<WorldConfig> {
  const filePath = path.join(getWorldDir(), 'world.json');
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

// Write world.json with backup
export async function writeWorldConfig(config: WorldConfig): Promise<void> {
  const filePath = path.join(getWorldDir(), 'world.json');
  const backupPath = filePath + '.backup';
  try {
    await fs.copyFile(filePath, backupPath);
  } catch {
    // Backup may not exist on first write
  }
  await fs.writeFile(filePath, JSON.stringify(config, null, 2) + '\n');
}

// Register or update a citizen in world.json
export async function registerCitizen(citizen: WorldConfig['citizens'][number]): Promise<WorldConfig> {
  const config = await readWorldConfig();
  if (!config.citizens) config.citizens = [];
  const idx = config.citizens.findIndex((c) => c.agentId === citizen.agentId);
  if (idx >= 0) {
    config.citizens[idx] = citizen;
  } else {
    config.citizens.push(citizen);
  }
  await writeWorldConfig(config);
  return config;
}

// Update a specific section of world.json
export async function updateWorldSection<K extends keyof WorldConfig>(
  key: K,
  value: WorldConfig[K]
): Promise<WorldConfig> {
  const config = await readWorldConfig();
  config[key] = value;
  await writeWorldConfig(config);
  return config;
}
