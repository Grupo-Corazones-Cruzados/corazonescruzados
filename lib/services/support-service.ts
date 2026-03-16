import { query } from "@/lib/db";

// ----- Types -----

export interface SupportTicket {
  id: number;
  user_id: string;
  type: string;
  subject: string;
  message: string;
  status: string;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  reply_count?: number;
}

export interface SupportReply {
  id: number;
  ticket_id: number;
  user_id: string;
  message: string;
  attachment_url: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
}

// ----- List -----

export async function listSupportTickets(params: {
  user_id?: string;
  status?: string;
  page?: number;
  per_page?: number;
}) {
  const page = params.page || 1;
  const perPage = params.per_page || 20;
  const offset = (page - 1) * perPage;

  const conds: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (params.user_id) {
    conds.push(`st.user_id = $${idx++}`);
    vals.push(params.user_id);
  }
  if (params.status) {
    conds.push(`st.status = $${idx++}`);
    vals.push(params.status);
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";

  const countRes = await query(`SELECT COUNT(*) FROM support_tickets st ${where}`, vals);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataVals = [...vals, perPage, offset];
  const result = await query(
    `SELECT st.*,
            COALESCE(u.first_name || ' ' || u.last_name, u.email) AS user_name,
            u.email AS user_email,
            u.role AS user_role,
            (SELECT COUNT(*) FROM support_replies sr WHERE sr.ticket_id = st.id)::int AS reply_count
     FROM support_tickets st
     JOIN users u ON u.id = st.user_id
     ${where}
     ORDER BY st.updated_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    dataVals
  );

  return {
    data: result.rows as SupportTicket[],
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  };
}

// ----- Get -----

export async function getSupportTicket(id: number): Promise<SupportTicket | null> {
  const result = await query(
    `SELECT st.*,
            COALESCE(u.first_name || ' ' || u.last_name, u.email) AS user_name,
            u.email AS user_email,
            u.role AS user_role
     FROM support_tickets st
     JOIN users u ON u.id = st.user_id
     WHERE st.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

// ----- Create -----

export async function createSupportTicket(data: {
  user_id: string;
  type: string;
  subject: string;
  message: string;
  attachment_url?: string;
}): Promise<SupportTicket> {
  const result = await query(
    `INSERT INTO support_tickets (user_id, type, subject, message, attachment_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.user_id, data.type, data.subject, data.message, data.attachment_url || null]
  );
  return result.rows[0];
}

// ----- Update status -----

export async function updateTicketStatus(
  id: number,
  status: string
): Promise<SupportTicket | null> {
  const result = await query(
    `UPDATE support_tickets SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0] || null;
}

// ----- Replies -----

export async function getTicketReplies(ticketId: number): Promise<SupportReply[]> {
  const result = await query(
    `SELECT sr.*,
            COALESCE(u.first_name || ' ' || u.last_name, u.email) AS user_name,
            u.email AS user_email,
            u.role AS user_role
     FROM support_replies sr
     JOIN users u ON u.id = sr.user_id
     WHERE sr.ticket_id = $1
     ORDER BY sr.created_at ASC`,
    [ticketId]
  );
  return result.rows;
}

export async function createReply(data: {
  ticket_id: number;
  user_id: string;
  message: string;
  attachment_url?: string;
}): Promise<SupportReply> {
  const result = await query(
    `INSERT INTO support_replies (ticket_id, user_id, message, attachment_url)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.ticket_id, data.user_id, data.message, data.attachment_url || null]
  );
  // Touch ticket updated_at
  await query("UPDATE support_tickets SET updated_at = NOW() WHERE id = $1", [data.ticket_id]);
  return result.rows[0];
}
