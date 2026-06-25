import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  CLIENT_COOKIE,
  COOKIE_MAX_AGE,
  generateClientToken,
  getClientIp,
  hashIp,
} from '@/lib/world/session';

/**
 * Login para CONTINUAR LA PARTIDA — paso 2: valida el código (2FA) y abre la
 * sesión del personaje. Funciona para MIEMBRO/ADMIN y para CANDIDATO.
 */
async function openCharacterSession(clientId: number, userId: string | null) {
  const ipHash = hashIp(await getClientIp());
  const clientToken = generateClientToken();
  const authToken = randomBytes(32).toString('hex');
  await pool.query(
    `UPDATE gcc_world.clients
        SET ip_hash = $1, client_token = $2, auth_token = $3,
            auth_expires = NOW() + INTERVAL '30 days',
            approved = true, email_verified = true,
            user_id = COALESCE($5, user_id), last_seen_at = NOW()
      WHERE id = $4`,
    [ipHash, clientToken, authToken, clientId, userId],
  );
  const cookieStore = await cookies();
  cookieStore.set(CLIENT_COOKIE, clientToken, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: COOKIE_MAX_AGE,
  });
  cookieStore.set(AUTH_COOKIE, authToken, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: AUTH_COOKIE_MAX_AGE,
  });
}

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    if (typeof email !== 'string' || typeof code !== 'string') {
      return NextResponse.json({ error: 'Correo y código son requeridos' }, { status: 400 });
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // ¿Miembro/admin?
    const u = await pool.query(
      `SELECT id, role, login_code, login_code_exp FROM gcc_world.users
        WHERE LOWER(email) = $1 AND role IN ('member','admin') LIMIT 1`,
      [cleanEmail],
    );
    const member = u.rows[0];
    if (member) {
      if (!member.login_code) {
        return NextResponse.json({ error: 'Solicita primero un código' }, { status: 400 });
      }
      if (!member.login_code_exp || new Date(member.login_code_exp).getTime() < Date.now()) {
        return NextResponse.json({ error: 'El código expiró, pide uno nuevo' }, { status: 400 });
      }
      if (member.login_code !== cleanCode) {
        return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 });
      }
      await pool.query(
        `UPDATE gcc_world.users SET login_code = NULL, login_code_exp = NULL WHERE id = $1`,
        [member.id],
      );
      const c = await pool.query(
        `SELECT id FROM gcc_world.clients
          WHERE (LOWER(email) = $1 OR user_id = $2) AND character_data IS NOT NULL
          ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
        [cleanEmail, member.id],
      );
      if (!c.rows[0]) {
        return NextResponse.json({ ok: true, hasCharacter: false });
      }
      await openCharacterSession(c.rows[0].id, member.id);
      return NextResponse.json({ ok: true, hasCharacter: true });
    }

    // Candidato: valida el código de recuperación del personaje.
    const r = await pool.query(
      `SELECT id, recovery_code, recovery_code_exp FROM gcc_world.clients
        WHERE LOWER(email) = $1 LIMIT 1`,
      [cleanEmail],
    );
    const row = r.rows[0];
    if (!row || !row.recovery_code) {
      return NextResponse.json({ error: 'Solicita primero un código' }, { status: 400 });
    }
    if (!row.recovery_code_exp || new Date(row.recovery_code_exp).getTime() < Date.now()) {
      return NextResponse.json({ error: 'El código expiró, pide uno nuevo' }, { status: 400 });
    }
    if (row.recovery_code !== cleanCode) {
      return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 });
    }
    await pool.query(
      `UPDATE gcc_world.clients SET recovery_code = NULL, recovery_code_exp = NULL WHERE id = $1`,
      [row.id],
    );
    await openCharacterSession(row.id, null);
    return NextResponse.json({ ok: true, hasCharacter: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Returning verify error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
