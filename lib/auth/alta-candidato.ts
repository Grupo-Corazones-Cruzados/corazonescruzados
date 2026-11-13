import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { pool } from '@/lib/db';
import { createToken, setAuthCookie } from '@/lib/auth/jwt';

/**
 * EL ALTA DEL CANDIDATO ACEPTADO (Fernando, 2026-11-12). Se entra al formulario con el CORREO CORPORATIVO y la
 * contraseña temporal que le llegó a ese correo; al entrar se abre una sesión corta de alta (cookie `gcc_alta`, 30 min)
 * que solo sirve para completar el formulario. Al completarlo, su cuenta del panel usa el correo corporativo: el
 * personal deja de servir para entrar.
 */
export const COOKIE_ALTA = 'gcc_alta';

export async function prepararAlta() {
  await pool.query(`ALTER TABLE gcc_world.clients
    ADD COLUMN IF NOT EXISTS workspace_email text, ADD COLUMN IF NOT EXISTS workspace_tipo text,
    ADD COLUMN IF NOT EXISTS alta_clave_hash text, ADD COLUMN IF NOT EXISTS alta_clave_vence timestamptz,
    ADD COLUMN IF NOT EXISTS alta_sesion text, ADD COLUMN IF NOT EXISTS alta_sesion_vence timestamptz`);
}

/** El candidato pendiente de alta para esta dirección corporativa (o null). */
export async function candidatoPorCorreo(correo: string) {
  await prepararAlta();
  const { rows: [c] } = await pool.query(
    `SELECT id, full_name, email AS personal, workspace_email, alta_clave_hash, alta_clave_vence, profile_completed
       FROM gcc_world.clients
      WHERE LOWER(workspace_email) = $1 AND account_type = 'candidate' AND approved = true LIMIT 1`,
    [correo.trim().toLowerCase()],
  );
  return c || null;
}

export async function abrirSesionAlta(clientId: number): Promise<void> {
  const token = randomBytes(32).toString('hex');
  await pool.query(`UPDATE gcc_world.clients SET alta_sesion = $1, alta_sesion_vence = NOW() + INTERVAL '30 minutes' WHERE id = $2`, [token, clientId]);
  (await cookies()).set(COOKIE_ALTA, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 1800 });
}

/** El candidato de la sesión de alta abierta (o null si no hay, venció o ya completó). */
export async function candidatoDeLaSesionAlta() {
  const token = (await cookies()).get(COOKIE_ALTA)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  await prepararAlta();
  const { rows: [c] } = await pool.query(
    `SELECT id, full_name, workspace_email FROM gcc_world.clients
      WHERE alta_sesion = $1 AND alta_sesion_vence > NOW() AND COALESCE(profile_completed, false) = false LIMIT 1`,
    [token],
  );
  return c || null;
}

/**
 * Cierra el alta: la cuenta del panel (gcc_world.users) se crea o enlaza con el CORREO CORPORATIVO, rol 'client', y
 * queda la sesión del panel abierta. Nunca con el correo personal.
 */
export async function completarCuentaCorporativa(c: { id: number; full_name: string | null; workspace_email: string }, passwordHash: string): Promise<void> {
  const correo = c.workspace_email.trim().toLowerCase();
  const partes = (c.full_name || '').trim().split(/\s+/);
  const nombre = partes.slice(0, Math.max(1, partes.length - 2)).join(' ') || null;
  const apellido = partes.length > 2 ? partes.slice(-2).join(' ') : partes.slice(1).join(' ') || null;
  await pool.query(`ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS workspace_email text`);
  const { rows: [u] } = await pool.query(`SELECT id, role FROM gcc_world.users WHERE LOWER(email) = $1 LIMIT 1`, [correo]);
  let userId: string;
  if (u) {
    userId = u.id;
    await pool.query(`UPDATE gcc_world.users SET password_hash = $1, is_verified = true, workspace_email = $2, updated_at = NOW() WHERE id = $3`, [passwordHash, correo, userId]);
  } else {
    const { rows: [n] } = await pool.query(
      `INSERT INTO gcc_world.users (email, password_hash, role, is_verified, first_name, last_name, workspace_email)
       VALUES ($1, $2, 'client', true, $3, $4, $1) RETURNING id`,
      [correo, passwordHash, nombre, apellido],
    );
    userId = n.id;
  }
  await pool.query(
    `UPDATE gcc_world.clients SET user_id = $1, password_hash = $2, profile_completed = true,
            alta_clave_hash = NULL, alta_clave_vence = NULL, alta_sesion = NULL, alta_sesion_vence = NULL,
            auth_token = $3, auth_expires = NOW() + INTERVAL '30 days', last_seen_at = NOW()
      WHERE id = $4`,
    [userId, passwordHash, randomBytes(32).toString('hex'), c.id],
  );
  (await cookies()).delete(COOKIE_ALTA);
  await setAuthCookie(await createToken({ userId, email: correo, role: 'client' }));
}
