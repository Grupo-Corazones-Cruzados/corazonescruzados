import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listTicketBids, createTicketBid, acceptTicketBid, deleteTicketBid } from '@/lib/tickets/bids';
import { createNotification } from '@/lib/notifications';

async function myMemberId(userId: string): Promise<number | null> {
  const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId]);
  return u?.member_id ?? null;
}
async function ticketInfo(id: number) {
  const { rows: [t] } = await pool.query(`SELECT id, user_id, title FROM gcc_world.tickets WHERE id = $1`, [id]);
  return t;
}

// GET — propuestas del ticket.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const { id } = await params;
    return NextResponse.json({ data: await listTicketBids(Number(id)) });
  } catch (err: any) {
    console.error('Ticket bids GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST { proposal } — el usuario (miembro/candidato con member_id) envía una propuesta.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const { id } = await params;
    const mid = await myMemberId(user.userId);
    if (!mid) return NextResponse.json({ error: 'Necesitas un perfil de miembro para enviar propuestas.' }, { status: 403 });
    const t = await ticketInfo(Number(id));
    if (!t) return NextResponse.json({ error: 'Ticket inexistente' }, { status: 404 });
    if (String(t.user_id) === String(user.userId)) return NextResponse.json({ error: 'No puedes proponerte en tu propio ticket.' }, { status: 400 });
    const { proposal } = await req.json();
    const bid = await createTicketBid(Number(id), mid, proposal || '');
    // Notifica al creador del ticket.
    try {
      if (t.user_id) await createNotification(String(t.user_id), {
        type: 'ticket_proposal', title: t.title, message: 'Recibiste una nueva propuesta para tu ticket.', link: `/dashboard/tickets/${id}`,
      });
    } catch { /* noop */ }
    return NextResponse.json({ data: bid });
  } catch (err: any) {
    console.error('Ticket bids POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH { bid_id } — el CREADOR (o admin) acepta una propuesta → asigna el miembro.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const { id } = await params;
    const t = await ticketInfo(Number(id));
    if (!t) return NextResponse.json({ error: 'Ticket inexistente' }, { status: 404 });
    if (user.role !== 'admin' && String(t.user_id) !== String(user.userId)) {
      return NextResponse.json({ error: 'Solo el creador del ticket puede aceptar propuestas.' }, { status: 403 });
    }
    const { bid_id } = await req.json();
    if (!bid_id) return NextResponse.json({ error: 'Falta bid_id' }, { status: 400 });
    const r = await acceptTicketBid(Number(id), Number(bid_id));
    // Notifica al miembro aceptado.
    try {
      const { rows: [u] } = await pool.query(`SELECT id FROM gcc_world.users WHERE member_id = $1 LIMIT 1`, [r.member_id]);
      if (u?.id) await createNotification(String(u.id), {
        type: 'ticket_accepted', title: t.title, message: 'Tu propuesta fue aceptada: el ticket es tuyo.', link: `/dashboard/tickets/${id}`,
      });
    } catch { /* noop */ }
    return NextResponse.json({ data: r });
  } catch (err: any) {
    console.error('Ticket bids PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — el usuario retira su propuesta.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const { id } = await params;
    const mid = await myMemberId(user.userId);
    if (mid) await deleteTicketBid(Number(id), mid);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Ticket bids DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
