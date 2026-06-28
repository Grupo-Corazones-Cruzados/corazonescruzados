import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getClientIp, hashIp } from '@/lib/world/session';

const CLIENT_REF_COOKIE = 'gcc_client_ref';

/**
 * Estado de la cuenta de CLIENTE de este dispositivo (por cookie o IP): si existe
 * y si su correo está verificado. Lo usa el menú "¿Cómo quieres ingresar?" para
 * mostrar "tu cuenta requiere verificación" y evitar nuevas solicitudes.
 */
export async function GET() {
  try {
    await pool.query(
      `ALTER TABLE gcc_world.users
         ADD COLUMN IF NOT EXISTS ref_token text,
         ADD COLUMN IF NOT EXISTS ip_hash text`,
    );
    const cookieStore = await cookies();
    const ref = cookieStore.get(CLIENT_REF_COOKIE)?.value || null;
    const ipHash = hashIp(await getClientIp());

    const r = await pool.query(
      `SELECT email, is_verified FROM gcc_world.users
        WHERE role = 'client' AND (($1::text IS NOT NULL AND ref_token = $1) OR ip_hash = $2)
        ORDER BY ($1::text IS NOT NULL AND ref_token = $1) DESC
        LIMIT 1`,
      [ref, ipHash],
    );
    const row = r.rows[0];
    if (!row) {
      return NextResponse.json({ exists: false });
    }
    return NextResponse.json({
      exists: true,
      email: row.email,
      verified: !!row.is_verified,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Client status error:', msg);
    return NextResponse.json({ exists: false, error: msg }, { status: 500 });
  }
}
