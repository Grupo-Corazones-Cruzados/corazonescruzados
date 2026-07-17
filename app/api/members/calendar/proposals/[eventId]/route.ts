import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { sendProposalDecisionToClient } from '@/lib/integrations/email';
import { notifyCalendarSubscribers } from '@/lib/calendar/notify';
import { ensureCalendarGuestColumns } from '@/lib/calendar/guest';
import { isGoogleWorkspaceConfigured, createMeetEvent } from '@/lib/integrations/google-workspace';

type RouteCtx = { params: Promise<{ eventId: string }> };

async function resolveMemberRow(userId: string) {
  const { rows } = await pool.query(
    `SELECT m.id, m.name, m.email, m.calendar_public_token
       FROM gcc_world.users u
       JOIN gcc_world.members m ON m.id = u.member_id
      WHERE u.id = $1`,
    [userId],
  );
  return rows[0] || null;
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const member = await resolveMemberRow(user.userId);
    if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const { eventId } = await ctx.params;
    const body = await req.json();
    const action = body?.action;
    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    }

    await ensureCalendarGuestColumns();

    const evRes = await pool.query(
      `SELECT e.id, e.title, e.start_at, e.end_at, e.timezone, e.created_by,
              COALESCE(u.email, e.guest_email) AS proposer_email,
              u.first_name AS proposer_first_name, u.last_name AS proposer_last_name,
              e.guest_name AS proposer_guest_name
         FROM gcc_world.member_calendar_events e
         LEFT JOIN gcc_world.users u ON u.id = e.created_by
        WHERE e.id = $1 AND e.member_id = $2 AND e.status = 'proposed'`,
      [eventId, member.id],
    );
    const ev = evRes.rows[0];
    if (!ev) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 });

    const clientName = [ev.proposer_first_name, ev.proposer_last_name].filter(Boolean).join(' ').trim()
      || ev.proposer_guest_name
      || ev.proposer_email
      || 'Invitado';

    let meetingUrl: string | null = null;

    if (action === 'accept') {
      await pool.query(
        `UPDATE gcc_world.member_calendar_events SET status = 'confirmed' WHERE id = $1`,
        [eventId],
      );

      // Reunión con Google Meet: la crea la cuenta organizadora de GCC (impersonada),
      // invitando al visitante y al miembro; Google envía la invitación de calendario.
      if (isGoogleWorkspaceConfigured() && ev.proposer_email) {
        try {
          const attendees: { email: string; name?: string | null }[] = [
            { email: ev.proposer_email, name: clientName },
          ];
          if (member.email) attendees.push({ email: member.email, name: member.name });
          const meet = await createMeetEvent({
            title: `${ev.title} — con ${member.name}`,
            description: `Reunión agendada vía el calendario público de ${member.name} (GCC World).`,
            startISO: new Date(ev.start_at).toISOString(),
            endISO: new Date(ev.end_at).toISOString(),
            timezone: ev.timezone || 'America/Guayaquil',
            attendees,
          });
          meetingUrl = meet.meetUrl;
          if (meetingUrl) {
            await pool.query(
              `UPDATE gcc_world.member_calendar_events
                  SET meeting_url = $1, meeting_provider = 'google_meet', meeting_event_id = $2
                WHERE id = $3`,
              [meetingUrl, meet.eventId, eventId],
            );
          }
        } catch (err: any) {
          console.error('Meet create error:', err?.response?.data ? JSON.stringify(err.response.data) : err.message);
        }
      }

      notifyCalendarSubscribers({
        memberId: member.id,
        action: 'created',
        eventTitle: ev.title,
        eventStart: new Date(ev.start_at),
        eventEnd: new Date(ev.end_at),
      });
    } else {
      await pool.query(
        `DELETE FROM gcc_world.member_calendar_events WHERE id = $1`,
        [eventId],
      );
    }

    if (ev.proposer_email) {
      try {
        await sendProposalDecisionToClient({
          clientEmail: ev.proposer_email,
          clientName,
          memberName: member.name,
          action: action === 'accept' ? 'accepted' : 'rejected',
          eventTitle: ev.title,
          eventStart: new Date(ev.start_at),
          eventEnd: new Date(ev.end_at),
          memberId: member.id,
          publicToken: member.calendar_public_token,
          meetingUrl,
        });
      } catch (err: any) {
        console.error('Proposal decision email error:', err.message);
      }
    }

    return NextResponse.json({ ok: true, action, meetingUrl });
  } catch (err: any) {
    console.error('Proposal PATCH error:', err.message);
    return NextResponse.json({ error: 'Error al responder propuesta' }, { status: 500 });
  }
}
