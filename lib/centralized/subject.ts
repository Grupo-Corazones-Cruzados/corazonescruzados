import { pool } from '@/lib/db';

/**
 * SUJETO del Centralizado (la identidad sobre la que cuelgan horario, tareas y puntuación
 * de talentos/valores): un MIEMBRO (`members.id`, vía `users.member_id`) o un CANDIDATO
 * (`clients.id` con `account_type='candidate'`).
 *
 * Definición ÚNICA reusable: la usan "Mi día" (`/api/centralized/horario/me`) y el módulo
 * "Experiencias". Antes vivía duplicada dentro de la ruta de horario.
 */
export interface Subject {
  kind: 'member' | 'candidate';
  id: string;
}

/** Resuelve el sujeto del usuario logueado, o null si no tiene uno (p. ej. cliente puro). */
export async function resolveSubject(user: any): Promise<Subject | null> {
  if (!user) return null;
  try {
    if (user.role === 'admin' || user.role === 'member') {
      const { rows } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
      const mid = rows[0]?.member_id;
      return mid != null ? { kind: 'member', id: String(mid) } : null;
    }
    // client/candidato: su fila en clients
    const { rows } = await pool.query(`SELECT id, account_type FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`, [user.userId]);
    const c = rows[0];
    return c && c.account_type === 'candidate' ? { kind: 'candidate', id: String(c.id) } : null;
  } catch { return null; }
}
