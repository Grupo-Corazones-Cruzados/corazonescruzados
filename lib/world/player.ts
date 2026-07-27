import { pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { getCurrentUser, type TokenPayload } from '@/lib/auth/jwt';
import { AUTH_COOKIE } from './session';

/**
 * ¿De quién es el personaje? — identidad del jugador por SESIÓN, no por dispositivo
 * ---------------------------------------------------------------------------------
 * Regla del proyecto (2026-07-26): **el personaje pertenece a la cuenta con la que se
 * inicia sesión**. Antes se resolvía por la cookie `gcc_client_token` o por el hash de
 * la IP, así que el personaje era del *dispositivo*: dos personas en la misma red o en
 * el mismo navegador se pisaban, y la misma persona en otro equipo "no existía".
 *
 * Todo jugador logueado acaba teniendo fila en `gcc_world.users`:
 * - miembro/admin y cliente inician sesión contra `users` (JWT);
 * - el candidato, al completar cuenta o iniciar sesión, recibe además su fila `users`
 *   y su JWT vía `grantCandidateDashboardSession()`.
 *
 * Por eso la identidad se resuelve así, en orden:
 *   1. **JWT** (`gcc_world.users`) → su fila de `clients` por `user_id` o por correo.
 *      Si la encuentra por correo y aún no está vinculada, **la vincula** (`user_id`).
 *   2. **Sesión de jugador** (`gcc_player_auth` ↔ `clients.auth_token` vigente), para el
 *      candidato que todavía no tiene JWT.
 *   3. Nada más. **Sin sesión no hay personaje**: ni cookie de dispositivo ni IP.
 */

export type PlayerSession = {
  /** Usuario del dashboard (JWT) si hay sesión; null si solo hay sesión de jugador. */
  user: TokenPayload | null;
  /** `gcc_world.clients.id` del personaje de esa cuenta. null = aún no tiene. */
  clientId: number | null;
};

export async function getPlayerSession(): Promise<PlayerSession> {
  const user = await getCurrentUser();

  if (user) {
    // `COALESCE(..., false)`: en Postgres `user_id = $1` con `user_id` NULL da NULL y
    // un `ORDER BY ... DESC` lo pondría PRIMERO (NULLS FIRST), justo al revés de lo
    // que queremos: la coincidencia exacta por `user_id` manda.
    const { rows } = await pool.query(
      `SELECT id, user_id FROM gcc_world.clients
        WHERE user_id = $1 OR LOWER(email) = LOWER($2)
        ORDER BY COALESCE(user_id = $1, false) DESC, last_seen_at DESC NULLS LAST
        LIMIT 1`,
      [user.userId, user.email],
    );
    const row = rows[0];
    if (row) {
      if (!row.user_id) {
        // Fila encontrada por correo (p. ej. creada antes de que existiera el enlace):
        // se vincula ahora para que a partir de aquí mande la cuenta.
        await pool
          .query(`UPDATE gcc_world.clients SET user_id = $1 WHERE id = $2`, [user.userId, row.id])
          .catch(() => undefined);
      }
      return { user, clientId: row.id };
    }
  }

  const cookieStore = await cookies();
  const auth = cookieStore.get(AUTH_COOKIE)?.value;
  if (auth) {
    const { rows } = await pool.query(
      `SELECT id FROM gcc_world.clients
        WHERE auth_token = $1 AND auth_expires > NOW() LIMIT 1`,
      [auth],
    );
    if (rows[0]) return { user, clientId: rows[0].id };
  }

  return { user, clientId: null };
}
