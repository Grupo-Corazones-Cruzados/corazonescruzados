import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { createToken, setAuthCookie } from '@/lib/auth/jwt';
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  CLIENT_COOKIE,
  COOKIE_MAX_AGE,
  getClientIp,
  hashIp,
} from '@/lib/world/session';

/**
 * Paso 2 del login de MIEMBRO/ADMIN: valida el código (2FA) y abre la sesión.
 * Si tiene personaje → abre su sesión (approved/verified). Si no → lo autentica
 * como staff (JWT) para que arranque el intro y cree su personaje.
 */
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

    const u = await pool.query(
      `SELECT id, role, login_code, login_code_exp FROM gcc_world.users
        WHERE LOWER(email) = $1 AND role IN ('member','admin') LIMIT 1`,
      [cleanEmail],
    );
    const user = u.rows[0];
    if (!user || !user.login_code) {
      return NextResponse.json({ error: 'Solicita primero un código' }, { status: 400 });
    }
    if (!user.login_code_exp || new Date(user.login_code_exp).getTime() < Date.now()) {
      return NextResponse.json({ error: 'El código expiró, pide uno nuevo' }, { status: 400 });
    }
    if (user.login_code !== cleanCode) {
      return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 });
    }

    // Consume el código.
    await pool.query(
      `UPDATE gcc_world.users SET login_code = NULL, login_code_exp = NULL WHERE id = $1`,
      [user.id],
    );

    // Personaje del juego asociado por correo o user_id.
    await pool.query(
      `ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS user_id uuid`,
    );
    const c = await pool.query(
      `SELECT id, client_token FROM gcc_world.clients
        WHERE (LOWER(email) = $1 OR user_id = $2) AND character_data IS NOT NULL
        ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
      [cleanEmail, user.id],
    );
    const character = c.rows[0];

    if (!character) {
      const jwt = await createToken({
        userId: String(user.id),
        email: cleanEmail,
        role: user.role,
      });
      await setAuthCookie(jwt);
      return NextResponse.json({ ok: true, hasCharacter: false });
    }

    const ipHash = hashIp(await getClientIp());
    const clientToken = character.client_token || randomBytes(24).toString('hex');
    const authToken = randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE gcc_world.clients
          SET ip_hash = $1, client_token = $2, auth_token = $3,
              auth_expires = NOW() + INTERVAL '30 days',
              approved = true, email_verified = true, user_id = $5, last_seen_at = NOW()
        WHERE id = $4`,
      [ipHash, clientToken, authToken, character.id, user.id],
    );

    const cookieStore = await cookies();
    cookieStore.set(CLIENT_COOKIE, clientToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
    cookieStore.set(AUTH_COOKIE, authToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: AUTH_COOKIE_MAX_AGE,
    });

    const pk = await pool.query(
      `SELECT 1 FROM gcc_world.client_passkeys WHERE client_id = $1 LIMIT 1`,
      [character.id],
    );
    return NextResponse.json({
      ok: true,
      hasCharacter: true,
      hasPasskey: pk.rows.length > 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Member login verify error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
