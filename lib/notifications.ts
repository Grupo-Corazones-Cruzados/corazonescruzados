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
