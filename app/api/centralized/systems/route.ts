import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { slugify, pisosAtOrBelow } from '@/lib/centralized/systems';
import { NextRequest, NextResponse } from 'next/server';

/** Genera un slug único para un sistema (dentro de centralized_systems). */
async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'sistema';
  let candidate = base;
  let n = 2;
  // Reintenta hasta encontrar uno libre.
  // (El volumen de sistemas es bajo; el bucle termina rápido.)
  while (true) {
    const { rows } = await pool.query(
      `SELECT 1 FROM gcc_world.centralized_systems WHERE slug = $1 LIMIT 1`,
      [candidate]
    );
    if (rows.length === 0) return candidate;
    candidate = `${base}-${n++}`;
  }
}

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
  // Slug estable para las rutas por sistema (/centralized/[piso]/[paso]/[slug]).
  await pool.query(`ALTER TABLE gcc_world.centralized_systems ADD COLUMN IF NOT EXISTS slug VARCHAR(220)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS centralized_systems_slug_key ON gcc_world.centralized_systems(slug)`);
  // Sistema built-in "Comandos Violeta" (global · creación). Se siembra idempotente para
  // que exista sin necesidad de crearlo a mano (define su propia interfaz por slug).
  await pool.query(
    `INSERT INTO gcc_world.centralized_systems (name, description, piso, paso, cell_name, slug)
     SELECT 'Comandos Violeta',
            'Configura modelos organizacionales: políticas activables por categoría, cada una con funciones (mensaje permanente, bloqueo de módulos, generación de tareas) que actúan en toda la app.',
            'global', 'creacion', 'Control Psicosocial', 'comandos-violeta'
     WHERE NOT EXISTS (SELECT 1 FROM gcc_world.centralized_systems WHERE slug = 'comandos-violeta')`,
  );
  // Sistema built-in "Gestión de Datos" (pilar · fundamentación, celda "Academia"). Ordena los datos
  // recolectados aplicando la condiciología como método de clasificación (Problemática → Fuentes →
  // Códigos → Categorías → Piezas → Rompecabezas → Subtemas → Temas). Sembrado idempotente por slug.
  await pool.query(
    `INSERT INTO gcc_world.centralized_systems (name, description, piso, paso, cell_name, slug)
     SELECT 'Gestión de Datos',
            'Gestiona y ordena los datos recolectados aplicando la condiciología como método de clasificación: por problemática se registran fuentes (premisa/peso), se generan códigos verificables, categorías, y luego piezas, rompecabezas, subtemas y temas.',
            'pilar', 'fundamentacion', 'Academia', 'gestion-de-datos'
     WHERE NOT EXISTS (SELECT 1 FROM gcc_world.centralized_systems WHERE slug = 'gestion-de-datos')`,
  );
  // Access table may be read (JOIN) before the access route creates it.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.centralized_member_access (
      id SERIAL PRIMARY KEY,
      member_id INT NOT NULL,
      piso VARCHAR(30) NOT NULL,
      paso VARCHAR(30) NOT NULL,
      cell_name VARCHAR(100) NOT NULL,
      system_id INT NOT NULL,
      granted_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(member_id, system_id)
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
    const slug = searchParams.get('slug');

    let query = `
      SELECT s.*, COALESCE(ac.cnt, 0)::int AS access_count
      FROM gcc_world.centralized_systems s
      LEFT JOIN (
        SELECT system_id, COUNT(*) AS cnt
        FROM gcc_world.centralized_member_access
        GROUP BY system_id
      ) ac ON ac.system_id = s.id`;
    const params: string[] = [];
    const conditions: string[] = [];

    if (piso) { conditions.push(`s.piso = $${params.length + 1}`); params.push(piso); }
    if (paso) { conditions.push(`s.paso = $${params.length + 1}`); params.push(paso); }
    if (slug) { conditions.push(`s.slug = $${params.length + 1}`); params.push(slug); }

    // Control de acceso: el admin global ve todos los sistemas. Cualquier otro
    // miembro accede a los sistemas de SU paso (exacto) en SU piso y en todos los
    // pisos por DEBAJO (jerárquico), o a los que se le compartieron explícitamente.
    if (user.role !== 'admin') {
      conditions.push('s.is_active = true');
      const { rows: [me] } = await pool.query(
        `SELECT m.id AS member_id, m.piso, m.paso
         FROM gcc_world.users u JOIN gcc_world.members m ON m.id = u.member_id
         WHERE u.id = $1`,
        [user.userId]
      );
      if (!me?.member_id) {
        // Sin miembro asociado → sin acceso a ningún sistema.
        return NextResponse.json({ data: [] });
      }
      const allowedPisos = pisosAtOrBelow(me.piso); // su piso + los de abajo
      const pp = `$${params.length + 1}`; params.push(allowedPisos as any);
      const ms = `$${params.length + 1}`; params.push(me.paso ?? '');
      const mid = `$${params.length + 1}`; params.push(String(me.member_id));
      conditions.push(
        `((s.piso = ANY(${pp}::text[]) AND s.paso = ${ms})` +
        ` OR EXISTS (SELECT 1 FROM gcc_world.centralized_member_access a WHERE a.system_id = s.id AND a.member_id = ${mid}::int))`
      );
    }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY s.created_at DESC';

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

    const slug = await uniqueSlug(name);
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.centralized_systems (name, description, piso, paso, cell_name, slug)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description || null, piso, paso, cellName, slug]
    );

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
