import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

async function ensureTable() {
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
    const memberId = searchParams.get('member_id');
    const systemId = searchParams.get('system_id');

    if (user.role === 'admin') {
      let query = `
        SELECT a.*, m.name as member_name, m.photo_url, s.name as system_name
        FROM gcc_world.centralized_member_access a
        JOIN gcc_world.members m ON m.id = a.member_id
        JOIN gcc_world.centralized_systems s ON s.id = a.system_id
      `;
      const params: any[] = [];
      const conditions: string[] = [];
      if (memberId) { conditions.push(`a.member_id = $${params.length + 1}`); params.push(memberId); }
      if (systemId) { conditions.push(`a.system_id = $${params.length + 1}`); params.push(systemId); }
      if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
      query += ' ORDER BY a.member_id, a.piso, a.paso, a.created_at DESC';

      const { rows } = await pool.query(query, params);
      return NextResponse.json({ data: rows });
    }

    // Member: see own access
    const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
    if (!u?.member_id) return NextResponse.json({ data: [] });

    const { rows } = await pool.query(
      `SELECT a.*, s.name as system_name
       FROM gcc_world.centralized_member_access a
       JOIN gcc_world.centralized_systems s ON s.id = a.system_id
       WHERE a.member_id = $1
       ORDER BY a.piso, a.paso, a.created_at DESC`,
      [u.member_id]
    );

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

    const { member_id, system_ids } = await req.json();
    if (!member_id || !system_ids?.length) return NextResponse.json({ error: 'member_id and system_ids required' }, { status: 400 });

    // Get system details for each system_id
    const { rows: systems } = await pool.query(
      `SELECT id, piso, paso, cell_name FROM gcc_world.centralized_systems WHERE id = ANY($1)`,
      [system_ids]
    );

    if (systems.length === 0) return NextResponse.json({ error: 'No valid systems found' }, { status: 400 });

    const inserted: any[] = [];
    for (const sys of systems) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO gcc_world.centralized_member_access (member_id, piso, paso, cell_name, system_id, granted_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (member_id, system_id) DO NOTHING
           RETURNING *`,
          [member_id, sys.piso, sys.paso, sys.cell_name, sys.id, user.userId]
        );
        if (rows.length) inserted.push(rows[0]);
      } catch { /* skip duplicates */ }
    }

    return NextResponse.json({ data: inserted, count: inserted.length }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    await ensureTable();

    const { access_id } = await req.json();
    if (!access_id) return NextResponse.json({ error: 'access_id required' }, { status: 400 });

    const { rowCount } = await pool.query(
      `DELETE FROM gcc_world.centralized_member_access WHERE id = $1`, [access_id]
    );

    if (rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
