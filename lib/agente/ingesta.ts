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

export {
  extraerMensajes, extraerEcos, extraerContactosDeAgenda, extraerHistorial, campoDelWebhook,
  type MensajeEntrante, type EcoDelEquipo, type ContactoDeAgenda, type MensajeDeHistorial,
} from './entrante';
import type { EcoDelEquipo, ContactoDeAgenda, MensajeDeHistorial } from './entrante';

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


/* ══════════════════════ COEXISTENCIA: EL NÚMERO LO COMPARTEN AGENTE Y PERSONAS ══════════════════════
 *
 * Todo lo de aquí abajo existe porque el número de un cliente de coexistencia NO es solo
 * del agente: su equipo sigue atendiendo desde el móvil y desde WhatsApp Web. Sin esto el
 * agente contesta a ciegas, sin saber que un compañero ya respondió.
 */

/** Encuentra o crea el contacto y su conversación. Lo que comparten los tres caminos. */
async function contactoYConversacion(canalId: number, waId: string) {
  const { rows: [contacto] } = await pool.query(
    `INSERT INTO gcc_world.agente_contactos (canal_id, wa_id)
     VALUES ($1, $2)
     ON CONFLICT (canal_id, wa_id) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [canalId, waId],
  );
  const { rows: [conversacion] } = await pool.query(
    `INSERT INTO gcc_world.agente_conversaciones (canal_id, contacto_id, ultimo_mensaje_en)
     VALUES ($1, $2, NOW())
     ON CONFLICT (canal_id, contacto_id) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [canalId, contacto.id],
  );
  return { contactoId: contacto.id as number, conversacionId: conversacion.id as number };
}

/**
 * Guarda un mensaje que escribió una PERSONA del equipo del cliente **y le cede la
 * conversación**.
 *
 * Las dos mitades importan y por motivos distintos:
 *
 *  1. **Guardarlo** es lo que pidió Diego: sin esto el agente no ve a sus compañeros y en
 *     la bandeja falta media conversación.
 *  2. **Apagar el bot en ESE chat** es lo que evita el ridículo. Que el agente «vea» el
 *     mensaje no basta: seguiría contestando, y dos respuestas a la vez —una del agente y
 *     otra de la persona, quizá distintas— las lee el cliente final. Cuando alguien del
 *     equipo entra en una conversación, esa conversación es suya.
 *
 * Se apaga **solo esta conversación**, nunca el canal. Se devuelve al bot desde la bandeja
 * con un clic, igual que un escalado.
 */
export async function ingerirEco(canalId: number, e: EcoDelEquipo): Promise<{ esNuevo: boolean; conversacionId: number }> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: [contacto] } = await cliente.query(
      `INSERT INTO gcc_world.agente_contactos (canal_id, wa_id) VALUES ($1, $2)
       ON CONFLICT (canal_id, wa_id) DO UPDATE SET updated_at = NOW() RETURNING id`,
      [canalId, e.waId],
    );
    const { rows: [conv] } = await cliente.query(
      `INSERT INTO gcc_world.agente_conversaciones (canal_id, contacto_id, ultimo_mensaje_en)
       VALUES ($1, $2, NOW())
       ON CONFLICT (canal_id, contacto_id) DO UPDATE SET ultimo_mensaje_en = NOW(), updated_at = NOW()
       RETURNING id`,
      [canalId, contacto.id],
    );

    // Idempotente por el mismo índice parcial que los entrantes: Meta reintenta los ecos igual.
    const { rows: insertado } = await cliente.query(
      `INSERT INTO gcc_world.agente_mensajes
         (conversacion_id, direccion, wa_message_id, tipo, texto, payload, herramienta, enviado_ok)
       VALUES ($1, 'saliente', $2, $3, $4, $5, 'equipo', true)
       ON CONFLICT (wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [conv.id, e.waMessageId, e.tipo, e.texto, JSON.stringify(e.crudo)],
    );

    // ⇒ La cesión. Solo al guardarlo por primera vez: si Meta reintenta, no se vuelve a
    // apagar una conversación que una persona ya pudo haber devuelto al bot a propósito.
    if (insertado.length > 0) {
      await cliente.query(
        `UPDATE gcc_world.agente_conversaciones
            SET bot_activo = false, tomada_en = NOW(),
                motivo_escalado = COALESCE(motivo_escalado, 'La atiende el equipo desde WhatsApp'),
                updated_at = NOW()
          WHERE id = $1 AND bot_activo = true`,
        [conv.id],
      );
    }

    await cliente.query('COMMIT');
    return { esNuevo: insertado.length > 0, conversacionId: conv.id };
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

/**
 * Guarda los nombres de la agenda de la empresa.
 *
 * Crea el contacto si no existía: la agenda llega de golpe al sincronizar, antes de que
 * esa persona haya escrito nunca. Así la bandeja ya sabe cómo se llama el que escriba
 * mañana.
 *
 * Un `remove` **borra el nombre, no el contacto**: la empresa lo quitó de su agenda, pero
 * la conversación y sus mensajes siguen siendo suyos.
 */
export async function guardarContactosDeAgenda(canalId: number, contactos: ContactoDeAgenda[]): Promise<number> {
  let tocados = 0;
  for (const c of contactos) {
    const { rowCount } = await pool.query(
      `INSERT INTO gcc_world.agente_contactos (canal_id, wa_id, nombre_agenda)
       VALUES ($1, $2, $3)
       ON CONFLICT (canal_id, wa_id) DO UPDATE
         SET nombre_agenda = EXCLUDED.nombre_agenda, updated_at = NOW()`,
      [canalId, c.waId, c.borrado ? null : c.nombre],
    );
    tocados += rowCount ?? 0;
  }
  return tocados;
}

/**
 * Guarda un mensaje del volcado de historial, **con su fecha original**.
 *
 * ⚠️ Aquí NO se encola nada y NO se toca el interruptor de la conversación. Son mensajes
 * de hace semanas: despertar al agente con ellos sería contestar a un «buenas tardes» de
 * marzo. Solo se rellena la conversación para que el equipo —y el agente, como contexto—
 * tengan la historia.
 *
 * `ultimo_mensaje_en` se mueve solo hacia ADELANTE (`GREATEST`): si no, un volcado
 * desordenado mandaría al fondo de la bandeja una conversación viva.
 */
export async function ingerirHistorial(canalId: number, m: MensajeDeHistorial): Promise<boolean> {
  const { conversacionId } = await contactoYConversacion(canalId, m.waId);
  const fecha = m.fecha ?? new Date();
  const { rows: insertado } = await pool.query(
    `INSERT INTO gcc_world.agente_mensajes
       (conversacion_id, direccion, wa_message_id, tipo, texto, payload, herramienta, enviado_ok, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'historial', $7, $8)
     ON CONFLICT (wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [conversacionId, m.deLaEmpresa ? 'saliente' : 'entrante', m.waMessageId, m.tipo, m.texto,
     JSON.stringify(m.crudo), m.deLaEmpresa ? true : null, fecha],
  );
  if (insertado.length > 0) {
    await pool.query(
      `UPDATE gcc_world.agente_conversaciones
          SET ultimo_mensaje_en = GREATEST(COALESCE(ultimo_mensaje_en, $2), $2), updated_at = NOW()
        WHERE id = $1`,
      [conversacionId, fecha],
    );
  }
  return insertado.length > 0;
}
