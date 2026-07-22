#!/usr/bin/env node
/**
 * Disparador FRECUENTE de la app (cada ~10 min). Igual que nightly-cron.mjs pero para
 * trabajos que deben correr a menudo. Arranca, llama a los endpoints y sale.
 *
 * ── Configuración en Railway ────────────────────────────────────────────────────
 *   Servicio (mismo repo):
 *     Start command : node scripts/frequent-cron.mjs
 *     Cron schedule : */10 * * * *      (cada 10 minutos)
 *   Variables:
 *     CRON_TOKEN  (requerido) el MISMO valor que en el servicio web
 *     APP_URL     (requerido) https://<tu-app>.up.railway.app
 *
 * Para añadir un trabajo frecuente nuevo, súmalo a JOBS.
 */

const JOBS = [
  { name: 'Recordatorios · correos escalados', path: '/api/reminders/cron/notify' },
];

const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002').replace(/\/+$/, '');
const TOKEN = process.env.CRON_TOKEN || '';

if (!TOKEN) {
  console.error('[cron] Falta CRON_TOKEN. Aborta.');
  process.exit(1);
}

console.log(`[cron] ${new Date().toISOString()} · ${JOBS.length} trabajo(s) → ${APP_URL}`);

let failed = 0;
for (const job of JOBS) {
  try {
    const res = await fetch(`${APP_URL}${job.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-token': TOKEN },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      failed++;
      console.error(`[cron] ✗ ${job.name} → HTTP ${res.status}: ${body.error || '(sin detalle)'}`);
      continue;
    }
    const detail = Object.entries(body).filter(([k]) => k !== 'ok').map(([k, v]) => `${k}=${v}`).join(' ');
    console.log(`[cron] ✓ ${job.name} ${detail}`);
  } catch (e) {
    failed++;
    console.error(`[cron] ✗ ${job.name} → ${e.message}`);
  }
}

console.log(`[cron] Fin. Fallidos: ${failed}/${JOBS.length}`);
process.exit(failed ? 1 : 0);
