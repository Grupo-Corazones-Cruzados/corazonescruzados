import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { pool } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { sendVerificationEmail } from '@/lib/integrations/email';

/**
 * REENVIAR EL CORREO DE VERIFICACIÓN de una cuenta de cliente (Fernando, 2026-10-29: «si no está
 * verificado todavía debe salir en el formulario de inicio de sesión que hace falta verificarse…
 * y que se puede reenviar el correo»).
 *
 * Pide correo y contraseña (los mismos del inicio de sesión): solo quien conoce la contraseña
 * puede disparar el envío, y el enlace va siempre al correo de la cuenta. Como mucho uno por
 * minuto. Responde igual de vago si las credenciales no valen, para no revelar cuentas.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || typeof password !== 'string') {
      return NextResponse.json({ error: 'Faltan el correo o la contraseña.' }, { status: 400 });
    }
    const { rows: [user] } = await pool.query(
      `SELECT id, email, password_hash, is_verified, first_name FROM gcc_world.users WHERE LOWER(email) = $1 LIMIT 1`,
      [cleanEmail],
    );
    if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }
    if (user.is_verified) {
      return NextResponse.json({ ok: true, yaVerificada: true });
    }
    // Uno por minuto: el último enlace vence a las 24 h, así que si vence en más de 23 h 59 min
    // es que se envió hace menos de un minuto.
    const { rows: [reciente] } = await pool.query(
      `SELECT 1 FROM gcc_world.verification_tokens
        WHERE user_id = $1 AND expires_at > NOW() + INTERVAL '23 hours 59 minutes' LIMIT 1`,
      [user.id],
    );
    if (reciente) {
      return NextResponse.json({ error: 'Acabamos de enviarlo. Espera un minuto antes de pedir otro.' }, { status: 429 });
    }
    const token = randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO gcc_world.verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
      [user.id, token],
    );
    await sendVerificationEmail(user.email, token, user.first_name || undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[auth/verify/reenviar]', (e as Error).message);
    return NextResponse.json({ error: 'No pudimos reenviar el correo. Inténtalo de nuevo.' }, { status: 500 });
  }
}
