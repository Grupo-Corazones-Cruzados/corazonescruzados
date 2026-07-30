import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { sendCampaignBatch, startCampaignRun, BATCH_LIMIT } from '@/lib/flows/campaign-send';
import { nextRunAfter } from '@/lib/flows/campaign-schedule';

/**
 * Pase del cron de CAMPAÑAS de email masivo (cada ~10 min, desde `scripts/frequent-cron.mjs`).
 * Hace tres cosas:
 *   1. Lanza las campañas cuya **próxima salida** (`next_run_at`) ya venció, sean de una sola
 *      vez o recurrentes, y programa la siguiente ocurrencia.
 *   2. Continúa las que están **enviándose** y aún tienen destinatarios pendientes (una lista
 *      grande se completa en varios pases sin chocar con el tope de ~300 s por petición).
 *   3. Cuando una serie recurrente pasa su **fecha de fin**, la cierra y —si al flujo no le
 *      queda ninguna otra campaña pendiente— **pausa el flujo**.
 *
 * ⚠️ Solo dispara campañas de flujos con `status='active'`: es lo que le da sentido real al
 * botón Activar/Pausar. Las de un flujo pausado se informan en `skippedPaused`.
 */

/** Presupuesto de tiempo del pase completo, por debajo del tope de la plataforma. */
const PASS_BUDGET_MS = 200_000;

/**
 * Pausa el flujo si ya no le queda NADA por lanzar. Se comprueba campaña por campaña a
 * propósito: un flujo puede tener varias, y pausarlo porque UNA terminó su serie apagaría las
 * demás sin que nadie lo pidiera.
 */
async function pauseFlowIfIdle(flowId: number | string): Promise<boolean> {
  const { rows: [r] } = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM gcc_world.flow_campaigns
      WHERE flow_id = $1 AND (next_run_at IS NOT NULL OR status = 'sending')`,
    [flowId],
  );
  if ((r?.n ?? 0) > 0) return false;

  const { rowCount } = await pool.query(
    `UPDATE gcc_world.flows SET status = 'paused', updated_at = NOW()
      WHERE id = $1 AND status = 'active'`,
    [flowId],
  );
  return !!rowCount;
}

/** Calcula y guarda la siguiente salida. Devuelve true si la serie terminó. */
async function advanceSchedule(campaign: any): Promise<boolean> {
  const runCount = Number(campaign.run_count || 0) + 1;
  const next = nextRunAfter(
    {
      kind: campaign.schedule_kind === 'recurring' ? 'recurring' : 'once',
      start: campaign.scheduled_at || campaign.next_run_at,
      unit: campaign.freq_unit,
      interval: campaign.freq_interval,
      until: campaign.recur_until,
    },
    runCount,
  );

  await pool.query(
    `UPDATE gcc_world.flow_campaigns SET run_count = $1, next_run_at = $2, updated_at = NOW() WHERE id = $3`,
    [runCount, next ? next.toISOString() : null, campaign.id],
  );
  return next === null;
}

export async function POST(req: NextRequest) {
  const viaCron = checkCronToken(req);
  if (!viaCron) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      if (!cronTokenConfigured()) {
        return NextResponse.json({ error: 'Cron no configurado (falta CRON_TOKEN)' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Token de cron inválido' }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const launched: number[] = [];
  const continued: number[] = [];
  const finished: number[] = [];
  const seriesEnded: number[] = [];
  const flowsPaused: number[] = [];
  let sent = 0, failed = 0;

  try {
    // Vencidas, en flujos ACTIVOS. `next_run_at` es la única condición: sirve igual para las
    // de una sola vez y para las recurrentes.
    const { rows: due } = await pool.query(
      `SELECT c.*, c.flow_id FROM gcc_world.flow_campaigns c
         JOIN gcc_world.flows f ON f.id = c.flow_id
        WHERE c.next_run_at IS NOT NULL AND c.next_run_at <= NOW()
          AND c.status <> 'sending' AND f.status = 'active'
        ORDER BY c.next_run_at`,
    );

    // Vencidas de flujos PAUSADOS: no se lanzan, pero se reportan para que quede rastro.
    const { rows: paused } = await pool.query(
      `SELECT c.id, c.subject, f.name AS flow_name, f.status AS flow_status
         FROM gcc_world.flow_campaigns c
         JOIN gcc_world.flows f ON f.id = c.flow_id
        WHERE c.next_run_at IS NOT NULL AND c.next_run_at <= NOW() AND f.status <> 'active'`,
    );

    // En curso con pendientes (arrancadas por un pase anterior o por el botón "Enviar ahora").
    const { rows: inFlight } = await pool.query(
      `SELECT c.id, c.flow_id FROM gcc_world.flow_campaigns c
         JOIN gcc_world.flows f ON f.id = c.flow_id
        WHERE c.status = 'sending' AND f.status = 'active'
        ORDER BY c.send_started_at NULLS FIRST`,
    );

    for (const c of due) {
      if (Date.now() - startedAt > PASS_BUDGET_MS) break;
      try {
        await startCampaignRun(c.id);
        const r = await sendCampaignBatch(c.id, { limit: BATCH_LIMIT, maxMs: 60_000 });
        launched.push(Number(c.id));
        sent += r.sent; failed += r.failed;
        if (r.done) finished.push(Number(c.id));

        const ended = await advanceSchedule(c);
        if (ended) {
          seriesEnded.push(Number(c.id));
          // La serie terminó (fin alcanzado, o era de una sola vez): si al flujo no le queda
          // nada pendiente, se pausa solo, como se pidió.
          if (await pauseFlowIfIdle(c.flow_id)) flowsPaused.push(Number(c.flow_id));
        }
      } catch (e: any) {
        console.error('[campaigns-cron] lanzando', c.id, e.message);
      }
    }

    for (const c of inFlight) {
      if (Date.now() - startedAt > PASS_BUDGET_MS) break;
      try {
        const r = await sendCampaignBatch(c.id, { limit: BATCH_LIMIT, maxMs: 60_000 });
        continued.push(Number(c.id));
        sent += r.sent; failed += r.failed;
        if (r.done) {
          finished.push(Number(c.id));
          if (await pauseFlowIfIdle(c.flow_id)) flowsPaused.push(Number(c.flow_id));
        }
      } catch (e: any) {
        console.error('[campaigns-cron] continuando', c.id, e.message);
      }
    }

    return NextResponse.json({
      ok: true,
      launched: launched.length,
      continued: continued.length,
      finished: finished.length,
      seriesEnded: seriesEnded.length,
      flowsPaused,
      sent,
      failed,
      skippedPaused: paused.map((p: any) => ({ id: Number(p.id), subject: p.subject, flow: p.flow_name, flowStatus: p.flow_status })),
    });
  } catch (err: any) {
    console.error('Campaigns cron error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
