import { query, transaction } from "@/lib/db";
import type { User } from "@/lib/types";

export async function getUserById(id: string): Promise<User | null> {
  const result = await query(
    `SELECT id, email, first_name, last_name, avatar_url, phone,
            role, member_id, is_verified, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function updateUserProfile(
  id: string,
  data: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    avatar_url?: string;
  }
): Promise<User | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.first_name !== undefined) {
    fields.push(`first_name = $${idx++}`);
    values.push(data.first_name);
  }
  if (data.last_name !== undefined) {
    fields.push(`last_name = $${idx++}`);
    values.push(data.last_name);
  }
  if (data.phone !== undefined) {
    fields.push(`phone = $${idx++}`);
    values.push(data.phone);
  }
  if (data.avatar_url !== undefined) {
    fields.push(`avatar_url = $${idx++}`);
    values.push(data.avatar_url);
  }

  if (fields.length === 0) return getUserById(id);

  values.push(id);
  const result = await query(
    `UPDATE users SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING id, email, first_name, last_name, avatar_url, phone,
               role, member_id, is_verified, created_at`,
    values
  );
  const user = result.rows[0] as User | undefined;
  if (!user) return null;

  // Sync phone and avatar_url to the linked members record
  if (user.member_id && (data.phone !== undefined || data.avatar_url !== undefined)) {
    const memberFields: string[] = [];
    const memberValues: unknown[] = [];
    let mIdx = 1;

    if (data.phone !== undefined) {
      memberFields.push(`phone = $${mIdx++}`);
      memberValues.push(data.phone);
    }
    if (data.avatar_url !== undefined) {
      memberFields.push(`photo_url = $${mIdx++}`);
      memberValues.push(data.avatar_url);
    }

    if (memberFields.length > 0) {
      memberValues.push(user.member_id);
      await query(
        `UPDATE members SET ${memberFields.join(", ")} WHERE id = $${mIdx}`,
        memberValues
      );
    }
  }

  return user;
}

export async function listUsers(params: {
  page?: number;
  per_page?: number;
  role?: string;
  roles?: string[];
  search?: string;
}) {
  const page = params.page || 1;
  const perPage = params.per_page || 20;
  const offset = (page - 1) * perPage;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.roles && params.roles.length > 0) {
    conditions.push(`role = ANY($${idx++})`);
    values.push(params.roles);
  } else if (params.role) {
    conditions.push(`role = $${idx++}`);
    values.push(params.role);
  }
  if (params.search) {
    conditions.push(
      `(email ILIKE $${idx} OR first_name ILIKE $${idx} OR last_name ILIKE $${idx})`
    );
    values.push(`%${params.search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query(
    `SELECT COUNT(*) FROM users ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataValues = [...values, perPage, offset];
  const result = await query(
    `SELECT id, email, first_name, last_name, avatar_url, phone,
            role, member_id, is_verified, created_at
     FROM users ${where}
     ORDER BY created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    dataValues
  );

  return {
    data: result.rows,
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  };
}

/** Invalidate all sessions for a single user */
export async function invalidateUserSessions(userId: string): Promise<void> {
  await query(
    "UPDATE users SET tokens_invalidated_at = NOW() WHERE id = $1",
    [userId]
  );
}

/** Invalidate all sessions for ALL users (admin action) */
export async function invalidateAllSessions(): Promise<number> {
  const result = await query(
    "UPDATE users SET tokens_invalidated_at = NOW()"
  );
  return result.rowCount ?? 0;
}

export async function promoteToMember(
  userId: string,
  data?: { position?: string; hourly_rate?: number }
): Promise<User> {
  return transaction(async (client) => {
    // 1. Fetch and validate user
    const userResult = await client.query(
      `SELECT id, email, first_name, last_name, phone, role, is_verified
       FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );
    const user = userResult.rows[0];
    if (!user) throw new Error("User not found");
    if (!user.is_verified) throw new Error("User is not verified");
    if (user.role !== "client") throw new Error("User is not a client");

    // 2. Create member record
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
    const memberResult = await client.query(
      `INSERT INTO members (name, email, phone, position, hourly_rate)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [name, user.email, user.phone, data?.position || null, data?.hourly_rate || null]
    );
    const memberId = memberResult.rows[0].id;

    // 3. Update user role and link member
    const updated = await client.query(
      `UPDATE users SET role = 'member', member_id = $1
       WHERE id = $2
       RETURNING id, email, first_name, last_name, avatar_url, phone,
                 role, member_id, is_verified, created_at`,
      [memberId, userId]
    );

    return updated.rows[0] as User;
  });
}
