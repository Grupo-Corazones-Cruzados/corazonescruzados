import { pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, CLIENT_COOKIE } from './session';
import { getPlayerSession } from './player';

export const ADMIN_EMAIL = 'lfgonzalezm0@outlook.com';

export type AuthedClient = {
  id: number;
  email: string;
  alias: string | null;
  isAdmin: boolean;
};

/**
 * Devuelve el jugador autenticado, o null si no hay sesión válida.
 *
 * Dos sesiones valen, y ambas son de CUENTA (nunca de dispositivo ni de IP):
 * 1. **Sesión de jugador**: cookie `gcc_player_auth` que casa con `clients.auth_token`
 *    vigente (la que abren los logins del mundo: candidato, miembro, passkey).
 * 2. **JWT del dashboard**: el cliente inicia sesión en `/api/auth/login/verify`, que
 *    NO abre sesión de jugador; sin este fallback su personaje existía pero el juego
 *    le respondía 401 en cada ruta. Se resuelve por `user_id` (o correo) vía
 *    `getPlayerSession()`, que además vincula la fila a su usuario.
 */
export async function getAuthedClient(): Promise<AuthedClient | null> {
  const cookieStore = await cookies();
  const auth = cookieStore.get(AUTH_COOKIE)?.value;
  const client = cookieStore.get(CLIENT_COOKIE)?.value;

  if (auth) {
    const r = await pool.query(
      `SELECT id, email, alias, email_verified
         FROM gcc_world.clients
        WHERE auth_token = $1
          AND auth_expires > NOW()
          ${client ? 'AND client_token = $2' : ''}
        LIMIT 1`,
      client ? [auth, client] : [auth],
    );
    const row = r.rows[0];
    if (row && row.email_verified) return toAuthedClient(row);
  }

  // Fallback por cuenta del dashboard. No se exige `email_verified` de `clients`:
  // la prueba es el JWT, que solo se emite a usuarios verificados de `users`.
  const { user, clientId } = await getPlayerSession();
  if (!user || !clientId) return null;

  const r = await pool.query(
    `SELECT id, email, alias FROM gcc_world.clients WHERE id = $1 LIMIT 1`,
    [clientId],
  );
  const row = r.rows[0];
  return row ? toAuthedClient(row) : null;
}

function toAuthedClient(row: {
  id: number;
  email: string;
  alias: string | null;
}): AuthedClient {
  return {
    id: row.id,
    email: row.email,
    alias: row.alias,
    isAdmin:
      typeof row.email === 'string' && row.email.toLowerCase() === ADMIN_EMAIL,
  };
}
