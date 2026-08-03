import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { puedeVerFlujo } from '@/lib/flows/acceso';

/**
 * Una lista de contactos del flujo.
 *
 * PATCH  → renombrar
 * DELETE → borrarla (sus contactos y sus vínculos con campañas caen por CASCADE)
 *
 * Ambos filtran por `flow_id`: desde un flujo no se puede tocar la lista de otro.
 */

/**
 * ⚠️ Antes esto exigía rol de administrador y por eso un cliente con acceso al flujo no
 * podía ver sus listas de contactos. La regla correcta es la del flujo — ver
 * `puedeVerFlujo` en `lib/flows/acceso.ts`.
 */
async function puedeEntrar(flowId: string) {
  return puedeVerFlujo(await getCurrentUser(), flowId);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; listId: string }> }) {
  try {
    const { id, listId } = await params;
    if (!await puedeEntrar(id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    if (name.length > 255) return NextResponse.json({ error: 'El nombre es demasiado largo' }, { status: 400 });

    const { rows } = await pool.query(
      `UPDATE gcc_world.flow_contact_lists SET name = $1 WHERE id = $2 AND flow_id = $3 RETURNING *`,
      [name, listId, id],
    );
    if (rows.length === 0) return NextResponse.json({ error: 'La lista no existe' }, { status: 404 });

    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Contact list PATCH error:', err.message);
    return NextResponse.json({ error: 'Error al renombrar la lista' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; listId: string }> }) {
  try {
    const { id, listId } = await params;
    if (!await puedeEntrar(id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { rowCount } = await pool.query(
      `DELETE FROM gcc_world.flow_contact_lists WHERE id = $1 AND flow_id = $2`,
      [listId, id],
    );
    if (!rowCount) return NextResponse.json({ error: 'La lista no existe' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Contact list DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
