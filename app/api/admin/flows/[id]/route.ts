import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { flujoPermitido } from '@/lib/flows/acceso';
import { NextResponse } from 'next/server';

/**
 * Un flujo. Lo consume la página de detalle `/dashboard/automatizaciones/[id]`, que necesita
 * el tipo para decidir qué espacio de trabajo montar (email masivo / WhatsApp / agente IA).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // LEER el flujo ya no es solo de administradores: un cliente con acceso tiene que poder
    // abrir su propio flujo. Quién puede lo decide `flujoPermitido()`. Modificarlo y
    // borrarlo siguen siendo de administrador (ver PUT y DELETE más abajo).
    const { id } = await params;
    const flujo = await flujoPermitido(user, id);
    if (!flujo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({ data: flujo });
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
