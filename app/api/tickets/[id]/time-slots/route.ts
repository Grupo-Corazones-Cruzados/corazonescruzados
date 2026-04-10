import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const { time_slots } = await req.json();

    if (!Array.isArray(time_slots)) {
      return NextResponse.json({ error: 'time_slots requerido' }, { status: 400 });
    }

    // Ensure table exists
    await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.ticket_time_slots (
      id SERIAL PRIMARY KEY,
      ticket_id INT NOT NULL,
      date DATE NOT NULL,
      start_time TEXT,
      end_time TEXT,
      status VARCHAR(20) DEFAULT 'scheduled',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    // Legacy schemas had start_time/end_time as NOT NULL — make them nullable
    await pool.query(`ALTER TABLE gcc_world.ticket_time_slots ALTER COLUMN start_time DROP NOT NULL`);
    await pool.query(`ALTER TABLE gcc_world.ticket_time_slots ALTER COLUMN end_time DROP NOT NULL`);
    // Legacy schemas also had a restrictive CHECK constraint on status — drop it
    await pool.query(`ALTER TABLE gcc_world.ticket_time_slots DROP CONSTRAINT IF EXISTS ticket_time_slots_status_check`);

    // Delete existing slots and re-insert
    await pool.query(`DELETE FROM gcc_world.ticket_time_slots WHERE ticket_id = $1`, [id]);

    for (const slot of time_slots) {
      if (!slot.date) continue;
      await pool.query(
        `INSERT INTO gcc_world.ticket_time_slots (ticket_id, date, start_time, end_time, status, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [id, slot.date, slot.start_time || null, slot.end_time || null, slot.status || 'scheduled']
      );
    }

    // Update ticket updated_at
    await pool.query(`UPDATE gcc_world.tickets SET updated_at = NOW() WHERE id = $1`, [id]);

    const { rows } = await pool.query(
      `SELECT * FROM gcc_world.ticket_time_slots WHERE ticket_id = $1 ORDER BY date`,
      [id]
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Time slots error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
