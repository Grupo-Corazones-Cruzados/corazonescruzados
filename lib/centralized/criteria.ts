import { getDimensionProblemLoads } from '@/lib/centralized/apoyo-db';
import { getSubjectsProfileScores } from '@/lib/centralized/horario-db';
import { getAssessments } from '@/lib/centralized/valoraciones-db';
import type { CandidateCriteria } from '@/lib/centralized/reclutamiento';

/**
 * Criterios de desarrollo calculados de un conjunto de sujetos (candidatos o miembros):
 *  - Dimensiones: carga de problemas por dimensión (Apoyo y Autoayuda).
 *  - Talento y Valores: cumplimiento de tareas del Horario de Vida (± por etiqueta).
 *  - Valoración: puntos ABSOLUTOS asignados a mano desde "Gestión Social · Recursos".
 * `apoyo` sigue pendiente de fuente de datos. Devuelve null si el sujeto no tiene datos.
 *
 * La valoración viaja SEPARADA (`assessment`) y nunca se suma al conteo ±1 de tareas: son
 * magnitudes distintas (un % derivado de tareas frente a puntos que pone una persona).
 */
export async function getSubjectsCriteria(subjectKind: string, subjectIds: string[]): Promise<Record<string, CandidateCriteria | null>> {
  const out: Record<string, CandidateCriteria | null> = {};
  if (subjectIds.length === 0) return out;
  const [loads, scores, assessments] = await Promise.all([
    getDimensionProblemLoads(subjectKind, subjectIds),
    getSubjectsProfileScores(subjectKind, subjectIds),
    getAssessments(subjectKind, subjectIds),
  ]);
  for (const id of subjectIds) {
    const dims = loads[id];
    const sc = scores[id];
    const as = assessments[id];
    out[id] = (dims || sc || as)
      ? {
          talents: sc?.talents || [], values: {}, valuesBalance: sc?.valuesBalance || {},
          dimensions: dims || {}, apoyo: {},
          assessment: as,
        }
      : null;
  }
  return out;
}
