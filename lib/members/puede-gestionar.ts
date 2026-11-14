import { pool } from '@/lib/db';

/**
 * ¿Puede `user` cambiar los datos del miembro `memberId`? El admin sí; los demás, solo los suyos
 * (`users.member_id` leído de la base, no del token). Extraído de `members/[id]/services` el
 * 2026-11-14 para que el CV lo use igual: su PUT dejaba a cualquier cuenta reescribir el CV de otro.
 */
export async function puedeGestionarMiembro(user: { role: string; userId: string }, memberId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  const { rows } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
  return String(rows[0]?.member_id || '') === String(memberId);
}
