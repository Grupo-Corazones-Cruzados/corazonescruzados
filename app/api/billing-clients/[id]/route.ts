import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureBillingClientsTable, invoiceOrigin, CONSUMIDOR_FINAL_RUC } from '@/lib/billing-clients';

async function loadDetail(id: number) {
  const { rows: [c] } = await pool.query(`SELECT * FROM gcc_world.billing_clients WHERE id = $1`, [id]);
  if (!c) return null;

  const { rows: invoices } = await pool.query(
    `SELECT i.id, i.invoice_number, i.total, i.status, i.sri_status, i.created_at,
            i.source_type, i.source_id, i.project_id,
            t.title AS ticket_title, p.title AS project_title
       FROM gcc_world.invoices i
       LEFT JOIN gcc_world.tickets t ON i.source_type = 'ticket' AND t.id::text = i.source_id
       LEFT JOIN gcc_world.projects p ON p.id = i.project_id
      WHERE i.client_ruc = $1 OR i.client_ruc = ANY($2::text[])
      ORDER BY i.created_at DESC`,
    [c.ruc, c.aliases || []]
  );

  const invList = invoices.map((i: any) => {
    const origin = invoiceOrigin({ source_type: i.source_type, source_id: i.source_id, project_id: i.project_id });
    return {
      id: i.id, invoice_number: i.invoice_number, total: Number(i.total),
      status: i.status, sri_status: i.sri_status,
      created_at: i.created_at ? String(i.created_at).split('T')[0] : null,
      origin_type: origin.type, origin_id: origin.id,
      origin_label: origin.type === 'ticket' ? (i.ticket_title || `Ticket #${origin.id}`)
        : origin.type === 'project' ? (i.project_title || 'Proyecto')
        : origin.type === 'subscription' ? 'Suscripción' : null,
    };
  });

  const totalFacturado = invList.filter((i: any) => i.status !== 'cancelled').reduce((s: number, i: any) => s + i.total, 0);
  const totalAutorizado = invList.filter((i: any) => i.sri_status === 'authorized').reduce((s: number, i: any) => s + i.total, 0);

  return {
    id: c.id, id_type: c.id_type, ruc: c.ruc, name: c.name, email: c.email,
    phone: c.phone, address: c.address, notes: c.notes, aliases: c.aliases || [], country: c.country,
    is_consumidor_final: c.ruc === CONSUMIDOR_FINAL_RUC,
    invoices: invList,
    summary: {
      count: invList.length,
      authorized: invList.filter((i: any) => i.sri_status === 'authorized').length,
      total_facturado: totalFacturado,
      total_autorizado: totalAutorizado,
    },
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ensureBillingClientsTable();
    const { id } = await params;
    const detail = await loadDetail(Number(id));
    if (!detail) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    return NextResponse.json({ data: detail });
  } catch (err: any) {
    console.error('Billing client detail error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ensureBillingClientsTable();
    const { id } = await params;
    const b = await req.json();

    const { rows: [existing] } = await pool.query(`SELECT ruc FROM gcc_world.billing_clients WHERE id = $1`, [id]);
    if (!existing) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    const isCF = existing.ruc === CONSUMIDOR_FINAL_RUC;

    const fields: string[] = [];
    const values: any[] = [];
    const set = (col: string, val: any) => { values.push(val); fields.push(`${col} = $${values.length}`); };

    // El registro Consumidor Final no permite cambiar identificación/nombre.
    if (!isCF) {
      if (b.id_type != null) set('id_type', String(b.id_type));
      if (b.ruc != null) { const r = String(b.ruc).trim(); if (!r) return NextResponse.json({ error: 'Identificación inválida' }, { status: 400 }); set('ruc', r); }
      if (b.name != null) { const n = String(b.name).trim(); if (!n) return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 }); set('name', n); }
    }
    if (b.email != null) set('email', String(b.email).trim() || null);
    if (b.phone != null) set('phone', String(b.phone).trim() || null);
    if (b.address != null) set('address', String(b.address).trim() || null);
    if (b.notes != null) set('notes', String(b.notes).trim() || null);
    if (b.country != null) set('country', String(b.country).trim() || null);

    if (!fields.length) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    fields.push(`updated_at = NOW()`);
    values.push(Number(id));
    try {
      await pool.query(`UPDATE gcc_world.billing_clients SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
    } catch (e: any) {
      if (e.code === '23505') return NextResponse.json({ error: 'Ya existe otro cliente con esa identificación' }, { status: 409 });
      throw e;
    }

    // Propagar a la tabla del portal (lista unificada) para que tickets/proyectos vean los mismos datos.
    try {
      const { rows: [bc] } = await pool.query(`SELECT portal_client_id, name, email, ruc, address, phone FROM gcc_world.billing_clients WHERE id = $1`, [id]);
      if (bc?.portal_client_id) {
        await pool.query(`UPDATE gcc_world.clients SET name = $1, ruc = $2, address = $3, phone = $4 WHERE id = $5`,
          [bc.name, bc.ruc, bc.address, bc.phone, bc.portal_client_id]);
        if (bc.email) await pool.query(`UPDATE gcc_world.clients SET email = $1 WHERE id = $2`, [bc.email, bc.portal_client_id]).catch(() => {});
      }
    } catch (propErr: any) { console.error('Propagate update to clients error:', propErr.message); }

    const detail = await loadDetail(Number(id));
    return NextResponse.json({ data: detail });
  } catch (err: any) {
    console.error('Billing client update error:', err.message);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await ensureBillingClientsTable();
    const { id } = await params;
    const { rows: [c] } = await pool.query(`SELECT ruc, portal_client_id FROM gcc_world.billing_clients WHERE id = $1`, [id]);
    if (!c) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    if (c.ruc === CONSUMIDOR_FINAL_RUC) return NextResponse.json({ error: 'No se puede eliminar Consumidor Final' }, { status: 400 });
    // No permitir borrar un cliente con tickets/proyectos activos (evita dejarlos sin cliente).
    if (c.portal_client_id) {
      const { rows: [refs] } = await pool.query(
        `SELECT (SELECT COUNT(*) FROM gcc_world.tickets WHERE client_id = $1)::int AS t,
                (SELECT COUNT(*) FROM gcc_world.projects WHERE client_id = $1)::int AS p`,
        [c.portal_client_id]
      );
      if (refs.t > 0 || refs.p > 0) {
        return NextResponse.json({ error: `No se puede eliminar: el cliente tiene ${refs.t} ticket(s) y ${refs.p} proyecto(s) asociados. Reasígnalos o ciérralos primero.` }, { status: 409 });
      }
    }
    // Elimina el registro del cliente. Las facturas (documentos fiscales) se conservan.
    await pool.query(`DELETE FROM gcc_world.billing_clients WHERE id = $1`, [id]);
    // Propagar a la tabla del portal (lista unificada): borrar también su registro en `clients`,
    // así desaparece de los selectores de tickets/proyectos y la siembra no lo resucita.
    if (c.portal_client_id) {
      await pool.query(`DELETE FROM gcc_world.clients WHERE id = $1`, [c.portal_client_id]).catch((e: any) => console.error('cascade delete clients:', e.message));
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Billing client delete error:', err.message);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
