import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import {
  resolveShareToken, validateContactInput, emailExistsInList, ShareError,
} from '@/lib/flows/contact-share';

/**
 * API PÚBLICA de UN contacto de una lista compartida.
 *
 * PATCH  → edita nombre/correo
 * DELETE → lo quita
 *
 * Toda consulta filtra por `list_id` además del `id`, así que con el token de una lista
 * NO se puede tocar un contacto de otra aunque se adivine su id.
 */

export const dynamic = 'force-dynamic';

async function resolve(token: string, contactId: string) {
  const list = await resolveShareToken(token);
  if (!list) throw new ShareError('Este enlace no es válido o fue revocado', 404);
  const id = Number(contactId);
  if (!Number.isInteger(id) || id <= 0) throw new ShareError('Contacto inválido', 400);
  return { list, id };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string; contactId: string }> }) {
  try {
    const { token, contactId } = await params;
    const { list, id } = await resolve(token, contactId);

    const body = await req.json().catch(() => ({}));
    const { name, email, phone, position } = validateContactInput(body);

    if (await emailExistsInList(list.id, email, id)) {
      return NextResponse.json({ error: 'Ese correo ya está en la lista' }, { status: 409 });
    }

    const { rows: [row] } = await pool.query(
      `UPDATE gcc_world.flow_contacts
          SET name = $1, email = $2, phone = $3, position = $4
        WHERE id = $5 AND list_id = $6
        RETURNING id, name, email, phone, position, added_via_share, created_at`,
      [name, email, phone, position, id, list.id],
    );
    if (!row) return NextResponse.json({ error: 'El contacto no existe en esta lista' }, { status: 404 });

    return NextResponse.json({
      data: {
        id: Number(row.id),
        name: row.name,
        email: row.email || '',
        phone: row.phone || '',
        position: row.position || '',
        addedViaShare: !!row.added_via_share,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      },
    });
  } catch (err: any) {
    if (err instanceof ShareError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Public contact PATCH error:', err.message);
    return NextResponse.json({ error: 'Error al guardar el contacto' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ token: string; contactId: string }> }) {
  try {
    const { token, contactId } = await params;
    const { list, id } = await resolve(token, contactId);

    const { rowCount } = await pool.query(
      `DELETE FROM gcc_world.flow_contacts WHERE id = $1 AND list_id = $2`,
      [id, list.id],
    );
    if (!rowCount) return NextResponse.json({ error: 'El contacto no existe en esta lista' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof ShareError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Public contact DELETE error:', err.message);
    return NextResponse.json({ error: 'Error al quitar el contacto' }, { status: 500 });
  }
}
