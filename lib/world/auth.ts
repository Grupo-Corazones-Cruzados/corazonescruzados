import { pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, CLIENT_COOKIE } from './session';

export const ADMIN_EMAIL = 'lfgonzalezm0@outlook.com';

export type AuthedClient = {
  id: number;
  email: string;
  alias: string | null;
  isAdmin: boolean;
};

/**
 * Returns the currently authenticated player (must have a valid
 * gcc_player_auth cookie matching their auth_token in the DB).
 * Returns null when there is no valid session.
 */
export async function getAuthedClient(): Promise<AuthedClient | null> {
  const cookieStore = await cookies();
  const auth = cookieStore.get(AUTH_COOKIE)?.value;
  const client = cookieStore.get(CLIENT_COOKIE)?.value;
  if (!auth) return null;

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
  if (!row || !row.email_verified) return null;

  return {
    id: row.id,
    email: row.email,
    alias: row.alias,
    isAdmin:
      typeof row.email === 'string' &&
      row.email.toLowerCase() === ADMIN_EMAIL,
  };
}
