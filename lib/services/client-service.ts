import { query } from "@/lib/db";
import type { Client } from "@/lib/types";

export async function listClients(params: {
  page?: number;
  per_page?: number;
  search?: string;
}) {
  const page = params.page || 1;
  const perPage = params.per_page || 20;
  const offset = (page - 1) * perPage;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.search) {
    conditions.push(
      `(name ILIKE $${idx} OR email ILIKE $${idx} OR company ILIKE $${idx})`
    );
    values.push(`%${params.search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query(`SELECT COUNT(*) FROM clients ${where}`, values);
  const total = parseInt(countResult.rows[0].count, 10);

  const dataValues = [...values, perPage, offset];
  const result = await query(
    `SELECT * FROM clients ${where}
     ORDER BY name ASC
     LIMIT $${idx++} OFFSET $${idx}`,
    dataValues
  );

  return {
    data: result.rows as Client[],
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  };
}

export async function getClientById(id: number): Promise<Client | null> {
  const result = await query("SELECT * FROM clients WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function createClient(data: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
}): Promise<Client> {
  const result = await query(
    `INSERT INTO clients (name, email, phone, company)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.name, data.email, data.phone, data.company]
  );
  return result.rows[0];
}

export async function updateClient(
  id: number,
  data: Partial<{ name: string; email: string; phone: string; company: string }>
): Promise<Client | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getClientById(id);

  values.push(id);
  const result = await query(
    `UPDATE clients SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function deleteClient(id: number): Promise<boolean> {
  const result = await query("DELETE FROM clients WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
