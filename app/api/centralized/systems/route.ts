import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const CELL_MAP: Record<string, Record<string, string>> = {
  global:      { fundamentacion: 'Condiciología', creacion: 'Control Psicosocial', implementacion: 'Centralizado', gestion: 'Gestión Psicosocial' },
  pilar:       { fundamentacion: 'Academia',      creacion: 'Tecnología',          implementacion: 'Organización', gestion: 'Publicación' },
  controlador: { fundamentacion: 'Conocimiento',  creacion: 'Herramientas',        implementacion: 'Estrategias',  gestion: 'Soluciones' },
  colaborador: { fundamentacion: 'Investigador',  creacion: 'Desarrollador',       implementacion: 'Planificador', gestion: 'Líder' },
};

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.centralized_systems (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      piso VARCHAR(30) NOT NULL,
      paso VARCHAR(30) NOT NULL,
      cell_name VARCHAR(100) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await ensureTable();

    const { searchParams } = new URL(req.url);
    const piso = searchParams.get('piso');
    const paso = searchParams.get('paso');

    let query = 'SELECT * FROM gcc_world.centralized_systems';
    const params: string[] = [];
    const conditions: string[] = [];

    if (piso) { conditions.push(`piso = $${params.length + 1}`); params.push(piso); }
    if (paso) { conditions.push(`paso = $${params.length + 1}`); params.push(paso); }
    if (user.role !== 'admin') { conditions.push('is_active = true'); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, params);
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    await ensureTable();

    const { name, description, piso, paso } = await req.json();
    if (!name || !piso || !paso) return NextResponse.json({ error: 'name, piso, paso required' }, { status: 400 });

    const cellName = CELL_MAP[piso]?.[paso];
    if (!cellName) return NextResponse.json({ error: 'Invalid piso/paso combination' }, { status: 400 });

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.centralized_systems (name, description, piso, paso, cell_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, description || null, piso, paso, cellName]
    );

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
