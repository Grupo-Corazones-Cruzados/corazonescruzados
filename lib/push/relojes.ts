import { pool } from '@/lib/db';
import { enviarDatosFcm } from '@/lib/push/fcm';

/**
 * «Un reloj de este miembro cambió»: avisa a sus teléfonos para que ajusten la notificación
 * del reloj al instante (Fernando, 2026-10-06). Antes de esto, un reloj iniciado o detenido en
 * el computador llegaba al teléfono al abrir la app o, con ella cerrada, en hasta 15 minutos.
 *
 * El aviso no lleva el reloj: solo «pregunta otra vez». La verdad sigue siendo
 * `/api/tickets/relojes`, y así un aviso perdido o desordenado no deja nada mal.
 */
export async function avisarRelojesDelMiembro(memberId: number | null): Promise<void> {
  if (memberId == null) return;
  try {
    const { rows } = await pool.query(
      `SELECT d.token FROM gcc_world.push_devices d
         JOIN gcc_world.users u ON u.id = d.user_id
        WHERE u.member_id = $1 AND d.kind = 'fcm'`,
      [memberId],
    );
    await enviarDatosFcm(rows.map((r: any) => r.token), { tipo: 'relojes' });
  } catch (e: any) {
    console.error('Aviso de relojes:', e?.message);
  }
}
