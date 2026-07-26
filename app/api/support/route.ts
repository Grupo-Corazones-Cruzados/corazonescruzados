import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Soporte — reglas de acceso (definidas por el usuario, 2026-07-25):
 *  · Cualquier usuario autenticado (cliente, candidato, miembro) **crea** tickets y ve
 *    **solo los suyos** con su estado.
 *  · **Solo el admin** ve todos los tickets, responde y cambia el estado
 *    (ver `/api/support/[id]`).
 */

const TYPES = ['bug', 'feature', 'question', 'other'];
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const status = req.nextUrl.searchParams.get('status');

    // Visibilidad: quien no es admin solo ve SUS tickets. (Antes solo se filtraba al rol
    // `client`, así que los miembros veían los tickets de todo el mundo.)
    let baseWhere = 'WHERE 1=1';
    const baseParams: any[] = [];
    if (user.role !== 'admin') {
      baseParams.push(user.userId);
      baseWhere += ` AND st.user_id = $${baseParams.length}`;
    }

    let where = baseWhere;
    const params: any[] = [...baseParams];
    if (status && status !== 'all') {
      params.push(status);
      where += ` AND st.status = $${params.length}`;
    }

    // Per-status counts for the rail (respect visibility, ignore status filter).
    const countsQ = await pool.query(
      `SELECT st.status, COUNT(*)::int AS n FROM gcc_world.support_tickets st ${baseWhere} GROUP BY st.status`,
      baseParams,
    );
    const counts: Record<string, number> = {};
    let allCount = 0;
    for (const r of countsQ.rows) { counts[r.status] = Number(r.n); allCount += Number(r.n); }
    counts.all = allCount;

    const { rows } = await pool.query(
      `SELECT st.*, (SELECT COUNT(*) FROM gcc_world.support_replies sr WHERE sr.ticket_id = st.id) as reply_count
       FROM gcc_world.support_tickets st
       ${where}
       ORDER BY st.created_at DESC`,
      params
    );

    return NextResponse.json({ data: rows, counts });
  } catch (err: any) {
    console.error('Support error:', err.message);
    return NextResponse.json({ data: [], counts: {} });
  }
}

/** POST — abre un ticket de soporte. Lo puede hacer cualquier usuario autenticado. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const b = await req.json();
    const type = String(b?.type ?? 'bug');
    const subject = String(b?.subject ?? '').trim();
    const message = String(b?.message ?? '').trim();

    if (!TYPES.includes(type)) return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 });
    if (!subject) return NextResponse.json({ error: 'El asunto es obligatorio.' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'Cuéntanos qué ocurre.' }, { status: 400 });
    if (subject.length > MAX_SUBJECT) return NextResponse.json({ error: `El asunto no puede pasar de ${MAX_SUBJECT} caracteres.` }, { status: 400 });
    if (message.length > MAX_MESSAGE) return NextResponse.json({ error: `El mensaje no puede pasar de ${MAX_MESSAGE} caracteres.` }, { status: 400 });

    // El ticket SIEMPRE se abre a nombre de quien lo envía: el `user_id` sale del token,
    // nunca del cuerpo de la petición.
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.support_tickets (user_id, type, subject, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user.userId, type, subject, message],
    );
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Support create error:', err.message);
    return NextResponse.json({ error: 'No se pudo crear el ticket.' }, { status: 500 });
  }
}
