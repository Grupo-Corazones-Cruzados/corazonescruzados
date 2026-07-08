import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { ensureHorarioTables } from '@/lib/centralized/horario-db';
import { NextResponse } from 'next/server';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// Una tarea solo se puede programar si YA tiene al menos una etiqueta.
async function hasLabels(alternativeId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.hv_task_labels
      WHERE alternative_id = $1 AND (array_length(value_tags,1) > 0 OR array_length(talent_tags,1) > 0) LIMIT 1`,
    [alternativeId],
  );
  return rows.length > 0;
}

// POST — asigna una tarea (alternativa) a un día del horario del sujeto.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await ensureHorarioTables();
    const b = await req.json();
    const kind = String(b.subject_kind || '');
    const subjectId = String(b.subject_id || '');
    const alternativeId = Number(b.alternativeId);
    const day = String(b.day || ''); // YYYY-MM-DD
    if (!kind || !subjectId || !alternativeId || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    if (!(await hasLabels(alternativeId))) {
      return NextResponse.json({ error: 'La tarea necesita al menos una etiqueta antes de programarse' }, { status: 400 });
    }
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.hv_schedule (subject_kind, subject_id, alternative_id, day) VALUES ($1,$2,$3,$4) RETURNING id`,
      [kind, subjectId, alternativeId, day],
    );
    return NextResponse.json({ ok: true, id: Number(rows[0].id) });
  } catch (err: any) {
    console.error('Horario schedule POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — cambia el estado de una asignación: 'pending' | 'completed' | 'failed'.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await ensureHorarioTables();
    const { id, status } = await req.json();
    if (!id || !['pending', 'completed', 'failed'].includes(String(status))) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    // Mantiene el legado `completed` coherente por si algo lo leyera.
    await pool.query(`UPDATE gcc_world.hv_schedule SET status = $1, completed = ($1 = 'completed') WHERE id = $2`, [String(status), Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Horario schedule PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — quita una asignación del calendario.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await ensureHorarioTables();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await pool.query(`DELETE FROM gcc_world.hv_schedule WHERE id = $1`, [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Horario schedule DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
