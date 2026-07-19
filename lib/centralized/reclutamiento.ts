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

/**
 * VALORACIÓN GLOBAL asignada a mano desde "Gestión Social · Recursos" tras leer los
 * pensamientos del sujeto. Puntos ABSOLUTOS que REEMPLAZAN (hoy 5, mañana 3 → vale 3).
 * Va SEPARADA de `talents`/`valuesBalance`, que se derivan del cumplimiento de tareas (±1):
 * un porcentaje de tareas cumplidas y unos puntos que pone una persona no son sumables.
 */
export interface AssessmentScores {
  talents: { itemKey: string; points: number }[];
  values: { itemKey: string; points: number }[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface CandidateCriteria {
  talents: TalentScore[];          // hasta 10, se ordenan de mayor a menor
  values: CriteriaGroup;           // por key de VALUE_ITEMS (compat; hoy vacío)
  valuesBalance?: { [key: string]: ValueBalance }; // barra divergente por valor
  dimensions: CriteriaGroup;       // por key de DIMENSION_ITEMS
  apoyo: CriteriaGroup;            // por key de APOYO_ITEMS
  /** Valoración manual de Gestión Social. No se mezcla con lo anterior. */
  assessment?: AssessmentScores;
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
