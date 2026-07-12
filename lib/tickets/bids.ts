// Propuestas de tickets abiertos (análogo a project_bids). Un ticket con
// open_for_proposals=true recibe propuestas de miembros/candidatos; el creador acepta una,
// que asigna el miembro y cierra el ticket a propuestas.
import { pool } from '@/lib/db';

let ready = false;

export async function ensureTicketBidsTable(): Promise<void> {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.ticket_bids (
      id SERIAL PRIMARY KEY,
      ticket_id INT NOT NULL,
      member_id INT NOT NULL,
      proposal TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'accepted' | 'rejected'
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (ticket_id, member_id)
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ticket_bids_ticket_idx ON gcc_world.ticket_bids(ticket_id)`);
  ready = true;
}

export async function listTicketBids(ticketId: number) {
  await ensureTicketBidsTable();
  const { rows } = await pool.query(
    `SELECT b.id, b.member_id, b.proposal, b.status, b.created_at, m.name AS member_name
       FROM gcc_world.ticket_bids b
       LEFT JOIN gcc_world.members m ON m.id = b.member_id
      WHERE b.ticket_id = $1 ORDER BY b.created_at ASC`,
    [ticketId],
  );
  return rows;
}

export async function createTicketBid(ticketId: number, memberId: number, proposal: string) {
  await ensureTicketBidsTable();
  // Guard: el ticket debe estar abierto a propuestas.
  const { rows: [t] } = await pool.query(`SELECT open_for_proposals, member_id FROM gcc_world.tickets WHERE id = $1`, [ticketId]);
  if (!t) throw new Error('Ticket inexistente.');
  if (!t.open_for_proposals || t.member_id) throw new Error('Este ticket ya no está abierto a propuestas.');
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.ticket_bids (ticket_id, member_id, proposal) VALUES ($1, $2, $3)
     ON CONFLICT (ticket_id, member_id) DO UPDATE SET proposal = EXCLUDED.proposal, status = 'pending', created_at = NOW()
     RETURNING *`,
    [ticketId, memberId, (proposal || '').trim()],
  );
  return rows[0];
}

/** Acepta una propuesta: asigna el miembro al ticket, cierra a propuestas, marca las demás rechazadas. */
export async function acceptTicketBid(ticketId: number, bidId: number) {
  await ensureTicketBidsTable();
  const { rows: [bid] } = await pool.query(`SELECT member_id FROM gcc_world.ticket_bids WHERE id = $1 AND ticket_id = $2`, [bidId, ticketId]);
  if (!bid) throw new Error('Propuesta no encontrada.');
  await pool.query(
    `UPDATE gcc_world.ticket_bids SET status = CASE WHEN id = $1 THEN 'accepted' ELSE 'rejected' END WHERE ticket_id = $2`,
    [bidId, ticketId],
  );
  await pool.query(`UPDATE gcc_world.tickets SET member_id = $1, open_for_proposals = false, updated_at = NOW() WHERE id = $2`, [bid.member_id, ticketId]);
  return { member_id: bid.member_id };
}

export async function deleteTicketBid(ticketId: number, memberId: number) {
  await ensureTicketBidsTable();
  await pool.query(`DELETE FROM gcc_world.ticket_bids WHERE ticket_id = $1 AND member_id = $2`, [ticketId, memberId]);
}

/** Talentos activos del miembro (de sus servicios). */
export async function memberTalents(memberId: number): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT talent FROM gcc_world.services WHERE member_id = $1 AND is_active = true AND talent IS NOT NULL`,
    [memberId],
  );
  return rows.map((r: any) => r.talent);
}

/** Toma INMEDIATA de un ticket "abierto por talento": el miembro con ≥1 talento requerido
 *  queda asignado sin pasar por selección del creador. Devuelve el member_id + info del ticket. */
export async function takeTicketByTalent(ticketId: number, userId: string) {
  const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId]);
  const memberId = u?.member_id;
  if (!memberId) throw new Error('Solo miembros pueden tomar este ticket.');
  const { rows: [t] } = await pool.query(`SELECT open_for_talent, member_id, required_talents, user_id, title FROM gcc_world.tickets WHERE id = $1`, [ticketId]);
  if (!t) throw new Error('Ticket inexistente.');
  if (!t.open_for_talent || t.member_id) throw new Error('Este ticket ya no está disponible para tomar.');
  const mine = await memberTalents(memberId);
  const required: string[] = t.required_talents || [];
  if (!required.some((r) => mine.includes(r))) {
    throw new Error('Necesitas al menos uno de los talentos requeridos para tomar este ticket.');
  }
  await pool.query(`UPDATE gcc_world.tickets SET member_id = $1, open_for_talent = false, updated_at = NOW() WHERE id = $2`, [memberId, ticketId]);
  return { member_id: memberId, creator_user_id: t.user_id, title: t.title };
}
