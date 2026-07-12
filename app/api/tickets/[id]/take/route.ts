import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { takeTicketByTalent } from '@/lib/tickets/bids';
import { createNotification } from '@/lib/notifications';

// POST — el miembro (con talento requerido) TOMA de inmediato un ticket abierto por talento.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'member'].includes(user.role)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    const r = await takeTicketByTalent(Number(id), user.userId);
    // Notifica al creador que su ticket fue tomado.
    try {
      if (r.creator_user_id) await createNotification(String(r.creator_user_id), {
        type: 'ticket_taken', title: r.title, message: 'Un miembro con el talento requerido tomó tu ticket.', link: `/dashboard/tickets/${id}`,
      });
    } catch { /* noop */ }
    return NextResponse.json({ data: r });
  } catch (err: any) {
    console.error('Ticket take POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
