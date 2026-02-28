import { query } from "@/lib/db";
import type { Applicant, RecruitmentEvent } from "@/lib/types";

// ----- Applicants -----

export async function listApplicants(params: {
  page?: number;
  per_page?: number;
  status?: string;
  search?: string;
}) {
  const page = params.page || 1;
  const perPage = params.per_page || 20;
  const offset = (page - 1) * perPage;

  const conds: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (params.status) {
    conds.push(`status = $${idx++}`);
    vals.push(params.status);
  }
  if (params.search) {
    conds.push(
      `(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx})`
    );
    vals.push(`%${params.search}%`);
    idx++;
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";

  const countRes = await query(`SELECT COUNT(*) FROM applicants ${where}`, vals);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataVals = [...vals, perPage, offset];
  const result = await query(
    `SELECT * FROM applicants ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
    dataVals
  );

  return {
    data: result.rows,
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  };
}

export async function getApplicantById(id: number) {
  const result = await query("SELECT * FROM applicants WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function createApplicant(data: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  resume_url?: string;
  source?: string;
  notes?: string;
}): Promise<Applicant> {
  const result = await query(
    `INSERT INTO applicants (first_name, last_name, email, phone, resume_url, source, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      data.first_name,
      data.last_name,
      data.email,
      data.phone || null,
      data.resume_url || null,
      data.source || null,
      data.notes || null,
    ]
  );
  return result.rows[0];
}

export async function updateApplicant(
  id: number,
  data: Partial<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    resume_url: string;
    status: string;
    notes: string;
    source: string;
  }>
): Promise<Applicant | null> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      vals.push(value);
    }
  }
  if (fields.length === 0) return getApplicantById(id);

  vals.push(id);
  const result = await query(
    `UPDATE applicants SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

// ----- Events -----

export async function listEvents(params: { type?: string } = {}) {
  const conds: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (params.type) {
    conds.push(`type = $${idx++}`);
    vals.push(params.type);
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  const result = await query(
    `SELECT * FROM recruitment_events ${where} ORDER BY event_date DESC`,
    vals
  );
  return result.rows;
}

export async function createEvent(data: {
  title: string;
  description?: string;
  event_date: string;
  location?: string;
  type: string;
  max_capacity?: number;
  created_by?: string;
}): Promise<RecruitmentEvent> {
  const result = await query(
    `INSERT INTO recruitment_events (title, description, event_date, location, type, max_capacity, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      data.title,
      data.description || null,
      data.event_date,
      data.location || null,
      data.type,
      data.max_capacity ?? null,
      data.created_by || null,
    ]
  );
  return result.rows[0];
}

// ----- Event Invitations -----

export async function getEventInvitations(eventId: number) {
  const result = await query(
    `SELECT ei.*, a.first_name, a.last_name, a.email
     FROM event_invitations ei
     JOIN applicants a ON a.id = ei.applicant_id
     WHERE ei.event_id = $1
     ORDER BY a.last_name, a.first_name`,
    [eventId]
  );
  return result.rows;
}

export async function createInvitation(eventId: number, applicantId: number) {
  const result = await query(
    `INSERT INTO event_invitations (event_id, applicant_id)
     VALUES ($1,$2)
     ON CONFLICT (event_id, applicant_id) DO NOTHING
     RETURNING *`,
    [eventId, applicantId]
  );
  return result.rows[0];
}

export async function updateInvitationStatus(id: number, status: string) {
  const result = await query(
    "UPDATE event_invitations SET status = $1 WHERE id = $2 RETURNING *",
    [status, id]
  );
  return result.rows[0] || null;
}

// ----- Event Scores -----

export async function getEventScores(eventId: number) {
  const result = await query(
    `SELECT es.*, a.first_name, a.last_name, u.email AS evaluator_email
     FROM event_scores es
     JOIN applicants a ON a.id = es.applicant_id
     JOIN users u ON u.id = es.evaluator_id
     WHERE es.event_id = $1
     ORDER BY es.score DESC`,
    [eventId]
  );
  return result.rows;
}

export async function createScore(data: {
  event_id: number;
  applicant_id: number;
  evaluator_id: string;
  score: number;
  comments?: string;
}) {
  const result = await query(
    `INSERT INTO event_scores (event_id, applicant_id, evaluator_id, score, comments)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (event_id, applicant_id, evaluator_id) DO UPDATE
     SET score = $4, comments = $5
     RETURNING *`,
    [data.event_id, data.applicant_id, data.evaluator_id, data.score, data.comments || null]
  );
  return result.rows[0];
}
