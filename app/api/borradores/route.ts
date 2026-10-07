import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * MIS BORRADORES (Fernando, 2026-10-07): los tickets y proyectos en 'draft' que creé yo. Es lo
 * que la pantalla «Borradores» guarda en el dispositivo cuando hay conexión, para poder
 * seguir editándolos sin ella. `updated_at` viaja con cada uno: al subir una edición hecha
 * sin red se devuelve como `si_no_cambio_desde`, y si otro la cambió entretanto el servidor
 * responde 409 en vez de pisarla.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const [tickets, proyectos] = await Promise.all([
      pool.query(
        `SELECT t.id, t.offline_id, t.title, t.description, t.service_id, t.client_id, t.draft_client_email,
                t.deadline, t.estimated_hours, t.estimated_cost, t.required_talents, t.updated_at,
                c.name AS client_name,
                (SELECT COALESCE(json_agg(to_char(ts.date, 'YYYY-MM-DD') ORDER BY ts.date), '[]')
                   FROM gcc_world.ticket_time_slots ts WHERE ts.ticket_id = t.id) AS dias
           FROM gcc_world.tickets t
           LEFT JOIN gcc_world.clients c ON c.id = t.client_id
          WHERE t.status = 'draft' AND t.user_id = $1::uuid
          ORDER BY t.updated_at DESC`,
        [user.userId],
      ),
      pool.query(
        `SELECT p.id, p.offline_id, p.title, p.description, p.client_id, p.client_email, p.deadline,
                p.budget_min, p.budget_max, p.updated_at, c.name AS client_name
           FROM gcc_world.projects p
           LEFT JOIN gcc_world.clients c ON c.id = p.client_id
          WHERE p.status = 'draft' AND p.created_by_user_id = $1
          ORDER BY p.updated_at DESC`,
        [user.userId],
      ),
    ]);
    return NextResponse.json({ tickets: tickets.rows, proyectos: proyectos.rows, leidoEn: new Date().toISOString() });
  } catch (err: any) {
    console.error('Borradores GET:', err.message);
    return NextResponse.json({ error: 'No se pudieron leer los borradores' }, { status: 500 });
  }
}
