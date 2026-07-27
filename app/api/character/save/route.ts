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
import { getPlayerSession } from '@/lib/world/player';

/**
 * Guarda el personaje del jugador.
 *
 * **El personaje queda vinculado a la CUENTA con la que se inició sesión**
 * (`gcc_world.clients.user_id` → `gcc_world.users.id`), no al dispositivo. Sin sesión
 * responde 401: antes, si no reconocía la cookie del navegador, creaba una fila
 * "invitado" con un correo `@guest.gcc-world.local` — un personaje huérfano atado al
 * aparato que nadie podía recuperar desde otro equipo.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const characterData = body?.characterData;
    const aliasInput =
      typeof body?.alias === 'string' ? body.alias.trim() : '';
    const alias =
      aliasInput ||
      (typeof characterData?.name === 'string'
        ? characterData.name.trim()
        : '');

    if (!alias || !characterData || typeof characterData !== 'object') {
      return NextResponse.json(
        { error: 'alias y characterData son requeridos' },
        { status: 400 },
      );
    }

    const json = JSON.stringify(characterData);

    // Identidad por sesión: JWT de `users` (miembro/admin/cliente/candidato) o sesión
    // de jugador. `clientId` es la fila que YA le pertenece a esa cuenta, si la hay.
    const { user, clientId: existingId } = await getPlayerSession();
    if (!user && !existingId) {
      return NextResponse.json(
        { error: 'Inicia sesión para guardar tu personaje' },
        { status: 401 },
      );
    }

    const ip = await getClientIp();
    const ipHash = hashIp(ip);

    const cookieStore = await cookies();
    let token = cookieStore.get(CLIENT_COOKIE)?.value;
    if (!token) token = generateClientToken();

    // Sesión de personaje (AUTH_COOKIE) para quien entra con JWT: es la que usan las
    // rutas del juego y la que habilita registrar passkey.
    const playerAuthToken = user ? randomBytes(32).toString('hex') : null;

    await pool.query(
      `ALTER TABLE gcc_world.clients
         ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
         ADD COLUMN IF NOT EXISTS user_id uuid`,
    );

    let clientId: number;

    if (existingId) {
      // Ya tiene fila (candidato con su cuenta, miembro que entró por member-login,
      // o quien vuelve a pasar por el creador): se actualiza SU fila.
      // - `user_id`: se vincula/mantiene con COALESCE (no se borra si no hay JWT).
      // - `approved`/`email_verified`: solo se elevan con JWT; al creador solo se
      //   llega con la cuenta ya aprobada, y así no se pisa el gate del candidato.
      const updated = await pool.query(
        `UPDATE gcc_world.clients
            SET alias = $1,
                character_data = $2::jsonb,
                client_token = $3,
                ip_hash = $4,
                user_id = COALESCE($6::uuid, user_id),
                auth_token = COALESCE($7::text, auth_token),
                auth_expires = CASE WHEN $7::text IS NULL THEN auth_expires
                                    ELSE NOW() + INTERVAL '30 days' END,
                approved = CASE WHEN $8::boolean THEN true ELSE approved END,
                email_verified = CASE WHEN $8::boolean THEN true ELSE email_verified END,
                last_seen_at = NOW()
          WHERE id = $5
        RETURNING id`,
        [alias, json, token, ipHash, existingId, user?.userId ?? null, playerAuthToken, !!user],
      );
      clientId = updated.rows[0].id;
    } else {
      // Usuario con cuenta pero sin fila de mundo todavía (primer personaje).
      const inserted = await pool.query(
        `INSERT INTO gcc_world.clients
            (name, email, user_id, alias, character_data,
             client_token, ip_hash, auth_token, auth_expires,
             approved, email_verified, last_seen_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8,
                 NOW() + INTERVAL '30 days', true, true, NOW())
         RETURNING id`,
        [alias, user!.email, user!.userId, alias, json, token, ipHash, playerAuthToken],
      );
      clientId = inserted.rows[0].id;
    }

    cookieStore.set(CLIENT_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
    // Deja activa la sesión de personaje (permite registrar passkey y jugar).
    if (playerAuthToken) {
      cookieStore.set(AUTH_COOKIE, playerAuthToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: AUTH_COOKIE_MAX_AGE,
      });
    }

    return NextResponse.json({
      ok: true,
      clientId,
      alias,
      // El personaje siempre queda enlazado a una cuenta: ya no hay invitados.
      guest: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('Character save error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
