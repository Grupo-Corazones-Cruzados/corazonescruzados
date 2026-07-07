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
  `);
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

    // Solución → Problemas (de este sujeto)
    const spr = await pool.query(`SELECT solution_id, problem_id FROM gcc_world.aa_solution_problems WHERE problem_id = ANY($1::bigint[])`, [problemIds]);
    const solutionIds = Array.from(new Set(spr.rows.map((r: any) => Number(r.solution_id))));
    spr.rows.forEach((r: any) => edges.push({ source: nodeKey('solution', r.solution_id), target: nodeKey('problem', r.problem_id), type: 'solution_problem' }));
    if (solutionIds.length) {
      const sol = await pool.query(`SELECT id, title, description FROM gcc_world.aa_solutions WHERE id = ANY($1::bigint[]) ORDER BY id`, [solutionIds]);
      sol.rows.forEach((r: any) => push('solution', r));
      // Solución → Causas que afecta (limitado a las causas presentes en el grafo)
      const sc = await pool.query(`SELECT solution_id, cause_id FROM gcc_world.aa_solution_causes WHERE solution_id = ANY($1::bigint[])`, [solutionIds]);
      const presentCauseKeys = new Set(nodes.filter((n) => n.type === 'cause').map((n) => n.key));
      sc.rows.forEach((r: any) => {
        const target = nodeKey('cause', r.cause_id);
        if (presentCauseKeys.has(target)) edges.push({ source: nodeKey('solution', r.solution_id), target, type: 'solution_cause' });
      });
    }
  }

  return { nodes, edges };
}
