import { pool } from '@/lib/db';
import { canAccessSystem } from '@/lib/centralized/system-access';
import { AVISOS, SLUG_RECLUTAMIENTO, type Canal, type ClaseAviso, type DefinicionAviso } from '@/lib/avisos/catalogo';

/**
 * Preferencias de avisos por persona (Fernando, 2026-10-29). Solo se guarda lo APAGADO o lo que
 * se volvió a encender: sin fila, el aviso está encendido.
 */

let asegurando: Promise<void> | null = null;
export function asegurarTablaPreferencias(): Promise<void> {
  if (asegurando) return asegurando;
  const p = pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.aviso_preferencias (
        user_id UUID NOT NULL,
        clase TEXT NOT NULL,
        canal TEXT NOT NULL,
        activo BOOLEAN NOT NULL,
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, clase, canal)
      )`)
    .then(() => undefined)
    .catch((e: unknown) => { asegurando = null; throw e; });
  asegurando = p;
  return p;
}

/** De `userIds`, los que NO apagaron esta clase en este canal. */
export async function conAvisoEncendido(userIds: string[], clase: ClaseAviso | string, canal: Canal): Promise<string[]> {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return [];
  await asegurarTablaPreferencias();
  const { rows } = await pool.query(
    `SELECT user_id::text AS id FROM gcc_world.aviso_preferencias
      WHERE user_id = ANY($1::uuid[]) AND clase = $2 AND canal = $3 AND activo = false`,
    [ids, clase, canal],
  );
  const apagados = new Set(rows.map((r: any) => r.id));
  return ids.filter((id) => !apagados.has(id));
}

/** Los avisos que esta persona puede recibir (los que ve en Configuración). */
export async function avisosDe(user: { userId: string; role: string }): Promise<DefinicionAviso[]> {
  const equipo = user.role === 'admin' || user.role === 'member' || (await pool.query(
    `SELECT 1 FROM gcc_world.clients WHERE user_id = $1::uuid AND account_type = 'candidate' LIMIT 1`, [user.userId],
  )).rows.length > 0;
  const reclutamiento = await canAccessSystem(user.userId, user.role, SLUG_RECLUTAMIENTO).catch(() => false);
  return AVISOS.filter((a) => a.alcance === 'todos' || (a.alcance === 'equipo' && equipo) || (a.alcance === 'reclutamiento' && reclutamiento));
}

export async function leerPreferencias(userId: string): Promise<Record<string, boolean>> {
  await asegurarTablaPreferencias();
  const { rows } = await pool.query(
    `SELECT clase, canal, activo FROM gcc_world.aviso_preferencias WHERE user_id = $1::uuid`, [userId]);
  return Object.fromEntries(rows.map((r: any) => [`${r.clase}:${r.canal}`, !!r.activo]));
}

export async function guardarPreferencia(userId: string, clase: ClaseAviso, canal: Canal, activo: boolean) {
  await asegurarTablaPreferencias();
  await pool.query(
    `INSERT INTO gcc_world.aviso_preferencias (user_id, clase, canal, activo) VALUES ($1::uuid, $2, $3, $4)
     ON CONFLICT (user_id, clase, canal) DO UPDATE SET activo = EXCLUDED.activo, actualizado_en = NOW()`,
    [userId, clase, canal, activo],
  );
}
