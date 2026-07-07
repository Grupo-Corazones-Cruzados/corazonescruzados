import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { ensureApoyoTables } from '@/lib/centralized/apoyo-db';
import { NextResponse } from 'next/server';

const NODE_TABLE: Record<string, string> = {
  situation: 'aa_situations', problem: 'aa_problems', cause: 'aa_causes',
  solution: 'aa_solutions', alternative: 'aa_solutions',
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
        `INSERT INTO gcc_world.aa_situations (subject_kind, subject_id, title, description) VALUES ($1,$2,$3,$4) RETURNING id`,
        [kind, subjectId, title, description],
      );
      id = Number(rows[0].id);
    } else if (type === 'problem') {
      if (!dimension) return NextResponse.json({ error: 'La dimensión es requerida' }, { status: 400 });
      const { rows } = await pool.query(`INSERT INTO gcc_world.aa_problems (title, dimension, description) VALUES ($1,$2,$3) RETURNING id`, [title, dimension, description]);
      id = Number(rows[0].id);
      if (b.situationId) await pool.query(`INSERT INTO gcc_world.aa_situation_problems (situation_id, problem_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [Number(b.situationId), id]);
    } else if (type === 'cause') {
      const { rows } = await pool.query(`INSERT INTO gcc_world.aa_causes (title, description) VALUES ($1,$2) RETURNING id`, [title, description]);
      id = Number(rows[0].id);
      if (b.problemId) await pool.query(`INSERT INTO gcc_world.aa_problem_causes (problem_id, cause_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [Number(b.problemId), id]);
    } else {
      // 'alternative' (propuesta) o 'solution' (comprobada). Comparten tabla aa_solutions.
      const status = type === 'solution' ? 'solution' : 'alternative';
      const { rows } = await pool.query(`INSERT INTO gcc_world.aa_solutions (title, description, status) VALUES ($1,$2,$3) RETURNING id`, [title, description, status]);
      id = Number(rows[0].id);
      if (b.problemId) await pool.query(`INSERT INTO gcc_world.aa_solution_problems (solution_id, problem_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, Number(b.problemId)]);
    }
    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    console.error('Apoyo node create error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — cambia el `status` de un registro de aa_solutions: convierte una alternativa
// (propuesta) en solución (comprobada), o viceversa. Los enlaces se conservan.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await ensureApoyoTables();
    const { id, status } = await req.json();
    if (!id || !['alternative', 'solution'].includes(String(status))) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    await pool.query(`UPDATE gcc_world.aa_solutions SET status = $1 WHERE id = $2`, [String(status), Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Apoyo node patch error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Borra un problema en cascada: sus causas y soluciones asociadas — salvo las que sigan
// compartidas con OTRO problema (quedan). Cada sentencia es individual (Postgres no
// admite múltiples comandos en una consulta con parámetros).
async function deleteProblemCascade(client: any, pid: number) {
  const causes = (await client.query(`SELECT cause_id FROM gcc_world.aa_problem_causes WHERE problem_id = $1`, [pid])).rows;
  const sols = (await client.query(`SELECT solution_id FROM gcc_world.aa_solution_problems WHERE problem_id = $1`, [pid])).rows;

  await client.query(`DELETE FROM gcc_world.aa_problem_causes WHERE problem_id = $1`, [pid]);
  await client.query(`DELETE FROM gcc_world.aa_solution_problems WHERE problem_id = $1`, [pid]);
  await client.query(`DELETE FROM gcc_world.aa_situation_problems WHERE problem_id = $1`, [pid]);

  for (const { cause_id } of causes) {
    const stillUsed = (await client.query(`SELECT 1 FROM gcc_world.aa_problem_causes WHERE cause_id = $1 LIMIT 1`, [cause_id])).rows.length;
    if (!stillUsed) {
      await client.query(`DELETE FROM gcc_world.aa_solution_causes WHERE cause_id = $1`, [cause_id]);
      await client.query(`DELETE FROM gcc_world.aa_causes WHERE id = $1`, [cause_id]);
    }
  }
  for (const { solution_id } of sols) {
    const stillUsed = (await client.query(`SELECT 1 FROM gcc_world.aa_solution_problems WHERE solution_id = $1 LIMIT 1`, [solution_id])).rows.length;
    if (!stillUsed) {
      await client.query(`DELETE FROM gcc_world.aa_solution_causes WHERE solution_id = $1`, [solution_id]);
      await client.query(`DELETE FROM gcc_world.aa_solutions WHERE id = $1`, [solution_id]);
    }
  }
  await client.query(`DELETE FROM gcc_world.aa_problems WHERE id = $1`, [pid]);
}

// DELETE — borra un nodo y (en cascada) lo que le corresponde. Transaccional.
export async function DELETE(req: Request) {
  const client = await pool.connect();
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await ensureApoyoTables();
    const { type, id } = await req.json();
    if (!NODE_TABLE[String(type)] || !id) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    const nid = Number(id);

    await client.query('BEGIN');
    if (type === 'cause') {
      await client.query(`DELETE FROM gcc_world.aa_problem_causes WHERE cause_id = $1`, [nid]);
      await client.query(`DELETE FROM gcc_world.aa_solution_causes WHERE cause_id = $1`, [nid]);
      await client.query(`DELETE FROM gcc_world.aa_causes WHERE id = $1`, [nid]);
    } else if (type === 'solution' || type === 'alternative') {
      await client.query(`DELETE FROM gcc_world.aa_solution_problems WHERE solution_id = $1`, [nid]);
      await client.query(`DELETE FROM gcc_world.aa_solution_causes WHERE solution_id = $1`, [nid]);
      await client.query(`DELETE FROM gcc_world.aa_solutions WHERE id = $1`, [nid]);
    } else if (type === 'problem') {
      await deleteProblemCascade(client, nid);
    } else if (type === 'situation') {
      const probs = (await client.query(`SELECT problem_id FROM gcc_world.aa_situation_problems WHERE situation_id = $1`, [nid])).rows;
      await client.query(`DELETE FROM gcc_world.aa_situation_problems WHERE situation_id = $1`, [nid]);
      for (const { problem_id } of probs) {
        // Solo borra en cascada los problemas que ya no pertenezcan a otra situación.
        const stillUsed = (await client.query(`SELECT 1 FROM gcc_world.aa_situation_problems WHERE problem_id = $1 LIMIT 1`, [problem_id])).rows.length;
        if (!stillUsed) await deleteProblemCascade(client, Number(problem_id));
      }
      await client.query(`DELETE FROM gcc_world.aa_situations WHERE id = $1`, [nid]);
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Apoyo node delete error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
