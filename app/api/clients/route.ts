import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureClientColumns, resolveMemberId } from '@/lib/clients/account';
import { sqlClienteMio } from '@/lib/pertenencia';

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await ensureClientColumns();

    // `?mine=1` → los clientes que ESTE usuario puede elegir al crear un ticket/proyecto:
    // los que él creó (created_by_member_id) o que ya usó en sus tickets/proyectos. Se EXCLUYE la
    // propia cuenta cliente (no te eliges a ti mismo). La lista se basa en el correo e incluye
    // clientes inactivos (solo-correo).
    // Sin `?mine`, desde el 2026-11-09 la misma lista para todos menos el admin (Fernando: «los
    // miembros no deberían ver los clientes de otros usuarios»). Solo el admin ve todos los clientes.
    // La regla está en `sqlClienteMio` (lib/pertenencia.ts).
    if (user.role !== 'admin') {
      const memberId = await resolveMemberId(user.userId);
      const { rows } = await pool.query(
        `SELECT c.id, c.name, c.email, c.status
           FROM gcc_world.clients c
          WHERE (c.user_id IS DISTINCT FROM $1::uuid)
            AND ${sqlClienteMio('c', '$1', '$2')}
          ORDER BY c.name`,
        [user.userId, memberId],
      );
      return NextResponse.json({ data: rows });
    }

    // Admin (con o sin `mine`): todos los clientes.
    const { rows } = await pool.query(
      `SELECT id, name, email, status FROM gcc_world.clients ORDER BY name`
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Clients list error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
