import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { getTicketBilling, ensureStageBilling } from '@/lib/payments';

/**
 * PLAN DE ETAPAS DE UN TICKET (Fernando, 2026-09-30) — el gemelo de `/api/projects/[id]/stages`.
 *
 * Reparte LO CONSUMIDO del ticket. Las etapas viven en `project_stages` con `ticket_id` (ver
 * migración 062: comparten el candado «una etapa se paga una vez» con las del proyecto).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const billing = await getTicketBilling(id);
    if (!billing) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    return NextResponse.json({ data: billing.etapas, baseTotal: billing.total });
  } catch (err: any) {
    console.error('Ticket stages error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Guarda el plan completo: llega la lista y sustituye a la anterior.
 *
 *  · Solo el admin, como la facturación.
 *  · La ÚLTIMA etapa no guarda importe: es el resto de lo consumido y se calcula al leer
 *    (`getTicketBilling`), porque el consumo sigue creciendo.
 *  · Una etapa ya FACTURADA o ya COBRADA (aunque sea por transferencia en espera) no se borra
 *    ni cambia de importe: el dinero ya se movió por ella.
 *  · Plan vacío = el ticket vuelve a cobrarse por su total.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const { stages } = await req.json();
    if (!Array.isArray(stages)) return NextResponse.json({ error: 'Faltan las etapas' }, { status: 400 });

    await ensureStageBilling();
    const billing = await getTicketBilling(id);
    if (!billing) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });

    const cerradas = billing.etapas.filter((e) => e.invoiceId || e.cobro);
    const entrantes = stages
      .map((e: any, i: number) => ({
        id: e.id != null ? Number(e.id) : null,
        name: String(e.name || '').trim() || `Etapa ${i + 1}`,
        amount: Math.max(0, Math.round((Number(e.amount) || 0) * 100) / 100),
      }))
      .filter((e: any) => e.name);

    for (const c of cerradas) {
      const sigue = entrantes.find((e: any) => e.id === c.id);
      if (!sigue) {
        return NextResponse.json({
          error: `La etapa «${c.name}» ya está ${c.invoiceId ? `facturada (${c.invoiceNumber})` : 'cobrada'} y no se puede eliminar.`,
        }, { status: 409 });
      }
      sigue.amount = c.amount;
      sigue.name = c.name;
    }

    if (entrantes.length === 0) {
      if (cerradas.length > 0) return NextResponse.json({ error: 'Hay etapas cobradas: no se puede vaciar el plan.' }, { status: 409 });
      await pool.query(`DELETE FROM gcc_world.project_stages WHERE ticket_id = ($1)::bigint`, [id]);
      return NextResponse.json({ ok: true, data: [] });
    }
    if (entrantes.length < 2) return NextResponse.json({ error: 'Un plan necesita al menos dos etapas' }, { status: 400 });

    // Las que no son la última no pueden pasarse de lo consumido: la última quedaría negativa.
    const anteriores = entrantes.slice(0, -1).reduce((s: number, e: any) => s + e.amount, 0);
    if (anteriores > billing.total + 0.009) {
      return NextResponse.json({ error: `Las etapas suman más de lo consumido ($${billing.total.toFixed(2)}).` }, { status: 400 });
    }

    const conservar = entrantes.filter((e: any) => e.id).map((e: any) => e.id);
    await pool.query(
      `DELETE FROM gcc_world.project_stages
        WHERE ticket_id = ($1)::bigint AND invoice_id IS NULL
          AND ($2::bigint[] = '{}' OR NOT (id = ANY($2::bigint[])))`,
      [id, conservar],
    );
    for (let i = 0; i < entrantes.length; i++) {
      const e = entrantes[i];
      const esUltima = i === entrantes.length - 1;
      const cerrada = cerradas.some((c) => c.id === e.id);
      // La última abierta no guarda importe (es el resto); una cerrada conserva el suyo.
      const importe = esUltima && !cerrada ? 0 : e.amount;
      if (e.id) {
        await pool.query(
          `UPDATE gcc_world.project_stages SET name = $1, amount = $2, sort_order = $3, updated_at = NOW()
            WHERE id = ($4)::bigint AND ticket_id = ($5)::bigint`,
          [e.name, importe.toFixed(2), i, e.id, id],
        );
      } else {
        await pool.query(
          `INSERT INTO gcc_world.project_stages (ticket_id, name, amount, sort_order) VALUES (($1)::bigint, $2, $3, $4)`,
          [id, e.name, importe.toFixed(2), i],
        );
      }
    }

    return NextResponse.json({ ok: true, data: (await getTicketBilling(id))?.etapas || [] });
  } catch (err: any) {
    console.error('Ticket stages save error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
