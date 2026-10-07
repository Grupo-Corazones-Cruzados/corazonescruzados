import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse, after } from 'next/server';
import { avisarRelojesDelMiembro } from '@/lib/push/relojes';
import { ensureTicketActionColumns, ensureTicketSlotColumns, loadTicketForSession, canManageTicket, slotCost, esFechaISO } from '@/lib/tickets/schema';
import { isGoogleWorkspaceConfigured, deleteMeetEvent } from '@/lib/integrations/google-workspace';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
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

    // Si la acción es una sesión, limpia su reunión de Meet y el evento del calendario.
    const { rows: aRows } = await pool.query(
      `SELECT meeting_event_id, calendar_event_id FROM gcc_world.ticket_actions
        WHERE id = $1 AND ticket_id = $2`,
      [actionId, id],
    );
    const action = aRows[0];
    if (action?.meeting_event_id && isGoogleWorkspaceConfigured()) {
      try { await deleteMeetEvent(action.meeting_event_id); }
      catch (err: any) { console.error('Action Meet delete error:', err.message); }
    }
    if (action?.calendar_event_id) {
      try {
        await pool.query(`DELETE FROM gcc_world.member_calendar_events WHERE id = $1`, [action.calendar_event_id]);
      } catch (err: any) { console.error('Action calendar delete error:', err.message); }
    }

    await pool.query(
      `DELETE FROM gcc_world.ticket_actions WHERE id = $1 AND ticket_id = $2`,
      [actionId, id]
    );
    // Si era el reloj en marcha, el teléfono tiene que quitarlo.
    after(() => avisarRelojesDelMiembro(ticket.member_id, { registroId: Number(actionId), accion: 'detener' }));
    await pool.query(`UPDATE gcc_world.tickets SET updated_at = NOW() WHERE id = $1`, [id]);

    return NextResponse.json({ message: 'Eliminado' });
  } catch (err: any) {
    console.error('Ticket action DELETE error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

/**
 * CAMBIAR UN REGISTRO DE TRABAJO (Fernando, 2026-09-30).
 *
 * Cuerpo: `{ accion?: 'iniciar' | 'detener', description?, notes?, duration_seconds?, work_date? }`.
 *
 *  · `iniciar`  pone el reloj en marcha (`timer_started_at`). UNO por ticket: con dos a la vez
 *               el mismo rato se contaría dos veces.
 *  · `detener`  suma lo transcurrido a `duration_seconds`. Si el registro nació de «Iniciar
 *               sesión» (Meet), cierra también la sesión y su evento del calendario.
 *  · `en` (ISO, opcional, con `iniciar`/`detener`): la hora a la que se pulsó DE VERDAD. La
 *               manda la app del teléfono cuando el botón se pulsó sin conexión y la orden
 *               llega después (Fernando, 2026-10-06). Sin `en`, la hora es la del servidor.
 *               No se acepta del futuro, ni un inicio de hace más de un día, ni una parada
 *               anterior al inicio: lo que no cuadra se rechaza, no se corrige a ojo.
 *  · `duration_seconds` corrige el tiempo a mano (no con el reloj en marcha: se pisarían).
 *  · El COSTO se recalcula SIEMPRE desde el tiempo: tiempo × tarifa del servicio. No se
 *    escribe a mano.
 *  · Con el ticket cerrado (completado o cancelado) no se cambia nada: lo consumido ya está
 *    facturado.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
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
    // Un borrador aún no es trabajo: sin registros, reloj ni sesiones hasta enviarlo (2026-10-07).
    if (ticket.status === 'draft') {
      return NextResponse.json({ error: 'Es un borrador: envíalo antes de registrar trabajo' }, { status: 400 });
    }
    if (['completed', 'cancelled'].includes(ticket.status)) {
      return NextResponse.json({ error: 'El ticket está cerrado: lo consumido ya no se cambia' }, { status: 400 });
    }
    await ensureTicketActionColumns();
    await ensureTicketSlotColumns();

    const { rows: [a] } = await pool.query(
      `SELECT * FROM gcc_world.ticket_actions WHERE id = $1 AND ticket_id = $2`, [actionId, id],
    );
    if (!a) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

    const cuerpo = await req.json();
    const tarifa = Number(ticket.service_base_price) || 0;
    let segundos = Number(a.duration_seconds) || 0;
    let timer: string | null = a.timer_started_at;
    let sesionTerminada: Date | null = null;

    // La hora de la orden: la del teléfono si la pulsó sin conexión, si no la del servidor.
    let cuando = new Date();
    if (cuerpo.en !== undefined && cuerpo.en !== null && (cuerpo.accion === 'iniciar' || cuerpo.accion === 'detener')) {
      const t = new Date(String(cuerpo.en));
      if (Number.isNaN(t.getTime())) return NextResponse.json({ error: 'Hora no válida' }, { status: 400 });
      // Dos minutos de holgura: el reloj del teléfono nunca va clavado con el del servidor.
      if (t.getTime() > cuando.getTime() + 2 * 60_000) return NextResponse.json({ error: 'La hora llega del futuro' }, { status: 400 });
      if (cuerpo.accion === 'iniciar' && t.getTime() < cuando.getTime() - 24 * 3600_000) {
        return NextResponse.json({ error: 'Ese inicio tiene más de un día: corrige el tiempo a mano' }, { status: 400 });
      }
      cuando = t.getTime() > cuando.getTime() ? cuando : t;
    }

    if (cuerpo.accion === 'iniciar') {
      if (!timer) {
        const { rows: otro } = await pool.query(
          `SELECT description FROM gcc_world.ticket_actions
            WHERE ticket_id = $1 AND id <> $2 AND timer_started_at IS NOT NULL LIMIT 1`, [id, actionId],
        );
        if (otro[0]) {
          return NextResponse.json({ error: `Ya hay un reloj en marcha en «${otro[0].description}». Detenlo primero.` }, { status: 409 });
        }
        timer = cuando.toISOString();
      }
    } else if (cuerpo.accion === 'detener') {
      if (timer) {
        const ahora = cuando;
        if (ahora.getTime() < new Date(timer).getTime()) {
          return NextResponse.json({ error: 'La parada es anterior al inicio del reloj' }, { status: 400 });
        }
        segundos += Math.max(0, Math.round((ahora.getTime() - new Date(timer).getTime()) / 1000));
        timer = null;
        if (a.session_started_at && !a.session_ended_at) sesionTerminada = ahora;
      }
    }

    if (cuerpo.duration_seconds !== undefined) {
      if (timer) return NextResponse.json({ error: 'Detén el reloj antes de corregir el tiempo' }, { status: 409 });
      const n = Math.round(Number(cuerpo.duration_seconds));
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'Tiempo no válido' }, { status: 400 });
      segundos = n;
    }

    const description = cuerpo.description !== undefined ? String(cuerpo.description).trim() : a.description;
    if (!description) return NextResponse.json({ error: 'El registro necesita un título' }, { status: 400 });
    const notes = cuerpo.notes !== undefined ? (String(cuerpo.notes).trim() || null) : a.notes;
    let workDate: string | null = a.work_date ? new Date(a.work_date).toISOString().slice(0, 10) : null;
    if (cuerpo.work_date !== undefined) {
      if (!esFechaISO(cuerpo.work_date)) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });
      workDate = cuerpo.work_date;
    }

    const { rows } = await pool.query(
      `UPDATE gcc_world.ticket_actions
          SET description = $1, notes = $2, duration_seconds = $3, cost = $4,
              timer_started_at = $5, work_date = $6,
              session_ended_at = COALESCE($7, session_ended_at)
        WHERE id = $8 AND ticket_id = $9 RETURNING *`,
      [description, notes, segundos, slotCost(segundos, tarifa), timer, workDate,
       sesionTerminada ? sesionTerminada.toISOString() : null, actionId, id],
    );
    if (workDate) {
      await pool.query(
        `INSERT INTO gcc_world.ticket_time_slots (ticket_id, date, status)
         SELECT $1, $2::date, 'scheduled'
          WHERE NOT EXISTS (SELECT 1 FROM gcc_world.ticket_time_slots WHERE ticket_id = $1 AND date = $2::date)`,
        [id, workDate],
      );
    }
    if (sesionTerminada && a.calendar_event_id) {
      try {
        await pool.query(`UPDATE gcc_world.member_calendar_events SET end_at = $1 WHERE id = $2`,
          [sesionTerminada.toISOString(), a.calendar_event_id]);
      } catch (err: any) { console.error('Action calendar end update error:', err.message); }
    }
    await pool.query(`UPDATE gcc_world.tickets SET updated_at = NOW() WHERE id = $1`, [id]);

    // El reloj cambió: los teléfonos del miembro ajustan su notificación al instante.
    // Solo si de verdad pasó de parado a en marcha (o al revés): un «iniciar» repetido no
    // arranca otra Actividad en Vivo en el iPhone.
    const arrancado = !a.timer_started_at && !!timer;
    const parado = !!a.timer_started_at && !timer;
    if (arrancado || parado) {
      after(() => avisarRelojesDelMiembro(ticket.member_id, { registroId: Number(actionId), accion: arrancado ? 'iniciar' : 'detener' }));
    }

    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Ticket action PATCH error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
