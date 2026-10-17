import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { esEquipo } from '@/lib/enlaces';

/**
 * GET /api/enlaces/clientes — los clientes a los que se puede atar un enlace: los que TIENEN
 * cuenta en GCC World, porque la validación es iniciar sesión con ella.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  if (!esEquipo(user.role)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { rows } = await pool.query(
    `SELECT c.id, COALESCE(c.name, c.full_name, u.email) AS nombre, u.email
       FROM gcc_world.clients c JOIN gcc_world.users u ON u.id = c.user_id
      WHERE c.account_type = 'client'
      ORDER BY 2`,
  );
  return NextResponse.json({ data: rows });
}
