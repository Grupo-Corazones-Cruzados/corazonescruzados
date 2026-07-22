import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureQuoteTables, validateQuoteToken } from '@/lib/cotizaciones/schema';

/**
 * Observaciones de una cotización. El cliente/externo (por token) las agrega desde la vista
 * pública; los internos las ven en el detalle. Sustituyen a las observaciones de DigiMundo;
 * a futuro se convertirán en tareas/recordatorios para el equipo.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    await ensureQuoteTables();
    const token = new URL(req.url).searchParams.get('token');
    if (token) {
      await validateQuoteToken(id, token); // externo
    } else {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { rows } = await pool.query(
      `SELECT id, author_name, author_email, body, status, created_at
         FROM gcc_world.project_observations WHERE project_id = $1 ORDER BY created_at DESC`, [id]);
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error' }, { status: err.status || 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const text = String(body.body || '').trim();
    if (!text) return NextResponse.json({ error: 'La observación está vacía' }, { status: 400 });
    await ensureQuoteTables();

    let authorUserId: string | null = null;
    let authorName: string | null = body.author_name ? String(body.author_name).slice(0, 120) : null;
    let authorEmail: string | null = body.author_email ? String(body.author_email).toLowerCase().slice(0, 160) : null;

    if (body.token) {
      const p = await validateQuoteToken(id, String(body.token)); // externo
      if (!authorEmail) authorEmail = p.quote_client_email || null;
      if (!authorName) authorName = 'Cliente';
    } else {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      authorUserId = user.userId;
      const u = (await pool.query(`SELECT first_name, last_name, email FROM gcc_world.users WHERE id = $1`, [user.userId])).rows[0] || {};
      authorName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || 'Miembro';
      authorEmail = u.email || null;
    }

    const { rows: [obs] } = await pool.query(
      `INSERT INTO gcc_world.project_observations (project_id, author_user_id, author_name, author_email, body)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, author_name, author_email, body, status, created_at`,
      [id, authorUserId, authorName, authorEmail, text.slice(0, 4000)],
    );
    return NextResponse.json({ data: obs }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error' }, { status: err.status || 500 });
  }
}
