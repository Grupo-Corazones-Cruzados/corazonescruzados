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

/**
 * Inicio de sesión de MIEMBRO/ADMIN para ENTRAR AL JUEGO.
 * Valida credenciales contra gcc_world.users (rol member/admin) y abre la
 * sesión del personaje (gcc_world.clients) asociado por correo. No usa el flujo
 * de candidato ("Ya tengo una cuenta", que es solo para candidatos).
 */
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

    // 1) Debe ser un miembro/admin con credenciales válidas.
    const u = await pool.query(
      `SELECT id, password_hash, role FROM gcc_world.users
        WHERE LOWER(email) = $1 AND role IN ('member','admin') LIMIT 1`,
      [cleanEmail],
    );
    const user = u.rows[0];
    if (!user || !user.password_hash) {
      return NextResponse.json(
        { error: 'No es una cuenta de miembro o credenciales inválidas' },
        { status: 401 },
      );
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
    }

    // 2) Personaje del juego asociado por correo.
    const c = await pool.query(
      `SELECT id, client_token FROM gcc_world.clients
        WHERE LOWER(email) = $1 AND character_data IS NOT NULL
        ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
      [cleanEmail],
    );
    const character = c.rows[0];
    if (!character) {
      return NextResponse.json(
        { error: 'No tienes un personaje en el juego todavía.', noCharacter: true },
        { status: 404 },
      );
    }

    // 3) Abre la sesión del personaje en este dispositivo. Los miembros entran
    //    sin gate de aprobación: se marca approved=true.
    const ip = await getClientIp();
    const ipHash = hashIp(ip);
    const clientToken = character.client_token || randomBytes(24).toString('hex');
    const authToken = randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE gcc_world.clients
          SET ip_hash = $1,
              client_token = $2,
              auth_token = $3,
              auth_expires = NOW() + INTERVAL '30 days',
              approved = true,
              last_seen_at = NOW()
        WHERE id = $4`,
      [ipHash, clientToken, authToken, character.id],
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

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Member login error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
