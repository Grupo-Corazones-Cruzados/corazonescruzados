#!/usr/bin/env node
/**
 * COMPATIBILIDAD — este disparador se renombró a `nightly-cron.mjs` (ahora agrupa varios
 * trabajos nocturnos, no solo el de Pensamientos).
 *
 * Este archivo se conserva porque el servicio de Cron de Railway puede seguir apuntando al
 * nombre antiguo: si se borrara sin actualizar antes esa configuración, la ejecución nocturna
 * fallaría con "módulo no encontrado". Delega en el nuevo script para que el resultado sea
 * idéntico apunte a donde apunte.
 *
 * Se puede eliminar una vez que el servicio de Railway use `node scripts/nightly-cron.mjs`.
 */
console.log('[cron] Aviso: "pensamientos-cron.mjs" quedó obsoleto; actualiza el servicio de Railway a "node scripts/nightly-cron.mjs".');
await import('./nightly-cron.mjs');
