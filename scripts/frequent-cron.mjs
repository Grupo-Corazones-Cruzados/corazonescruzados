// Disparador ÚNICO de la app (corre cada ~10 min). Ejecuta:
//  - SIEMPRE: los trabajos frecuentes (correos de recordatorios, recordatorios desde Meet y
//    campañas de email masivo programadas / por lotes).
//  - UNA VEZ AL DÍA: los nocturnos, solo en la ventana 06:00-06:09 UTC (= 01:00 Ecuador).
//    Como el cron corre cada 10 min, exactamente un disparo al día cae en esa ventana.
//
// Reemplaza a nightly-cron.mjs: un solo servicio Cron de Railway hace todo.
//
// ⚠️ OJO CON LOS COMENTARIOS DE BLOQUE. Este archivo estuvo ROTO desde que se creó: la
// expresión de cron "*/10 * * * *" iba dentro de un comentario /* ... */, y ese "*/" CIERRA
// el comentario, así que el resto del texto pasaba a ser código y el script no compilaba
// (`node --check` fallaba). Nunca se notó porque Railway tampoco lo estaba ejecutando.
// Por eso la cabecera va con comentarios de línea: aquí la expresión es inofensiva.
//
// ⚠️ ESTADO EN RAILWAY (comprobado por CLI el 2026-07-30): el servicio `nightly-cron` seguía
// ejecutando `scripts/nightly-cron.mjs` UNA VEZ AL DÍA (~06:00 UTC), así que este script no
// se ejecutaba y sus trabajos frecuentes no corrían desde que se escribió.
//
// ── Configuración del servicio "nightly-cron" en Railway (mismo repo) ────────────────
//     Start command : node scripts/frequent-cron.mjs
//     Cron schedule : */10 * * * *      (cada 10 minutos)
//   Variables (ya están puestas):
//     CRON_TOKEN  (requerido) el MISMO valor que en el servicio web
//     APP_URL     (requerido) https://app.grupocc.org
//
// El comando de arranque y el horario NO los expone la CLI, y un railway.json en la raíz
// afectaría también al servicio web (lo convertiría en cron y tumbaría la app), así que no se
// hace por repo.
//
// ⚠️ CORRECCIÓN (2026-08-01): decir «solo desde el panel» era falso. La API pública de Railway
// SÍ los expone — `serviceInstanceUpdate` acepta `startCommand` y `cronSchedule`, y se llama
// con el mismo token que ya guarda la CLI en ~/.railway/config.json. Así se creó y configuró
// entero el servicio `agente-worker` sin tocar el panel. Lo que no se puede es hacerlo por
// railway.json, que sigue siendo cierto.
//
// Todos los trabajos son IDEMPOTENTES: repetirlos no duplica y una corrida perdida se recupera.

const FREQUENT_JOBS = [
  { name: 'Recordatorios · correos escalados',   path: '/api/reminders/cron/notify' },
  { name: 'Recordatorios · generar desde Meet',  path: '/api/reminders/cron/generate-from-meetings' },
  // Campañas de email masivo: arranca las programadas cuya hora llegó y continúa por lotes
  // las que quedaron a medias (una lista grande se completa en varios pases).
  { name: 'Campañas · programadas y por lotes',  path: '/api/admin/flows/cron/send-scheduled' },
];

const NIGHTLY_JOBS = [
  { name: 'Pensamientos · etiquetado IA', path: '/api/pensamientos/cron/etiquetar' },
  { name: 'Chat · purga por retención',   path: '/api/chat/cron/purgar' },
  // Estaba solo en nightly-cron.mjs: al cambiar el servicio a este script se habría dejado
  // de reindexar los talentos sin que nadie se enterara. Ver la nota de arriba.
  { name: 'Talentos · embeddings al día', path: '/api/talentos/cron/reindexar' },
];

const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002').replace(/\/+$/, '');
const TOKEN = process.env.CRON_TOKEN || '';

if (!TOKEN) {
  console.error('[cron] Falta CRON_TOKEN. Aborta.');
  process.exit(1);
}

/**
 * Resumen legible de la respuesta de un trabajo. Antes se interpolaba el valor tal cual y los
 * campos que no eran texto salían como `instant=[object Object]` o `skippedPaused=` (vacío),
 * que en los logs de Railway no dicen nada. Ahora los objetos van en JSON y lo que está vacío
 * (0, [], null) se omite, para que la línea muestre solo lo que pasó de verdad.
 */
function formatDetail(body) {
  const parts = [];
  for (const [k, v] of Object.entries(body)) {
    if (k === 'ok') continue;
    if (v === null || v === undefined || v === 0) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      parts.push(`${k}=${JSON.stringify(v)}`);
    } else if (typeof v === 'object') {
      const inner = formatDetail(v);
      if (inner) parts.push(`${k}(${inner})`);
    } else {
      parts.push(`${k}=${v}`);
    }
  }
  return parts.join(' ') || 'sin novedades';
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
    console.log(`[cron] ✓ ${job.name} ${formatDetail(body)}`);
  } catch (e) {
    failed++;
    console.error(`[cron] ✗ ${job.name} → ${e.message}`);
  }
}

console.log(`[cron] Fin. Fallidos: ${failed}/${jobs.length}`);
process.exit(failed ? 1 : 0);
