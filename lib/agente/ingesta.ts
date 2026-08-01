/**
 * Ingesta del mensaje entrante: contacto, conversación y mensaje, de forma idempotente.
 *
 * Meta reintenta los webhooks cuando no recibe un 200 a tiempo. Sin idempotencia, el
 * mismo mensaje se procesaría dos veces y el contacto recibiría dos respuestas. La
 * garantía vive en el índice único de `wa_message_id`: si ya estaba, no se vuelve a
 * insertar y no se vuelve a encolar.
 *
 * La LECTURA de la carga de Meta vive en `entrante.ts`, que es puro y se prueba aparte.
 */

import { pool } from '@/lib/db';
import type { MensajeEntrante } from './entrante';

export { extraerMensajes, type MensajeEntrante } from './entrante';

export interface ResultadoIngesta {
  conversacionId: number;
  contactoId: number;
  /** false = ya lo teníamos; Meta está reintentando y no hay que volver a encolar. */
  esNuevo: boolean;
  /** El bot está apagado en esta conversación: alguien la tomó. No se encola. */
  conversacionEnManosDeUnaPersona: boolean;
}

/**
 * Persiste un mensaje entrante. Devuelve `esNuevo: false` si Meta ya nos lo había mandado.
 *
 * Todo va en una transacción: o queda el contacto, la conversación y el mensaje, o no
 * queda nada. Una conversación sin su mensaje dejaría un chat fantasma en la bandeja.
 */
export async function ingerir(canalId: number, m: MensajeEntrante): Promise<ResultadoIngesta> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const { rows: [contacto] } = await cliente.query(
      `INSERT INTO gcc_world.agente_contactos (canal_id, wa_id, nombre_perfil)
       VALUES ($1, $2, $3)
       ON CONFLICT (canal_id, wa_id) DO UPDATE
         SET nombre_perfil = COALESCE(EXCLUDED.nombre_perfil, gcc_world.agente_contactos.nombre_perfil),
             updated_at = NOW()
       RETURNING id`,
      [canalId, m.waId, m.nombrePerfil],
    );

    const { rows: [conversacion] } = await cliente.query(
      `INSERT INTO gcc_world.agente_conversaciones (canal_id, contacto_id, ultimo_mensaje_en)
       VALUES ($1, $2, NOW())
       ON CONFLICT (canal_id, contacto_id) DO UPDATE
         SET ultimo_mensaje_en = NOW(), updated_at = NOW()
       RETURNING id, bot_activo`,
      [canalId, contacto.id],
    );

    // ⇒ La idempotencia. Si el id ya estaba, no inserta y `rows` viene vacío.
    const { rows: insertado } = await cliente.query(
      `INSERT INTO gcc_world.agente_mensajes
         (conversacion_id, direccion, wa_message_id, tipo, texto, payload, ubicacion_lat, ubicacion_lng)
       VALUES ($1, 'entrante', $2, $3, $4, $5, $6, $7)
       -- ⚠️ El índice de wa_message_id es PARCIAL (WHERE wa_message_id IS NOT NULL), y
       -- Postgres exige repetir esa condición aquí o no reconoce el índice: sin el WHERE
       -- falla con «no unique or exclusion constraint matching the ON CONFLICT
       -- specification» y se cae la ingesta entera.
       ON CONFLICT (wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [conversacion.id, m.waMessageId, m.tipo, m.texto, JSON.stringify(m.crudo), m.lat, m.lng],
    );

    await cliente.query('COMMIT');
    return {
      conversacionId: conversacion.id,
      contactoId: contacto.id,
      esNuevo: insertado.length > 0,
      conversacionEnManosDeUnaPersona: conversacion.bot_activo === false,
    };
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}

/** Guarda un mensaje saliente ya enviado (o el intento fallido, con su motivo). */
export async function registrarSaliente(opciones: {
  conversacionId: number;
  texto: string;
  waMessageId?: string | null;
  herramienta?: string | null;
  motivo?: string | null;
  enviadoOk: boolean;
  errorEnvio?: string | null;
}): Promise<number> {
  const { rows: [fila] } = await pool.query(
    `INSERT INTO gcc_world.agente_mensajes
       (conversacion_id, direccion, wa_message_id, tipo, texto, herramienta, motivo, enviado_ok, error_envio)
     VALUES ($1, 'saliente', $2, 'text', $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      opciones.conversacionId,
      opciones.waMessageId ?? null,
      opciones.texto,
      opciones.herramienta ?? null,
      opciones.motivo ?? null,
      opciones.enviadoOk,
      opciones.errorEnvio ?? null,
    ],
  );
  await pool.query(
    `UPDATE gcc_world.agente_conversaciones SET ultimo_mensaje_en = NOW(), updated_at = NOW() WHERE id = $1`,
    [opciones.conversacionId],
  );
  return fila.id;
}

/**
 * La TOMA HUMANA: apaga el bot en ESTA conversación, sin tocar el resto del canal.
 * Pasar `null` en `usuarioId` lo devuelve al bot.
 */
export async function tomarConversacion(
  conversacionId: number,
  usuarioId: string | null,
  motivo?: string,
): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.agente_conversaciones
        SET bot_activo = $2, tomada_por = $3, tomada_en = CASE WHEN $3 IS NULL THEN NULL ELSE NOW() END,
            motivo_escalado = $4, updated_at = NOW()
      WHERE id = $1`,
    [conversacionId, usuarioId === null, usuarioId, motivo ?? null],
  );
}
