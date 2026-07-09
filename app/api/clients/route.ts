import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // `?mine=1` → clientes a quienes YO ofrezco servicio (para "Nuevo ticket"): los que ya he
    // usado en tickets que yo creé. **Excluye mi propia cuenta cliente** (no me puedo elegir a
    // mí mismo). (La asociación completa desde el módulo Clientes se integrará después.)
    const mine = req.nextUrl.searchParams.get('mine') === '1';
    if (mine) {
      const { rows } = await pool.query(
        `SELECT DISTINCT c.id, c.name, c.email
           FROM gcc_world.clients c
          WHERE c.id IN (SELECT client_id FROM gcc_world.tickets WHERE user_id = $1 AND client_id IS NOT NULL)
            AND (c.user_id IS DISTINCT FROM $1)
          ORDER BY c.name`,
        [user.userId],
      );
      return NextResponse.json({ data: rows });
    }

    const { rows } = await pool.query(
      `SELECT id, name, email FROM gcc_world.clients ORDER BY name`
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Clients list error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
