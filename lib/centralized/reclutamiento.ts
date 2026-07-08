/**
 * Criterios del candidato en el sistema de Reclutamiento y Selección.
 *
 * Se muestran en 4 secciones. Los porcentajes (0–100) se llenarán A FUTURO desde un
 * sistema de evaluación (fuente aún por definir); por ahora no hay datos y se ven como
 * "sin evaluar". La forma esperada por candidato es `CandidateCriteria`.
 */

export interface TalentScore {
  name: string;
  score: number; // 0–100
}

export interface CriteriaGroup {
  [key: string]: number; // key → porcentaje 0–100
}

/** Balance de un valor: tareas completadas (positivo) vs no completadas (negativo). */
export interface ValueBalance { completed: number; failed: number; }

export interface CandidateCriteria {
  talents: TalentScore[];          // hasta 10, se ordenan de mayor a menor
  values: CriteriaGroup;           // por key de VALUE_ITEMS (compat; hoy vacío)
  valuesBalance?: { [key: string]: ValueBalance }; // barra divergente por valor
  dimensions: CriteriaGroup;       // por key de DIMENSION_ITEMS
  apoyo: CriteriaGroup;            // por key de APOYO_ITEMS
}

export interface CriterionItem { key: string; label: string; }

/** Valores que gobiernan el proyecto (9). Fuente única: `lib/centralized/valores.ts`. */
export { VALORES } from './valores';
import { VALORES } from './valores';
export const VALUE_ITEMS: CriterionItem[] = VALORES;

/** Dimensiones del candidato (4). */
export const DIMENSION_ITEMS: CriterionItem[] = [
  { key: 'mental', label: 'Mental' },
  { key: 'corporal', label: 'Corporal' },
  { key: 'social', label: 'Social' },
  { key: 'laboral', label: 'Laboral' },
];

/** Redes de apoyo del candidato (4). */
export const APOYO_ITEMS: CriterionItem[] = [
  { key: 'familia', label: 'Familia' },
  { key: 'amigos', label: 'Amigos' },
  { key: 'grupos', label: 'Grupos' },
  { key: 'clientes', label: 'Clientes' },
];

export const MAX_TALENTS = 10;

/** Talentos ordenados de mayor a menor, recortados a MAX_TALENTS. */
export function sortedTalents(talents: TalentScore[] | undefined | null): TalentScore[] {
  if (!Array.isArray(talents)) return [];
  return [...talents].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, MAX_TALENTS);
}
