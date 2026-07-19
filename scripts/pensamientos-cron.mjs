#!/usr/bin/env node
/**
 * Disparador NOCTURNO del etiquetado de Pensamientos.
 *
 * Next.js en Railway solo atiende peticiones; no ejecuta nada por su cuenta a una hora fija.
 * Este script es el disparador: llama al endpoint de la app y TERMINA. Está pensado para un
 * servicio de tipo Cron en Railway (un servicio que arranca, corre su comando y sale).
 *
 * ── Configuración en Railway ────────────────────────────────────────────────────
 *   Servicio nuevo, mismo repo:
 *     Start command : node scripts/pensamientos-cron.mjs
 *     Cron schedule : 0 6 * * *      ← ¡UTC! 06:00 UTC = 01:00 en Ecuador (UTC-5, sin horario de verano)
 *   Variables:
 *     CRON_TOKEN        (requerido) el MISMO valor que en el servicio web
 *     APP_URL           (requerido) https://<tu-app>.up.railway.app
 *
 * Salida: código 0 si todo fue bien, 1 si falló (para que Railway lo marque como fallido).
 */

const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002').replace(/\/+$/, '');
const TOKEN = process.env.CRON_TOKEN || '';

if (!TOKEN) {
  console.error('[pensamientos-cron] Falta CRON_TOKEN. Aborta.');
  process.exit(1);
}

const url = `${APP_URL}/api/pensamientos/cron/etiquetar`;
console.log(`[pensamientos-cron] ${new Date().toISOString()} → POST ${url}`);

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-token': TOKEN },
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`[pensamientos-cron] Error HTTP ${res.status}:`, body.error || '(sin detalle)');
    process.exit(1);
  }

  console.log(`[pensamientos-cron] OK — etiquetados: ${body.tagged}, fallidos: ${body.failed}, revisados: ${body.pending}`);
  process.exit(0);
} catch (e) {
  console.error('[pensamientos-cron] No se pudo contactar la app:', e.message);
  process.exit(1);
}
