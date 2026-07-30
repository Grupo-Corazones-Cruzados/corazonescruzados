#!/usr/bin/env node
/**
 * ⚠️ OBSOLETO — NO DESPLEGAR. Lo sustituye `scripts/frequent-cron.mjs`, que corre cada 10 min
 * y hace TODO: los trabajos frecuentes siempre y estos nocturnos en la ventana 06:00–06:09 UTC.
 *
 * Se conserva solo como referencia histórica. Hasta el 2026-07-30 el servicio `nightly-cron`
 * de Railway seguía ejecutando ESTE script una vez al día, y por eso los trabajos frecuentes
 * (correos de recordatorios, recordatorios desde Meet, campañas programadas) nunca corrieron.
 *
 * Disparador NOCTURNO de la app (01:00 America/Guayaquil = 06:00 UTC).
 *
 * Next.js en Railway solo atiende peticiones; no ejecuta nada por su cuenta a una hora fija.
 * Este script es el disparador: llama a los endpoints de trabajos nocturnos y TERMINA.
 * Está pensado para un servicio de tipo Cron en Railway (arranca, corre y sale).
 *
 * Cada trabajo es IDEMPOTENTE y se auto-repara, así que una noche perdida se recupera en la
 * siguiente ejecución y repetirlo no duplica trabajo.
 *
 * Para añadir un trabajo nocturno nuevo, basta con sumarlo a JOBS: NO hace falta otro
 * servicio de cron en Railway.
 *
 * ── Configuración en Railway ────────────────────────────────────────────────────
 *   Servicio (mismo repo):
 *     Start command : node scripts/nightly-cron.mjs
 *     Cron schedule : 0 6 * * *      ← ¡UTC! 06:00 UTC = 01:00 en Ecuador (UTC-5, sin DST)
 *   Variables:
 *     CRON_TOKEN  (requerido) el MISMO valor que en el servicio web
 *     APP_URL     (requerido) https://<tu-app>.up.railway.app
 */

const JOBS = [
  { name: 'Pensamientos · etiquetado IA', path: '/api/pensamientos/cron/etiquetar' },
  { name: 'Chat · purga por retención',   path: '/api/chat/cron/purgar' },
  { name: 'Talentos · embeddings al día', path: '/api/talentos/cron/reindexar' },
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
    const detail = Object.entries(body)
      .filter(([k]) => k !== 'ok')
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    console.log(`[cron] ✓ ${job.name} ${detail}`);
  } catch (e) {
    // Un trabajo caído no debe impedir los demás: se reintentará la noche siguiente.
    failed++;
    console.error(`[cron] ✗ ${job.name} → ${e.message}`);
  }
}

console.log(`[cron] Fin. Fallidos: ${failed}/${JOBS.length}`);
process.exit(failed ? 1 : 0);
