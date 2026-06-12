import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureBillingClientsTable, CONSUMIDOR_FINAL_RUC } from '@/lib/billing-clients';

/**
 * Fusiona el cliente `source_id` DENTRO del cliente `[id]` (canónico): la
 * identificación del origen (y sus alias) pasan a ser alias del canónico, y el
 * registro origen se elimina. Las facturas NO se modifican: se agrupan por alias.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ensureBillingClientsTable();

    const { id } = await params;
    const { source_id } = await req.json();
    if (!source_id) return NextResponse.json({ error: 'Falta el cliente a fusionar' }, { status: 400 });
    if (String(source_id) === String(id)) return NextResponse.json({ error: 'No se puede fusionar un cliente consigo mismo' }, { status: 400 });

    const { rows: [target] } = await pool.query(`SELECT id, ruc, aliases FROM gcc_world.billing_clients WHERE id = $1`, [id]);
    const { rows: [source] } = await pool.query(`SELECT id, ruc, aliases FROM gcc_world.billing_clients WHERE id = $1`, [source_id]);
    if (!target || !source) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    if (target.ruc === CONSUMIDOR_FINAL_RUC || source.ruc === CONSUMIDOR_FINAL_RUC) {
      return NextResponse.json({ error: 'No se puede fusionar el registro Consumidor Final' }, { status: 400 });
    }

    // El canónico adopta como alias: el ruc del origen + los alias del origen.
    const newAliases = Array.from(new Set([
      ...(target.aliases || []),
      source.ruc,
      ...(source.aliases || []),
    ].filter((r: string) => r && r !== target.ruc)));

    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`UPDATE gcc_world.billing_clients SET aliases = $1, updated_at = NOW() WHERE id = $2`, [newAliases, id]);
      await c.query(`DELETE FROM gcc_world.billing_clients WHERE id = $1`, [source_id]);
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; }
    finally { c.release(); }

    return NextResponse.json({ ok: true, aliases: newAliases });
  } catch (err: any) {
    console.error('Billing client merge error:', err.message);
    return NextResponse.json({ error: 'Error al fusionar' }, { status: 500 });
  }
}
