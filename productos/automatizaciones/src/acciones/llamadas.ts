'use server';

import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { canalPorId, secretoDelCanal } from '@/lib/agente/canales';
import { accionLlamada } from '@/lib/agente/meta';
import { textoDeLlamada } from '@/lib/agente/llamadas';

export type Resultado = { ok: true } | { ok: false; error: string };

/**
 * CONTESTAR, RECHAZAR Y COLGAR UNA LLAMADA ENTRANTE (2026-11-10). Ver lib/agente/llamadas.ts.
 *
 * ⚠️ Puede sonar en varios navegadores a la vez: la llamada se RECLAMA con un UPDATE condicionado
 * a `estado = 'SONANDO'`, así que solo una persona la contesta y las demás ven «ya la contestaron».
 * Siempre con `inquilino_id`: un id de otro negocio no encuentra nada.
 */

async function tokenDe(canalId: number) {
  const canal = await canalPorId(canalId);
  const token = canal ? secretoDelCanal(canal, 'wa_token') : null;
  if (!canal?.phone_number_id || !token) return null;
  return { phone: canal.phone_number_id, token };
}

export async function contestarLlamada(slug: string, llamadaId: number, sdpRespuesta: string): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'OPERADOR');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const sdp = String(sdpRespuesta || '');
  if (!sdp.startsWith('v=0')) return { ok: false, error: 'El navegador no preparó el audio de la llamada.' };

  const { rows: [l] } = await pool.query<{ wa_call_id: string; canal_id: number }>(
    `UPDATE llamadas SET estado = 'CONTESTANDO', atendida_por_id = $3
      WHERE id = $1 AND inquilino_id = $2 AND estado = 'SONANDO' AND llego_en > NOW() - INTERVAL '90 seconds'
      RETURNING wa_call_id, canal_id`,
    [llamadaId, permiso.ctx.inquilino.id, permiso.ctx.sesion.uid],
  );
  if (!l) return { ok: false, error: 'Ya la contestó otra persona o dejó de sonar.' };

  const meta = await tokenDe(l.canal_id);
  try {
    if (!meta) throw new Error('No hay un token guardado para este número.');
    // La misma respuesta en las dos: si no coinciden, Meta rechaza el `accept`.
    await accionLlamada(meta.phone, meta.token, l.wa_call_id, 'pre_accept', sdp);
    await accionLlamada(meta.phone, meta.token, l.wa_call_id, 'accept', sdp);
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    await pool.query(
      `UPDATE llamadas SET estado = 'FALLIDA', error = $2, terminada_en = NOW(), sdp_oferta = NULL WHERE id = $1`,
      [llamadaId, motivo],
    );
    await pool.query(
      `UPDATE mensajes m SET texto = $2 FROM llamadas l WHERE l.id = $1 AND m.id = l.mensaje_id`,
      [llamadaId, textoDeLlamada('FALLIDA', null)],
    );
    return { ok: false, error: `Meta no dejó contestar: ${motivo}` };
  }
  await pool.query(
    `UPDATE llamadas SET estado = 'EN_CURSO', contestada_en = NOW(), sdp_oferta = NULL WHERE id = $1`,
    [llamadaId],
  );
  return { ok: true };
}

export async function rechazarLlamada(slug: string, llamadaId: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'OPERADOR');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { rows: [l] } = await pool.query<{ wa_call_id: string; canal_id: number }>(
    `UPDATE llamadas SET estado = 'RECHAZADA', atendida_por_id = $3, terminada_en = NOW(), sdp_oferta = NULL
      WHERE id = $1 AND inquilino_id = $2 AND estado = 'SONANDO'
      RETURNING wa_call_id, canal_id`,
    [llamadaId, permiso.ctx.inquilino.id, permiso.ctx.sesion.uid],
  );
  if (!l) return { ok: false, error: 'Ya la contestó otra persona o dejó de sonar.' };
  await pool.query(
    `UPDATE mensajes m SET texto = $2 FROM llamadas l WHERE l.id = $1 AND m.id = l.mensaje_id`,
    [llamadaId, textoDeLlamada('RECHAZADA', null)],
  );
  const meta = await tokenDe(l.canal_id);
  if (meta) await accionLlamada(meta.phone, meta.token, l.wa_call_id, 'reject').catch(() => {});
  revalidatePath(`/${slug}/conversaciones`);
  return { ok: true };
}

/**
 * Colgar desde aquí. Se avisa a Meta SIEMPRE (también si el audio ya se cortó): es lo que cierra
 * la llamada y la cobra bien. La duración exacta la trae luego el webhook `terminate`.
 */
export async function colgarLlamada(slug: string, llamadaId: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'OPERADOR');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { rows: [l] } = await pool.query<{ wa_call_id: string; canal_id: number; mensaje_id: number | null; duracion: number | null }>(
    `UPDATE llamadas
        SET estado = 'TERMINADA', terminada_en = NOW(),
            duracion_segundos = COALESCE(duracion_segundos, EXTRACT(EPOCH FROM NOW() - contestada_en)::int)
      WHERE id = $1 AND inquilino_id = $2 AND estado IN ('CONTESTANDO', 'EN_CURSO')
      RETURNING wa_call_id, canal_id, mensaje_id, duracion_segundos AS duracion`,
    [llamadaId, permiso.ctx.inquilino.id],
  );
  if (!l) return { ok: true };
  if (l.mensaje_id) await pool.query(`UPDATE mensajes SET texto = $2 WHERE id = $1`, [l.mensaje_id, textoDeLlamada('TERMINADA', l.duracion)]);
  const meta = await tokenDe(l.canal_id);
  if (meta) await accionLlamada(meta.phone, meta.token, l.wa_call_id, 'terminate').catch(() => {});
  revalidatePath(`/${slug}/conversaciones`);
  return { ok: true };
}
