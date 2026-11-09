import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { encaja, talentosAbiertosDelProyecto, talentosDelRequerimiento, top5DeMiembros } from '@/lib/talentos/demostrados';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Personas a las que se puede invitar o asignar: miembros activos y candidatos (su ficha de
 * miembro nace inactiva, pero ofertan y se asignan igual; Fernando, 2026-11-09).
 *
 * Con `proyecto=<id>` o `requerimiento=<id>` salen solo quienes tienen demostrado alguno de
 * los talentos que ese trabajo pide (top 5, `lib/talentos/demostrados.ts`), más uno mismo. Las
 * rutas que invitan o asignan lo vuelven a comprobar.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const sp = req.nextUrl.searchParams;

    const [{ rows }, pedidos, { rows: [yo] }] = await Promise.all([
      pool.query(
        `SELECT m.id, m.name, m.email, m.photo_url,
                EXISTS (SELECT 1 FROM gcc_world.users u WHERE u.member_id = m.id) AS con_cuenta
           FROM gcc_world.members m
          WHERE m.is_active = true
             OR EXISTS (SELECT 1 FROM gcc_world.users u
                          JOIN gcc_world.clients c ON c.user_id = u.id AND c.account_type = 'candidate'
                         WHERE u.member_id = m.id AND u.role NOT IN ('admin', 'member'))
          ORDER BY m.name`,
      ),
      /^\d+$/.test(sp.get('requerimiento') || '') ? talentosDelRequerimiento(sp.get('requerimiento')!)
        : /^\d+$/.test(sp.get('proyecto') || '') ? talentosAbiertosDelProyecto(sp.get('proyecto')!)
        : Promise.resolve(null),
      pool.query(`SELECT member_id::text AS member_id FROM gcc_world.users WHERE id = $1`, [user.userId]),
    ]);

    if (!pedidos || !pedidos.length) return NextResponse.json({ data: rows });
    const tops = await top5DeMiembros(rows.map((r: any) => r.id));
    const data = rows.filter((r: any) => String(r.id) === String(yo?.member_id ?? '') || encaja(tops.get(String(r.id)) || [], pedidos));
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Members list error:', err.message);
    // Vacía con 200 se leería como «no hay nadie con ese talento».
    return NextResponse.json({ error: 'No se pudo cargar la lista de personas', data: [] }, { status: 500 });
  }
}
