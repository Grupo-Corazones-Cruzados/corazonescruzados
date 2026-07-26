// Notificaciones persistentes por usuario. Usa la tabla EXISTENTE `gcc_world.notifications`
// (ya la alimenta la app con tipos como payment_submitted / project_all_completed…):
//   id, created_at, user_id UUID, type, title, message, link, is_read, read_at.
// Las invitaciones de PROYECTO NO se guardan aquí: se derivan en vivo de
// project_bids/project_members (ver app/api/notifications/route.ts).
import { pool } from '@/lib/db';

let ready = false;

export async function ensureNotificationsTable(): Promise<void> {
  if (ready) return;
  // No-op si ya existe (prod). Definición para instalaciones nuevas, alineada al esquema real.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.notifications (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_id UUID NOT NULL,
      type VARCHAR NOT NULL,
      title VARCHAR NOT NULL,
      message TEXT,
      link TEXT,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      read_at TIMESTAMPTZ
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS notifications_user_idx ON gcc_world.notifications(user_id)`);
  ready = true;
}

export async function createNotification(
  userId: string,
  n: { type: string; title: string; message?: string; link?: string },
): Promise<void> {
  await ensureNotificationsTable();
  await pool.query(
    `INSERT INTO gcc_world.notifications (user_id, type, title, message, link) VALUES ($1::uuid, $2, $3, $4, $5)`,
    [String(userId), n.type, n.title, n.message || null, n.link || null],
  );
}

export async function listUserNotifications(userId: string) {
  await ensureNotificationsTable();
  const { rows } = await pool.query(
    `SELECT id, type, title, message, link, is_read, created_at
       FROM gcc_world.notifications WHERE user_id = $1::uuid ORDER BY created_at DESC`,
    [String(userId)],
  );
  return rows;
}

/* ── Marca de lectura ─────────────────────────────────────────────────────────
 * El contador de la campanita mezcla dos orígenes: las filas de `notifications`
 * (tienen `is_read`) y las invitaciones a proyectos, que se DERIVAN en vivo de
 * `project_bids`/`project_members` y por tanto no se pueden marcar.
 *
 * Para que el contador pueda llegar a cero se guarda "hasta cuándo leyó" cada usuario:
 * una invitación cuenta como no leída solo si es POSTERIOR a esa marca.
 */
let readyReads = false;

async function ensureReadMarker(): Promise<void> {
  if (readyReads) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.notification_reads (
      user_id UUID PRIMARY KEY,
      read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  readyReads = true;
}

/** Momento en que el usuario abrió por última vez sus notificaciones (o `null`). */
export async function getReadAt(userId: string): Promise<string | null> {
  await ensureReadMarker();
  const { rows } = await pool.query(
    `SELECT read_at FROM gcc_world.notification_reads WHERE user_id = $1::uuid`, [String(userId)]);
  return rows.length ? new Date(rows[0].read_at).toISOString() : null;
}

/**
 * Marca todo como leído: las filas persistentes y la marca temporal que apaga las
 * invitaciones derivadas. Es lo que se dispara al abrir la ventana de la campanita.
 */
export async function markAllRead(userId: string): Promise<void> {
  await ensureNotificationsTable();
  await ensureReadMarker();
  await pool.query(
    `UPDATE gcc_world.notifications SET is_read = TRUE, read_at = NOW()
      WHERE user_id = $1::uuid AND is_read = FALSE`, [String(userId)]);
  await pool.query(
    `INSERT INTO gcc_world.notification_reads (user_id, read_at) VALUES ($1::uuid, NOW())
     ON CONFLICT (user_id) DO UPDATE SET read_at = NOW()`, [String(userId)]);
}
