import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import {
  ensureTicketSlotColumns, ensureTicketActionColumns,
  ecuadorWallclockToISO, ECUADOR_TZ,
  slotSeconds, slotCost, slotSessionLabel,
  loadTicketForSession, canManageTicket,
} from '@/lib/tickets/schema';
import { isGoogleWorkspaceConfigured, createMeetEvent, deleteMeetEvent } from '@/lib/integrations/google-workspace';

/** Clave para reconocer un mismo evento entre guardados (misma fecha + horario). */
const slotKey = (date: string, start?: string | null, end?: string | null) =>
  `${date}|${start || ''}|${end || ''}`;

/**
 * Guarda los "días de trabajo" de un ticket (reemplaza todos). Reglas nuevas:
 *  - Las horas de inicio/fin son OPCIONALES; un día "Evento (Meet)" sí las exige.
 *  - Todo día CON horas genera una acción costeada "Sesión {fecha hora}"
 *    (costo = tiempo programado × tarifa/hora del servicio), sea evento o no.
 *  - Un día con horas y SIN evento Meet crea además un bloque OCUPADO de tipo
 *    'progreso' en el calendario "Mi día" del miembro (fecha/hora del propio día).
 *  - Al editar/eliminar un día, su acción y su bloque de calendario se recrean/borran.
 *  - Si el costo total de las sesiones supera el presupuesto estimado, se BLOQUEA.
 * La acción enlaza su bloque de calendario en ticket_actions.calendar_event_id; el
 * slot enlaza su acción en ticket_time_slots.action_id (para recrear/borrar en cascada).
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const { time_slots } = await req.json();

    if (!Array.isArray(time_slots)) {
      return NextResponse.json({ error: 'time_slots requerido' }, { status: 400 });
    }

    await ensureTicketSlotColumns();
    await ensureTicketActionColumns();
    // Esquemas legados: start_time/end_time NOT NULL y CHECK de status restrictivo.
    await pool.query(`ALTER TABLE gcc_world.ticket_time_slots ALTER COLUMN start_time DROP NOT NULL`);
    await pool.query(`ALTER TABLE gcc_world.ticket_time_slots ALTER COLUMN end_time DROP NOT NULL`);
    await pool.query(`ALTER TABLE gcc_world.ticket_time_slots DROP CONSTRAINT IF EXISTS ticket_time_slots_status_check`);

    const ticket = await loadTicketForSession(id);
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    if (!(await canManageTicket(user, ticket.member_id))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const rate = Number(ticket.service_base_price) || 0;
    const estimated = Number(ticket.estimated_cost) || 0;

    // Normaliza y valida. Un día "evento" exige horas; en un día normal las horas son
    // opcionales, pero si pones una debes poner ambas y el fin debe ser posterior.
    const normalized = time_slots
      .filter((s: any) => s?.date)
      .map((s: any) => {
        const date = String(s.date).split('T')[0];
        const isEvent = !!s.is_event;
        const start = s.start_time || null;
        const end = s.end_time || null;
        const hasTimes = !!start && !!end;
        const seconds = hasTimes ? slotSeconds(date, start, end) : 0;
        const cost = hasTimes ? slotCost(seconds, rate) : 0;
        return {
          date, isEvent, start, end, hasTimes, seconds, cost,
          meetingUrl: null as string | null, meetingEventId: null as string | null,
        };
      });
    for (const s of normalized) {
      if (s.isEvent) {
        if (!s.hasTimes) {
          return NextResponse.json({ error: `El día ${s.date} es un evento: indica hora de inicio y fin` }, { status: 400 });
        }
        if (s.end! <= s.start!) {
          return NextResponse.json({ error: `El día ${s.date}: la hora de fin debe ser posterior al inicio` }, { status: 400 });
        }
      } else {
        if ((!!s.start) !== (!!s.end)) {
          return NextResponse.json({ error: `El día ${s.date}: indica hora de inicio y fin, o deja ambas vacías` }, { status: 400 });
        }
        if (s.hasTimes && s.end! <= s.start!) {
          return NextResponse.json({ error: `El día ${s.date}: la hora de fin debe ser posterior al inicio` }, { status: 400 });
        }
      }
    }

    // Estado previo: reunión Meet + acción generada por cada slot (para conservar/recrear).
    const { rows: prevRows } = await pool.query(
      `SELECT date, start_time, end_time, is_event, meeting_url, meeting_event_id, action_id
         FROM gcc_world.ticket_time_slots WHERE ticket_id = $1`,
      [id],
    );
    const prevByKey = new Map<string, any>();
    for (const p of prevRows) {
      const d = String(p.date).split('T')[0];
      if (p.is_event) prevByKey.set(slotKey(d, p.start_time, p.end_time), p);
    }
    const prevSlotActionIds: number[] = prevRows
      .map((p: any) => (p.action_id != null ? Number(p.action_id) : null))
      .filter((x: number | null): x is number => x != null);

    // BLOQUEO por presupuesto: (acciones ajenas a slots) + (nuevas sesiones de slots) ≤ estimado.
    const newSlotTotal = normalized.reduce((a, s) => a + (s.hasTimes ? s.cost : 0), 0);
    if (estimated > 0) {
      const { rows: sumRows } = await pool.query(
        `SELECT COALESCE(SUM(cost), 0)::numeric AS total
           FROM gcc_world.ticket_actions
          WHERE ticket_id = $1 AND NOT (id = ANY($2::int[]))`,
        [id, prevSlotActionIds],
      );
      const nonSlotTotal = Number(sumRows[0]?.total) || 0;
      if (nonSlotTotal + newSlotTotal > estimated + 0.001) {
        const remaining = Math.max(0, Math.round((estimated - nonSlotTotal) * 100) / 100);
        return NextResponse.json(
          { error: `El costo de las sesiones ($${newSlotTotal.toFixed(2)}) excede el presupuesto del ticket. Disponible: $${remaining.toFixed(2)}.` },
          { status: 400 },
        );
      }
    }

    // Reunión Meet (externo, antes de mutar la BD): reutiliza la existente si el evento
    // (fecha+horario) no cambió; crea una nueva para los eventos nuevos/cambiados.
    const gwReady = isGoogleWorkspaceConfigured();
    const keptEventIds = new Set<string>();
    for (const s of normalized) {
      if (!s.isEvent) continue;
      const prev = prevByKey.get(slotKey(s.date, s.start, s.end));
      if (prev?.meeting_event_id) {
        s.meetingUrl = prev.meeting_url;
        s.meetingEventId = prev.meeting_event_id;
        keptEventIds.add(prev.meeting_event_id);
      } else if (gwReady) {
        try {
          const attendees: { email: string; name?: string | null }[] = [];
          if (ticket.client_email) attendees.push({ email: ticket.client_email, name: ticket.client_name });
          if (ticket.member_email) attendees.push({ email: ticket.member_email, name: ticket.member_name });
          const meet = await createMeetEvent({
            title: `${ticket.title} — con ${ticket.member_name || 'GCC'}`,
            description: `Día de trabajo agendado en el ticket #${ticket.id} (GCC World).`,
            startISO: ecuadorWallclockToISO(s.date, s.start!),
            endISO: ecuadorWallclockToISO(s.date, s.end!),
            timezone: ECUADOR_TZ,
            attendees,
          });
          s.meetingUrl = meet.meetUrl;
          s.meetingEventId = meet.eventId;
        } catch (err: any) {
          console.error('Time-slot Meet create error:', err?.response?.data ? JSON.stringify(err.response.data) : err.message);
        }
      }
    }

    // Mutaciones de BD en transacción: borra las acciones/bloques previos de slots,
    // reemplaza los slots y crea las nuevas acciones + bloques de calendario.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (prevSlotActionIds.length) {
        const { rows: calRows } = await client.query(
          `SELECT calendar_event_id FROM gcc_world.ticket_actions
            WHERE id = ANY($1::int[]) AND calendar_event_id IS NOT NULL`,
          [prevSlotActionIds],
        );
        for (const c of calRows) {
          if (c.calendar_event_id) {
            await client.query(`DELETE FROM gcc_world.member_calendar_events WHERE id = $1`, [c.calendar_event_id]);
          }
        }
        await client.query(`DELETE FROM gcc_world.ticket_actions WHERE id = ANY($1::int[])`, [prevSlotActionIds]);
      }

      await client.query(`DELETE FROM gcc_world.ticket_time_slots WHERE ticket_id = $1`, [id]);

      for (const s of normalized) {
        let actionId: number | null = null;

        if (s.hasTimes) {
          // Bloque OCUPADO en "Mi día" solo para días normales (los Meet ya viven en Google).
          let calendarEventId: string | null = null;
          if (!s.isEvent && ticket.member_id != null) {
            const cal = await client.query(
              `INSERT INTO gcc_world.member_calendar_events (
                 member_id, title, description, event_type, client_id,
                 start_at, end_at, all_day, timezone,
                 recurrence_type, recurrence_days, recurrence_interval, recurrence_until,
                 color, status, created_by
               ) VALUES (
                 $1, $2, $3, 'progreso', $4,
                 $5, $6, FALSE, $7,
                 'none', NULL, 1, NULL,
                 NULL, 'confirmed', $8
               ) RETURNING id`,
              [
                ticket.member_id,
                `Sesión — ${ticket.title}`,
                `Día de trabajo del ticket #${ticket.id}.`,
                ticket.client_id,
                ecuadorWallclockToISO(s.date, s.start!), ecuadorWallclockToISO(s.date, s.end!), ECUADOR_TZ,
                user.userId || null,
              ],
            );
            calendarEventId = cal.rows[0]?.id != null ? String(cal.rows[0].id) : null;
          }

          const act = await client.query(
            `INSERT INTO gcc_world.ticket_actions
               (ticket_id, description, cost, created_by, created_at, calendar_event_id)
             VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING id`,
            [id, slotSessionLabel(s.date, s.start!, s.end!), s.cost, user.userId || null, calendarEventId],
          );
          actionId = act.rows[0]?.id != null ? Number(act.rows[0].id) : null;
        }

        await client.query(
          `INSERT INTO gcc_world.ticket_time_slots
             (ticket_id, date, start_time, end_time, status, is_event, meeting_url, meeting_event_id, action_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [id, s.date, s.start, s.end, 'scheduled', s.isEvent, s.meetingUrl, s.meetingEventId, actionId],
        );
      }

      await client.query(`UPDATE gcc_world.tickets SET updated_at = NOW() WHERE id = $1`, [id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    // Cancela en Google las reuniones de eventos que ya no existen (o cambiaron de horario).
    if (gwReady) {
      for (const p of prevRows) {
        if (p.is_event && p.meeting_event_id && !keptEventIds.has(p.meeting_event_id)) {
          try { await deleteMeetEvent(p.meeting_event_id); }
          catch (err: any) { console.error('Time-slot Meet delete error:', err.message); }
        }
      }
    }

    const { rows } = await pool.query(
      `SELECT * FROM gcc_world.ticket_time_slots WHERE ticket_id = $1 ORDER BY date`,
      [id],
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Time slots error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
