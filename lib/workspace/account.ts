import { pool } from '@/lib/db';

/**
 * Resuelve el correo corporativo (`@grupocc.org`) del usuario del dashboard, para
 * sincronizar su perfil con Google. Fuente: `users.workspace_email` o, si no, la fila
 * de candidato enlazada (`clients.user_id = users.id`). Devuelve null si no tiene cuenta.
 */
let ensuring: Promise<void> | null = null;
function ensureColumn(): Promise<void> {
  if (!ensuring) {
    const p = pool
      .query(`
        ALTER TABLE gcc_world.users   ADD COLUMN IF NOT EXISTS workspace_email text;
        ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS workspace_email text;
      `)
      .then(() => undefined)
      .catch((e: unknown) => { ensuring = null; throw e; });
    ensuring = p;
    return p;
  }
  return ensuring;
}

export async function resolveWorkspaceEmail(userId: string): Promise<string | null> {
  await ensureColumn();
  const r = await pool.query(
    `SELECT COALESCE(
              u.workspace_email,
              (SELECT c.workspace_email FROM gcc_world.clients c
                WHERE c.user_id = u.id AND c.workspace_email IS NOT NULL LIMIT 1)
            ) AS we
       FROM gcc_world.users u WHERE u.id = $1`,
    [userId],
  );
  return r.rows[0]?.we || null;
}
