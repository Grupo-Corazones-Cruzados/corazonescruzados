import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureTicketActionColumns, loadTicketForSession, canManageTicket } from '@/lib/tickets/schema';
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
    await pool.query(`UPDATE gcc_world.tickets SET updated_at = NOW() WHERE id = $1`, [id]);

    return NextResponse.json({ message: 'Eliminado' });
  } catch (err: any) {
    console.error('Ticket action DELETE error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
