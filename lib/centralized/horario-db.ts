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
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS hv_schedule_subject_idx ON gcc_world.hv_schedule (subject_kind, subject_id);
  `);
  // Para instalaciones previas de hv_schedule sin la columna.
  await pool.query(`ALTER TABLE gcc_world.hv_schedule ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE`);
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
  completed: boolean;
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
    `SELECT id, alternative_id, to_char(day, 'YYYY-MM-DD') AS day, completed
       FROM gcc_world.hv_schedule
      WHERE subject_kind = $1 AND subject_id = $2 AND alternative_id = ANY($3::bigint[])
      ORDER BY day`,
    [subjectKind, subjectId, ids],
  )).rows;
  const schedule: ScheduleEntry[] = schedRows.map((r: any) => ({ id: Number(r.id), alternativeId: Number(r.alternative_id), day: r.day, completed: r.completed === true }));

  return { tasks, schedule };
}

export interface ProfileScores {
  /** Top 10 talentos por puntos netos; `score` = % sobre la suma del top 10. */
  talents: { name: string; score: number }[];
  /** Por valor: nº de tareas completadas (positivo) vs no completadas (negativo). */
  valuesBalance: Record<string, { completed: number; failed: number }>;
}

/**
 * Puntuación de perfil derivada del cumplimiento de tareas del Horario de Vida.
 * Cada tarea programada afecta a sus etiquetas: si se COMPLETA suma (+1); si el día ya
 * pasó y NO se completó resta (−1); si el día aún no llega, queda pendiente (no puntúa).
 *
 *  - Talentos: puntos netos por talento (completadas − fallidas). El top 10 con neto
 *    positivo se reparte el 100% proporcionalmente (mayor potencial = más %).
 *  - Valores: por cada valor, cuántas completadas vs no completadas (barra divergente).
 *
 * Devuelve: { [subject_id]: ProfileScores }.
 */
export async function getSubjectsProfileScores(subjectKind: string, subjectIds: string[]): Promise<Record<string, ProfileScores>> {
  const out: Record<string, ProfileScores> = {};
  if (subjectIds.length === 0) return out;
  await ensureHorarioTables();
  const { rows } = await pool.query(
    `SELECT h.subject_id, h.completed, (h.day < CURRENT_DATE) AS past, l.value_tags, l.talent_tags
       FROM gcc_world.hv_schedule h
       JOIN gcc_world.hv_task_labels l ON l.alternative_id = h.alternative_id
      WHERE h.subject_kind = $1 AND h.subject_id = ANY($2::text[])`,
    [subjectKind, subjectIds],
  );

  type Tally = { c: number; f: number };
  const agg = new Map<string, { talents: Map<string, Tally>; values: Map<string, Tally> }>();
  for (const r of rows) {
    const completed = r.completed === true;
    const past = r.past === true;
    if (!completed && !past) continue; // pendiente (día futuro sin completar) → no puntúa aún
    const sid = String(r.subject_id);
    let a = agg.get(sid);
    if (!a) { a = { talents: new Map(), values: new Map() }; agg.set(sid, a); }
    const bump = (m: Map<string, Tally>, key: string) => { const e = m.get(key) || { c: 0, f: 0 }; if (completed) e.c++; else e.f++; m.set(key, e); };
    for (const t of (r.talent_tags || [])) bump(a.talents, String(t));
    for (const v of (r.value_tags || [])) bump(a.values, String(v));
  }

  for (const [sid, a] of agg) {
    const nets = Array.from(a.talents.entries())
      .map(([name, e]) => ({ name, net: e.c - e.f }))
      .filter((x) => x.net > 0)
      .sort((p, q) => q.net - p.net)
      .slice(0, 10);
    const sum = nets.reduce((s, x) => s + x.net, 0);
    const talents = sum > 0 ? nets.map((x) => ({ name: x.name, score: Math.round((x.net / sum) * 100) })) : [];
    const valuesBalance: Record<string, { completed: number; failed: number }> = {};
    for (const [v, e] of a.values) valuesBalance[v] = { completed: e.c, failed: e.f };
    out[sid] = { talents, valuesBalance };
  }
  return out;
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
