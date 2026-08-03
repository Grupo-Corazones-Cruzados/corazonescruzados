import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { puedeVerFlujo } from '@/lib/flows/acceso';

export async function GET(req: Request, { params }: { params: Promise<{ id: string; listId: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id, listId } = await params;
    if (!await puedeVerFlujo(user, id)) return NextResponse.json({ data: [] }, { status: 403 });
    const { rows } = await pool.query(
      `SELECT id, list_id, name, email, phone, position, added_via_share, created_at
         FROM gcc_world.flow_contacts WHERE list_id = $1 ORDER BY created_at DESC, id DESC`,
      [listId]
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Contacts GET error:', err.message);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; listId: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id, listId } = await params;
    if (!await puedeVerFlujo(user, id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();

    // Support both single contact and batch
    const contacts: { name: string; email?: string; phone?: string; position?: string }[] = Array.isArray(body) ? body : [body];

    if (contacts.some(c => !c.name?.trim())) {
      return NextResponse.json({ error: 'El nombre es requerido para cada contacto' }, { status: 400 });
    }
    // At least email or phone required
    if (contacts.some(c => !c.email?.trim() && !c.phone?.trim())) {
      return NextResponse.json({ error: 'El correo o el teléfono es requerido para cada contacto' }, { status: 400 });
    }

    // `position` = puesto/cargo; junto con nombre, correo y teléfono es lo que se puede
    // insertar como variable en el correo de la campaña.
    const values: any[] = [];
    const placeholders: string[] = [];
    contacts.forEach((c, i) => {
      const offset = i * 5;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      values.push(listId, c.name.trim(), (c.email || '').trim().toLowerCase(), (c.phone || '').trim(), (c.position || '').trim() || null);
    });

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.flow_contacts (list_id, name, email, phone, position) VALUES ${placeholders.join(', ')}
       RETURNING id, list_id, name, email, phone, position, added_via_share, created_at`,
      values
    );

    return NextResponse.json({ data: rows }, { status: 201 });
  } catch (err: any) {
    console.error('Contacts POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; listId: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    if (!await puedeVerFlujo(user, id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) return NextResponse.json({ error: 'contactId requerido' }, { status: 400 });

    await pool.query(`DELETE FROM gcc_world.flow_contacts WHERE id = $1`, [contactId]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Contact DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
