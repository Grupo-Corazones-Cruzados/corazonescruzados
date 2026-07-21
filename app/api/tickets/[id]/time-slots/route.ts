import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import {
  ensureTicketSlotColumns, ecuadorWallclockToISO, ECUADOR_TZ,
  loadTicketForSession, canManageTicket,
} from '@/lib/tickets/schema';
import { isGoogleWorkspaceConfigured, createMeetEvent, deleteMeetEvent } from '@/lib/integrations/google-workspace';

/** Clave para reconocer un mismo evento entre guardados (misma fecha + horario). */
const slotKey = (date: string, start?: string | null, end?: string | null) =>
  `${date}|${start || ''}|${end || ''}`;

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
    // Esquemas legados: start_time/end_time NOT NULL y CHECK de status restrictivo.
    await pool.query(`ALTER TABLE gcc_world.ticket_time_slots ALTER COLUMN start_time DROP NOT NULL`);
    await pool.query(`ALTER TABLE gcc_world.ticket_time_slots ALTER COLUMN end_time DROP NOT NULL`);
    await pool.query(`ALTER TABLE gcc_world.ticket_time_slots DROP CONSTRAINT IF EXISTS ticket_time_slots_status_check`);

    const ticket = await loadTicketForSession(id);
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    if (!(await canManageTicket(user, ticket.member_id))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Validación: un día "evento" exige hora de inicio y fin, con fin posterior al inicio.
    const normalized = time_slots
      .filter((s: any) => s?.date)
      .map((s: any) => {
        const date = String(s.date).split('T')[0];
        const isEvent = !!s.is_event;
        const start = s.start_time || null;
        const end = s.end_time || null;
        return { date, isEvent, start, end };
      });
    for (const s of normalized) {
      if (s.isEvent) {
        if (!s.start || !s.end) {
          return NextResponse.json({ error: `El día ${s.date} es un evento: indica hora de inicio y fin` }, { status: 400 });
        }
        if (s.end <= s.start) {
          return NextResponse.json({ error: `El día ${s.date}: la hora de fin debe ser posterior al inicio` }, { status: 400 });
        }
      }
    }

    // Reunión Meet: reutiliza la existente si el evento (fecha+horario) no cambió; así no
    // se recrean reuniones en cada guardado. Los eventos que desaparecen/cambian se cancelan.
    const { rows: prevRows } = await pool.query(
      `SELECT date, start_time, end_time, is_event, meeting_url, meeting_event_id
         FROM gcc_world.ticket_time_slots WHERE ticket_id = $1`,
      [id],
    );
    const prevByKey = new Map<string, any>();
    for (const p of prevRows) {
      const d = String(p.date).split('T')[0];
      if (p.is_event) prevByKey.set(slotKey(d, p.start_time, p.end_time), p);
    }

    const keptEventIds = new Set<string>();
    const gwReady = isGoogleWorkspaceConfigured();

    // Reemplaza todos los slots; conserva/crea la reunión de los que son evento.
    await pool.query(`DELETE FROM gcc_world.ticket_time_slots WHERE ticket_id = $1`, [id]);

    for (const s of normalized) {
      let meetingUrl: string | null = null;
      let meetingEventId: string | null = null;

      if (s.isEvent) {
        const prev = prevByKey.get(slotKey(s.date, s.start, s.end));
        if (prev?.meeting_event_id) {
          // Mismo evento que antes → conserva la reunión.
          meetingUrl = prev.meeting_url;
          meetingEventId = prev.meeting_event_id;
          keptEventIds.add(prev.meeting_event_id);
        } else if (gwReady) {
          // Evento nuevo/cambiado → crea la reunión invitando a cliente y miembro.
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
            meetingUrl = meet.meetUrl;
            meetingEventId = meet.eventId;
          } catch (err: any) {
            console.error('Time-slot Meet create error:', err?.response?.data ? JSON.stringify(err.response.data) : err.message);
          }
        }
      }

      await pool.query(
        `INSERT INTO gcc_world.ticket_time_slots
           (ticket_id, date, start_time, end_time, status, is_event, meeting_url, meeting_event_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [id, s.date, s.start, s.end, 'scheduled', s.isEvent, meetingUrl, meetingEventId],
      );
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

    await pool.query(`UPDATE gcc_world.tickets SET updated_at = NOW() WHERE id = $1`, [id]);

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
