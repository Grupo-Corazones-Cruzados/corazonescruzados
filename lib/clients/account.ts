import { pool } from '@/lib/db';

/**
 * Estados de una cuenta de cliente (`gcc_world.clients.status`):
 *  - `inactivo`  → placeholder de solo correo (sin dueño), creado al asignar un cliente por
 *                  correo a un ticket/proyecto. No tiene datos ni login.
 *  - `pendiente` → alguien inició el registro de cliente pero aún no verifica su correo.
 *  - `activo`    → cuenta real usable: verificada por self-signup, o generada por un
 *                  miembro/candidato a partir de su propia cuenta.
 * Ver MEMORIA.md → "Modelo de CLIENTES y FACTURACIÓN".
 */
export const CLIENT_STATUS = {
  INACTIVE: 'inactivo',
  PENDING: 'pendiente',
  ACTIVE: 'activo',
} as const;

let ensuring: Promise<void> | null = null;
/**
 * Columnas del modelo de clientes: `status` (estado de la cuenta) y `created_by_member_id`
 * (el miembro que creó un placeholder por correo, para "mis clientes"). Idempotente; hace
 * un backfill best-effort del estado de las filas existentes.
 */
export function ensureClientColumns(): Promise<void> {
  if (ensuring) return ensuring;
  const p = (async () => {
    await pool.query(`
      ALTER TABLE gcc_world.clients
        ADD COLUMN IF NOT EXISTS status               VARCHAR(12) NOT NULL DEFAULT 'inactivo',
        ADD COLUMN IF NOT EXISTS created_by_member_id BIGINT;
    `);
    // Backfill best-effort (las columnas referenciadas ya existen en prod; si faltaran, se
    // ignora el error y las filas quedan 'inactivo' por el DEFAULT).
    try {
      await pool.query(
        `UPDATE gcc_world.clients SET status = 'activo'
          WHERE status = 'inactivo' AND (user_id IS NOT NULL OR email_verified = TRUE)`,
      );
    } catch (e: any) { console.error('[clients] backfill activo:', e.message); }
    try {
      await pool.query(
        `UPDATE gcc_world.clients SET status = 'pendiente'
          WHERE status = 'inactivo' AND user_id IS NULL
            AND (email_verified IS DISTINCT FROM TRUE) AND pending_email IS NOT NULL`,
      );
    } catch (e: any) { console.error('[clients] backfill pendiente:', e.message); }
  })().catch((err: unknown) => { ensuring = null; throw err; });
  ensuring = p;
  return p;
}

/** member_id del usuario (o null si no tiene perfil de miembro, p. ej. admin sin vínculo). */
export async function resolveMemberId(userId: string): Promise<number | null> {
  try {
    const { rows } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1 LIMIT 1`, [userId]);
    return rows[0]?.member_id != null ? Number(rows[0].member_id) : null;
  } catch { return null; }
}

/**
 * RUTA 3 de asociación: "usar/agregar correo" al asignar un cliente en un ticket/proyecto.
 * Devuelve el id de la fila `clients` con ese correo — si no existe, crea un placeholder
 * `inactivo` (solo correo), ligado al miembro que lo creó. NO envía la invitación (lo hace
 * el llamador). Devuelve `{ id, created }`.
 */
export async function findOrCreatePlaceholderByEmail(
  email: string,
  createdByMemberId: number | null,
): Promise<{ id: number; created: boolean } | null> {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  await ensureClientColumns();
  const existing = await pool.query(`SELECT id FROM gcc_world.clients WHERE LOWER(email) = $1 LIMIT 1`, [e]);
  if (existing.rows[0]) return { id: Number(existing.rows[0].id), created: false };
  const ins = await pool.query(
    `INSERT INTO gcc_world.clients (name, email, status, created_by_member_id, created_at, updated_at)
     VALUES ($1, $2, 'inactivo', $3, NOW(), NOW()) RETURNING id`,
    [e, e, createdByMemberId],
  );
  return { id: Number(ins.rows[0].id), created: true };
}

/** Marca una cuenta de cliente como `activo` (dueño real: self-signup verificado o miembro/candidato). */
export async function markClientActive(clientId: number | string): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.clients SET status = 'activo', updated_at = NOW() WHERE id = $1 AND status <> 'activo'`,
    [clientId],
  ).catch(() => undefined);
}
