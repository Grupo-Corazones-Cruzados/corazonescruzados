import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

// Ensure table exists
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.flows (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      description TEXT,
      status VARCHAR(20) DEFAULT 'draft',
      config JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ data: [] }, { status: 403 });

    await ensureTable();

    const { rows } = await pool.query(
      `SELECT id, name, type, description, status, config, created_at, updated_at
       FROM gcc_world.flows
       ORDER BY created_at DESC`
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Flows GET error:', err.message);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await ensureTable();

    const body = await req.json();
    const { name, type, description, config } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'name y type son requeridos' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.flows (name, type, description, config)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, type, description || '', JSON.stringify(config || {})]
    );

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Flows POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
