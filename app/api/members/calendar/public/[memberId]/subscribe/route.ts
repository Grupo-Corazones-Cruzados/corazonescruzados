import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendCalendarSubscribeVerification } from '@/lib/integrations/resend';

type RouteCtx = { params: Promise<{ memberId: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest, ctx: RouteCtx) {
  try {
    const { memberId } = await ctx.params;
    const body = await req.json();
    const token = String(body.token || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Email inválido' }, { status: 400 });

    const memberRes = await pool.query(
      `SELECT id, name FROM gcc_world.members
       WHERE id = $1 AND calendar_public_token = $2 LIMIT 1`,
      [memberId, token],
    );
    const member = memberRes.rows[0];
    if (!member) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 });

    const verificationToken = crypto.randomBytes(32).toString('hex');

    await pool.query(
      `INSERT INTO gcc_world.member_calendar_subscribers (member_id, email, verification_token)
       VALUES ($1, $2, $3)
       ON CONFLICT (member_id, email)
       DO UPDATE SET verification_token = EXCLUDED.verification_token,
                     verified = FALSE,
                     verified_at = NULL`,
      [memberId, email, verificationToken],
    );

    try {
      await sendCalendarSubscribeVerification(email, verificationToken, member.name);
    } catch (err: any) {
      console.error('Calendar subscribe email error:', err.message);
      return NextResponse.json({ error: 'No se pudo enviar el correo de confirmación' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Calendar subscribe error:', err.message);
    return NextResponse.json({ error: 'Error al suscribir' }, { status: 500 });
  }
}
