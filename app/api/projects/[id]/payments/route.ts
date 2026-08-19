import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { getProjectPayments, getProjectBilling, ensureStageBilling } from '@/lib/payments';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const data = await getProjectPayments(id);
    const billing = await getProjectBilling(id);
    // Cobros registrados (dinero recibido; no son comprobantes)
    const { rows: collections } = await pool.query(
      `SELECT id, amount, notes, created_at, status FROM gcc_world.project_payments
        WHERE project_id = ($1)::bigint AND status <> 'cancelled' ORDER BY created_at DESC`,
      [id],
    );
    return NextResponse.json({ data, billing, collections });
  } catch (err: any) {
    console.error('Project payments error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

/**
 * Registra un COBRO del proyecto: dinero recibido del cliente (p. ej. el 25% a la
 * firma). No emite comprobante — la factura se emite al entregar cada etapa, que es
 * cuando se verifica el hecho generador. Sirve para saber cuánto se ha cobrado
 * frente a lo facturado y lo pendiente.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const { amount, notes } = await req.json();
    const monto = Number(amount);
    if (!monto || monto <= 0) return NextResponse.json({ error: 'Ingresa un monto mayor a 0' }, { status: 400 });

    await ensureStageBilling();
    const { rows: [row] } = await pool.query(
      `INSERT INTO gcc_world.project_payments (project_id, amount, notes, status, confirmed_at)
       VALUES (($1)::bigint, $2, $3, 'confirmed', NOW()) RETURNING id`,
      [id, monto.toFixed(2), (notes || '').trim() || null],
    );
    return NextResponse.json({ ok: true, id: row.id });
  } catch (err: any) {
    console.error('Project payment register error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Elimina un cobro mal registrado. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const paymentId = req.nextUrl.searchParams.get('payment_id');
    if (!paymentId) return NextResponse.json({ error: 'Falta el cobro a eliminar' }, { status: 400 });
    await pool.query(
      `DELETE FROM gcc_world.project_payments WHERE id = ($1)::bigint AND project_id = ($2)::bigint`,
      [paymentId, id],
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Project payment delete error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
