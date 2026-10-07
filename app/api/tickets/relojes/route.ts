import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { ensureTicketActionColumns } from '@/lib/tickets/schema';

export const dynamic = 'force-dynamic';

/**
 * MIS RELOJES EN MARCHA (Fernando, 2026-10-06).
 *
 * La app del teléfono enseña el reloj de un ticket en la pantalla de bloqueo. El reloj vive
 * en el servidor (`ticket_actions.timer_started_at`), así que el teléfono pregunta aquí qué
 * hay en marcha al abrirse, al volver a primer plano y después de iniciar o detener: un reloj
 * arrancado en el computador aparece en el teléfono y uno detenido allí desaparece.
 *
 * «Míos» = los de los tickets asignados a mi miembro. Ni siquiera el administrador ve aquí los
 * de los demás: es su pantalla de bloqueo, no un tablero. Sin miembro enlazado, lista vacía
 * (y es de verdad vacía: no hay relojes que puedan ser suyos).
 *
 * `inicio` es la hora desde la que el teléfono cuenta: `timer_started_at` MENOS lo ya
 * acumulado. Si no se resta, al reanudar un registro el teléfono empezaría en cero mientras la
 * web dice 1:20:00.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    await ensureTicketActionColumns();

    const { rows } = await pool.query(
      `SELECT a.id AS registro_id, a.ticket_id, a.description, a.timer_started_at,
              COALESCE(a.duration_seconds, 0) AS duration_seconds,
              t.title AS ticket_titulo, c.name AS cliente,
              COALESCE(s.base_price, 0) AS tarifa
         FROM gcc_world.users u
         JOIN gcc_world.tickets t        ON t.member_id = u.member_id
         JOIN gcc_world.ticket_actions a ON a.ticket_id = t.id AND a.timer_started_at IS NOT NULL
         LEFT JOIN gcc_world.clients c   ON c.id = t.client_id
         LEFT JOIN gcc_world.services s  ON s.id = t.service_id
        WHERE u.id = $1 AND u.member_id IS NOT NULL
          AND t.status NOT IN ('completed', 'cancelled')
        ORDER BY a.timer_started_at`,
      [user.userId],
    );

    const data = rows.map((r: any) => ({
      registroId: Number(r.registro_id),
      ticketId: Number(r.ticket_id),
      titulo: r.ticket_titulo || `Ticket #${r.ticket_id}`,
      registro: r.description,
      cliente: r.cliente || null,
      tarifa: Number(r.tarifa) || 0,
      inicio: new Date(new Date(r.timer_started_at).getTime() - Number(r.duration_seconds) * 1000).toISOString(),
    }));
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Relojes en marcha GET error:', err.message);
    return NextResponse.json({ error: 'No se pudieron leer los relojes' }, { status: 500 });
  }
}
