import { pool } from '@/lib/db';

/**
 * EL AGENTE RETOMA LO QUE UNA PERSONA DEJÓ (Fernando, 2026-11-10: «que la vuelva a tomar el
 * agente de IA después de 6 horas de la última vez que respondió y tomó la conversación un
 * usuario»).
 *
 * Una conversación tomada vuelve al agente cuando pasa `canales.retomar_minutos` desde lo ÚLTIMO
 * que hizo una persona en ella: tomarla (`tomada_en`, que también pone el agente al escalar) o
 * escribirle (saliente con `herramienta = 'equipo'`, sea desde la app o desde el teléfono en
 * coexistencia). Mientras la persona siga contestando, el plazo se renueva solo.
 *
 * No hay un reloj que la devuelva a la hora exacta: se comprueba donde importa.
 *  · En el runner, antes de decidir si contesta: si el contacto escribe pasado el plazo, la
 *    retoma y le responde en ese mismo turno.
 *  · Al abrir Conversaciones y el Panel: para que la bandeja diga la verdad.
 *
 * Devuelve cuántas devolvió. Idempotente: dos llamadas a la vez no hacen nada raro.
 */
export async function devolverAlAgente(alcance: { conversacionId: number } | { inquilinoId: number }): Promise<number> {
  const porConversacion = 'conversacionId' in alcance;
  const { rowCount } = await pool.query(
    `UPDATE conversaciones cv
        SET bot_activo = true, tomada_por_id = NULL, tomada_en = NULL, motivo_escalado = NULL, actualizado_en = NOW()
       FROM canales ca
      WHERE ca.id = cv.canal_id
        AND cv.bot_activo = false
        AND ${porConversacion ? 'cv.id = $1' : 'cv.inquilino_id = $1'}
        AND GREATEST(
              COALESCE(cv.tomada_en, '-infinity'::timestamptz),
              COALESCE((SELECT m.creado_en FROM mensajes m
                         WHERE m.conversacion_id = cv.id AND m.direccion = 'SALIENTE' AND m.herramienta = 'equipo'
                         ORDER BY m.creado_en DESC LIMIT 1), '-infinity'::timestamptz)
            ) < NOW() - make_interval(mins => ca.retomar_minutos)`,
    [porConversacion ? alcance.conversacionId : alcance.inquilinoId],
  );
  return rowCount ?? 0;
}
