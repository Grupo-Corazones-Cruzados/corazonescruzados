import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import {
  ensureTicketActionColumns, formatEcuador, ECUADOR_TZ,
  loadTicketForSession, canManageTicket,
} from '@/lib/tickets/schema';
import { isGoogleWorkspaceConfigured, createMeetEvent } from '@/lib/integrations/google-workspace';
import { ensureCalendarGuestColumns } from '@/lib/calendar/guest';

/**
 * "Inicio ahora": arranca una sesión en vivo del ticket.
 *  - Crea una reunión de Google Meet invitando al cliente (si hay) y al miembro.
 *  - Crea un evento en el calendario del miembro (in-app) con el enlace de la reunión.
 *  - Registra una acción "Sesión {fecha/hora}" con el cronómetro corriendo (cost 0).
 * El costo se calcula al terminar (PATCH /sessions/[actionId]) según el tiempo real.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const ticket = await loadTicketForSession(id);
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    if (!(await canManageTicket(user, ticket.member_id))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    if (['completed', 'cancelled'].includes(ticket.status)) {
      return NextResponse.json({ error: 'El ticket está cerrado' }, { status: 400 });
    }
    if (ticket.member_id == null) {
      return NextResponse.json({ error: 'El ticket no tiene un miembro asignado' }, { status: 400 });
    }
    if (!ticket.service_base_price || ticket.service_base_price <= 0) {
      return NextResponse.json(
        { error: 'El servicio del ticket no tiene un precio por hora definido' },
        { status: 400 },
      );
    }

    await ensureTicketActionColumns();

    // Una sola sesión en curso por ticket.
    const running = await pool.query(
      `SELECT id FROM gcc_world.ticket_actions
        WHERE ticket_id = $1 AND session_started_at IS NOT NULL AND session_ended_at IS NULL
        LIMIT 1`,
      [id],
    );
    if (running.rows[0]) {
      return NextResponse.json({ error: 'Ya hay una sesión en curso. Termínala antes de iniciar otra.' }, { status: 409 });
    }

    const now = new Date();
    let meetingUrl: string | null = null;
    let meetingEventId: string | null = null;

    if (isGoogleWorkspaceConfigured()) {
      try {
        const attendees: { email: string; name?: string | null }[] = [];
        if (ticket.client_email) attendees.push({ email: ticket.client_email, name: ticket.client_name });
        if (ticket.member_email) attendees.push({ email: ticket.member_email, name: ticket.member_name });
        // Fin provisional: +1h; se corrige al terminar según el tiempo real.
        const end = new Date(now.getTime() + 60 * 60 * 1000);
        const meet = await createMeetEvent({
          title: `${ticket.title} — sesión con ${ticket.member_name || 'GCC'}`,
          description: `Sesión en vivo del ticket #${ticket.id} (GCC World).`,
          startISO: now.toISOString(),
          endISO: end.toISOString(),
          timezone: ECUADOR_TZ,
          attendees,
        });
        meetingUrl = meet.meetUrl;
        meetingEventId = meet.eventId;
      } catch (err: any) {
        console.error('Session Meet create error:', err?.response?.data ? JSON.stringify(err.response.data) : err.message);
      }
    }

    // Evento en el calendario in-app del miembro (fin provisional +1h; se ajusta al terminar).
    let calendarEventId: string | null = null;
    try {
      await ensureCalendarGuestColumns();
      const provisionalEnd = new Date(now.getTime() + 60 * 60 * 1000);
      const cal = await pool.query(
        `INSERT INTO gcc_world.member_calendar_events (
           member_id, title, description, event_type, client_id,
           start_at, end_at, all_day, timezone,
           recurrence_type, recurrence_days, recurrence_interval, recurrence_until,
           color, status, created_by, meeting_url, meeting_provider, meeting_event_id
         ) VALUES (
           $1, $2, $3, 'progreso', $4,
           $5, $6, FALSE, $7,
           'none', NULL, 1, NULL,
           NULL, 'confirmed', $8, $9, $10, $11
         ) RETURNING id`,
        [
          ticket.member_id,
          `Sesión — ${ticket.title}`,
          `Sesión en vivo del ticket #${ticket.id}.`,
          ticket.client_id,
          now.toISOString(), provisionalEnd.toISOString(), ECUADOR_TZ,
          user.userId,
          meetingUrl, meetingUrl ? 'google_meet' : null, meetingEventId,
        ],
      );
      calendarEventId = cal.rows[0]?.id != null ? String(cal.rows[0].id) : null;
    } catch (err: any) {
      // El calendario in-app puede no tener todas las columnas (meeting_*); no bloquea la sesión.
      console.error('Session calendar event error:', err.message);
    }

    const description = `Sesión ${formatEcuador(now)}`;
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.ticket_actions
         (ticket_id, description, cost, created_by, created_at,
          session_started_at, meeting_url, meeting_event_id, calendar_event_id)
       VALUES ($1, $2, 0, $3, NOW(), $4, $5, $6, $7)
       RETURNING *`,
      [id, description, user.userId || null, now.toISOString(), meetingUrl, meetingEventId, calendarEventId],
    );

    await pool.query(`UPDATE gcc_world.tickets SET updated_at = NOW() WHERE id = $1`, [id]);

    return NextResponse.json({ data: rows[0], meetingUrl });
  } catch (err: any) {
    console.error('Session POST error:', err.message);
    return NextResponse.json({ error: 'Error al iniciar la sesión' }, { status: 500 });
  }
}
