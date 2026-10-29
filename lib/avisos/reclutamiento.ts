import { pool } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { canAccessSystem } from '@/lib/centralized/system-access';
import { systemPath } from '@/lib/centralized/systems';
import { SLUG_RECLUTAMIENTO, type ClaseAviso } from '@/lib/avisos/catalogo';

/**
 * ⇒ AVISOS DE RECLUTAMIENTO Y SELECCIÓN (Fernando, 2026-10-29): *«recibir notificaciones de
 * postulaciones, de cambios de candidatos a miembros también»*.
 *
 * Los reciben quienes ACCEDEN al sistema «Reclutamiento y Selección» (admin, y miembros por su
 * piso/paso o por acceso compartido: la misma regla que abre el sistema), menos quien hizo el
 * cambio. Cada uno elige en Configuración → Notificaciones si los quiere. Campanita +
 * teléfono/Mac. Nunca lanza: lo que se avisa ya quedó guardado.
 *
 * `consulta` es el enlace profundo del sistema (`tab=candidatos`, `miembro=<id>`…).
 */
export async function avisarReclutamiento(
  clase: ClaseAviso,
  aviso: { titulo: string; mensaje: string; consulta?: string; excluirUserId?: string | null },
): Promise<void> {
  try {
    const { rows: [sistema] } = await pool.query(
      `SELECT piso, paso, slug FROM gcc_world.centralized_systems WHERE slug = $1 AND is_active = true`,
      [SLUG_RECLUTAMIENTO],
    );
    if (!sistema) return;
    const { rows: usuarios } = await pool.query(
      `SELECT id::text AS id, role FROM gcc_world.users WHERE role IN ('admin', 'member')`,
    );
    const destinatarios: string[] = [];
    for (const u of usuarios) {
      if (u.id === aviso.excluirUserId) continue;
      if (await canAccessSystem(u.id, u.role, SLUG_RECLUTAMIENTO).catch(() => false)) destinatarios.push(u.id);
    }
    const link = systemPath(sistema) + (aviso.consulta ? `?${aviso.consulta}` : '');
    await Promise.all(destinatarios.map((id) =>
      createNotification(id, { type: clase, title: aviso.titulo, message: aviso.mensaje, link }, { push: { hilo: 'reclutamiento' } })
        .catch((e: any) => console.error('Aviso de reclutamiento:', e?.message)),
    ));
  } catch (e: any) {
    console.error('Aviso de reclutamiento:', e?.message);
  }
}
