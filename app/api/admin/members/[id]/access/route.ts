import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { isPiso, isPaso } from '@/lib/centralized/systems';
import { NextResponse } from 'next/server';

/**
 * Configura el acceso del miembro al módulo Centralizado (solo admin): su **piso** y
 * su **paso** (`members.piso`, `members.paso`). El acceso resultante es jerárquico por
 * piso (su piso + los de abajo) y exacto por paso — ver `GET /api/centralized/systems`.
 * Enviar `null`/'' en un campo lo limpia (deja al miembro sin acceso por celda).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const piso = body.piso ? String(body.piso) : null;
    const paso = body.paso ? String(body.paso) : null;
    if (piso && !isPiso(piso)) return NextResponse.json({ error: 'Piso inválido' }, { status: 400 });
    if (paso && !isPaso(paso)) return NextResponse.json({ error: 'Paso inválido' }, { status: 400 });

    const { rows } = await pool.query(
      `UPDATE gcc_world.members SET piso = $1, paso = $2, updated_at = NOW()
        WHERE id = $3 RETURNING id, piso, paso`,
      [piso, paso, id],
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 });

    return NextResponse.json({ ok: true, data: rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Member access config error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
