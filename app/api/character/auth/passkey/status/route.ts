import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
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

    let clientId: number | null = null;
    if (token) {
      const r = await pool.query(
        `SELECT id FROM gcc_world.clients WHERE client_token = $1 LIMIT 1`,
        [token],
      );
      clientId = r.rows[0]?.id ?? null;
    }
    if (!clientId) {
      const r = await pool.query(
        `SELECT id FROM gcc_world.clients
          WHERE ip_hash = $1
          ORDER BY last_seen_at DESC NULLS LAST
          LIMIT 1`,
        [ipHash],
      );
      clientId = r.rows[0]?.id ?? null;
    }

    if (!clientId) return NextResponse.json({ hasPasskeys: false });

    const c = await pool.query(
      `SELECT COUNT(*)::int AS n FROM gcc_world.client_passkeys WHERE client_id = $1`,
      [clientId],
    );
    return NextResponse.json({ hasPasskeys: (c.rows[0]?.n ?? 0) > 0 });
  } catch {
    return NextResponse.json({ hasPasskeys: false });
  }
}
