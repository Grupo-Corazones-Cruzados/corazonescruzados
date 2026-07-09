import { pool } from '@/lib/db';

/**
 * Garantiza que un usuario (candidato/miembro/admin) tenga una **cuenta de tipo cliente** en
 * `gcc_world.clients` para hacer operaciones (p. ej. solicitar tickets). El modelo se unifica
 * en `clients`: la fila de cliente es la identidad de "compra/solicitud" del usuario y guarda
 * sus registros. Estrategia idempotente:
 *  1. Si ya hay una fila `clients` enlazada por `user_id` → se reutiliza (candidato o cliente).
 *  2. Si hay una fila con el mismo correo → se enlaza `user_id` y se reutiliza.
 *  3. Si no → se crea una fila `account_type='client'` con los datos del usuario.
 * Devuelve el `clients.id` (o null si no se pudo).
 */
export async function ensureUserClientAccount(userId: string): Promise<number | null> {
  try {
    // Datos del usuario (para nombre/correo de la cuenta cliente).
    const u = await pool.query(
      `SELECT email, first_name, last_name FROM gcc_world.users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const urow = u.rows[0];
    const email = String(urow?.email || '').trim().toLowerCase();
    const name = [urow?.first_name, urow?.last_name].filter(Boolean).join(' ').trim() || email || 'Cliente';

    // 1) ya enlazada por user_id
    const byUser = await pool.query(
      `SELECT id FROM gcc_world.clients WHERE user_id = $1 ORDER BY (account_type = 'client') DESC, id ASC LIMIT 1`,
      [userId],
    );
    if (byUser.rows[0]) return Number(byUser.rows[0].id);

    // 2) por correo → enlazar user_id
    if (email) {
      const byEmail = await pool.query(
        `SELECT id, user_id FROM gcc_world.clients WHERE LOWER(email) = $1 LIMIT 1`,
        [email],
      );
      if (byEmail.rows[0]) {
        const id = Number(byEmail.rows[0].id);
        if (byEmail.rows[0].user_id == null) {
          await pool.query(`UPDATE gcc_world.clients SET user_id = $1 WHERE id = $2`, [userId, id]).catch(() => undefined);
        }
        return id;
      }
    }

    // 3) crear cuenta de tipo cliente con los datos del usuario
    const ins = await pool.query(
      `INSERT INTO gcc_world.clients (name, email, account_type, user_id, created_at, updated_at)
       VALUES ($1, $2, 'client', $3, NOW(), NOW()) RETURNING id`,
      [name, email || null, userId],
    );
    return Number(ins.rows[0].id);
  } catch (e) {
    console.error('ensureUserClientAccount error:', e);
    return null;
  }
}
