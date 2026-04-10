import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.ticket_actions (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL,
    description TEXT NOT NULL,
    cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  // Migrate legacy INT column to TEXT if needed
  await pool.query(`ALTER TABLE gcc_world.ticket_actions ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT`);
}

async function getTicketAndGuard(ticketId: string) {
  const { rows } = await pool.query(
    `SELECT id, member_id, estimated_cost FROM gcc_world.tickets WHERE id = $1`,
    [ticketId]
  );
  return rows[0] || null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await ensureTable();
    const { rows } = await pool.query(
      `SELECT * FROM gcc_world.ticket_actions WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Ticket actions GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const { description, cost } = await req.json();

    if (!description || !description.trim()) {
      return NextResponse.json({ error: 'Descripcion requerida' }, { status: 400 });
    }
    const costNum = Number(cost);
    if (!Number.isFinite(costNum) || costNum < 0) {
      return NextResponse.json({ error: 'Costo invalido' }, { status: 400 });
    }

    await ensureTable();

    const ticket = await getTicketAndGuard(id);
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });

    // Only the assigned member or an admin can add actions
    const isAdmin = user.role === 'admin';
    let isAssignedMember = false;
    if (user.role === 'member') {
      const { rows: mRows } = await pool.query(
        `SELECT member_id FROM gcc_world.users WHERE id = $1 LIMIT 1`,
        [user.userId]
      );
      const memberId = mRows[0]?.member_id ? Number(mRows[0].member_id) : null;
      isAssignedMember = !!memberId && Number(ticket.member_id) === memberId;
    }
    if (!isAdmin && !isAssignedMember) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const estimated = Number(ticket.estimated_cost) || 0;
    if (estimated <= 0) {
      return NextResponse.json(
        { error: 'El ticket no tiene costo estimado definido' },
        { status: 400 }
      );
    }

    const { rows: sumRows } = await pool.query(
      `SELECT COALESCE(SUM(cost), 0)::numeric AS total FROM gcc_world.ticket_actions WHERE ticket_id = $1`,
      [id]
    );
    const currentTotal = Number(sumRows[0]?.total) || 0;

    if (currentTotal + costNum > estimated) {
      const remaining = Math.max(0, estimated - currentTotal);
      return NextResponse.json(
        {
          error: `El costo excede el presupuesto estimado. Disponible: $${remaining.toFixed(2)}`,
          remaining,
        },
        { status: 400 }
      );
    }

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.ticket_actions (ticket_id, description, cost, created_by, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [id, description.trim(), costNum, user.userId || null]
    );

    await pool.query(`UPDATE gcc_world.tickets SET updated_at = NOW() WHERE id = $1`, [id]);

    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Ticket actions POST error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
