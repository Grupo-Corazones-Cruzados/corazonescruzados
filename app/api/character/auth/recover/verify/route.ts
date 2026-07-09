import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { grantCandidateDashboardSession } from '@/lib/auth/candidateSession';
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  CLIENT_COOKIE,
  COOKIE_MAX_AGE,
  generateClientToken,
  getClientIp,
  hashIp,
} from '@/lib/world/session';

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    if (typeof email !== 'string' || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Correo y código son requeridos' },
        { status: 400 },
      );
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    const r = await pool.query(
      `SELECT id, recovery_code, recovery_code_exp, client_token
         FROM gcc_world.clients
        WHERE LOWER(email) = $1
        LIMIT 1`,
      [cleanEmail],
    );
    const row = r.rows[0];
    if (!row || !row.recovery_code) {
      return NextResponse.json(
        { error: 'Solicita primero un código' },
        { status: 400 },
      );
    }
    if (
      !row.recovery_code_exp ||
      new Date(row.recovery_code_exp).getTime() < Date.now()
    ) {
      return NextResponse.json(
        { error: 'El código expiró, pide uno nuevo' },
        { status: 400 },
      );
    }
    if (row.recovery_code !== cleanCode) {
      return NextResponse.json(
        { error: 'Código incorrecto' },
        { status: 401 },
      );
    }

    // Code accepted: bind this device's IP and (re)generate cookies.
    const ip = await getClientIp();
    const ipHash = hashIp(ip);
    const newClientToken = row.client_token || generateClientToken();
    const newAuthToken = randomBytes(32).toString('hex');

    await pool.query(
      `UPDATE gcc_world.clients
          SET ip_hash = $1,
              client_token = $2,
              auth_token = $3,
              auth_expires = NOW() + INTERVAL '30 days',
              recovery_code = NULL,
              recovery_code_exp = NULL,
              last_seen_at = NOW()
        WHERE id = $4`,
      [ipHash, newClientToken, newAuthToken, row.id],
    );

    const cookieStore = await cookies();
    cookieStore.set(CLIENT_COOKIE, newClientToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
    cookieStore.set(AUTH_COOKIE, newAuthToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: AUTH_COOKIE_MAX_AGE,
    });

    // Da también sesión de /dashboard (rol client + JWT) al candidato para que, si entró
    // por "Colaborar", llegue al panel con UN solo login (sin rebotar a /auth).
    try { await grantCandidateDashboardSession(cleanEmail); }
    catch (e) { console.error('grant candidate dashboard session (recover/verify):', e); }

    const pk = await pool.query(
      `SELECT 1 FROM gcc_world.client_passkeys WHERE client_id = $1 LIMIT 1`,
      [row.id],
    );
    return NextResponse.json({ ok: true, hasPasskey: pk.rows.length > 0 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Recovery verify error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
