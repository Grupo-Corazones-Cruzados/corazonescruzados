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
      completed BOOLEAN NOT NULL DEFAULT FALSE,           -- legado (ya no se usa)
      status TEXT NOT NULL DEFAULT 'pending',             -- 'pending' | 'completed' | 'failed'
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS hv_schedule_subject_idx ON gcc_world.hv_schedule (subject_kind, subject_id);
  `);
  // Instalaciones previas: agrega `status` y arrastra el valor del viejo `completed`.
  await pool.query(`ALTER TABLE gcc_world.hv_schedule ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`);
  await pool.query(`UPDATE gcc_world.hv_schedule SET status = 'completed' WHERE completed = TRUE AND status = 'pending'`);
}

export interface HorarioTask {
  id: number;
  title: string;
  description: string | null;
  problems: { title: string; dimension: string | null }[];
  values: string[];   // keys de VALORES
  talents: string[];  // etiquetas de TALENTOS
}
export type ScheduleStatus = 'pending' | 'completed' | 'failed';
export interface ScheduleEntry {
  id: number;
  alternativeId: number;
  day: string; // YYYY-MM-DD
  status: ScheduleStatus;
}
/** Entrada AUTOMÁTICA (no editable) derivada del ticket/proyecto asociado a la alternativa. */
export interface AutoEntry {
  alternativeId: number;
  day: string; // YYYY-MM-DD
  source: 'ticket' | 'project';
  refTitle: string;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Tareas del sujeto = alternativas (aún no convertidas en solución) vinculadas a algún
 * problema de sus situaciones, con sus etiquetas. Más el calendario asignado (manual) y
 * las entradas AUTOMÁTICAS del ticket/proyecto asociado (todos los días entre su fecha de
 * inicio y su fecha límite), acotadas a la ventana [from, to] si se indica.
 */
export async function getSubjectHorario(subjectKind: string, subjectId: string, from?: string, to?: string): Promise<{ tasks: HorarioTask[]; schedule: ScheduleEntry[]; auto: AutoEntry[] }> {
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
  if (ids.length === 0) return { tasks: [], schedule: [], auto: [] };

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
    `SELECT id, alternative_id, to_char(day, 'YYYY-MM-DD') AS day, status
       FROM gcc_world.hv_schedule
      WHERE subject_kind = $1 AND subject_id = $2 AND alternative_id = ANY($3::bigint[])
      ORDER BY day`,
    [subjectKind, subjectId, ids],
  )).rows;
  const schedule: ScheduleEntry[] = schedRows.map((r: any) => ({ id: Number(r.id), alternativeId: Number(r.alternative_id), day: r.day, status: (r.status as ScheduleStatus) || 'pending' }));

  // Entradas AUTOMÁTICAS: por cada alternativa con un ticket/proyecto asociado, un día por
  // cada fecha entre su inicio (created_at; proyectos: confirmed_at si existe) y su límite
  // (deadline). Acotadas a la ventana [from, to] para no generar rangos enormes.
  const auto: AutoEntry[] = [];
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const ranges = (await pool.query(
      `SELECT l.alternative_id AS aid, 'ticket'::text AS source, t.title AS ref_title,
              to_char(t.created_at::date, 'YYYY-MM-DD') AS start, to_char(t.deadline::date, 'YYYY-MM-DD') AS end
         FROM gcc_world.aa_alternative_tickets l
         JOIN gcc_world.tickets t ON t.id = l.ticket_id
        WHERE l.alternative_id = ANY($1::bigint[]) AND t.deadline IS NOT NULL
       UNION ALL
       SELECT l.alternative_id, 'project'::text, p.title,
              to_char(COALESCE(p.confirmed_at, p.created_at)::date, 'YYYY-MM-DD'), to_char(p.deadline::date, 'YYYY-MM-DD')
         FROM gcc_world.aa_alternative_projects l
         JOIN gcc_world.projects p ON p.id = l.project_id
        WHERE l.alternative_id = ANY($1::bigint[]) AND p.deadline IS NOT NULL`,
      [ids],
    )).rows;
    for (const r of ranges) {
      const lo = r.start > from ? r.start : from;   // comparación lexicográfica válida en YYYY-MM-DD
      const hi = r.end < to ? r.end : to;
      if (lo > hi) continue;
      // Itera día a día en la ventana efectiva.
      let d = new Date(`${lo}T00:00:00`);
      const end = new Date(`${hi}T00:00:00`);
      let guard = 0;
      while (d <= end && guard < 400) {
        auto.push({ alternativeId: Number(r.aid), day: ymd(d), source: r.source, refTitle: r.ref_title });
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        guard++;
      }
    }
  }

  return { tasks, schedule, auto };
}

export interface ProfileScores {
  /** Top 10 talentos por puntos netos; `score` = % sobre la suma del top 10. */
  talents: { name: string; score: number }[];
  /** Por valor: nº de tareas completadas (positivo) vs no completadas (negativo). */
  valuesBalance: Record<string, { completed: number; failed: number }>;
}

/**
 * Puntuación de perfil derivada del cumplimiento de tareas del Horario de Vida.
 * Cada tarea programada afecta a sus etiquetas según su estado EXPLÍCITO: 'completed'
 * suma (+1), 'failed' resta (−1), 'pending' no puntúa (efecto neutro).
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
    `SELECT h.subject_id, h.status, l.value_tags, l.talent_tags
       FROM gcc_world.hv_schedule h
       JOIN gcc_world.hv_task_labels l ON l.alternative_id = h.alternative_id
      WHERE h.subject_kind = $1 AND h.subject_id = ANY($2::text[]) AND h.status IN ('completed','failed')`,
    [subjectKind, subjectIds],
  );

  type Tally = { c: number; f: number };
  const agg = new Map<string, { talents: Map<string, Tally>; values: Map<string, Tally> }>();
  for (const r of rows) {
    const completed = r.status === 'completed'; // 'failed' es el otro caso (pending ya se filtró)
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

export interface TaskContext {
  problems: { title: string; dimension: string | null }[];
  situations: string[];
  causes: string[];
}

/**
 * Contexto de una tarea (alternativa) dentro del grafo de Apoyo del sujeto: los
 * problemas que aborda, y —vía esos problemas— sus situaciones y causas. Para el panel
 * de detalle del horario.
 */
export async function getTaskContext(subjectKind: string, subjectId: string, alternativeId: number): Promise<TaskContext> {
  await ensureHorarioTables();
  // Problemas del sujeto que aborda esta alternativa.
  const probRows = (await pool.query(
    `SELECT DISTINCT p.id, p.title, p.dimension
       FROM gcc_world.aa_solution_problems spr
       JOIN gcc_world.aa_problems p ON p.id = spr.problem_id
       JOIN gcc_world.aa_situation_problems sp ON sp.problem_id = p.id
       JOIN gcc_world.aa_situations s ON s.id = sp.situation_id
      WHERE spr.solution_id = $1 AND s.subject_kind = $2 AND s.subject_id = $3`,
    [alternativeId, subjectKind, subjectId],
  )).rows;
  const problemIds = probRows.map((r: any) => Number(r.id));
  const problems = probRows.map((r: any) => ({ title: r.title, dimension: r.dimension ?? null }));
  if (problemIds.length === 0) return { problems: [], situations: [], causes: [] };

  const sitRows = (await pool.query(
    `SELECT DISTINCT s.title
       FROM gcc_world.aa_situation_problems sp
       JOIN gcc_world.aa_situations s ON s.id = sp.situation_id
      WHERE sp.problem_id = ANY($1::bigint[]) AND s.subject_kind = $2 AND s.subject_id = $3`,
    [problemIds, subjectKind, subjectId],
  )).rows;
  const causeRows = (await pool.query(
    `SELECT DISTINCT c.title
       FROM gcc_world.aa_problem_causes pc
       JOIN gcc_world.aa_causes c ON c.id = pc.cause_id
      WHERE pc.problem_id = ANY($1::bigint[])`,
    [problemIds],
  )).rows;

  return {
    problems,
    situations: sitRows.map((r: any) => r.title),
    causes: causeRows.map((r: any) => r.title),
  };
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
