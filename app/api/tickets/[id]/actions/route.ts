import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import {
  ensureTicketActionColumns, ensureTicketSlotColumns, loadTicketForSession, canManageTicket,
  slotCost, hoyEcuador, esFechaISO,
} from '@/lib/tickets/schema';

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await ensureTable();
    const { rows } = await pool.query(
      `SELECT * FROM gcc_world.ticket_actions WHERE ticket_id = $1 ORDER BY work_date NULLS LAST, created_at ASC`,
      [id]
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Ticket actions GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

/**
 * AÑADIR UN REGISTRO DE TRABAJO A UN DÍA (Fernando, 2026-09-30).
 *
 * · SIN TOPE POR PRESUPUESTO. Antes se rechazaba si el costo pasaba del costo estimado, y ni
 *   siquiera se podía registrar sin él. El estimado es eso, una estimación: lo consumido puede
 *   quedar por encima o por debajo, y la pantalla avisa con un ⚠ en «Consumido».
 * · El registro va a un DÍA (`work_date`, hoy en Ecuador si no llega) y, si ese día de trabajo
 *   no existía en el ticket, se crea: un registro nunca queda en un día que no se ve.
 * · El COSTO no se escribe: es tiempo × tarifa del servicio (`slotCost`). Se crea con el
 *   tiempo que llegue —normalmente 0, y se llena con el reloj o a mano—.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const cuerpo = await req.json();
    const description = String(cuerpo.description || '').trim();
    if (!description) return NextResponse.json({ error: 'Escribe qué se hizo' }, { status: 400 });
    const workDate = esFechaISO(cuerpo.work_date) ? cuerpo.work_date : hoyEcuador();
    const segundos = Math.max(0, Math.round(Number(cuerpo.duration_seconds) || 0));

    await ensureTable();
    await ensureTicketActionColumns();
    await ensureTicketSlotColumns();

    const ticket = await loadTicketForSession(id);
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    if (!(await canManageTicket(user, ticket.member_id))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    // Un borrador aún no es trabajo: sin registros, reloj ni sesiones hasta enviarlo (2026-10-07).
    if (ticket.status === 'draft') {
      return NextResponse.json({ error: 'Es un borrador: envíalo antes de registrar trabajo' }, { status: 400 });
    }
    if (['completed', 'cancelled'].includes(ticket.status)) {
      return NextResponse.json({ error: 'El ticket está cerrado' }, { status: 400 });
    }

    const cost = slotCost(segundos, Number(ticket.service_base_price) || 0);
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.ticket_actions (ticket_id, description, cost, created_by, created_at, work_date, duration_seconds)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6) RETURNING *`,
      [id, description, cost, user.userId || null, workDate, segundos],
    );
    await pool.query(
      `INSERT INTO gcc_world.ticket_time_slots (ticket_id, date, status)
       SELECT $1, $2::date, 'scheduled'
        WHERE NOT EXISTS (SELECT 1 FROM gcc_world.ticket_time_slots WHERE ticket_id = $1 AND date = $2::date)`,
      [id, workDate],
    );
    await pool.query(`UPDATE gcc_world.tickets SET updated_at = NOW() WHERE id = $1`, [id]);

    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Ticket actions POST error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
