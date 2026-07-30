import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

/**
 * Un contacto de una lista. Los cuatro campos editables (nombre, correo, teléfono, puesto)
 * son justo los que alimentan las VARIABLES del correo (`lib/flows/variables.ts`).
 *
 * PATCH  → edita los campos que lleguen
 * DELETE → lo quita
 *
 * Se valida que la lista sea del flujo y el contacto de la lista: así ni con ids ajenos se
 * escribe fuera del flujo en el que se está trabajando.
 */

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === 'admin' ? user : null;
}

/** La lista pertenece al flujo. */
async function listInFlow(flowId: string, listId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.flow_contact_lists WHERE id = $1 AND flow_id = $2`, [listId, flowId],
  );
  return rows.length > 0;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; listId: string; contactId: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id, listId, contactId } = await params;
    if (!await listInFlow(id, listId)) return NextResponse.json({ error: 'La lista no existe' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const name = body?.name !== undefined ? String(body.name).trim() : undefined;
    const email = body?.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;
    const phone = body?.phone !== undefined ? String(body.phone).trim() : undefined;
    const position = body?.position !== undefined ? String(body.position).trim() : undefined;

    if (name !== undefined && !name) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ error: 'El correo no tiene un formato válido' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `UPDATE gcc_world.flow_contacts SET
         name     = COALESCE($1, name),
         email    = COALESCE($2, email),
         phone    = COALESCE($3, phone),
         position = COALESCE($4, position)
       WHERE id = $5 AND list_id = $6
       RETURNING id, name, email, phone, position, added_via_share, created_at`,
      [name ?? null, email ?? null, phone ?? null, position ?? null, contactId, listId],
    );
    if (rows.length === 0) return NextResponse.json({ error: 'El contacto no existe en esta lista' }, { status: 404 });

    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Contact PATCH error:', err.message);
    return NextResponse.json({ error: 'Error al guardar el contacto' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; listId: string; contactId: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id, listId, contactId } = await params;
    if (!await listInFlow(id, listId)) return NextResponse.json({ error: 'La lista no existe' }, { status: 404 });

    const { rowCount } = await pool.query(
      `DELETE FROM gcc_world.flow_contacts WHERE id = $1 AND list_id = $2`, [contactId, listId],
    );
    if (!rowCount) return NextResponse.json({ error: 'El contacto no existe en esta lista' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Contact DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
