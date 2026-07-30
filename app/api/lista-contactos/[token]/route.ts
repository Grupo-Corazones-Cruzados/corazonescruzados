import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import {
  resolveShareToken, listSharedContacts, validateContactInput, assertRoomInList,
  emailExistsInList, MAX_CONTACTS_PER_SHARED_LIST, ShareError,
} from '@/lib/flows/contact-share';

/**
 * API PÚBLICA (sin sesión) de una lista de contactos compartida por enlace.
 * El token del path es la única credencial; `resolveShareToken` es el único camino a la BD.
 *
 * GET  → nombre de la lista + sus contactos
 * POST → agrega un contacto ({ name, email })
 *
 * No expone el flujo, ni otras listas, ni las campañas. Editar/quitar un contacto va en
 * `[contactId]/route.ts`.
 */

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const list = await resolveShareToken(token);
    if (!list) return NextResponse.json({ error: 'Este enlace no es válido o fue revocado' }, { status: 404 });

    const contacts = await listSharedContacts(list.id);
    return NextResponse.json({
      data: {
        listName: list.name,
        contacts,
        maxContacts: MAX_CONTACTS_PER_SHARED_LIST,
      },
    });
  } catch (err: any) {
    console.error('Public contact list GET error:', err.message);
    return NextResponse.json({ error: 'Error al cargar la lista' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const list = await resolveShareToken(token);
    if (!list) return NextResponse.json({ error: 'Este enlace no es válido o fue revocado' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const { name, email, phone, position } = validateContactInput(body);

    await assertRoomInList(list.id);
    if (await emailExistsInList(list.id, email)) {
      return NextResponse.json({ error: 'Ese correo ya está en la lista' }, { status: 409 });
    }

    const { rows: [row] } = await pool.query(
      `INSERT INTO gcc_world.flow_contacts (list_id, name, email, phone, position, added_via_share)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, name, email, phone, position, added_via_share, created_at`,
      [list.id, name, email, phone, position],
    );

    return NextResponse.json({
      data: {
        id: Number(row.id),
        name: row.name,
        email: row.email || '',
        phone: row.phone || '',
        position: row.position || '',
        addedViaShare: true,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      },
    }, { status: 201 });
  } catch (err: any) {
    if (err instanceof ShareError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Public contact list POST error:', err.message);
    return NextResponse.json({ error: 'Error al agregar el contacto' }, { status: 500 });
  }
}
