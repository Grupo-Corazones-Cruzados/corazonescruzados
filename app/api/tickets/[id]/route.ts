import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { addTicketIncomeToFinance } from '@/lib/finance';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.ticket_time_slots (
      id SERIAL PRIMARY KEY, ticket_id INT NOT NULL, date DATE NOT NULL,
      start_time TEXT, end_time TEXT, status VARCHAR(20) DEFAULT 'scheduled', created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.ticket_actions (
      id SERIAL PRIMARY KEY, ticket_id INT NOT NULL, description TEXT NOT NULL,
      cost NUMERIC(12,2) NOT NULL DEFAULT 0, created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    const { rows } = await pool.query(
      `SELECT t.*, c.name as client_name, c.email as client_email,
              m.name as member_name, s.name as service_name,
              (SELECT json_agg(ts ORDER BY ts.date) FROM gcc_world.ticket_time_slots ts WHERE ts.ticket_id = t.id) as time_slots,
              (SELECT json_agg(ta ORDER BY ta.created_at) FROM gcc_world.ticket_actions ta WHERE ta.ticket_id = t.id) as actions,
              (SELECT COALESCE(SUM(cost), 0) FROM gcc_world.ticket_actions WHERE ticket_id = t.id) as actions_total
       FROM gcc_world.tickets t
       LEFT JOIN gcc_world.clients c ON c.id = t.client_id
       LEFT JOIN gcc_world.members m ON m.id = t.member_id
       LEFT JOIN gcc_world.services s ON s.id = t.service_id
       WHERE t.id = $1`,
      [id]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Ticket GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(body)) {
      if (['title', 'description', 'status', 'member_id', 'client_id', 'service_id', 'deadline', 'estimated_hours', 'estimated_cost', 'cancellation_reason'].includes(key)) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE gcc_world.tickets SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Auto-register as income when ticket is completed
    const ticket = rows[0];
    if (ticket.status === 'completed' && ticket.estimated_cost) {
      try {
        await addTicketIncomeToFinance(String(ticket.id), ticket.title, Number(ticket.estimated_cost) || 0);
      } catch (finErr: any) { console.error('Finance ticket registration error:', finErr.message); }
    }

    return NextResponse.json({ data: ticket });
  } catch (err: any) {
    console.error('Ticket PATCH error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await pool.query('DELETE FROM gcc_world.tickets WHERE id = $1', [id]);
    return NextResponse.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error('Ticket DELETE error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
