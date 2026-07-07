import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { ensureApoyoTables } from '@/lib/centralized/apoyo-db';
import { NextResponse } from 'next/server';

const NODE_TABLE: Record<string, string> = {
  situation: 'aa_situations', problem: 'aa_problems', cause: 'aa_causes', solution: 'aa_solutions',
};

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// POST — crea un nodo (situación/problema/causa/solución). Opcionalmente lo enlaza a
// su "padre" (problema→situación, causa→problema, solución→problema).
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await ensureApoyoTables();
    const b = await req.json();
    const type = String(b.type || '');
    const table = NODE_TABLE[type];
    if (!table) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    const title = String(b.title || '').trim();
    if (!title) return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
    const description = b.description ? String(b.description) : null;
    const dimension = b.dimension ? String(b.dimension) : null;

    let id: number;
    if (type === 'situation') {
      const kind = String(b.subject_kind || '');
      const subjectId = String(b.subject_id || '');
      if (!kind || !subjectId) return NextResponse.json({ error: 'Falta el sujeto' }, { status: 400 });
      const { rows } = await pool.query(
        `INSERT INTO gcc_world.aa_situations (subject_kind, subject_id, title, dimension, description) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [kind, subjectId, title, dimension, description],
      );
      id = Number(rows[0].id);
    } else if (type === 'problem') {
      const { rows } = await pool.query(`INSERT INTO gcc_world.aa_problems (title, dimension, description) VALUES ($1,$2,$3) RETURNING id`, [title, dimension, description]);
      id = Number(rows[0].id);
      if (b.situationId) await pool.query(`INSERT INTO gcc_world.aa_situation_problems (situation_id, problem_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [Number(b.situationId), id]);
    } else if (type === 'cause') {
      const { rows } = await pool.query(`INSERT INTO gcc_world.aa_causes (title, description) VALUES ($1,$2) RETURNING id`, [title, description]);
      id = Number(rows[0].id);
      if (b.problemId) await pool.query(`INSERT INTO gcc_world.aa_problem_causes (problem_id, cause_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [Number(b.problemId), id]);
    } else {
      const { rows } = await pool.query(`INSERT INTO gcc_world.aa_solutions (title, description) VALUES ($1,$2) RETURNING id`, [title, description]);
      id = Number(rows[0].id);
      if (b.problemId) await pool.query(`INSERT INTO gcc_world.aa_solution_problems (solution_id, problem_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, Number(b.problemId)]);
    }
    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    console.error('Apoyo node create error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — borra un nodo y sus asociaciones.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await ensureApoyoTables();
    const { type, id } = await req.json();
    const table = NODE_TABLE[String(type)];
    if (!table || !id) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    const nid = Number(id);
    if (type === 'situation') await pool.query(`DELETE FROM gcc_world.aa_situation_problems WHERE situation_id = $1`, [nid]);
    if (type === 'problem') await pool.query(`DELETE FROM gcc_world.aa_situation_problems WHERE problem_id = $1; DELETE FROM gcc_world.aa_problem_causes WHERE problem_id = $1; DELETE FROM gcc_world.aa_solution_problems WHERE problem_id = $1;`, [nid]);
    if (type === 'cause') await pool.query(`DELETE FROM gcc_world.aa_problem_causes WHERE cause_id = $1; DELETE FROM gcc_world.aa_solution_causes WHERE cause_id = $1;`, [nid]);
    if (type === 'solution') await pool.query(`DELETE FROM gcc_world.aa_solution_problems WHERE solution_id = $1; DELETE FROM gcc_world.aa_solution_causes WHERE solution_id = $1;`, [nid]);
    await pool.query(`DELETE FROM gcc_world.${table} WHERE id = $1`, [nid]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Apoyo node delete error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
