import { pool } from '@/lib/db';
import { createToken, setAuthCookie, type UserRole } from '@/lib/auth/jwt';

/**
 * Da al CANDIDATO (fila en `gcc_world.clients`, account_type='candidate') una sesión de
 * `/dashboard`: crea o enlaza su fila en `gcc_world.users` (rol 'client'), sincroniza su
 * contraseña, vincula `clients.user_id`, y emite el **JWT `auth_token`** (via `setAuthCookie`)
 * para que entre al panel SIN volver a iniciar sesión (evita el doble login).
 *
 * Se llama al COMPLETAR la cuenta (`complete-profile`) y al INICIAR SESIÓN como candidato
 * (`recover/verify`). Requiere que el candidato ya tenga contraseña (cuenta completada); si
 * no, devuelve false y no crea nada. El rol en el dashboard es 'client' (sus módulos se
 * gatean por rol como cualquier otro).
 */
export async function grantCandidateDashboardSession(email: string): Promise<boolean> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return false;

  const cr = await pool.query(
    `SELECT id, password_hash, full_name FROM gcc_world.clients
      WHERE LOWER(email) = $1 AND account_type = 'candidate' LIMIT 1`,
    [cleanEmail],
  );
  const cand = cr.rows[0];
  if (!cand || !cand.password_hash) return false; // sin cuenta completada → sin sesión

  // Busca/crea la fila `users`. Si ya existe (p. ej. el correo también es staff), se
  // PRESERVA su rol; si se crea nueva, es rol 'client'.
  const ur = await pool.query(`SELECT id, role FROM gcc_world.users WHERE LOWER(email) = $1 LIMIT 1`, [cleanEmail]);
  let userId: string;
  let role: UserRole = 'client';
  if (ur.rows[0]) {
    userId = ur.rows[0].id;
    const existing = String(ur.rows[0].role || 'client');
    role = (['client', 'member', 'admin'].includes(existing) ? existing : 'client') as UserRole;
    await pool.query(
      `UPDATE gcc_world.users SET password_hash = $1, is_verified = true, updated_at = NOW() WHERE id = $2`,
      [cand.password_hash, userId],
    );
  } else {
    const ins = await pool.query(
      `INSERT INTO gcc_world.users (email, password_hash, role, is_verified, first_name)
       VALUES ($1, $2, 'client', true, $3) RETURNING id`,
      [cleanEmail, cand.password_hash, cand.full_name || null],
    );
    userId = ins.rows[0].id;
  }

  // Vincula el candidato (clients) con su usuario del dashboard.
  await pool.query(
    `UPDATE gcc_world.clients SET user_id = $1 WHERE LOWER(email) = $2 AND account_type = 'candidate'`,
    [userId, cleanEmail],
  ).catch(() => undefined);

  // Emite el JWT del dashboard (cookie `auth_token`) con el rol correspondiente.
  const token = await createToken({ userId, email: cleanEmail, role });
  await setAuthCookie(token);
  return true;
}
