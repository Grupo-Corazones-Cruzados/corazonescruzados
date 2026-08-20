import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * El DETALLE DE SERVICIOS de una factura: documento informativo, no comprobante.
 *
 * Aquí solo viven los conceptos que Fernando añade a mano (los que no factura) y sus
 * observaciones. Los ítems facturados no se copian: se leen de la factura al armar el
 * PDF, para que el documento nunca contradiga al comprobante.
 */

async function ensureTabla() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.invoice_annexes (
      id BIGSERIAL PRIMARY KEY,
      invoice_id INT NOT NULL,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_annexes_invoice ON gcc_world.invoice_annexes (invoice_id);
  `);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    await ensureTabla();

    const { rows: [doc] } = await pool.query(
      `SELECT items, notes, updated_at FROM gcc_world.invoice_annexes WHERE invoice_id = ($1)::int`, [id]
    );
    // Los ítems reales de la factura, para enseñarlos en el formulario sin poder tocarlos.
    const { rows: items } = await pool.query(
      `SELECT description, quantity, unit_price, discount, subtotal
         FROM gcc_world.invoice_items_sri WHERE invoice_id = ($1)::int ORDER BY id`, [id]
    );

    return NextResponse.json({
      data: doc ? { items: doc.items || [], notes: doc.notes || '', updatedAt: doc.updated_at } : null,
      invoiceItems: items.map((i: any) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
        subtotal: Number(i.subtotal),
      })),
    });
  } catch (err: any) {
    console.error('Detalle de servicios GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const { items, notes } = await req.json();
    await ensureTabla();

    const limpios = (Array.isArray(items) ? items : [])
      .map((i: any) => ({
        description: String(i.description || '').trim(),
        quantity: Number(i.quantity) || 0,
        unitPrice: Number(i.unitPrice) || 0,
      }))
      .filter((i: any) => i.description && i.quantity > 0);

    await pool.query(
      `INSERT INTO gcc_world.invoice_annexes (invoice_id, items, notes)
       VALUES (($1)::int, $2::jsonb, $3)
       ON CONFLICT (invoice_id) DO UPDATE
         SET items = EXCLUDED.items, notes = EXCLUDED.notes, updated_at = NOW()`,
      [id, JSON.stringify(limpios), (notes || '').trim() || null]
    );
    return NextResponse.json({ ok: true, data: { items: limpios, notes: (notes || '').trim() } });
  } catch (err: any) {
    console.error('Detalle de servicios PUT error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    await ensureTabla();
    await pool.query(`DELETE FROM gcc_world.invoice_annexes WHERE invoice_id = ($1)::int`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Detalle de servicios DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
