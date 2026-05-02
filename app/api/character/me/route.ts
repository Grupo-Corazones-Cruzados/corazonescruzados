import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  AUTH_COOKIE,
  CLIENT_COOKIE,
  getClientIp,
  hashIp,
} from '@/lib/world/session';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(CLIENT_COOKIE)?.value || null;
    const ip = await getClientIp();
    const ipHash = hashIp(ip);

    let row: Record<string, unknown> | null = null;

    const COLS = `id, alias, character_data, password_hash, email_verified,
                  pending_email, auth_token, auth_expires, last_seen_at`;
    if (token) {
      const r = await pool.query(
        `SELECT ${COLS} FROM gcc_world.clients WHERE client_token = $1 LIMIT 1`,
        [token],
      );
      row = r.rows[0] ?? null;
    }

    if (!row) {
      const r = await pool.query(
        `SELECT ${COLS} FROM gcc_world.clients
          WHERE ip_hash = $1 AND character_data IS NOT NULL
          ORDER BY last_seen_at DESC NULLS LAST
          LIMIT 1`,
        [ipHash],
      );
      row = r.rows[0] ?? null;
    }

    if (!row) {
      return NextResponse.json({ exists: false });
    }

    if (row.character_data == null) {
      return NextResponse.json({ exists: false });
    }

    await pool.query(
      `UPDATE gcc_world.clients SET last_seen_at = NOW() WHERE id = $1`,
      [row.id],
    );

    const authCookie = cookieStore.get(AUTH_COOKIE)?.value || null;
    const authValid =
      !!authCookie &&
      !!row.auth_token &&
      authCookie === row.auth_token &&
      row.auth_expires &&
      new Date(row.auth_expires as string).getTime() > Date.now();

    return NextResponse.json({
      exists: true,
      clientId: row.id,
      alias: row.alias,
      characterData: row.character_data,
      hasPassword: !!row.password_hash,
      emailVerified: !!row.email_verified,
      pendingEmail: row.pending_email,
      authenticated: !!authValid,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('Character /me error:', message);
    return NextResponse.json({ error: message, exists: false }, { status: 500 });
  }
}
