import { pool } from '@/lib/db';
import { ensureApoyoTables } from '@/lib/centralized/apoyo-db';

/**
 * Tablas del sistema "Horario de Vida":
 *  - hv_task_labels: etiquetas (valores/talentos) de cada tarea. Una TAREA es una
 *    ALTERNATIVA del sistema de Apoyo (aa_solutions con status='alternative'); por eso
 *    se identifica por `alternative_id`. Antes de poder programarla, debe tener al menos
 *    una etiqueta.
 *  - hv_schedule: asignación de una tarea (alternativa) a un DÍA del horario del sujeto.
 * Nota: `value_tags`/`talent_tags` (no `values`, que es palabra reservada en Postgres).
 */
export async function ensureHorarioTables() {
  await ensureApoyoTables();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.hv_task_labels (
      alternative_id BIGINT PRIMARY KEY,
      value_tags TEXT[] NOT NULL DEFAULT '{}',
      talent_tags TEXT[] NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gcc_world.hv_schedule (
      id BIGSERIAL PRIMARY KEY,
      subject_kind TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      alternative_id BIGINT NOT NULL,
      day DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS hv_schedule_subject_idx ON gcc_world.hv_schedule (subject_kind, subject_id);
  `);
}

export interface HorarioTask {
  id: number;
  title: string;
  description: string | null;
  problems: { title: string; dimension: string | null }[];
  values: string[];   // keys de VALORES
  talents: string[];  // etiquetas de TALENTOS
}
export interface ScheduleEntry {
  id: number;
  alternativeId: number;
  day: string; // YYYY-MM-DD
}

/**
 * Tareas del sujeto = alternativas (aún no convertidas en solución) vinculadas a algún
 * problema de sus situaciones, con sus etiquetas. Más el calendario asignado.
 */
export async function getSubjectHorario(subjectKind: string, subjectId: string): Promise<{ tasks: HorarioTask[]; schedule: ScheduleEntry[] }> {
  await ensureHorarioTables();

  // Alternativas del sujeto (por sus problemas).
  const taskRows = (await pool.query(
    `SELECT DISTINCT so.id, so.title, so.description
       FROM gcc_world.aa_solutions so
       JOIN gcc_world.aa_solution_problems spr ON spr.solution_id = so.id
       JOIN gcc_world.aa_situation_problems sp ON sp.problem_id = spr.problem_id
       JOIN gcc_world.aa_situations s ON s.id = sp.situation_id
      WHERE so.status = 'alternative' AND s.subject_kind = $1 AND s.subject_id = $2
      ORDER BY so.id`,
    [subjectKind, subjectId],
  )).rows;

  const ids = taskRows.map((r: any) => Number(r.id));
  if (ids.length === 0) return { tasks: [], schedule: [] };

  // Problemas que aborda cada alternativa (contexto en la tarjeta).
  const probRows = (await pool.query(
    `SELECT DISTINCT spr.solution_id, p.title, p.dimension
       FROM gcc_world.aa_solution_problems spr
       JOIN gcc_world.aa_problems p ON p.id = spr.problem_id
       JOIN gcc_world.aa_situation_problems sp ON sp.problem_id = p.id
       JOIN gcc_world.aa_situations s ON s.id = sp.situation_id
      WHERE spr.solution_id = ANY($1::bigint[]) AND s.subject_kind = $2 AND s.subject_id = $3`,
    [ids, subjectKind, subjectId],
  )).rows;
  const probsBy = new Map<number, { title: string; dimension: string | null }[]>();
  for (const r of probRows) {
    const arr = probsBy.get(Number(r.solution_id)) || [];
    arr.push({ title: r.title, dimension: r.dimension ?? null });
    probsBy.set(Number(r.solution_id), arr);
  }

  // Etiquetas.
  const labelRows = (await pool.query(
    `SELECT alternative_id, value_tags, talent_tags FROM gcc_world.hv_task_labels WHERE alternative_id = ANY($1::bigint[])`,
    [ids],
  )).rows;
  const labelsBy = new Map<number, { values: string[]; talents: string[] }>();
  for (const r of labelRows) labelsBy.set(Number(r.alternative_id), { values: r.value_tags || [], talents: r.talent_tags || [] });

  const tasks: HorarioTask[] = taskRows.map((r: any) => {
    const l = labelsBy.get(Number(r.id)) || { values: [], talents: [] };
    return {
      id: Number(r.id),
      title: r.title,
      description: r.description ?? null,
      problems: probsBy.get(Number(r.id)) || [],
      values: l.values,
      talents: l.talents,
    };
  });

  // Calendario del sujeto (limitado a tareas todavía vigentes).
  const schedRows = (await pool.query(
    `SELECT id, alternative_id, to_char(day, 'YYYY-MM-DD') AS day
       FROM gcc_world.hv_schedule
      WHERE subject_kind = $1 AND subject_id = $2 AND alternative_id = ANY($3::bigint[])
      ORDER BY day`,
    [subjectKind, subjectId, ids],
  )).rows;
  const schedule: ScheduleEntry[] = schedRows.map((r: any) => ({ id: Number(r.id), alternativeId: Number(r.alternative_id), day: r.day }));

  return { tasks, schedule };
}

/** Fija las etiquetas (valores/talentos) de una tarea (alternativa). */
export async function setTaskLabels(alternativeId: number, values: string[], talents: string[]) {
  await ensureHorarioTables();
  await pool.query(
    `INSERT INTO gcc_world.hv_task_labels (alternative_id, value_tags, talent_tags, updated_at)
       VALUES ($1, $2, $3, NOW())
     ON CONFLICT (alternative_id) DO UPDATE SET value_tags = EXCLUDED.value_tags, talent_tags = EXCLUDED.talent_tags, updated_at = NOW()`,
    [alternativeId, values, talents],
  );
}
