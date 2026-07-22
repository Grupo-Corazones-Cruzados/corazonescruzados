#!/usr/bin/env node
/**
 * Disparador ÚNICO de la app (corre cada ~10 min). Ejecuta:
 *  - SIEMPRE: los trabajos frecuentes (recordatorios: correos escalados + generación desde Meet).
 *  - UNA VEZ AL DÍA: los trabajos nocturnos, solo en la ventana 06:00–06:09 UTC (= 01:00 Ecuador).
 *    Como el cron corre cada 10 min, exactamente un disparo al día cae en esa ventana.
 *
 * Reemplaza a nightly-cron.mjs: un solo servicio Cron de Railway hace todo.
 *
 * ── Configuración en Railway (servicio "nightly-cron", mismo repo) ───────────────
 *     Start command : node scripts/frequent-cron.mjs
 *     Cron schedule : */10 * * * *      (cada 10 minutos)
 *   Variables (ya deberían estar):
 *     CRON_TOKEN  (requerido) el MISMO valor que en el servicio web
 *     APP_URL     (requerido) https://<tu-app>.up.railway.app
 *
 * Todos los trabajos son IDEMPOTENTES: repetirlos no duplica y una corrida perdida se recupera.
 */

const FREQUENT_JOBS = [
  { name: 'Recordatorios · correos escalados',   path: '/api/reminders/cron/notify' },
  { name: 'Recordatorios · generar desde Meet',  path: '/api/reminders/cron/generate-from-meetings' },
];

const NIGHTLY_JOBS = [
  { name: 'Pensamientos · etiquetado IA', path: '/api/pensamientos/cron/etiquetar' },
  { name: 'Chat · purga por retención',   path: '/api/chat/cron/purgar' },
];

const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002').replace(/\/+$/, '');
const TOKEN = process.env.CRON_TOKEN || '';

if (!TOKEN) {
  console.error('[cron] Falta CRON_TOKEN. Aborta.');
  process.exit(1);
}

const now = new Date();
const nightlyWindow = now.getUTCHours() === 6 && now.getUTCMinutes() < 10;
const jobs = nightlyWindow ? [...FREQUENT_JOBS, ...NIGHTLY_JOBS] : FREQUENT_JOBS;

console.log(`[cron] ${now.toISOString()} · ${jobs.length} trabajo(s)${nightlyWindow ? ' (incluye nocturnos)' : ''} → ${APP_URL}`);

let failed = 0;
for (const job of jobs) {
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

console.log(`[cron] Fin. Fallidos: ${failed}/${jobs.length}`);
process.exit(failed ? 1 : 0);
