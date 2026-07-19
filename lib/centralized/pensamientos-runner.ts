import {
  listUncategorized, setCategory, startRun, finishRun,
} from '@/lib/centralized/pensamientos-db';
import { classifyBatch, BATCH_SIZE } from '@/lib/centralized/pensamientos-ai';

/**
 * Trabajo NOCTURNO de etiquetado. Recorre los pensamientos SIN categoría de todos los
 * usuarios, los clasifica con la IA por lotes y guarda la etiqueta.
 *
 * Es IDEMPOTENTE y se AUTO-REPARA: como su entrada son "los que aún no tienen categoría",
 * si una noche el cron no corre o falla, la ejecución siguiente recupera lo pendiente. Por
 * eso no depende de que el disparo sea puntual, y volver a llamarlo no duplica trabajo.
 * `setCategory` además solo escribe si la fila sigue sin etiquetar, así que dos ejecuciones
 * solapadas no se pisan.
 */
export interface RunResult { tagged: number; failed: number; pending: number }

export async function runTagging(trigger: 'cron' | 'manual', maxThoughts = 400): Promise<RunResult> {
  const runId = await startRun(trigger);
  let tagged = 0;
  let failed = 0;
  try {
    const pending = await listUncategorized(maxThoughts);
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      try {
        const results = await classifyBatch(batch);
        for (const r of results) {
          if (await setCategory(r.id, r.category)) tagged++;
        }
        // Los que el modelo no devolvió quedan pendientes para la próxima noche.
        failed += batch.length - results.length;
      } catch (e: any) {
        // Un lote que falla no aborta el resto: se reintentará la noche siguiente.
        console.error('Pensamientos: lote fallido:', e.message);
        failed += batch.length;
      }
    }
    await finishRun(runId, tagged, failed);
    return { tagged, failed, pending: pending.length };
  } catch (e: any) {
    await finishRun(runId, tagged, failed, e.message);
    throw e;
  }
}
