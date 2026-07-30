import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { totalRecipients } from '@/lib/flows/campaign-send';
import {
  parseScheduleInput, nextRunAfter, describeSchedule, belowCronResolution, ScheduleError,
} from '@/lib/flows/campaign-schedule';

/**
 * Programa (o cancela) el envío de una campaña: **una sola vez** o **con frecuencia**
 * (cada N segundos / minutos / horas / días / meses / años), con inicio y fin opcional.
 *
 * POST   { kind, scheduled_at, freq_unit?, freq_interval?, recur_until? }
 * DELETE → cancela la programación
 *
 * Toda la aritmética vive en `lib/flows/campaign-schedule.ts`, el mismo módulo que usan el
 * cron y la vista previa del navegador.
 *
 * ⚠️ El cron solo dispara campañas de flujos **activos**; se devuelve `flowActive` para que la
 * interfaz lo avise en el momento, en vez de dejar al usuario esperando un correo que no sale.
 */

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === 'admin' ? user : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id, campaignId } = await params;

    const { rows: [campaign] } = await pool.query(
      `SELECT c.status, f.status AS flow_status
         FROM gcc_world.flow_campaigns c
         JOIN gcc_world.flows f ON f.id = c.flow_id
        WHERE c.id = $1 AND c.flow_id = $2`,
      [campaignId, id],
    );
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    if (campaign.status === 'sending') {
      return NextResponse.json({ error: 'Esta campaña ya está enviándose' }, { status: 409 });
    }

    const spec = parseScheduleInput(await req.json().catch(() => ({})));

    const total = await totalRecipients(campaignId);
    if (total === 0) {
      return NextResponse.json({ error: 'La campaña no tiene contactos con correo en sus listas' }, { status: 400 });
    }

    // Al (re)programar se reinicia la serie: la próxima salida es la primera ocurrencia.
    const next = nextRunAfter(
      { kind: spec.kind, start: spec.start, unit: spec.unit, interval: spec.interval, until: spec.until },
      0,
      new Date(0),   // sin "ahora": la primera ocurrencia es la fecha de inicio elegida
    );
    if (!next) return NextResponse.json({ error: 'Con esos datos no queda ninguna salida por delante' }, { status: 400 });

    const { rows: [row] } = await pool.query(
      `UPDATE gcc_world.flow_campaigns
          SET schedule_kind = $1,
              scheduled_at  = $2,
              freq_unit     = $3,
              freq_interval = $4,
              recur_until   = $5,
              next_run_at   = $6,
              run_count     = 0,
              status        = 'scheduled',
              updated_at    = NOW()
        WHERE id = $7 AND flow_id = $8
        RETURNING id, schedule_kind, scheduled_at, freq_unit, freq_interval, recur_until, next_run_at, status`,
      [spec.kind, spec.start.toISOString(), spec.unit, spec.interval,
       spec.until ? spec.until.toISOString() : null, next.toISOString(), campaignId, id],
    );

    return NextResponse.json({
      data: {
        ...row,
        total,
        flowActive: campaign.flow_status === 'active',
        description: describeSchedule({ kind: spec.kind, unit: spec.unit, interval: spec.interval }),
        belowCronResolution: belowCronResolution(spec.unit, spec.interval),
      },
    });
  } catch (err: any) {
    if (err instanceof ScheduleError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Campaign schedule POST error:', err.message);
    return NextResponse.json({ error: 'Error al programar la campaña' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id, campaignId } = await params;

    // Se cancela la programación; el estado vuelve a borrador salvo que ya se haya enviado
    // alguna vez (entonces se queda como 'sent', que es lo que refleja la realidad).
    const { rows: [row] } = await pool.query(
      `UPDATE gcc_world.flow_campaigns
          SET schedule_kind = NULL, scheduled_at = NULL, freq_unit = NULL, freq_interval = NULL,
              recur_until = NULL, next_run_at = NULL,
              status = CASE WHEN run_count > 0 THEN 'sent' ELSE 'draft' END,
              updated_at = NOW()
        WHERE id = $1 AND flow_id = $2 AND next_run_at IS NOT NULL
        RETURNING id, status`,
      [campaignId, id],
    );
    if (!row) return NextResponse.json({ error: 'Esa campaña no está programada' }, { status: 404 });

    return NextResponse.json({ ok: true, data: row });
  } catch (err: any) {
    console.error('Campaign schedule DELETE error:', err.message);
    return NextResponse.json({ error: 'Error al cancelar la programación' }, { status: 500 });
  }
}
