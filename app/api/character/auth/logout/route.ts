import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, CLIENT_COOKIE, getClientIp, hashIp } from '@/lib/world/session';

const STAFF_COOKIE = 'auth_token';

/**
 * Cierra la sesión y DESVINCULA el dispositivo de la cuenta: limpia las cookies
 * (personaje + staff) y borra client_token/auth_token/ip_hash de la fila, para
 * que /api/character/me ya no la reconozca por cookie ni por IP. Lo usa "Cambiar
 * tipo de ingreso" para poder entrar con otra cuenta.
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(CLIENT_COOKIE)?.value || null;
    const ipHash = hashIp(await getClientIp());

    let row: { id: number } | null = null;
    if (token) {
      row =
        (
          await pool.query(
            `SELECT id FROM gcc_world.clients WHERE client_token = $1 LIMIT 1`,
            [token],
          )
        ).rows[0] ?? null;
    }
    if (!row) {
      row =
        (
          await pool.query(
            `SELECT id FROM gcc_world.clients WHERE ip_hash = $1
              ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
            [ipHash],
          )
        ).rows[0] ?? null;
    }
    if (row) {
      await pool.query(
        `UPDATE gcc_world.clients
            SET client_token = NULL, auth_token = NULL, auth_expires = NULL, ip_hash = NULL
          WHERE id = $1`,
        [row.id],
      );
    }

    cookieStore.delete(CLIENT_COOKIE);
    cookieStore.delete(AUTH_COOKIE);
    cookieStore.delete(STAFF_COOKIE);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Character logout error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
