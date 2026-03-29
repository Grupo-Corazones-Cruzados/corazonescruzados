import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 15);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      where += ` AND t.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND t.title ILIKE $${params.length}`;
    }
    if (user.role === 'client') {
      params.push(user.userId);
      where += ` AND t.client_id IN (SELECT id FROM gcc_world.clients WHERE user_id = $${params.length})`;
    }

    const countQ = await pool.query(`SELECT COUNT(*) FROM gcc_world.tickets t ${where}`, params);
    params.push(limit, offset);
    const dataQ = await pool.query(
      `SELECT t.*, c.name as client_name, m.name as member_name
       FROM gcc_world.tickets t
       LEFT JOIN gcc_world.clients c ON c.id = t.client_id
       LEFT JOIN gcc_world.members m ON m.id = t.member_id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return NextResponse.json({ data: dataQ.rows, total: Number(countQ.rows[0].count) });
  } catch (err: any) {
    console.error('Tickets error:', err.message);
    return NextResponse.json({ data: [], total: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { title, description, service_id, member_id, client_id, deadline, estimated_hours, estimated_cost } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'El titulo es requerido' }, { status: 400 });
    }

    // If user is a client, resolve their client_id automatically
    let resolvedClientId = client_id || null;
    if (user.role === 'client' && !resolvedClientId) {
      const clientRes = await pool.query(
        `SELECT id FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`,
        [user.userId]
      );
      if (clientRes.rows.length > 0) resolvedClientId = clientRes.rows[0].id;
    }

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.tickets (title, description, service_id, member_id, client_id, deadline, estimated_hours, estimated_cost, status, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, NOW(), NOW())
       RETURNING *`,
      [
        title.trim(),
        description?.trim() || null,
        service_id || null,
        member_id || null,
        resolvedClientId,
        deadline || null,
        estimated_hours || null,
        estimated_cost || null,
        user.userId,
      ]
    );

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Ticket create error:', err.message);
    return NextResponse.json({ error: 'Error al crear ticket' }, { status: 500 });
  }
}
