import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { ensureApoyoTables } from '@/lib/centralized/apoyo-db';
import { NextResponse } from 'next/server';

// Mapa de tipo de asociación → tabla y columnas (a, b).
const LINK: Record<string, { table: string; a: string; b: string }> = {
  situation_problem: { table: 'aa_situation_problems', a: 'situation_id', b: 'problem_id' },
  problem_cause: { table: 'aa_problem_causes', a: 'problem_id', b: 'cause_id' },
  solution_problem: { table: 'aa_solution_problems', a: 'solution_id', b: 'problem_id' },
  solution_cause: { table: 'aa_solution_causes', a: 'solution_id', b: 'cause_id' },
};

/** POST — asocia (connect:true) o desasocia (connect:false) dos nodos. body: {type,a,b,connect}. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'member'].includes(user.role)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await ensureApoyoTables();

    const { type, a, b, connect = true } = await req.json();
    const L = LINK[String(type)];
    if (!L || !a || !b) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    const av = Number(a), bv = Number(b);

    if (connect) {
      await pool.query(`INSERT INTO gcc_world.${L.table} (${L.a}, ${L.b}) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [av, bv]);
    } else {
      await pool.query(`DELETE FROM gcc_world.${L.table} WHERE ${L.a} = $1 AND ${L.b} = $2`, [av, bv]);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Apoyo link error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
