import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import {
  ensureTicketActionColumns, formatEcuador, formatDuration,
  loadTicketForSession, canManageTicket,
} from '@/lib/tickets/schema';

/**
 * Termina una sesión en vivo ("inicio ahora"): detiene el cronómetro y fija el costo
 * = tiempo real transcurrido × precio por hora del servicio. Renombra la acción con el
 * rango horario y la duración, y ajusta el fin del evento del calendario del miembro.
 * El costo puede superar el presupuesto estimado (se avisa, no se bloquea).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id, actionId } = await params;
    const ticket = await loadTicketForSession(id);
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    if (!(await canManageTicket(user, ticket.member_id))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await ensureTicketActionColumns();

    const { rows: aRows } = await pool.query(
      `SELECT * FROM gcc_world.ticket_actions
        WHERE id = $1 AND ticket_id = $2`,
      [actionId, id],
    );
    const action = aRows[0];
    if (!action) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
    if (!action.session_started_at) {
      return NextResponse.json({ error: 'Esta acción no es una sesión' }, { status: 400 });
    }
    if (action.session_ended_at) {
      return NextResponse.json({ error: 'La sesión ya fue terminada' }, { status: 409 });
    }

    const started = new Date(action.session_started_at);
    const ended = new Date();
    const elapsedSeconds = Math.max(0, (ended.getTime() - started.getTime()) / 1000);
    const ratePerHour = Number(ticket.service_base_price) || 0;
    // Costo por el tiempo exacto (fracción de hora incluida), redondeado a centavos.
    const cost = Math.round((elapsedSeconds / 3600) * ratePerHour * 100) / 100;

    const description = `Sesión ${formatEcuador(started)} — ${formatEcuador(ended).split(' ').slice(-1)[0]} · ${formatDuration(elapsedSeconds)}`;

    const { rows } = await pool.query(
      `UPDATE gcc_world.ticket_actions
          SET session_ended_at = $1, cost = $2, description = $3
        WHERE id = $4 AND ticket_id = $5
        RETURNING *`,
      [ended.toISOString(), cost, description, actionId, id],
    );

    // Ajusta el fin del evento del calendario del miembro al tiempo real.
    if (action.calendar_event_id) {
      try {
        await pool.query(
          `UPDATE gcc_world.member_calendar_events SET end_at = $1 WHERE id = $2`,
          [ended.toISOString(), action.calendar_event_id],
        );
      } catch (err: any) {
        console.error('Session calendar end update error:', err.message);
      }
    }

    await pool.query(`UPDATE gcc_world.tickets SET updated_at = NOW() WHERE id = $1`, [id]);

    // Aviso si el total de acciones supera el presupuesto estimado (no bloquea).
    const { rows: sumRows } = await pool.query(
      `SELECT COALESCE(SUM(ta.cost), 0)::numeric AS total, t.estimated_cost
         FROM gcc_world.tickets t
         LEFT JOIN gcc_world.ticket_actions ta ON ta.ticket_id = t.id
        WHERE t.id = $1
        GROUP BY t.estimated_cost`,
      [id],
    );
    const total = Number(sumRows[0]?.total) || 0;
    const est = Number(sumRows[0]?.estimated_cost) || 0;
    const overBudget = est > 0 && total > est;
    const over = overBudget ? Math.round((total - est) * 100) / 100 : 0;

    return NextResponse.json({
      data: rows[0],
      cost,
      elapsedSeconds,
      durationLabel: formatDuration(elapsedSeconds),
      overBudget,
      over,
    });
  } catch (err: any) {
    console.error('Session PATCH error:', err.message);
    return NextResponse.json({ error: 'Error al terminar la sesión' }, { status: 500 });
  }
}
