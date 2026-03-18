import fs from 'fs/promises';
import path from 'path';
import type { DigimonData, DigimonDataMap, AffinityTier, DigimonPhrases } from '@/types/digimon';

const DATA_PATH = path.join(process.cwd(), 'data', 'digimon-data.json');

export async function readDigimonData(): Promise<DigimonDataMap> {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function writeDigimonData(data: DigimonDataMap): Promise<void> {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2));
}

export async function getDigimonEntry(agentId: string): Promise<DigimonData | null> {
  const all = await readDigimonData();
  return all[agentId] ?? null;
}

export async function setDigimonEntry(agentId: string, entry: DigimonData): Promise<void> {
  const all = await readDigimonData();
  all[agentId] = entry;
  await writeDigimonData(all);
}

/** Generate 3 random meal times in breakfast/lunch/dinner windows */
export function generateFoodSchedule(): [string, string, string] {
  const randInRange = (min: number, max: number) => {
    const h = min + Math.floor(Math.random() * (max - min));
    const m = Math.floor(Math.random() * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  return [
    randInRange(7, 10),   // breakfast: 7:00-9:59
    randInRange(12, 15),  // lunch:     12:00-14:59
    randInRange(18, 21),  // dinner:    18:00-20:59
  ];
}

export function getAffinityTier(affinity: number): AffinityTier {
  if (affinity >= 90) return 6;
  if (affinity >= 70) return 5;
  if (affinity >= 50) return 4;
  if (affinity >= 30) return 3;
  if (affinity >= 10) return 2;
  return 1;
}

/** Get all available phrases up to the current tier */
export function getAvailablePhrases(phrases: DigimonPhrases, tier: AffinityTier): string[] {
  const all: string[] = [...phrases.tier1];
  if (tier >= 2) all.push(...phrases.tier2);
  if (tier >= 3) all.push(...phrases.tier3);
  if (tier >= 4) all.push(...phrases.tier4);
  if (tier >= 5) all.push(...phrases.tier5);
  if (tier >= 6) all.push(...phrases.tier6);
  return all;
}

/** Check if a meal is within its 3-hour window */
export function isMealWindowOpen(mealTime: string, now: Date): boolean {
  const [h, m] = mealTime.split(':').map(Number);
  const mealMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diff = nowMinutes - mealMinutes;
  return diff >= 0 && diff < 180; // 3-hour window
}

/** Get today's date string as YYYY-MM-DD */
export function todayString(): string {
  return new Date().toISOString().split('T')[0];
}
