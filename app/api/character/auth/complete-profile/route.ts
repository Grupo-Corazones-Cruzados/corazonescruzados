import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { hashPassword } from '@/lib/auth/password';
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  CLIENT_COOKIE,
  getClientIp,
  hashIp,
} from '@/lib/world/session';

/**
 * Completa el perfil del CANDIDATO aprobado cuyo correo YA está verificado:
 * guarda directo (sin código) la contraseña (reemplaza la temporal) + datos, y
 * deja la sesión activa. No envía correo de verificación.
 */
export async function POST(req: Request) {
  try {
    const { password, fullName, country, address, phone } = await req.json();
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(CLIENT_COOKIE)?.value || null;
    const ipHash = hashIp(await getClientIp());

    let row: { id: number; email_verified: boolean } | null = null;
    if (token) {
      const r = await pool.query(
        `SELECT id, email_verified FROM gcc_world.clients WHERE client_token = $1 LIMIT 1`,
        [token],
      );
      row = r.rows[0] ?? null;
    }
    if (!row) {
      const r = await pool.query(
        `SELECT id, email_verified FROM gcc_world.clients
          WHERE ip_hash = $1 AND character_data IS NOT NULL
          ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
        [ipHash],
      );
      row = r.rows[0] ?? null;
    }
    if (!row) {
      return NextResponse.json(
        { error: 'No se encontró tu cuenta. Inicia sesión de nuevo.' },
        { status: 404 },
      );
    }
    if (!row.email_verified) {
      return NextResponse.json(
        { error: 'Tu correo aún no está verificado.' },
        { status: 403 },
      );
    }

    const passwordHash = await hashPassword(password);
    const authToken = randomBytes(32).toString('hex');

    await pool.query(
      `UPDATE gcc_world.clients
          SET password_hash = $1,
              full_name = COALESCE(NULLIF($2, ''), full_name),
              country = COALESCE(NULLIF($3, ''), country),
              address = COALESCE(NULLIF($4, ''), address),
              phone = COALESCE(NULLIF($5, ''), phone),
              auth_token = $6,
              auth_expires = NOW() + INTERVAL '30 days',
              pending_email = NULL,
              pending_password_hash = NULL,
              last_seen_at = NOW()
        WHERE id = $7`,
      [
        passwordHash,
        typeof fullName === 'string' ? fullName.trim() : '',
        typeof country === 'string' ? country.trim() : '',
        typeof address === 'string' ? address.trim() : '',
        typeof phone === 'string' ? phone.trim() : '',
        authToken,
        row.id,
      ],
    );

    cookieStore.set(AUTH_COOKIE, authToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: AUTH_COOKIE_MAX_AGE,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Complete profile error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
