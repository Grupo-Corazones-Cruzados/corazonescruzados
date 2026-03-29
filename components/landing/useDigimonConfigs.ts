'use client';

import { useEffect, useState } from 'react';

export interface DigimonConfig {
  name: string;
  sprite: string;
  /** Walk sprite URL via /api/assets/ (same source as world viewer) */
  walkSrc: string;
  /** Done sprite URL */
  doneSrc: string;
  /** true = art faces right, flip for left. false = art faces left, flip for right */
  flipWalk: boolean;
  /** Which frame columns to use for walk animation */
  walkFrames: number[];
  /** Which frame columns to use for done animation */
  doneFrames: number[];
  /** Columns in the walk sprite sheet (default 4) */
  sheetCols: number;
  /** Rows in the walk sprite sheet (default 4) */
  sheetRows: number;
  /** Which row is the walk animation (default 2) */
  walkRow: number;
}

const MESSAGES: Record<string, string> = {
  Agumon: 'Hola! Bienvenido!',
  Gabumon: 'Que bueno verte!',
  Patamon: 'Explora con nosotros!',
  Veemon: 'Vamos a digievolucionar!',
  Gomamon: 'El mar digital te espera!',
  Piyomon: 'Volemos juntos!',
  Shoutmon: 'ROCK AND ROLL!',
  Palmon: 'Creciendo contigo!',
  Guilmon: 'Tienes pan?',
};

let cached: DigimonConfig[] | null = null;
let fetchPromise: Promise<DigimonConfig[]> | null = null;

function fetchConfigs(): Promise<DigimonConfig[]> {
  if (cached) return Promise.resolve(cached);
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/world')
    .then(r => r.json())
    .then(data => {
      const citizens: any[] = data.citizens || [];
      cached = citizens.map(c => ({
        name: c.name,
        sprite: c.sprite,
        walkSrc: `/api/assets/universal_assets/citizens/${c.sprite}_walk.png`,
        doneSrc: `/api/assets/universal_assets/citizens/${c.sprite}_done.png`,
        flipWalk: c.flipWalk ?? true,
        walkFrames: c.frameConfig?.walk || [0, 1, 2, 3],
        doneFrames: c.frameConfig?.done || [0, 1, 2, 3],
        sheetCols: c.walkSheetCols ?? 4,
        sheetRows: c.walkSheetRows ?? 4,
        walkRow: c.walkRow ?? 2,
      }));
      return cached;
    })
    .catch(() => {
      cached = [];
      return cached;
    });

  return fetchPromise;
}

export function getDigimonMessage(name: string): string {
  return MESSAGES[name] || 'Hola!';
}

export default function useDigimonConfigs(): DigimonConfig[] {
  const [configs, setConfigs] = useState<DigimonConfig[]>(cached || []);

  useEffect(() => {
    fetchConfigs().then(setConfigs);
  }, []);

  return configs;
}
