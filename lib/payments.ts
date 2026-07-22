import { pool } from '@/lib/db';

export type PaymentInvoice = {
  id: number;
  invoice_number: string | null;
  total: number;
  status: string | null;
  sri_status: string | null;
  created_at: string;
};

export type PaymentsSummary = {
  total: number;        // total a cobrar del ticket/proyecto
  invoiced: number;     // suma facturada (facturas no anuladas)
  pending: number;      // saldo por cobrar = max(0, total - invoiced)
  invoices: PaymentInvoice[];
};

function summarize(total: number, rows: any[]): PaymentsSummary {
  const invoices: PaymentInvoice[] = rows.map((r) => ({
    id: Number(r.id),
    invoice_number: r.invoice_number ?? null,
    total: Number(r.total) || 0,
    status: r.status ?? null,
    sri_status: r.sri_status ?? null,
    created_at: r.created_at,
  }));
  const invoiced = invoices
    .filter((i) => i.status !== 'cancelled')
    .reduce((s, i) => s + i.total, 0);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    total: round2(total),
    invoiced: round2(invoiced),
    pending: round2(Math.max(0, total - invoiced)),
    invoices,
  };
}

/** Resumen de pagos de un TICKET: total = estimated_cost; facturas ligadas por source_type/ticket_id. */
export async function getTicketPayments(ticketId: string | number): Promise<PaymentsSummary> {
  const idStr = String(ticketId);
  const { rows: [t] } = await pool.query(
    `SELECT estimated_cost FROM gcc_world.tickets WHERE id = $1`, [ticketId],
  );
  const total = Number(t?.estimated_cost) || 0;
  const { rows } = await pool.query(
    `SELECT id, invoice_number, total, status, sri_status, created_at
       FROM gcc_world.invoices
      WHERE (source_type = 'ticket' AND source_id = $1) OR ticket_id = ($1)::int
      ORDER BY created_at`,
    [idStr],
  );
  return summarize(total, rows);
}

/** Resumen de pagos de un PROYECTO: total = final_cost; facturas por project_id o invoice_projects. */
export async function getProjectPayments(projectId: string | number): Promise<PaymentsSummary> {
  const idStr = String(projectId);
  const { rows: [p] } = await pool.query(
    `SELECT final_cost FROM gcc_world.projects WHERE id = $1`, [projectId],
  );
  const total = Number(p?.final_cost) || 0;
  const { rows } = await pool.query(
    `SELECT id, invoice_number, total, status, sri_status, created_at
       FROM gcc_world.invoices
      WHERE project_id = ($1)::int
         OR id IN (SELECT invoice_id FROM gcc_world.invoice_projects WHERE project_id = ($1)::int)
      ORDER BY created_at`,
    [idStr],
  ).catch(async () => {
    // invoice_projects puede no existir en algunos entornos → sólo por project_id.
    return pool.query(
      `SELECT id, invoice_number, total, status, sri_status, created_at
         FROM gcc_world.invoices WHERE project_id = ($1)::int ORDER BY created_at`,
      [idStr],
    );
  });
  return summarize(total, rows);
}
