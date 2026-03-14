import { query } from "@/lib/db";

/**
 * Upsert a client-member association (idempotent via ON CONFLICT DO NOTHING).
 */
export async function ensureClientMemberAssociation(data: {
  client_id: number;
  member_id: number;
  source?: string;
}): Promise<void> {
  await query(
    `INSERT INTO client_members (client_id, member_id, source)
     VALUES ($1, $2, $3)
     ON CONFLICT (client_id, member_id) DO NOTHING`,
    [data.client_id, data.member_id, data.source || "manual"]
  );
}

/**
 * Get all clients associated with a member.
 */
export async function getClientsForMember(memberId: number) {
  const result = await query(
    `SELECT c.id, c.name, c.email, c.phone
     FROM clients c
     JOIN client_members cm ON cm.client_id = c.id
     WHERE cm.member_id = $1
     ORDER BY c.name`,
    [memberId]
  );
  return result.rows;
}

/**
 * Find a client by email, or create a placeholder record.
 * Returns the client and whether it was newly created.
 */
export async function findOrCreateClientByEmail(
  email: string,
  name?: string
): Promise<{ client: { id: number; name: string; email: string }; isNew: boolean }> {
  const existing = await query(
    "SELECT id, name, email FROM clients WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [email]
  );
  if (existing.rows[0]) return { client: existing.rows[0], isNew: false };

  const result = await query(
    `INSERT INTO clients (name, email) VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, name, email`,
    [name || email, email]
  );

  // Handle race condition: if ON CONFLICT fired, re-fetch
  if (!result.rows[0]) {
    const fallback = await query(
      "SELECT id, name, email FROM clients WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );
    return { client: fallback.rows[0], isNew: false };
  }

  return { client: result.rows[0], isNew: true };
}
