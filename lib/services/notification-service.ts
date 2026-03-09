import { query } from "@/lib/db";
import type { Notification, NotificationType } from "@/lib/types";

export async function createNotification(data: {
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
}): Promise<Notification> {
  const result = await query<Notification>(
    `INSERT INTO notifications (user_id, type, title, message, link)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.user_id, data.type, data.title, data.message ?? null, data.link ?? null]
  );
  return result.rows[0];
}

export async function listNotifications(
  userId: string,
  limit = 20
): Promise<Notification[]> {
  const result = await query<Notification>(
    `SELECT * FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export async function countUnread(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return Number(result.rows[0].count);
}

export async function markAsRead(
  id: number,
  userId: string
): Promise<Notification | null> {
  const result = await query<Notification>(
    `UPDATE notifications
     SET is_read = true, read_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await query(
    `UPDATE notifications
     SET is_read = true, read_at = NOW()
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return result.rowCount ?? 0;
}

export async function getUserIdByMemberId(
  memberId: number
): Promise<string | null> {
  const result = await query<{ id: string }>(
    `SELECT id FROM users WHERE member_id = $1`,
    [memberId]
  );
  return result.rows[0]?.id ?? null;
}
