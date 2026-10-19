/**
 * Arranque del servidor (Next lo llama una vez por proceso).
 *
 * ⚠️ Next compila este archivo también para el runtime edge, que no tiene `http`/`https`: lo de
 * Node va en `instrumentation-node.ts` y se importa SOLO tras esta comprobación literal (así el
 * build de edge lo descarta). Importarlo arriba rompió el build con `web-push` (2026-10-19).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./instrumentation-node');
}
