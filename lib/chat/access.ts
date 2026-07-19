import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';

/**
 * Acceso al CHAT de la aplicación: solo **candidatos y miembros** (y admin).
 * Un cliente puro NO entra.
 *
 * El JWT solo lleva `userId`/`email`/`role`, así que "candidato" no se puede deducir del
 * token: un candidato tiene `role='client'` y su fila en `gcc_world.clients` con
 * `account_type='candidate'` (ver `lib/dashboard/access.ts`). Por eso hace falta la consulta.
 */
export interface ChatUser { userId: string; role: string }

export async function requireChatUser(): Promise<ChatUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.role === 'member' || user.role === 'admin') {
    return { userId: user.userId, role: user.role };
  }
  if (user.role === 'client') {
    const { rows } = await pool.query(
      `SELECT 1 FROM gcc_world.clients
        WHERE user_id = $1 AND account_type = 'candidate' LIMIT 1`,
      [user.userId],
    );
    if (rows.length > 0) return { userId: user.userId, role: 'candidate' };
  }
  return null;
}
