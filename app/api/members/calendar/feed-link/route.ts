import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { asegurarColumnasIcal } from '@/lib/calendar/ical';

/**
 * Enlace iCal SECRETO del calendario propio (con títulos), para otras apps. Distinto del enlace
 * público de libre/ocupado (`public-link`). GET lo lee, POST lo crea o regenera (el anterior deja
 * de funcionar), DELETE lo apaga.
 */
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org').replace(/\/$/, '');
const urlDe = (t: string | null) => (t ? `${APP_URL}/api/calendario/ical/${t}.ics` : null);

async function miembro() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
  if (!u?.member_id) return { error: NextResponse.json({ error: 'Not a member' }, { status: 403 }) };
  await asegurarColumnasIcal();
  return { memberId: u.member_id as string };
}

export async function GET() {
  const m = await miembro();
  if ('error' in m) return m.error;
  const { rows: [r] } = await pool.query(
    `SELECT calendar_feed_token, calendar_feed_token_created_at FROM gcc_world.members WHERE id = $1`, [m.memberId]);
  return NextResponse.json({ url: urlDe(r?.calendar_feed_token || null), created_at: r?.calendar_feed_token_created_at || null });
}

export async function POST() {
  const m = await miembro();
  if ('error' in m) return m.error;
  const token = crypto.randomBytes(24).toString('hex');
  await pool.query(
    `UPDATE gcc_world.members SET calendar_feed_token = $1, calendar_feed_token_created_at = NOW() WHERE id = $2`,
    [token, m.memberId]);
  return NextResponse.json({ url: urlDe(token), created_at: new Date().toISOString() });
}

export async function DELETE() {
  const m = await miembro();
  if ('error' in m) return m.error;
  await pool.query(
    `UPDATE gcc_world.members SET calendar_feed_token = NULL, calendar_feed_token_created_at = NULL WHERE id = $1`,
    [m.memberId]);
  return NextResponse.json({ ok: true });
}
