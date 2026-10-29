import { pool } from '@/lib/db';
import { enviarDatosFcm } from '@/lib/push/fcm';
import { enviarAvisoApns, type EntornoApns } from '@/lib/push/apns';
import { enviarPush } from '@/lib/push';
import { conAvisoEncendido } from '@/lib/avisos/preferencias';
import type { ClaseAviso } from '@/lib/avisos/catalogo';

export type Aviso = {
  /** Clase del catálogo (`lib/avisos/catalogo.ts`): decide si la persona lo quiere recibir. */
  clase: ClaseAviso;
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
  /** Navegador: lo que abre al tocarlo si no es `ruta` (p. ej. el enlace del Meet). */
  url?: string;
  /** Navegador: el aviso nuevo con la misma etiqueta reemplaza al anterior. */
  etiqueta?: string;
  /** Navegador: no se cierra solo. */
  insistir?: boolean;
  /** Navegador: segundos que el servicio de push lo guarda si el equipo está apagado. */
  ttl?: number;
};

/**
 * AVISO AL TELÉFONO (y al Mac) de una o varias personas — la ÚNICA puerta de las
 * notificaciones del sistema (2026-10-07; desde 2026-10-29 también para el navegador y con
 * las preferencias de cada uno). Quien quiera avisar llama aquí con sus `users.id` y no sabe
 * nada de Android, iPhone ni navegadores.
 *
 *  · Android: mensaje de datos `tipo=aviso`; la app lo pinta con el logo GCC en el canal
 *    «Avisos» (`MensajeriaService`).
 *  · iPhone, iPad y Mac (la misma app nativa): banner normal por APNs al token `apns`.
 *  · Navegador con «Activar avisos»: Web Push al service worker (`public/sw.js`).
 *
 * Se salta a quien apagó esta clase en Configuración → Notificaciones. Nunca lanza.
 */
export async function avisarUsuarios(userIds: string[], aviso: Aviso): Promise<void> {
  try {
    const ids = await conAvisoEncendido(userIds, aviso.clase, 'push');
    if (!ids.length) return;
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
      ...ids.map((id) => enviarPush(id, {
        titulo: aviso.titulo,
        cuerpo: aviso.cuerpo,
        url: aviso.url || aviso.ruta || '/dashboard',
        etiqueta: aviso.etiqueta || aviso.hilo,
        insistir: aviso.insistir,
      }, aviso.ttl).catch((e: any) => console.error('Aviso al navegador:', e?.message))),
    ]);
  } catch (e: any) {
    console.error('Aviso al teléfono:', e?.message);
  }
}
