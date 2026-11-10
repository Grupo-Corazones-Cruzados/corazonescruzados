import { pool } from '@/lib/db';

type Usuario = { userId: string; email: string; role: string };

/**
 * QUÉ SUSCRIPCIONES VE CADA CUENTA — definición ÚNICA (Fernando, 2026-11-09: «los usuarios están
 * viendo las suscripciones que tiene otro miembro asignado»; Helen veía las de Carliza y Peter Tours,
 * que son de Fernando). Antes un miembro veía TODAS, igual que el administrador.
 *
 *  · admin   → todas.
 *  · member  → las suyas: dueño de la ficha (`owner_member_id` = su `member_id`) o quien la creó
 *              (`created_by` = su correo; las antiguas no tienen dueño).
 *  · cliente → las que le cobran a él (`client_email_sri` o el correo de su ficha de cliente).
 *
 * Devuelve el trozo de SQL para el WHERE (con alias `s`) y añade sus valores a `params`, o `null` si
 * no hay que filtrar. El `member_id` se lee de la base: el token no lo lleva.
 */
export async function alcanceSuscripciones(user: Usuario, params: unknown[]): Promise<string | null> {
  if (user.role === 'admin') return null;
  params.push(String(user.email));
  const correo = `$${params.length}`;
  if (user.role === 'member') {
    const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1::uuid`, [String(user.userId)]);
    const memberId = u?.member_id != null ? Number(u.member_id) : null;
    if (memberId == null) return `LOWER(s.created_by) = LOWER(${correo})`;
    params.push(memberId);
    return `(s.owner_member_id = $${params.length} OR LOWER(s.created_by) = LOWER(${correo}))`;
  }
  return `(LOWER(s.client_email_sri) = LOWER(${correo})
           OR s.client_id IN (SELECT c.id FROM gcc_world.clients c WHERE LOWER(c.email) = LOWER(${correo})))`;
}

/** ¿Puede esta cuenta ver (o, si es del equipo, tocar) la suscripción `id`? Misma regla que la lista. */
export async function puedeVerSuscripcion(user: Usuario, id: number): Promise<boolean> {
  const params: unknown[] = [id];
  const filtro = await alcanceSuscripciones(user, params);
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.subscriptions s WHERE s.id = ($1)::bigint ${filtro ? `AND ${filtro}` : ''} LIMIT 1`,
    params,
  );
  return rows.length > 0;
}
