import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getClientIp, hashIp } from '@/lib/world/session';

// GET — ¿este visitante (por IP) ya tiene una cuenta de cliente? Para pedirle
// iniciar sesión en vez de crear cuenta cuando elige "Soy cliente".
export async function GET() {
  try {
    const ipHash = hashIp(await getClientIp());
    const r = await pool.query(
      `SELECT id, email_verified
         FROM gcc_world.clients
        WHERE ip_hash = $1 AND account_type = 'client'
        ORDER BY last_seen_at DESC NULLS LAST
        LIMIT 1`,
      [ipHash],
    );
    const row = r.rows[0];
    return NextResponse.json({
      exists: !!row,
      emailVerified: row ? !!row.email_verified : false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Client status error:', msg);
    return NextResponse.json({ exists: false, error: msg }, { status: 500 });
  }
}
