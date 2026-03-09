import { query, transaction } from "@/lib/db";
import type { Ticket, TicketTimeSlot, TicketService } from "@/lib/types";

// ----- List / Get -----

export async function listTickets(params: {
  page?: number;
  per_page?: number;
  status?: string;
  user_id?: string;
  member_id?: number;
  search?: string;
}) {
  const page = params.page || 1;
  const perPage = params.per_page || 20;
  const offset = (page - 1) * perPage;

  const conds: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (params.status) {
    conds.push(`t.status = $${idx++}`);
    vals.push(params.status);
  }
  if (params.user_id) {
    conds.push(`t.user_id = $${idx++}`);
    vals.push(params.user_id);
  }
  if (params.member_id) {
    conds.push(`t.member_id = $${idx++}`);
    vals.push(params.member_id);
  }
  if (params.search) {
    conds.push(`(t.title ILIKE $${idx} OR t.description ILIKE $${idx})`);
    vals.push(`%${params.search}%`);
    idx++;
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";

  const countRes = await query(`SELECT COUNT(*) FROM tickets t ${where}`, vals);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataVals = [...vals, perPage, offset];
  const result = await query(
    `SELECT t.*,
            COALESCE(u.first_name || ' ' || u.last_name, u.email) AS client_name,
            m.name  AS member_name,
            s.name  AS service_name
     FROM tickets t
     LEFT JOIN users    u ON u.id = t.user_id
     LEFT JOIN members  m ON m.id = t.member_id
     LEFT JOIN services s ON s.id = t.service_id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
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

export async function getTicketById(id: number) {
  const result = await query(
    `SELECT t.*,
            COALESCE(u.first_name || ' ' || u.last_name, u.email) AS client_name,
            u.email AS client_email,
            m.name  AS member_name,  m.email AS member_email,
            s.name  AS service_name
     FROM tickets t
     LEFT JOIN users    u ON u.id = t.user_id
     LEFT JOIN members  m ON m.id = t.member_id
     LEFT JOIN services s ON s.id = t.service_id
     WHERE t.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

// ----- Create -----

export async function createTicket(data: {
  user_id: string;
  service_id?: number;
  member_id?: number;
  title: string;
  description?: string;
  scheduled_at?: string;
  estimated_hours?: number;
  estimated_cost?: number;
}): Promise<Ticket> {
  const result = await query(
    `INSERT INTO tickets
       (user_id, service_id, member_id, title, description,
        scheduled_at, estimated_hours, estimated_cost)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      data.user_id,
      data.service_id || null,
      data.member_id || null,
      data.title,
      data.description || null,
      data.scheduled_at || null,
      data.estimated_hours || null,
      data.estimated_cost || null,
    ]
  );
  return result.rows[0];
}

// ----- Update -----

export async function updateTicket(
  id: number,
  data: Partial<{
    service_id: number;
    member_id: number;
    title: string;
    description: string;
    status: string;
    scheduled_at: string;
    estimated_hours: number;
    actual_hours: number;
    estimated_cost: number;
    actual_cost: number;
    google_event_id: string;
    google_meet_link: string;
  }>
): Promise<Ticket | null> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      vals.push(value);
    }
  }

  if (fields.length === 0) return getTicketById(id);

  // Auto-set completed_at when status changes to completed
  if (data.status === "completed") {
    fields.push(`completed_at = NOW()`);
  }

  vals.push(id);
  const result = await query(
    `UPDATE tickets SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

// ----- Delete -----

export async function deleteTicket(id: number): Promise<boolean> {
  const result = await query("DELETE FROM tickets WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

// ----- Time Slots -----

export async function getTicketSlots(ticketId: number): Promise<TicketTimeSlot[]> {
  const result = await query(
    "SELECT * FROM ticket_time_slots WHERE ticket_id = $1 ORDER BY date, start_time",
    [ticketId]
  );
  return result.rows;
}

export async function addTicketSlot(data: {
  ticket_id: number;
  date: string;
  start_time: string;
  end_time: string;
}): Promise<TicketTimeSlot> {
  const result = await query(
    `INSERT INTO ticket_time_slots (ticket_id, date, start_time, end_time)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [data.ticket_id, data.date, data.start_time, data.end_time]
  );
  return result.rows[0];
}

export async function updateTicketSlot(
  id: number,
  data: Partial<{
    status: string;
    actual_duration: number;
    notes: string;
  }>
): Promise<TicketTimeSlot | null> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      vals.push(value);
    }
  }
  if (fields.length === 0) return null;

  vals.push(id);
  const result = await query(
    `UPDATE ticket_time_slots SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

export async function deleteTicketSlot(id: number): Promise<boolean> {
  const result = await query("DELETE FROM ticket_time_slots WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

// ----- Ticket Services (line items) -----

export async function getTicketServices(ticketId: number): Promise<TicketService[]> {
  const result = await query(
    `SELECT ts.*, s.name AS service_name
     FROM ticket_services ts
     LEFT JOIN services s ON s.id = ts.service_id
     WHERE ts.ticket_id = $1
     ORDER BY ts.id`,
    [ticketId]
  );
  return result.rows;
}

export async function addTicketService(data: {
  ticket_id: number;
  service_id?: number;
  assigned_hours: number;
  hourly_cost: number;
}): Promise<TicketService> {
  const result = await query(
    `INSERT INTO ticket_services (ticket_id, service_id, assigned_hours, hourly_cost)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [data.ticket_id, data.service_id || null, data.assigned_hours, data.hourly_cost]
  );
  return result.rows[0];
}

export async function deleteTicketService(id: number): Promise<boolean> {
  const result = await query("DELETE FROM ticket_services WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

// ----- Calendar view helper -----

export async function getTicketsForCalendar(params: {
  from: string;
  to: string;
  member_id?: number;
}) {
  const conds = ["tts.date >= $1", "tts.date <= $2"];
  const vals: unknown[] = [params.from, params.to];
  let idx = 3;

  if (params.member_id) {
    conds.push(`t.member_id = $${idx++}`);
    vals.push(params.member_id);
  }

  const result = await query(
    `SELECT tts.*, t.title AS ticket_title, t.status AS ticket_status,
            COALESCE(u.first_name || ' ' || u.last_name, u.email) AS client_name,
            m.name AS member_name
     FROM ticket_time_slots tts
     JOIN tickets t ON t.id = tts.ticket_id
     LEFT JOIN users   u ON u.id = t.user_id
     LEFT JOIN members m ON m.id = t.member_id
     WHERE ${conds.join(" AND ")}
     ORDER BY tts.date, tts.start_time`,
    vals
  );
  return result.rows;
}
