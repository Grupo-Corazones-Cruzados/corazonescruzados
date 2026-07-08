import { pool } from '@/lib/db';
import type { ApoyoGraph, GraphNode, GraphEdge, ApoyoNodeType } from '@/lib/centralized/apoyo';
import { nodeKey } from '@/lib/centralized/apoyo';

/** Crea (idempotente) las tablas del sistema Apoyo y Autoayuda. */
export async function ensureApoyoTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.aa_situations (
      id BIGSERIAL PRIMARY KEY,
      subject_kind TEXT NOT NULL,   -- 'candidate' | 'member'
      subject_id TEXT NOT NULL,
      title TEXT NOT NULL,
      dimension TEXT,               -- laboral|corporal|mental|social
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gcc_world.aa_problems (
      id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, dimension TEXT, description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gcc_world.aa_causes (
      id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gcc_world.aa_solutions (
      id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      status TEXT NOT NULL DEFAULT 'solution',   -- 'alternative' (propuesta) | 'solution' (comprobada)
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gcc_world.aa_situation_problems (
      situation_id BIGINT NOT NULL, problem_id BIGINT NOT NULL, PRIMARY KEY (situation_id, problem_id)
    );
    CREATE TABLE IF NOT EXISTS gcc_world.aa_problem_causes (
      problem_id BIGINT NOT NULL, cause_id BIGINT NOT NULL, PRIMARY KEY (problem_id, cause_id)
    );
    CREATE TABLE IF NOT EXISTS gcc_world.aa_solution_problems (
      solution_id BIGINT NOT NULL, problem_id BIGINT NOT NULL, PRIMARY KEY (solution_id, problem_id)
    );
    CREATE TABLE IF NOT EXISTS gcc_world.aa_solution_causes (
      solution_id BIGINT NOT NULL, cause_id BIGINT NOT NULL, PRIMARY KEY (solution_id, cause_id)
    );
    -- Asociación de una ALTERNATIVA (aa_solutions) con proyectos/tickets del sujeto.
    CREATE TABLE IF NOT EXISTS gcc_world.aa_alternative_tickets (
      alternative_id BIGINT NOT NULL, ticket_id BIGINT NOT NULL, PRIMARY KEY (alternative_id, ticket_id)
    );
    CREATE TABLE IF NOT EXISTS gcc_world.aa_alternative_projects (
      alternative_id BIGINT NOT NULL, project_id TEXT NOT NULL, PRIMARY KEY (alternative_id, project_id)
    );
  `);
  // Para instalaciones previas: las soluciones existentes ya eran "comprobadas".
  await pool.query(`ALTER TABLE gcc_world.aa_solutions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'solution'`);
}

export interface LinkRef { id: string; title: string; status: string | null }

/** Resuelve el user_id (creador) asociado a un sujeto de Apoyo, si existe. */
async function resolveUserId(subjectKind: string, subjectId: string): Promise<string | null> {
  try {
    if (subjectKind === 'member') {
      const { rows } = await pool.query(`SELECT id FROM gcc_world.users WHERE member_id::text = $1 LIMIT 1`, [subjectId]);
      return rows[0] ? String(rows[0].id) : null;
    }
    const { rows } = await pool.query(`SELECT user_id FROM gcc_world.clients WHERE id::text = $1 LIMIT 1`, [subjectId]);
    return rows[0]?.user_id ? String(rows[0].user_id) : null;
  } catch { return null; }
}

/**
 * Proyectos y tickets que el sujeto CREÓ o en los que PARTICIPA, para ofrecerlos en el
 * selector de asociación de una alternativa.
 *  - Tickets: participa si es su miembro asignado (member_id) o su cliente (client_id);
 *    creó si user_id = su user.
 *  - Proyectos: participa (miembro) si es assigned_member_id, tiene bid aceptado o una
 *    asignación de requerimiento; su cliente (candidato) si client_id; creó si
 *    created_by_user_id = su user.
 */
export async function getSubjectLinkOptions(subjectKind: string, subjectId: string): Promise<{ tickets: LinkRef[]; projects: LinkRef[] }> {
  await ensureApoyoTables();
  const userId = await resolveUserId(subjectKind, subjectId);

  const tickets = (await pool.query(
    `SELECT id, title, status FROM gcc_world.tickets
      WHERE ($3 = 'member' AND member_id::text = $1)
         OR ($3 = 'candidate' AND client_id::text = $1)
         OR ($2::text IS NOT NULL AND user_id::text = $2::text)
      ORDER BY created_at DESC NULLS LAST, id DESC`,
    [subjectId, userId, subjectKind],
  )).rows.map((r: any) => ({ id: String(r.id), title: r.title, status: r.status ?? null }));

  const projects = (await pool.query(
    `SELECT p.id, p.title, p.status FROM gcc_world.projects p
      WHERE ($3 = 'candidate' AND p.client_id::text = $1)
         OR ($2::text IS NOT NULL AND p.created_by_user_id::text = $2::text)
         OR ($3 = 'member' AND (
              p.assigned_member_id::text = $1
              OR EXISTS (SELECT 1 FROM gcc_world.project_bids b WHERE b.project_id = p.id AND b.member_id::text = $1 AND b.status = 'accepted')
              OR EXISTS (SELECT 1 FROM gcc_world.requirement_assignments ra WHERE ra.project_id = p.id AND ra.member_id::text = $1)
            ))
      ORDER BY p.created_at DESC NULLS LAST`,
    [subjectId, userId, subjectKind],
  )).rows.map((r: any) => ({ id: String(r.id), title: r.title, status: r.status ?? null }));

  return { tickets, projects };
}

export interface AlternativeLink { kind: 'ticket' | 'project'; id: string; title: string; status: string | null }

/** El ÚNICO proyecto o ticket asociado a una alternativa (exclusivo), o null. */
export async function getAlternativeLink(alternativeId: number): Promise<AlternativeLink | null> {
  await ensureApoyoTables();
  const t = (await pool.query(
    `SELECT t.id, t.title, t.status FROM gcc_world.aa_alternative_tickets l
       JOIN gcc_world.tickets t ON t.id = l.ticket_id WHERE l.alternative_id = $1 LIMIT 1`,
    [alternativeId],
  )).rows[0];
  if (t) return { kind: 'ticket', id: String(t.id), title: t.title, status: t.status ?? null };
  const p = (await pool.query(
    `SELECT p.id, p.title, p.status FROM gcc_world.aa_alternative_projects l
       JOIN gcc_world.projects p ON p.id::text = l.project_id WHERE l.alternative_id = $1 LIMIT 1`,
    [alternativeId],
  )).rows[0];
  if (p) return { kind: 'project', id: String(p.id), title: p.title, status: p.status ?? null };
  return null;
}

/**
 * Asocia/desasocia una alternativa con un ticket o proyecto. La relación es EXCLUSIVA:
 * a lo sumo UN ticket O UN proyecto por alternativa. Al conectar se limpia cualquier
 * asociación previa (de ambos tipos) y se deja solo la nueva.
 */
export async function setAlternativeLink(alternativeId: number, kind: 'ticket' | 'project', refId: string, connect: boolean) {
  await ensureApoyoTables();
  await pool.query(`DELETE FROM gcc_world.aa_alternative_tickets WHERE alternative_id = $1`, [alternativeId]);
  await pool.query(`DELETE FROM gcc_world.aa_alternative_projects WHERE alternative_id = $1`, [alternativeId]);
  if (!connect) return;
  if (kind === 'ticket') await pool.query(`INSERT INTO gcc_world.aa_alternative_tickets (alternative_id, ticket_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [alternativeId, Number(refId)]);
  else await pool.query(`INSERT INTO gcc_world.aa_alternative_projects (alternative_id, project_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [alternativeId, refId]);
}

/**
 * Carga de problemas por dimensión para un conjunto de sujetos (candidatos/miembros).
 * Por dimensión devuelve el % de problemas AÚN sin resolver = (total - resueltos)/total.
 * Un problema está "resuelto" si tiene al menos una **solución** vinculada (status
 * 'solution'); las alternativas NO cuentan como resuelto. Si todos siguen sin solución
 * el % es 100; si 1 de 5 ya tiene solución, el % baja a 80. Dimensiones sin problemas
 * quedan fuera del resultado (la UI las muestra como "sin evaluar").
 *
 * Devuelve: { [subject_id]: { [dimension]: pct 0–100 } }.
 */
export async function getDimensionProblemLoads(
  subjectKind: string,
  subjectIds: string[],
): Promise<Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, number>> = {};
  if (subjectIds.length === 0) return out;
  await ensureApoyoTables();
  const { rows } = await pool.query(
    `SELECT s.subject_id AS subject_id,
            p.dimension AS dimension,
            COUNT(DISTINCT p.id) AS total,
            COUNT(DISTINCT p.id) FILTER (WHERE solved.ok) AS solved
       FROM gcc_world.aa_situations s
       JOIN gcc_world.aa_situation_problems sp ON sp.situation_id = s.id
       JOIN gcc_world.aa_problems p ON p.id = sp.problem_id
       LEFT JOIN LATERAL (
         SELECT EXISTS (
           SELECT 1 FROM gcc_world.aa_solution_problems spr
             JOIN gcc_world.aa_solutions so ON so.id = spr.solution_id
            WHERE spr.problem_id = p.id AND so.status = 'solution'
         ) AS ok
       ) solved ON TRUE
      WHERE s.subject_kind = $1 AND s.subject_id = ANY($2::text[]) AND p.dimension IS NOT NULL
      GROUP BY s.subject_id, p.dimension`,
    [subjectKind, subjectIds],
  );
  for (const r of rows) {
    const total = Number(r.total) || 0;
    if (total === 0) continue;
    const solved = Number(r.solved) || 0;
    const pct = Math.round(((total - solved) / total) * 100);
    const sid = String(r.subject_id);
    (out[sid] ||= {})[String(r.dimension)] = pct;
  }
  return out;
}

/**
 * Grafo del sujeto: sus situaciones + los problemas asociados + las causas de esos
 * problemas + las soluciones asociadas a esos problemas (y qué causas afectan).
 */
export async function getSubjectGraph(subjectKind: string, subjectId: string): Promise<ApoyoGraph> {
  await ensureApoyoTables();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const push = (type: ApoyoNodeType, r: any) => nodes.push({ key: nodeKey(type, r.id), type, id: Number(r.id), title: r.title, dimension: r.dimension ?? null, description: r.description ?? null });

  // Situaciones del sujeto
  const sit = await pool.query(
    `SELECT id, title, dimension, description FROM gcc_world.aa_situations WHERE subject_kind = $1 AND subject_id = $2 ORDER BY id`,
    [subjectKind, subjectId],
  );
  sit.rows.forEach((r: any) => push('situation', r));
  const sitIds = sit.rows.map((r: any) => Number(r.id));
  if (sitIds.length === 0) return { nodes, edges };

  // Situación → Problemas
  const sp = await pool.query(`SELECT situation_id, problem_id FROM gcc_world.aa_situation_problems WHERE situation_id = ANY($1::bigint[])`, [sitIds]);
  const problemIds = Array.from(new Set(sp.rows.map((r: any) => Number(r.problem_id))));
  sp.rows.forEach((r: any) => edges.push({ source: nodeKey('situation', r.situation_id), target: nodeKey('problem', r.problem_id), type: 'situation_problem' }));

  if (problemIds.length) {
    const prob = await pool.query(`SELECT id, title, dimension, description FROM gcc_world.aa_problems WHERE id = ANY($1::bigint[]) ORDER BY id`, [problemIds]);
    prob.rows.forEach((r: any) => push('problem', r));

    // Problema → Causas
    const pc = await pool.query(`SELECT problem_id, cause_id FROM gcc_world.aa_problem_causes WHERE problem_id = ANY($1::bigint[])`, [problemIds]);
    const causeIds = Array.from(new Set(pc.rows.map((r: any) => Number(r.cause_id))));
    pc.rows.forEach((r: any) => edges.push({ source: nodeKey('problem', r.problem_id), target: nodeKey('cause', r.cause_id), type: 'problem_cause' }));
    if (causeIds.length) {
      const cau = await pool.query(`SELECT id, title, description FROM gcc_world.aa_causes WHERE id = ANY($1::bigint[]) ORDER BY id`, [causeIds]);
      cau.rows.forEach((r: any) => push('cause', r));
    }

    // Alternativas/Soluciones → Problemas (de este sujeto). El tipo del nodo depende del
    // `status`: 'solution' (comprobada) o 'alternative' (propuesta). Ambas comparten tabla/joins.
    const spr = await pool.query(`SELECT solution_id, problem_id FROM gcc_world.aa_solution_problems WHERE problem_id = ANY($1::bigint[])`, [problemIds]);
    const solutionIds = Array.from(new Set(spr.rows.map((r: any) => Number(r.solution_id))));
    if (solutionIds.length) {
      const sol = await pool.query(`SELECT id, title, description, status FROM gcc_world.aa_solutions WHERE id = ANY($1::bigint[]) ORDER BY id`, [solutionIds]);
      // Alternativas/soluciones con ticket o proyecto asociado (distintivo en el grafo).
      const linkRows = (await pool.query(
        `SELECT alternative_id, 'ticket'::text AS source FROM gcc_world.aa_alternative_tickets WHERE alternative_id = ANY($1::bigint[])
         UNION SELECT alternative_id, 'project'::text FROM gcc_world.aa_alternative_projects WHERE alternative_id = ANY($1::bigint[])`,
        [solutionIds],
      )).rows;
      const linkSrc = new Map<number, 'ticket' | 'project'>();
      linkRows.forEach((r: any) => linkSrc.set(Number(r.alternative_id), r.source));
      const solType = new Map<number, ApoyoNodeType>();
      sol.rows.forEach((r: any) => {
        const t: ApoyoNodeType = r.status === 'solution' ? 'solution' : 'alternative';
        solType.set(Number(r.id), t);
        push(t, r);
        const src = linkSrc.get(Number(r.id));
        if (src) nodes[nodes.length - 1].linkSource = src;
      });
      const typeOf = (id: any) => solType.get(Number(id)) || 'alternative';
      spr.rows.forEach((r: any) => edges.push({ source: nodeKey(typeOf(r.solution_id), r.solution_id), target: nodeKey('problem', r.problem_id), type: 'solution_problem' }));
      // → Causas que afecta (limitado a las causas presentes en el grafo)
      const sc = await pool.query(`SELECT solution_id, cause_id FROM gcc_world.aa_solution_causes WHERE solution_id = ANY($1::bigint[])`, [solutionIds]);
      const presentCauseKeys = new Set(nodes.filter((n) => n.type === 'cause').map((n) => n.key));
      sc.rows.forEach((r: any) => {
        const target = nodeKey('cause', r.cause_id);
        if (presentCauseKeys.has(target)) edges.push({ source: nodeKey(typeOf(r.solution_id), r.solution_id), target, type: 'solution_cause' });
      });
    }
  }

  return { nodes, edges };
}
