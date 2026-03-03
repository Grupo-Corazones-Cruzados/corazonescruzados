import { query } from "@/lib/db";
import type { Member, MemberSchedule, ScheduleException, PublicMember } from "@/lib/types";

export async function listMembers(params: {
  page?: number;
  per_page?: number;
  active_only?: boolean;
  search?: string;
}) {
  const page = params.page || 1;
  const perPage = params.per_page || 20;
  const offset = (page - 1) * perPage;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.active_only !== false) {
    conditions.push(`is_active = true`);
  }
  if (params.search) {
    conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx})`);
    values.push(`%${params.search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query(`SELECT COUNT(*) FROM members ${where}`, values);
  const total = parseInt(countResult.rows[0].count, 10);

  const dataValues = [...values, perPage, offset];
  const result = await query(
    `SELECT * FROM members ${where}
     ORDER BY name ASC
     LIMIT $${idx++} OFFSET $${idx}`,
    dataValues
  );

  return {
    data: result.rows as Member[],
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  };
}

export async function getMemberById(id: number): Promise<Member | null> {
  const result = await query("SELECT * FROM members WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function createMember(data: {
  name: string;
  email?: string;
  phone?: string;
  photo_url?: string;
  position?: string;
  hourly_rate?: number;
}): Promise<Member> {
  const result = await query(
    `INSERT INTO members (name, email, phone, photo_url, position, hourly_rate)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.name, data.email, data.phone, data.photo_url, data.position, data.hourly_rate]
  );
  return result.rows[0];
}

export async function updateMember(
  id: number,
  data: Partial<{
    name: string;
    email: string;
    phone: string;
    photo_url: string;
    position: string;
    hourly_rate: number;
    is_active: boolean;
  }>
): Promise<Member | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getMemberById(id);

  values.push(id);
  const result = await query(
    `UPDATE members SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

// --- Public gallery ---

export async function listPublicMembers(): Promise<PublicMember[]> {
  const result = await query(
    `SELECT m.id, m.name, m.photo_url, m.position, m.hourly_rate, m.phone,
            cv.bio, cv.skills
     FROM members m
     LEFT JOIN member_cv_profiles cv ON cv.member_id = m.id
     WHERE m.is_active = true AND m.phone IS NOT NULL AND m.phone != ''
     ORDER BY m.name ASC`
  );
  return result.rows.map((r) => ({
    ...r,
    skills: r.skills || [],
  }));
}

// --- Schedules ---

export async function getMemberSchedules(memberId: number): Promise<MemberSchedule[]> {
  const result = await query(
    "SELECT * FROM member_schedules WHERE member_id = $1 ORDER BY day_of_week, start_time",
    [memberId]
  );
  return result.rows;
}

export async function setMemberSchedules(
  memberId: number,
  schedules: { day_of_week: number; start_time: string; end_time: string; is_active: boolean }[]
): Promise<MemberSchedule[]> {
  await query("DELETE FROM member_schedules WHERE member_id = $1", [memberId]);

  if (schedules.length === 0) return [];

  const placeholders: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const s of schedules) {
    placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    values.push(memberId, s.day_of_week, s.start_time, s.end_time, s.is_active);
  }

  const result = await query(
    `INSERT INTO member_schedules (member_id, day_of_week, start_time, end_time, is_active)
     VALUES ${placeholders.join(", ")}
     RETURNING *`,
    values
  );
  return result.rows;
}

// --- Schedule Exceptions ---

export async function getScheduleExceptions(
  memberId: number,
  fromDate?: string,
  toDate?: string
): Promise<ScheduleException[]> {
  let sql = "SELECT * FROM schedule_exceptions WHERE member_id = $1";
  const values: unknown[] = [memberId];
  let idx = 2;

  if (fromDate) {
    sql += ` AND date >= $${idx++}`;
    values.push(fromDate);
  }
  if (toDate) {
    sql += ` AND date <= $${idx++}`;
    values.push(toDate);
  }

  sql += " ORDER BY date";
  const result = await query(sql, values);
  return result.rows;
}

export async function createScheduleException(data: {
  member_id: number;
  date: string;
  type: "blocked" | "available";
  reason?: string;
  start_time?: string;
  end_time?: string;
}): Promise<ScheduleException> {
  const result = await query(
    `INSERT INTO schedule_exceptions (member_id, date, type, reason, start_time, end_time)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.member_id, data.date, data.type, data.reason, data.start_time, data.end_time]
  );
  return result.rows[0];
}

export async function deleteScheduleException(id: number, memberId: number): Promise<boolean> {
  const result = await query(
    "DELETE FROM schedule_exceptions WHERE id = $1 AND member_id = $2",
    [id, memberId]
  );
  return (result.rowCount ?? 0) > 0;
}
