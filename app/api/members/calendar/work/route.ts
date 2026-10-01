import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Tareas de una sesión de «Trabajando» (`gcc_world.member_work_tasks`).
 *
 *   GET    ?event=<uuid>  → las tareas de ESE bloque (detalle del calendario).
 *   GET                   → la sesión abierta del miembro y sus tareas (ventana flotante).
 *   POST   { title }      → agrega una tarea a la sesión abierta.
 *   DELETE ?id=<n>        → quita una tarea, solo mientras su sesión sigue abierta.
 *
 * Toda consulta se cruza con el `member_id` del que llama: tener sesión no basta para
 * leer o tocar el bloque de otro.
 */

async function resolveMemberId(userId: string): Promise<string | null> {
  const { rows } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId]);
  return rows[0]?.member_id || null;
}

const TASK_COLS = `t.id, t.title, t.created_at, t.completed_at`;

async function openSession(memberId: string) {
  const { rows } = await pool.query(
    `SELECT id, start_at FROM gcc_world.member_calendar_events
      WHERE member_id = $1 AND availability_open = TRUE AND availability_status = 'trabajando'
      ORDER BY start_at DESC LIMIT 1`,
    [memberId],
  );
  return rows[0] || null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const eventId = req.nextUrl.searchParams.get('event');
    if (eventId) {
      const { rows } = await pool.query(
        `SELECT ${TASK_COLS} FROM gcc_world.member_work_tasks t
           JOIN gcc_world.member_calendar_events e ON e.id = t.event_id
          WHERE t.event_id = $1 AND e.member_id = $2
          ORDER BY t.created_at, t.id`,
        [eventId, memberId],
      );
      return NextResponse.json({ data: rows });
    }

    const session = await openSession(memberId);
    if (!session) return NextResponse.json({ session: null, data: [] });
    const { rows } = await pool.query(
      `SELECT ${TASK_COLS} FROM gcc_world.member_work_tasks t
        WHERE t.event_id = $1 ORDER BY t.created_at, t.id`,
      [session.id],
    );
    return NextResponse.json({ session: { event_id: session.id, start_at: session.start_at }, data: rows });
  } catch (err: any) {
    console.error('Work tasks GET error:', err.message);
    return NextResponse.json({ error: 'Error al cargar las tareas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'Escribe la tarea' }, { status: 400 });
    if (title.length > 300) return NextResponse.json({ error: 'Máximo 300 caracteres' }, { status: 400 });

    const session = await openSession(memberId);
    if (!session) return NextResponse.json({ error: 'No estás en estado «Trabajando»' }, { status: 409 });

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.member_work_tasks (event_id, member_id, title)
       VALUES ($1, $2, $3) RETURNING id, title, created_at, completed_at`,
      [session.id, memberId, title],
    );
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Work tasks POST error:', err.message);
    return NextResponse.json({ error: 'Error al agregar la tarea' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const id = Number(req.nextUrl.searchParams.get('id'));
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Tarea inválida' }, { status: 400 });

    const { rowCount } = await pool.query(
      `DELETE FROM gcc_world.member_work_tasks t
        USING gcc_world.member_calendar_events e
        WHERE t.id = $1 AND e.id = t.event_id AND e.member_id = $2 AND e.availability_open = TRUE`,
      [id, memberId],
    );
    if (!rowCount) return NextResponse.json({ error: 'No se encontró la tarea o la sesión ya terminó' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Work tasks DELETE error:', err.message);
    return NextResponse.json({ error: 'Error al eliminar la tarea' }, { status: 500 });
  }
}
