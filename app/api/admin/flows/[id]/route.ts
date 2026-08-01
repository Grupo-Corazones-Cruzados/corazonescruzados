import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

/**
 * Un flujo. Lo consume la página de detalle `/dashboard/automatizaciones/[id]`, que necesita
 * el tipo para decidir qué espacio de trabajo montar (email masivo / WhatsApp / agente IA).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const { rows } = await pool.query(`SELECT * FROM gcc_world.flows WHERE id = $1`, [id]);
    if (rows.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Flow GET error:', err.message);
    return NextResponse.json({ error: 'Error al cargar el flujo' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { name, type, description, status, config } = body;

    const { rows } = await pool.query(
      `UPDATE gcc_world.flows
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           description = COALESCE($3, description),
           status = COALESCE($4, status),
           config = COALESCE($5, config),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, type, description, status, config ? JSON.stringify(config) : null, id]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Flows PUT error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const { rowCount } = await pool.query(`DELETE FROM gcc_world.flows WHERE id = $1`, [id]);

    if (rowCount === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Flows DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
