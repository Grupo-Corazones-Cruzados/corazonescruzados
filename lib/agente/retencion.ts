/**
 * RETENCIÓN del agente: borra lo que ya no debe estar guardado.
 *
 * Existe porque la política publicada en `/legal/whatsapp` (sección A.8) promete un plazo
 * concreto, y una promesa de retención sin un borrado que la cumpla es una declaración
 * falsa. La regla que gobierna esto: **primero el código, después la promesa**.
 *
 * Hoy purga dos cosas, y NO toca las conversaciones:
 *
 * 1. `agente_eventos_webhook` — la traza cruda de lo que manda Meta. Es una COPIA
 *    duplicada del contenido de los mensajes que solo sirve para diagnosticar fallos; el
 *    mensaje de verdad vive en `agente_mensajes`. Guardar dos veces lo mismo sin plazo va
 *    contra la minimización, así que se va a los 30 días.
 *
 * 2. Los trabajos de cola ya terminados, que no llevan datos personales pero crecen sin
 *    fin.
 *
 * Las **conversaciones no se purgan por tiempo**: son el historial de atención de la
 * empresa cliente, que es la responsable y a quien corresponde decidir su plazo. Se
 * borran cuando ella lo pide y en cascada al desconectar el canal. Una retención por
 * canal configurable es una decisión de producto pendiente, no de este archivo.
 */

import { pool } from '@/lib/db';

/** Días que se conserva la traza cruda de webhooks. Debe coincidir con `/legal/whatsapp` A.8. */
export const DIAS_TRAZA_WEBHOOK = 30;

/** Días que se conservan los trabajos de cola ya cerrados (hechos o fallidos). */
export const DIAS_COLA_CERRADA = 14;

export interface ResultadoPurga {
  eventos_webhook: number;
  cola_cerrada: number;
}

/**
 * Aplica la retención. Es **idempotente**: repetirla el mismo día no borra nada nuevo.
 *
 * No va en una transacción única a propósito — son dos borrados independientes y que uno
 * falle no es razón para dejar el otro sin hacer.
 */
export async function purgarRetencionAgente(): Promise<ResultadoPurga> {
  const eventos = await pool.query(
    `DELETE FROM gcc_world.agente_eventos_webhook
      WHERE recibido_en < NOW() - ($1 || ' days')::interval`,
    [DIAS_TRAZA_WEBHOOK],
  );

  const cola = await pool.query(
    `DELETE FROM gcc_world.agente_cola
      WHERE estado IN ('hecho', 'error')
        AND updated_at < NOW() - ($1 || ' days')::interval`,
    [DIAS_COLA_CERRADA],
  );

  return {
    eventos_webhook: eventos.rowCount ?? 0,
    cola_cerrada: cola.rowCount ?? 0,
  };
}
