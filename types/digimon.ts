export type AffinityTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface FoodSchedule {
  /** 3 meal times as "HH:MM" in 24h format */
  meals: [string, string, string];
}

export interface DigimonPhrases {
  tier1: string[];  // 2 phrases — stranger
  tier2: string[];  // 5 phrases — acquaintance
  tier3: string[];  // 15 phrases — friendly
  tier4: string[];  // 25 phrases — close friend
  tier5: string[];  // 35 phrases — best friend
  tier6: string[];  // 40 phrases — soulmate
}

export interface DigimonData {
  agentId: string;
  digimonName: string;
  affinity: number;               // 0-100
  foodSchedule: FoodSchedule;
  lastFedDates: string[];         // ISO dates of last 3 meals today
  visualDescription: string;      // English, for fal.ai prompts
  phrases: DigimonPhrases;
  createdAt: string;
}

export type DigimonDataMap = Record<string, DigimonData>;
