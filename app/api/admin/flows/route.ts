import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { filtroDeFlujos } from '@/lib/flows/acceso';
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
    if (!user) return NextResponse.json({ data: [] }, { status: 401 });

    await ensureTable();

    // ⚠️ ANTES ESTO DEVOLVÍA TODOS LOS FLUJOS A CUALQUIERA CON SESIÓN. Con un solo cliente
    // no se notaba; con dos, el cliente A veía el flujo del cliente B —y desde ahí su
    // bandeja de WhatsApp—. Quién ve qué lo decide `lib/flows/acceso.ts`, en un solo sitio.
    const { sql: filtro, params } = await filtroDeFlujos(user);

    const { rows } = await pool.query(
      `SELECT f.id, f.name, f.type, f.category, f.description, f.status, f.config,
              f.responsable_user_id, f.created_at, f.updated_at
       FROM gcc_world.flows f
       WHERE ${filtro}
       ORDER BY f.created_at DESC`,
      params,
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
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

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
