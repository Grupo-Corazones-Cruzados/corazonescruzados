import { pool } from '@/lib/db';
import { enviarDatosFcm } from '@/lib/push/fcm';
import { enviarAvisoApns, type EntornoApns } from '@/lib/push/apns';

export type Aviso = {
  titulo: string;
  cuerpo: string;
  /** Ruta de la plataforma que abre al tocarlo (p. ej. `/dashboard/subscriptions`). */
  ruta?: string;
  /** Tipo para el teléfono: `aviso` (por defecto) o `chat` (agrupado y con «Responder»). */
  tipo?: 'aviso' | 'chat';
  /** Datos extra que viajan al teléfono (p. ej. la conversación, para responder). */
  datos?: Record<string, string>;
  /** iPhone: categoría (botones) e hilo (agrupación). */
  categoria?: string;
  hilo?: string;
};

/**
 * AVISO AL TELÉFONO de una o varias personas (Fernando, 2026-10-07): recordatorios,
 * suscripciones por vencer… La pieza común: quien quiera avisar a alguien en el móvil llama
 * aquí con sus `users.id` y no sabe nada de Android ni de iPhone.
 *
 *  · Android: mensaje de datos `tipo=aviso`; la app lo pinta con el logo GCC en el canal
 *    «Avisos» (`MensajeriaService`).
 *  · iPhone: banner normal por APNs al token `apns`.
 *
 * Quien no tenga la app instalada simplemente no recibe nada aquí: el aviso de la plataforma
 * y el correo siguen siendo los suyos. Nunca lanza.
 */
export async function avisarUsuarios(userIds: string[], aviso: Aviso): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  try {
    const { rows } = await pool.query(
      `SELECT token, kind, entorno FROM gcc_world.push_devices
        WHERE user_id = ANY($1::uuid[]) AND kind IN ('fcm', 'apns')`,
      [ids],
    );
    await Promise.all([
      enviarDatosFcm(rows.filter((r: any) => r.kind === 'fcm').map((r: any) => r.token), {
        tipo: aviso.tipo || 'aviso', titulo: aviso.titulo, cuerpo: aviso.cuerpo, ruta: aviso.ruta || '',
        ...(aviso.datos || {}),
      }),
      enviarAvisoApns(
        rows.filter((r: any) => r.kind === 'apns')
          .map((r: any) => ({ token: r.token, entorno: (r.entorno || 'production') as EntornoApns })),
        aviso,
      ),
    ]);
  } catch (e: any) {
    console.error('Aviso al teléfono:', e?.message);
  }
}
