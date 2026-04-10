import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get('token');

    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 403 });

    await pool.query(`
      ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS public_token VARCHAR(64);
      ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ;
    `);

    const { rows } = await pool.query(
      `SELECT t.id, t.title, t.description, t.status, t.estimated_cost, t.estimated_hours,
              t.deadline, t.created_at, t.updated_at, t.public_token, t.public_token_expires_at,
              c.name as client_name, c.email as client_email,
              m.name as member_name, s.name as service_name,
              (SELECT json_agg(ts ORDER BY ts.date) FROM gcc_world.ticket_time_slots ts WHERE ts.ticket_id = t.id) as time_slots,
              (SELECT json_agg(json_build_object('id', ta.id, 'description', ta.description, 'cost', ta.cost, 'created_at', ta.created_at) ORDER BY ta.created_at) FROM gcc_world.ticket_actions ta WHERE ta.ticket_id = t.id) as actions,
              (SELECT COALESCE(SUM(cost), 0) FROM gcc_world.ticket_actions WHERE ticket_id = t.id) as actions_total
       FROM gcc_world.tickets t
       LEFT JOIN gcc_world.clients c ON c.id = t.client_id
       LEFT JOIN gcc_world.members m ON m.id = t.member_id
       LEFT JOIN gcc_world.services s ON s.id = t.service_id
       WHERE t.id = $1`,
      [id]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });

    const ticket = rows[0];

    if (!ticket.public_token || token !== ticket.public_token) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 403 });
    }
    if (ticket.public_token_expires_at && new Date(ticket.public_token_expires_at) < new Date()) {
      return NextResponse.json({ error: 'El enlace ha expirado' }, { status: 403 });
    }

    delete ticket.public_token;
    delete ticket.public_token_expires_at;

    return NextResponse.json({ data: ticket });
  } catch (err: any) {
    console.error('Public ticket GET error:', err.message);
    return NextResponse.json({ error: 'Error al obtener ticket' }, { status: 500 });
  }
}
