import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { sendCampaignBatch, startCampaignRun, BATCH_LIMIT } from '@/lib/flows/campaign-send';

/**
 * Pase del cron de CAMPAÑAS de email masivo (cada ~10 min, desde `scripts/frequent-cron.mjs`).
 * Hace dos cosas:
 *   1. Arranca las campañas **programadas** cuya hora ya pasó.
 *   2. Continúa las que están **enviándose** y aún tienen destinatarios pendientes (así una
 *      lista grande se completa en varios pases sin chocar con el tope de ~300 s por petición).
 *
 * ⚠️ Solo dispara campañas de flujos con `status='active'`: es lo que le da sentido real al
 * botón Activar/Pausar del flujo. Las de un flujo pausado se informan en `skippedPaused` para
 * que quede rastro de por qué no salieron.
 *
 * Se invoca con `x-cron-token` o, a mano, por un admin.
 */

/** Presupuesto de tiempo del pase completo, por debajo del tope de la plataforma. */
const PASS_BUDGET_MS = 200_000;

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
  const started: number[] = [];
  const continued: number[] = [];
  const finished: number[] = [];
  let sent = 0, failed = 0;

  try {
    // Programadas cuya hora ya pasó, en flujos ACTIVOS.
    const { rows: due } = await pool.query(
      `SELECT c.id FROM gcc_world.flow_campaigns c
         JOIN gcc_world.flows f ON f.id = c.flow_id
        WHERE c.status = 'scheduled' AND c.scheduled_at <= NOW() AND f.status = 'active'
        ORDER BY c.scheduled_at`,
    );

    // Programadas vencidas de flujos PAUSADOS: no se envían, pero se reportan.
    const { rows: paused } = await pool.query(
      `SELECT c.id, c.subject, f.name AS flow_name, f.status AS flow_status
         FROM gcc_world.flow_campaigns c
         JOIN gcc_world.flows f ON f.id = c.flow_id
        WHERE c.status = 'scheduled' AND c.scheduled_at <= NOW() AND f.status <> 'active'`,
    );

    // En curso con pendientes (incluye las que arrancó un pase anterior o el botón "Enviar").
    const { rows: inFlight } = await pool.query(
      `SELECT c.id FROM gcc_world.flow_campaigns c
         JOIN gcc_world.flows f ON f.id = c.flow_id
        WHERE c.status = 'sending' AND f.status = 'active'
        ORDER BY c.send_started_at NULLS FIRST`,
    );

    for (const c of due) {
      if (Date.now() - startedAt > PASS_BUDGET_MS) break;
      try {
        await startCampaignRun(c.id);
        const r = await sendCampaignBatch(c.id, { limit: BATCH_LIMIT, maxMs: 60_000 });
        started.push(Number(c.id));
        sent += r.sent; failed += r.failed;
        if (r.done) finished.push(Number(c.id));
      } catch (e: any) {
        console.error('[campaigns-cron] arrancando', c.id, e.message);
      }
    }

    for (const c of inFlight) {
      if (Date.now() - startedAt > PASS_BUDGET_MS) break;
      try {
        const r = await sendCampaignBatch(c.id, { limit: BATCH_LIMIT, maxMs: 60_000 });
        continued.push(Number(c.id));
        sent += r.sent; failed += r.failed;
        if (r.done) finished.push(Number(c.id));
      } catch (e: any) {
        console.error('[campaigns-cron] continuando', c.id, e.message);
      }
    }

    return NextResponse.json({
      ok: true,
      started: started.length,
      continued: continued.length,
      finished: finished.length,
      sent,
      failed,
      skippedPaused: paused.map((p: any) => ({ id: Number(p.id), subject: p.subject, flow: p.flow_name, flowStatus: p.flow_status })),
    });
  } catch (err: any) {
    console.error('Campaigns cron error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
