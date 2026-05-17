import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CLIENT_COOKIE, getClientIp, hashIp } from '@/lib/world/session';

// Público, solo lectura, best-effort. Resuelve si el visitante de esta
// red/dispositivo corresponde a un usuario de staff (admin/member),
// uniendo clients ↔ users por email (sin migración). Sólo controla la
// VISIBILIDAD del botón "Ingresar como Colaborador" en la landing — el
// acceso real lo protege el login en /auth. Nunca lanza: devuelve
// { role: 'admin' | 'member' } o { role: null }.
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(CLIENT_COOKIE)?.value || null;
    const ip = await getClientIp();
    const ipHash = hashIp(ip);

    const { rows } = await pool.query(
      `SELECT u.role
         FROM gcc_world.clients c
         JOIN gcc_world.users u
           ON lower(u.email) = lower(c.email)
        WHERE ($1::text IS NOT NULL AND c.client_token = $1)
           OR c.ip_hash = $2
        ORDER BY ($1::text IS NOT NULL AND c.client_token = $1) DESC NULLS LAST,
                 c.last_seen_at DESC NULLS LAST
        LIMIT 1`,
      [token, ipHash],
    );

    const role = rows[0]?.role;
    if (role === 'admin' || role === 'member') {
      return NextResponse.json({ role });
    }
    return NextResponse.json({ role: null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('GET /api/auth/landing-role error:', msg);
    return NextResponse.json({ role: null });
  }
}
