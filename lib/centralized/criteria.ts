import { getDimensionProblemLoads } from '@/lib/centralized/apoyo-db';
import { getSubjectsProfileScores } from '@/lib/centralized/horario-db';
import type { CandidateCriteria } from '@/lib/centralized/reclutamiento';

/**
 * Criterios de desarrollo calculados de un conjunto de sujetos (candidatos o miembros):
 *  - Dimensiones: carga de problemas por dimensión (Apoyo y Autoayuda).
 *  - Talento y Valores: cumplimiento de tareas del Horario de Vida (± por etiqueta).
 * `apoyo` sigue pendiente de fuente de datos. Devuelve null si el sujeto no tiene datos.
 */
export async function getSubjectsCriteria(subjectKind: string, subjectIds: string[]): Promise<Record<string, CandidateCriteria | null>> {
  const out: Record<string, CandidateCriteria | null> = {};
  if (subjectIds.length === 0) return out;
  const [loads, scores] = await Promise.all([
    getDimensionProblemLoads(subjectKind, subjectIds),
    getSubjectsProfileScores(subjectKind, subjectIds),
  ]);
  for (const id of subjectIds) {
    const dims = loads[id];
    const sc = scores[id];
    out[id] = (dims || sc)
      ? { talents: sc?.talents || [], values: {}, valuesBalance: sc?.valuesBalance || {}, dimensions: dims || {}, apoyo: {} }
      : null;
  }
  return out;
}
