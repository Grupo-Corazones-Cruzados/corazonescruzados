import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.flow_contact_lists (
      id SERIAL PRIMARY KEY,
      flow_id INT NOT NULL REFERENCES gcc_world.flows(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gcc_world.flow_contacts (
      id SERIAL PRIMARY KEY,
      list_id INT NOT NULL REFERENCES gcc_world.flow_contact_lists(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL DEFAULT '',
      phone VARCHAR(30),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE gcc_world.flow_contacts ALTER COLUMN email DROP NOT NULL;
    ALTER TABLE gcc_world.flow_contacts ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
  `);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ data: [] }, { status: 403 });

    await ensureTables();
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT cl.*, (SELECT COUNT(*)::int FROM gcc_world.flow_contacts WHERE list_id = cl.id) as contact_count
       FROM gcc_world.flow_contact_lists cl
       WHERE cl.flow_id = $1
       ORDER BY cl.created_at DESC`,
      [id]
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Contact lists GET error:', err.message);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await ensureTables();
    const { id } = await params;
    const { name } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.flow_contact_lists (flow_id, name) VALUES ($1, $2) RETURNING *`,
      [id, name.trim()]
    );

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Contact lists POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
