import { pool } from '@/lib/db';
import { enviarDatosFcm } from '@/lib/push/fcm';
import { enviarActividadEnVivo, fechaSwift, type EntornoApns } from '@/lib/push/apns';
import { relojesDelMiembro } from '@/lib/tickets/relojes';

/**
 * «Un reloj de este miembro cambió»: avisa a sus teléfonos para que el reloj aparezca o
 * desaparezca al instante, con la app cerrada (Fernando, 2026-10-06/07).
 *
 *  · Android (FCM): un aviso de datos «pregunta otra vez»; la verdad sigue siendo
 *    `/api/tickets/relojes`, y así un aviso perdido no deja nada mal.
 *  · iPhone (APNs): la Actividad en Vivo no puede preguntar, hay que dársela hecha. Al INICIAR
 *    se manda `start` con el reloj a los tokens de arranque del miembro; al DETENER (o borrar),
 *    `end` a los tokens de las actividades de ese registro, que luego se olvidan.
 *    Si el reloj se inició desde el propio iPhone con la app abierta, la app arranca también
 *    la suya: la app se queda con una y cierra la repetida.
 *
 * `cambio` dice qué pasó; sin él solo se avisa a Android.
 */
export async function avisarRelojesDelMiembro(
  memberId: number | null,
  cambio?: { registroId: number; accion: 'iniciar' | 'detener' },
): Promise<void> {
  if (memberId == null) return;
  try {
    const { rows } = await pool.query(
      `SELECT d.token, d.kind, d.entorno, d.registro_id FROM gcc_world.push_devices d
         JOIN gcc_world.users u ON u.id = d.user_id
        WHERE u.member_id = $1`,
      [memberId],
    );
    const tareas: Promise<void>[] = [];
    const fcm = rows.filter((r: any) => r.kind === 'fcm').map((r: any) => r.token);
    tareas.push(enviarDatosFcm(fcm, { tipo: 'relojes' }));

    if (cambio?.accion === 'iniciar') {
      const [reloj] = await relojesDelMiembro(memberId, cambio.registroId);
      const destinos = rows
        .filter((r: any) => r.kind === 'apns_live_start')
        .map((r: any) => ({ token: r.token, entorno: (r.entorno || 'production') as EntornoApns }));
      if (reloj && destinos.length) {
        tareas.push(enviarActividadEnVivo(destinos, {
          event: 'start',
          'content-state': { inicio: fechaSwift(reloj.inicio) },
          'attributes-type': 'RelojAtributos',
          attributes: {
            registroId: reloj.registroId, ticketId: reloj.ticketId, titulo: reloj.titulo,
            cliente: reloj.cliente || '', registro: reloj.registro || '', tarifa: reloj.tarifa,
          },
          alert: { title: reloj.titulo, body: `Reloj en marcha${reloj.cliente ? ` · ${reloj.cliente}` : ''}` },
        }));
      }
    } else if (cambio?.accion === 'detener') {
      const destinos = rows
        .filter((r: any) => r.kind === 'apns_live_update' && Number(r.registro_id) === cambio.registroId)
        .map((r: any) => ({ token: r.token, entorno: (r.entorno || 'production') as EntornoApns }));
      if (destinos.length) {
        const ahora = Math.floor(Date.now() / 1000);
        tareas.push(enviarActividadEnVivo(destinos, {
          event: 'end',
          'content-state': { inicio: fechaSwift(new Date().toISOString()) },
          'dismissal-date': ahora,
        }).then(() => pool.query(
          `DELETE FROM gcc_world.push_devices WHERE kind = 'apns_live_update' AND registro_id = $1`,
          [cambio.registroId],
        )).then(() => undefined));
      }
    }
    await Promise.all(tareas);
  } catch (e: any) {
    console.error('Aviso de relojes:', e?.message);
  }
}
