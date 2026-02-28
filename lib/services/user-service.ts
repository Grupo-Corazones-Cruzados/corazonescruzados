import { query } from "@/lib/db";
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
  return result.rows[0] || null;
}

export async function listUsers(params: {
  page?: number;
  per_page?: number;
  role?: string;
  search?: string;
}) {
  const page = params.page || 1;
  const perPage = params.per_page || 20;
  const offset = (page - 1) * perPage;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.role) {
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
