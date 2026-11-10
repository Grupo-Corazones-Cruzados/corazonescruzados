import { pool } from '@/lib/db';

/**
 * LAS LLAMADAS ENTRANTES DE WHATSAPP (Cloud API Calling, Fernando, 2026-11-10).
 *
 * Solo en números CLOUD_API (Meta no admite llamadas en coexistencia) y solo ENTRANTES: las
 * salientes cuestan por minuto y piden permiso al usuario; quedan pendientes.
 *
 * El recorrido, según la documentación de Meta (developers.facebook.com/documentation/
 * business-messaging/whatsapp/calling/user-initiated-calls):
 *  1. Llega el webhook `calls` con `event: "connect"` y la OFERTA SDP (`session.sdp`). Hay entre
 *     30 y 60 s para contestar o Meta da la llamada por no atendida.
 *  2. El navegador de quien contesta crea la RESPUESTA SDP con WebRTC (el audio va directo entre
 *     ese navegador y Meta: no hay servidor de medios) y el servidor la manda con `pre_accept` y
 *     luego `accept` —la misma respuesta en las dos o Meta la rechaza—.
 *  3. Al colgar cualquiera de los dos llega `event: "terminate"` con `status` y `duration`.
 * ⚠️ Usar `session.sdp`; `connection.webrtc.sdp` es el formato antiguo (FAQ de Meta).
 */

export type EventoLlamada = {
  id: string;
  from: string;
  event: 'connect' | 'terminate' | string;
  sdp: string | null;
  status: string | null;
  duracion: number | null;
  error: string | null;
};

/** Los eventos de un webhook `calls`, con el nombre de perfil de quien llama. */
export function extraerLlamadas(payload: any): { eventos: EventoLlamada[]; nombres: Map<string, string> } {
  const eventos: EventoLlamada[] = [];
  const nombres = new Map<string, string>();
  for (const entrada of payload?.entry ?? []) {
    for (const cambio of entrada?.changes ?? []) {
      if (cambio?.field !== 'calls') continue;
      const v = cambio.value ?? {};
      for (const c of v.contacts ?? []) if (c?.wa_id && c?.profile?.name) nombres.set(String(c.wa_id), String(c.profile.name));
      for (const l of v.calls ?? []) {
        if (!l?.id || !l?.from) continue;
        const errores = Array.isArray(l.errors) ? l.errors.map((e: any) => e?.message ?? e?.title ?? e?.code).filter(Boolean).join(' · ') : '';
        eventos.push({
          id: String(l.id),
          from: String(l.from),
          event: String(l.event ?? ''),
          sdp: l.session?.sdp ?? l.connection?.webrtc?.sdp ?? null,
          status: l.status ? String(l.status) : null,
          duracion: Number.isFinite(Number(l.duration)) ? Number(l.duration) : null,
          error: errores || null,
        });
      }
    }
  }
  return { eventos, nombres };
}

/**
 * Llega una llamada: contacto, conversación, el aviso en el chat y la fila de la llamada, todo
 * en una transacción con SU PROPIO cliente. Idempotente por `wa_call_id`: si Meta reintenta, no
 * se duplica nada.
 */
export async function registrarLlamada(canalId: number, ev: EventoLlamada, nombre: string | null): Promise<void> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: ya } = await cliente.query(`SELECT 1 FROM llamadas WHERE wa_call_id = $1`, [ev.id]);
    if (ya.length) { await cliente.query('COMMIT'); return; }

    const { rows: [contacto] } = await cliente.query(
      `INSERT INTO contactos (inquilino_id, canal_id, wa_id, nombre_perfil, actualizado_en)
       SELECT c.inquilino_id, c.id, $2, $3, NOW() FROM canales c WHERE c.id = $1
       ON CONFLICT (canal_id, wa_id) DO UPDATE
         SET nombre_perfil = COALESCE(EXCLUDED.nombre_perfil, contactos.nombre_perfil), actualizado_en = NOW()
       RETURNING id`,
      [canalId, ev.from, nombre],
    );
    const { rows: [conv] } = await cliente.query(
      `INSERT INTO conversaciones (inquilino_id, canal_id, contacto_id, ultimo_mensaje_en, actualizado_en)
       SELECT c.inquilino_id, c.id, $2, NOW(), NOW() FROM canales c WHERE c.id = $1
       ON CONFLICT (canal_id, contacto_id) DO UPDATE SET ultimo_mensaje_en = NOW(), actualizado_en = NOW()
       RETURNING id`,
      [canalId, contacto.id],
    );
    // El aviso en el chat: ENTRANTE, así cuenta como «sin leer» si nadie contesta.
    const { rows: [mensaje] } = await cliente.query(
      `INSERT INTO mensajes (inquilino_id, conversacion_id, direccion, tipo, texto)
       SELECT cv.inquilino_id, cv.id, 'ENTRANTE', 'llamada', 'Llamada de voz' FROM conversaciones cv WHERE cv.id = $1
       RETURNING id`,
      [conv.id],
    );
    await cliente.query(
      `INSERT INTO llamadas (inquilino_id, canal_id, conversacion_id, mensaje_id, wa_call_id, estado, sdp_oferta)
       SELECT c.inquilino_id, c.id, $2, $3, $4, 'SONANDO', $5 FROM canales c WHERE c.id = $1
       ON CONFLICT (wa_call_id) DO NOTHING`,
      [canalId, conv.id, mensaje.id, ev.id, ev.sdp],
    );
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Lo que dice el aviso del chat según cómo acabó. */
export function textoDeLlamada(estado: string, duracion: number | null): string {
  if (estado === 'TERMINADA') return duracion ? `Llamada de voz · ${mmss(duracion)}` : 'Llamada de voz';
  if (estado === 'PERDIDA') return 'Llamada perdida';
  if (estado === 'RECHAZADA') return 'Llamada rechazada';
  if (estado === 'FALLIDA') return 'Llamada fallida';
  return 'Llamada de voz';
}

/**
 * Terminó (cuelga el contacto, se cuelga desde aquí o Meta la corta). Si nadie la contestó es
 * PERDIDA; si se rechazó se queda RECHAZADA; si estaba en curso, TERMINADA con su duración.
 */
export async function terminarLlamada(canalId: number, ev: EventoLlamada): Promise<void> {
  const { rows: [l] } = await pool.query<{ estado: string; mensaje_id: number | null; duracion_segundos: number | null }>(
    `UPDATE llamadas
        SET estado = CASE
              WHEN estado = 'SONANDO' THEN 'PERDIDA'
              WHEN estado IN ('CONTESTANDO', 'EN_CURSO') THEN CASE WHEN $3 = 'FAILED' AND $4::int IS NULL THEN 'FALLIDA' ELSE 'TERMINADA' END
              ELSE estado END,
            terminada_en = COALESCE(terminada_en, NOW()),
            duracion_segundos = COALESCE($4::int, duracion_segundos),
            error = COALESCE($5, error),
            sdp_oferta = NULL
      WHERE wa_call_id = $1 AND canal_id = $2
      RETURNING estado, mensaje_id, duracion_segundos`,
    [ev.id, canalId, ev.status, ev.duracion, ev.error],
  );
  if (l?.mensaje_id) {
    await pool.query(`UPDATE mensajes SET texto = $2 WHERE id = $1`, [l.mensaje_id, textoDeLlamada(l.estado, l.duracion_segundos)]);
  }
}
