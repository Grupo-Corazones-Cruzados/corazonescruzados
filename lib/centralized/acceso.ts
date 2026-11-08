import { pool } from '@/lib/db';
import { pisosAtOrBelow } from '@/lib/centralized/systems';
import { SLUG_CONTROL_PSICOSOCIAL } from '@/lib/centralized/control-psicosocial';

/**
 * QUÉ SISTEMAS DE CENTRALIZADO PUEDE VER UNA CUENTA — definición única (extraída el 2026-11-08 de
 * `/api/centralized/systems` para que el dashboard use la misma regla y no una parecida).
 *
 * El admin global ve todos. Cualquier otro ve, si está activo, los sistemas de SU paso (exacto) en SU
 * piso y en los pisos por DEBAJO, los que se le compartieron explícitamente y, si es miembro, Control
 * Psicosocial, que es de todos (la seguridad no depende de la celda). Sin miembro asociado, ninguno.
 *
 * Devuelve las condiciones SQL sobre el alias `s` (`centralized_systems`), añadiendo sus valores a
 * `params`, o `null` si la cuenta no puede ver ninguno.
 */
export async function condicionesDeAcceso(user: { userId: string; role: string }, params: unknown[]): Promise<string[] | null> {
  if (user.role === 'admin') return [];
  const { rows: [me] } = await pool.query(
    `SELECT m.id AS member_id, m.piso, m.paso
     FROM gcc_world.users u JOIN gcc_world.members m ON m.id = u.member_id
     WHERE u.id = $1`,
    [user.userId],
  );
  if (!me?.member_id) return null;
  // Un candidato también tiene `member_id`, pero su rol es `client`: Control Psicosocial no es suyo.
  const alcance = user.role === 'member' ? ` OR s.slug = '${SLUG_CONTROL_PSICOSOCIAL}'` : '';
  const pp = `$${params.length + 1}`; params.push(pisosAtOrBelow(me.piso));
  const ms = `$${params.length + 1}`; params.push(me.paso ?? '');
  const mid = `$${params.length + 1}`; params.push(String(me.member_id));
  return [
    's.is_active = true',
    `((s.piso = ANY(${pp}::text[]) AND s.paso = ${ms})` +
      ` OR EXISTS (SELECT 1 FROM gcc_world.centralized_member_access a WHERE a.system_id = s.id AND a.member_id = ${mid}::int)${alcance})`,
  ];
}
