import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { getProjectBilling, getProjectEtapas, ensureStageBilling } from '@/lib/payments';

/** Plan de etapas del proyecto (el acuerdo con el cliente) y su base de reparto. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const billing = await getProjectBilling(id);
    return NextResponse.json({ data: billing?.etapas || [], baseTotal: billing?.baseTotal || 0 });
  } catch (err: any) {
    console.error('Project stages error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Guarda el plan completo: llega la lista de etapas y sustituye a la anterior.
 *
 * El importe de la ÚLTIMA etapa NO se acepta del cliente: se calcula aquí como el
 * resto (base − las anteriores), que es como Fernando las acuerda y evita que el plan
 * se descuadre por un redondeo de la pantalla.
 *
 * Una etapa YA FACTURADA no se toca: ni se borra ni cambia de importe, porque su
 * comprobante ya salió. Si hay que corregirla, primero se anula la factura.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const { stages } = await req.json();
    if (!Array.isArray(stages)) return NextResponse.json({ error: 'Faltan las etapas' }, { status: 400 });

    await ensureStageBilling();
    const billing = await getProjectBilling(id);
    if (!billing) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    const facturadas = billing.etapas.filter(e => e.invoiceId);
    const entrantes = stages
      .map((e: any, i: number) => ({
        id: e.id != null ? Number(e.id) : null,
        name: String(e.name || '').trim() || `Etapa ${i + 1}`,
        amount: Number(e.amount) || 0,
      }))
      .filter((e: any) => e.name);

    // Las etapas ya facturadas tienen que seguir estando, con su mismo importe.
    for (const f of facturadas) {
      const sigue = entrantes.find((e: any) => e.id === f.id);
      if (!sigue) {
        return NextResponse.json({
          error: `La etapa «${f.name}» ya está facturada (${f.invoiceNumber}) y no se puede eliminar. Anula esa factura primero.`,
        }, { status: 409 });
      }
      sigue.amount = f.amount;
      sigue.name = f.name;
    }

    if (entrantes.length === 0) {
      // Plan vacío = el proyecto vuelve a facturarse por requerimientos.
      if (facturadas.length > 0) {
        return NextResponse.json({ error: 'Hay etapas facturadas: no se puede vaciar el plan.' }, { status: 409 });
      }
      await pool.query(`DELETE FROM gcc_world.project_stages WHERE project_id = ($1)::bigint`, [id]);
      return NextResponse.json({ ok: true, data: [] });
    }

    // La última recoge el resto de la base del proyecto (nunca negativa).
    const base = Number(billing.baseTotal) || 0;
    const anteriores = entrantes.slice(0, -1).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
    const ultima = entrantes[entrantes.length - 1];
    if (!facturadas.some(f => f.id === ultima.id)) {
      ultima.amount = Math.max(0, Math.round((base - anteriores) * 100) / 100);
    }

    const conservar = entrantes.filter((e: any) => e.id).map((e: any) => e.id);
    await pool.query(
      `DELETE FROM gcc_world.project_stages
        WHERE project_id = ($1)::bigint
          AND ($2::bigint[] = '{}' OR NOT (id = ANY($2::bigint[])))`,
      [id, conservar],
    );
    for (let i = 0; i < entrantes.length; i++) {
      const e = entrantes[i];
      if (e.id) {
        await pool.query(
          `UPDATE gcc_world.project_stages SET name = $1, amount = $2, sort_order = $3, updated_at = NOW()
            WHERE id = ($4)::bigint AND project_id = ($5)::bigint`,
          [e.name, e.amount.toFixed(2), i, e.id, id],
        );
      } else {
        await pool.query(
          `INSERT INTO gcc_world.project_stages (project_id, name, amount, sort_order)
           VALUES (($1)::bigint, $2, $3, $4)`,
          [id, e.name, e.amount.toFixed(2), i],
        );
      }
    }

    return NextResponse.json({ ok: true, data: await getProjectEtapas(id) });
  } catch (err: any) {
    console.error('Project stages save error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
