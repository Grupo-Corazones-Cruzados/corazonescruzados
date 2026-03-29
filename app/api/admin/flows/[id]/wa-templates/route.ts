import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.flow_wa_templates (
      id SERIAL PRIMARY KEY,
      flow_id INT NOT NULL REFERENCES gcc_world.flows(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      language VARCHAR(10) DEFAULT 'es',
      header_type VARCHAR(20) DEFAULT 'none',
      header_content TEXT,
      header_filename VARCHAR(255),
      body TEXT NOT NULL,
      footer VARCHAR(60),
      buttons JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ data: [] }, { status: 403 });
    await ensureTable();
    const { id } = await params;
    const { rows } = await pool.query(
      `SELECT * FROM gcc_world.flow_wa_templates WHERE flow_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('WA templates GET error:', err.message);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await ensureTable();
    const { id } = await params;
    const body = await req.json();
    const { name, language, header_type, header_content, header_filename, body: bodyText, footer, buttons } = body;

    if (!name?.trim() || !bodyText?.trim()) {
      return NextResponse.json({ error: 'Nombre y cuerpo son requeridos' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.flow_wa_templates (flow_id, name, language, header_type, header_content, header_filename, body, footer, buttons)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, name.trim(), language || 'es', header_type || 'none', header_content || null, header_filename || null, bodyText.trim(), footer || null, JSON.stringify(buttons || [])]
    );

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('WA templates POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
