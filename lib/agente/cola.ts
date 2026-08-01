/**
 * Cola de trabajos del agente: debounce, reclamo seguro y recuperación de colgados.
 *
 * Por qué está en la BASE y no en memoria: el chatbot que había antes en este repo hacía
 * el debounce con `setTimeout` sobre un `Map` del proceso. En Railway, un redeploy —o
 * simplemente un segundo contenedor— se lleva por delante ese temporizador y **el mensaje
 * del cliente se pierde sin dejar rastro**. Aquí un trabajo pendiente es una fila: si el
 * proceso muere, sigue ahí cuando vuelva.
 */

import { pool } from '@/lib/db';

export interface Trabajo {
  id: number;
  conversacion_id: number;
  estado: string;
  ejecutar_en: string;
  intentos: number;
}

/** Tras cuántos intentos se deja de reintentar y se marca como error. */
export const MAX_INTENTOS = 3;
/** Un trabajo reclamado hace más de esto se da por colgado (proceso muerto a media faena). */
export const MINUTOS_COLGADO = 5;

/**
 * Encola el proceso de una conversación **con debounce**.
 *
 * El índice único parcial de `agente_cola` sobre `conversacion_id` (donde el estado sigue
 * vivo) hace el trabajo: si ya hay uno pendiente, el `ON CONFLICT` no crea otro, solo
 * **empuja su `ejecutar_en` hacia adelante**. Seis mensajes seguidos de un cliente son una
 * sola corrida del modelo, no seis — que además es lo que hace que el agente conteste a
 * todo el bloque y no frase por frase.
 */
export async function encolar(conversacionId: number, debounceSegundos: number): Promise<void> {
  await pool.query(
    `INSERT INTO gcc_world.agente_cola (conversacion_id, ejecutar_en)
     VALUES ($1, NOW() + ($2 || ' seconds')::interval)
     ON CONFLICT (conversacion_id) WHERE estado IN ('pendiente','procesando')
     DO UPDATE SET ejecutar_en = EXCLUDED.ejecutar_en,
                   estado      = 'pendiente',
                   updated_at  = NOW()`,
    [conversacionId, Math.max(0, Math.min(120, debounceSegundos || 8))],
  );
}

/**
 * Reclama hasta `limite` trabajos listos para ejecutar.
 *
 * `FOR UPDATE SKIP LOCKED` permite que varios workers tiren de la misma cola sin pisarse:
 * el que llega segundo salta las filas que el primero ya bloqueó en vez de esperar.
 */
export async function reclamar(limite = 5): Promise<Trabajo[]> {
  const { rows } = await pool.query<Trabajo>(
    `UPDATE gcc_world.agente_cola c
        SET estado = 'procesando', reclamado_en = NOW(), intentos = c.intentos + 1, updated_at = NOW()
      WHERE c.id IN (
        SELECT id FROM gcc_world.agente_cola
         WHERE estado = 'pendiente' AND ejecutar_en <= NOW()
         ORDER BY ejecutar_en
         FOR UPDATE SKIP LOCKED
         LIMIT $1
      )
      RETURNING c.id, c.conversacion_id, c.estado, c.ejecutar_en, c.intentos`,
    [limite],
  );
  return rows;
}

/** El trabajo salió bien. */
export async function terminar(trabajoId: number): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.agente_cola SET estado = 'hecho', error = NULL, updated_at = NOW() WHERE id = $1`,
    [trabajoId],
  );
}

/**
 * El trabajo falló. Vuelve a 'pendiente' con espera creciente mientras queden intentos;
 * al agotarlos se marca 'error' y **deja de bloquear la cola de esa conversación**, para
 * que un mensaje posterior pueda encolarse y el chat no se quede mudo para siempre.
 */
export async function fallar(trabajo: Trabajo, mensaje: string): Promise<'reintenta' | 'agotado'> {
  const agotado = trabajo.intentos >= MAX_INTENTOS;
  if (agotado) {
    await pool.query(
      `UPDATE gcc_world.agente_cola SET estado = 'error', error = $1, updated_at = NOW() WHERE id = $2`,
      [mensaje.slice(0, 2000), trabajo.id],
    );
    return 'agotado';
  }
  const esperaSegundos = 15 * Math.pow(2, trabajo.intentos - 1); // 15s · 30s · 60s
  await pool.query(
    `UPDATE gcc_world.agente_cola
        SET estado = 'pendiente', error = $1, ejecutar_en = NOW() + ($2 || ' seconds')::interval, updated_at = NOW()
      WHERE id = $3`,
    [mensaje.slice(0, 2000), esperaSegundos, trabajo.id],
  );
  return 'reintenta';
}

/**
 * Devuelve a la cola los trabajos que quedaron 'procesando' de un proceso que ya no existe.
 *
 * Sin esto, un despliegue en mitad de una corrida deja la conversación bloqueada para
 * siempre: el índice único impide encolar otro y nadie va a terminar el que hay.
 */
export async function recuperarColgados(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.agente_cola
        SET estado = 'pendiente', ejecutar_en = NOW(), updated_at = NOW()
      WHERE estado = 'procesando'
        AND reclamado_en < NOW() - ($1 || ' minutes')::interval
        AND intentos < $2`,
    [MINUTOS_COLGADO, MAX_INTENTOS],
  );
  return rowCount ?? 0;
}

/** Para el panel: cuántos trabajos hay en cada estado. */
export async function resumenCola(canalId?: number) {
  const { rows } = await pool.query<{ estado: string; n: number }>(
    `SELECT c.estado, COUNT(*)::int AS n
       FROM gcc_world.agente_cola c
       JOIN gcc_world.agente_conversaciones cv ON cv.id = c.conversacion_id
      WHERE ($1::int IS NULL OR cv.canal_id = $1)
      GROUP BY c.estado`,
    [canalId ?? null],
  );
  return Object.fromEntries(rows.map((r: { estado: string; n: number }) => [r.estado, r.n])) as Record<string, number>;
}
