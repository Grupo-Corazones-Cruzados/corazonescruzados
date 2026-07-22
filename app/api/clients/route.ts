import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureClientColumns, resolveMemberId } from '@/lib/clients/account';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await ensureClientColumns();

    // `?mine=1` → los clientes que ESTE usuario puede elegir al crear un ticket/proyecto:
    // los que él creó (created_by_member_id) o que ya usó en sus tickets/proyectos. El admin
    // ve todos. Se EXCLUYE la propia cuenta cliente (no te eliges a ti mismo). La lista se
    // basa en el correo e incluye clientes inactivos (solo-correo).
    const mine = req.nextUrl.searchParams.get('mine') === '1';
    if (mine && user.role !== 'admin') {
      const memberId = await resolveMemberId(user.userId);
      const { rows } = await pool.query(
        `SELECT DISTINCT c.id, c.name, c.email, c.status
           FROM gcc_world.clients c
          WHERE (c.user_id IS DISTINCT FROM $1)
            AND (
              ($2::bigint IS NOT NULL AND c.created_by_member_id = $2)
              OR c.id IN (SELECT client_id FROM gcc_world.tickets  WHERE user_id = $1 AND client_id IS NOT NULL)
              OR c.id IN (SELECT client_id FROM gcc_world.projects WHERE created_by_user_id = $1::text AND client_id IS NOT NULL)
            )
          ORDER BY c.name`,
        [user.userId, memberId],
      );
      return NextResponse.json({ data: rows });
    }

    // Default (y `mine` para admin): todos los clientes.
    const { rows } = await pool.query(
      `SELECT id, name, email, status FROM gcc_world.clients ORDER BY name`
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Clients list error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
