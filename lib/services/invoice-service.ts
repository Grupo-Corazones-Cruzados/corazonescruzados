import { query, transaction } from "@/lib/db";
import type { Invoice, InvoiceItem } from "@/lib/types";

// ----- List / Get -----

export async function listInvoices(params: {
  page?: number;
  per_page?: number;
  status?: string;
  client_id?: number;
  search?: string;
}) {
  const page = params.page || 1;
  const perPage = params.per_page || 20;
  const offset = (page - 1) * perPage;

  const conds: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (params.status) {
    conds.push(`i.status = $${idx++}`);
    vals.push(params.status);
  }
  if (params.client_id) {
    conds.push(`i.client_id = $${idx++}`);
    vals.push(params.client_id);
  }
  if (params.search) {
    conds.push(`(i.invoice_number ILIKE $${idx} OR c.name ILIKE $${idx})`);
    vals.push(`%${params.search}%`);
    idx++;
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";

  const countRes = await query(
    `SELECT COUNT(*) FROM invoices i LEFT JOIN clients c ON c.id = i.client_id ${where}`,
    vals
  );
  const total = parseInt(countRes.rows[0].count, 10);

  const dataVals = [...vals, perPage, offset];
  const result = await query(
    `SELECT i.*,
            c.name AS client_name, c.email AS client_email,
            m.name AS member_name
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id
     LEFT JOIN members m ON m.id = i.member_id
     ${where}
     ORDER BY i.created_at DESC
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

export async function getInvoiceById(id: number) {
  const result = await query(
    `SELECT i.*,
            c.name AS client_name, c.email AS client_email,
            c.company AS client_company, c.phone AS client_phone,
            m.name AS member_name
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id
     LEFT JOIN members m ON m.id = i.member_id
     WHERE i.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getInvoiceItems(invoiceId: number): Promise<InvoiceItem[]> {
  const result = await query(
    "SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id",
    [invoiceId]
  );
  return result.rows;
}

// ----- Create -----

export async function createInvoice(data: {
  client_id: number;
  member_id?: number;
  ticket_id?: number;
  project_id?: number;
  notes?: string;
  tax?: number;
  items: { description: string; quantity: number; unit_price: number }[];
}) {
  return transaction(async (client) => {
    // Calculate subtotal
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    const tax = data.tax ?? 0;

    // Create invoice
    const invRes = await client.query(
      `INSERT INTO invoices
         (client_id, member_id, ticket_id, project_id, subtotal, tax, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        data.client_id,
        data.member_id || null,
        data.ticket_id || null,
        data.project_id || null,
        subtotal,
        tax,
        data.notes || null,
      ]
    );
    const invoice = invRes.rows[0];

    // Create items
    for (const item of data.items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price)
         VALUES ($1,$2,$3,$4)`,
        [invoice.id, item.description, item.quantity, item.unit_price]
      );
    }

    return invoice;
  });
}

// ----- Update -----

export async function updateInvoice(
  id: number,
  data: Partial<{
    status: string;
    notes: string;
    pdf_url: string;
    tax: number;
    subtotal: number;
  }>
): Promise<Invoice | null> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      vals.push(value);
    }
  }

  // Auto-set sent_at / paid_at
  if (data.status === "sent") {
    fields.push(`sent_at = NOW()`);
  } else if (data.status === "paid") {
    fields.push(`paid_at = NOW()`);
  }

  if (fields.length === 0) return getInvoiceById(id);

  vals.push(id);
  const result = await query(
    `UPDATE invoices SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

// ----- Invoice Items -----

export async function addInvoiceItem(data: {
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
}): Promise<InvoiceItem> {
  const result = await query(
    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [data.invoice_id, data.description, data.quantity, data.unit_price]
  );
  // Recalculate subtotal
  await recalcSubtotal(data.invoice_id);
  return result.rows[0];
}

export async function deleteInvoiceItem(id: number, invoiceId: number): Promise<boolean> {
  const result = await query("DELETE FROM invoice_items WHERE id = $1", [id]);
  await recalcSubtotal(invoiceId);
  return (result.rowCount ?? 0) > 0;
}

async function recalcSubtotal(invoiceId: number) {
  await query(
    `UPDATE invoices SET subtotal = COALESCE(
       (SELECT SUM(quantity * unit_price) FROM invoice_items WHERE invoice_id = $1), 0
     ) WHERE id = $1`,
    [invoiceId]
  );
}

// ----- Delete -----

export async function deleteInvoice(id: number): Promise<boolean> {
  const result = await query("DELETE FROM invoices WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
