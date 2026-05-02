import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { verifyPassword } from '@/lib/auth/password';
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  CLIENT_COOKIE,
  COOKIE_MAX_AGE,
  getClientIp,
  hashIp,
} from '@/lib/world/session';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Correo y contraseña son requeridos' },
        { status: 400 },
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const r = await pool.query(
      `SELECT id, password_hash, email_verified, client_token
         FROM gcc_world.clients
        WHERE LOWER(email) = $1 AND password_hash IS NOT NULL
        LIMIT 1`,
      [cleanEmail],
    );
    const row = r.rows[0];
    if (!row) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 },
      );
    }
    if (!row.email_verified) {
      return NextResponse.json(
        { error: 'Tu correo no está verificado todavía' },
        { status: 403 },
      );
    }

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 },
      );
    }

    const authToken = randomBytes(32).toString('hex');
    const ip = await getClientIp();
    const ipHash = hashIp(ip);
    await pool.query(
      `UPDATE gcc_world.clients
          SET auth_token = $1,
              auth_expires = NOW() + INTERVAL '30 days',
              ip_hash = $2,
              last_seen_at = NOW()
        WHERE id = $3`,
      [authToken, ipHash, row.id],
    );

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE, authToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: AUTH_COOKIE_MAX_AGE,
    });
    if (row.client_token) {
      cookieStore.set(CLIENT_COOKIE, row.client_token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Character login error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
