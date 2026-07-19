import { pool } from '@/lib/db';
import { pisosAtOrBelow } from '@/lib/centralized/systems';

/**
 * ¿Puede este usuario entrar a un sistema concreto del Centralizado?
 *
 * Replica la MISMA regla que filtra la lista en `app/api/centralized/systems/route.ts`:
 * un miembro accede a los sistemas de **su piso y los pisos por debajo**, pero solo en **su
 * paso exacto**; el admin pasa siempre; y existe la puerta de escape
 * `centralized_member_access` (accesos compartidos desde "Compartir acceso").
 *
 * Hasta ahora esa regla vivía SOLO en la ruta que lista sistemas, así que las rutas de datos
 * de cada sistema quedaban protegidas únicamente por `['admin','member']`. Para sistemas cuyos
 * datos son del propio usuario eso bastaba, pero **Gestión Social · Recursos lee pensamientos
 * PRIVADOS de otras personas**: ahí la comprobación tiene que ser real, no cosmética.
 */
export async function canAccessSystem(userId: string, role: string, slug: string): Promise<boolean> {
  if (role === 'admin') return true;
  if (role !== 'member') return false;

  const { rows: sysRows } = await pool.query(
    `SELECT id, piso, paso FROM gcc_world.centralized_systems WHERE slug = $1 AND is_active = true`,
    [slug],
  );
  const sys = sysRows[0];
  if (!sys) return false;

  const { rows: meRows } = await pool.query(
    `SELECT m.id AS member_id, m.piso, m.paso
       FROM gcc_world.users u JOIN gcc_world.members m ON m.id = u.member_id
      WHERE u.id = $1`,
    [userId],
  );
  const me = meRows[0];
  if (!me?.member_id) return false;

  // Jerárquico por piso, exacto por paso.
  if (pisosAtOrBelow(me.piso).includes(sys.piso) && sys.paso === me.paso) return true;

  // Acceso concedido explícitamente a este miembro para este sistema.
  const { rows: grant } = await pool.query(
    `SELECT 1 FROM gcc_world.centralized_member_access
      WHERE system_id = $1 AND member_id = $2 LIMIT 1`,
    [sys.id, me.member_id],
  );
  return grant.length > 0;
}
