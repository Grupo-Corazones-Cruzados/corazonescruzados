import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ensureQuoteShareColumns } from '@/lib/cotizaciones/schema';
import { loadQuote } from '@/lib/cotizaciones/data';
import { sendQuoteToClient } from '@/lib/integrations/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org';

/** Verifica que el usuario sea el responsable de la cotización (o admin). */
async function assertOwner(userId: string, role: string, projectId: number) {
  const { rows: [p] } = await pool.query(`SELECT assigned_member_id, created_by_user_id, status FROM gcc_world.projects WHERE id = $1`, [projectId]);
  if (!p) return { ok: false, status: 404, error: 'Cotización no encontrada' };
  if (p.status !== 'cotizacion') return { ok: false, status: 400, error: 'El proyecto ya no es una cotización' };
  const uRow = (await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId])).rows[0] || {};
  const owner = role === 'admin' || (uRow.member_id && Number(uRow.member_id) === Number(p.assigned_member_id)) || p.created_by_user_id === userId;
  return owner ? { ok: true } : { ok: false, status: 403, error: 'No tienes acceso a esta cotización' };
}

/** Genera/renueva el enlace de la cotización (token + expiración) y, opcional, lo envía por correo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id: idStr } = await params;
    const id = Number(idStr);
    const chk = await assertOwner(user.userId, user.role, id);
    if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status });

    const body = await req.json().catch(() => ({}));
    const durationHours = Math.min(Math.max(Number(body.durationHours) || 168, 1), 8760); // default 1 semana, máx 1 año
    const email = body.email ? String(body.email).trim().toLowerCase() : '';

    await ensureQuoteShareColumns();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000);
    await pool.query(
      `UPDATE gcc_world.projects
          SET quote_token = $1, quote_token_expires_at = $2, quote_status = 'pending',
              quote_decided_at = NULL, quote_client_email = COALESCE($3, quote_client_email)
        WHERE id = $4`,
      [token, expiresAt, email || null, id],
    );

    const url = `${APP_URL}/cotizacion/${id}?token=${token}`;
    let emailed = false;
    if (email) {
      try {
        const q = await loadQuote(id);
        await sendQuoteToClient({ email, projectTitle: q?.title || `Cotización #${id}`, total: q?.total || 0, url, responsibleName: q?.responsibleName });
        emailed = true;
      } catch (e: any) { console.error('sendQuoteToClient:', e.message); }
    }
    return NextResponse.json({ data: { token, url, expiresAt: expiresAt.toISOString(), emailed } });
  } catch (err: any) {
    console.error('Quote share error:', err.message);
    return NextResponse.json({ error: err.message || 'Error al compartir' }, { status: 500 });
  }
}

/** Revoca el enlace. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id: idStr } = await params;
    const id = Number(idStr);
    const chk = await assertOwner(user.userId, user.role, id);
    if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status });
    await ensureQuoteShareColumns();
    await pool.query(`UPDATE gcc_world.projects SET quote_token = NULL, quote_token_expires_at = NULL WHERE id = $1`, [id]);
    return NextResponse.json({ data: { revoked: true } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 });
  }
}
