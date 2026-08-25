import { pool } from '@/lib/db';

export type PaymentInvoice = {
  id: number;
  invoice_number: string | null;
  total: number;
  /**
   * El recargo de la pasarela incluido en `total`, si la factura salió de un cobro en
   * línea. Es el importe que el cliente pagó de más para cubrir la comisión.
   */
  fee: number;
  status: string | null;
  sri_status: string | null;
  created_at: string;
};

export type PaymentsSummary = {
  total: number;        // total a cobrar del ticket/proyecto
  invoiced: number;     // suma facturada SIN el recargo de la pasarela
  pending: number;      // saldo por cobrar = max(0, total - invoiced)
  fees: number;         // lo que se trasladó al cliente en concepto de comisión
  invoices: PaymentInvoice[];
};

/**
 * ⚠️ EL RECARGO DE LA PASARELA NO ES FACTURACIÓN DEL PROYECTO.
 *
 * Desde el 2026-08-25 el cliente paga la comisión y esta viaja como línea propia de la
 * factura, así que `invoices.total` es mayor que la etapa pactada. Si «facturado» sumara
 * el total a secas, un proyecto de 6.000 $ cobrado por pasarela se daría por facturado
 * con 5.820 $ de trabajo emitido — y «por facturar» llegaría a cero antes de tiempo.
 * Por eso se descuenta: lo facturado del proyecto es lo pactado, no lo que costó cobrarlo.
 */
function summarize(total: number, rows: any[]): PaymentsSummary {
  const invoices: PaymentInvoice[] = rows.map((r) => ({
    id: Number(r.id),
    invoice_number: r.invoice_number ?? null,
    total: Number(r.total) || 0,
    fee: Number(r.fee) || 0,
    status: r.status ?? null,
    sri_status: r.sri_status ?? null,
    created_at: r.created_at,
  }));
  const vigentes = invoices.filter((i) => i.status !== 'cancelled');
  const invoiced = vigentes.reduce((s, i) => s + i.total - i.fee, 0);
  return {
    total: round2(total),
    invoiced: round2(invoiced),
    pending: round2(Math.max(0, total - invoiced)),
    fees: round2(vigentes.reduce((s, i) => s + i.fee, 0)),
    invoices,
  };
}

/**
 * El recargo de la pasarela que lleva una factura dentro. Se lee del cobro que la originó,
 * no se recalcula: la tarifa puede cambiar y la factura ya emitida no.
 */
const FEE_SQL = `COALESCE((
  SELECT pi.fee_amount FROM gcc_world.payment_intents pi WHERE pi.invoice_id = i.id LIMIT 1
), 0)`;

/** Resumen de pagos de un TICKET: total = estimated_cost; facturas ligadas por source_type/ticket_id. */
export async function getTicketPayments(ticketId: string | number): Promise<PaymentsSummary> {
  const idStr = String(ticketId);
  const { rows: [t] } = await pool.query(
    `SELECT estimated_cost FROM gcc_world.tickets WHERE id = $1`, [ticketId],
  );
  const total = Number(t?.estimated_cost) || 0;
  const { rows } = await pool.query(
    `SELECT i.id, i.invoice_number, i.total, ${FEE_SQL} AS fee, i.status, i.sri_status, i.created_at
       FROM gcc_world.invoices i
      WHERE (i.source_type = 'ticket' AND i.source_id = $1) OR i.ticket_id = ($1)::int
      ORDER BY i.created_at`,
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
    `SELECT i.id, i.invoice_number, i.total, ${FEE_SQL} AS fee, i.status, i.sri_status, i.created_at
       FROM gcc_world.invoices i
      WHERE i.project_id = ($1)::int
         OR i.id IN (SELECT invoice_id FROM gcc_world.invoice_projects WHERE project_id = ($1)::int)
      ORDER BY i.created_at`,
    [idStr],
  ).catch(async () => {
    // invoice_projects puede no existir en algunos entornos → sólo por project_id.
    return pool.query(
      `SELECT i.id, i.invoice_number, i.total, ${FEE_SQL} AS fee, i.status, i.sri_status, i.created_at
         FROM gcc_world.invoices i WHERE i.project_id = ($1)::int ORDER BY i.created_at`,
      [idStr],
    );
  });
  return summarize(total, rows);
}

// ─── Facturación por etapas ───────────────────────────────────────────────────
// Un proyecto se factura al cumplirse cada fase, no al cobrar: el hecho generador
// del IVA se verifica con la entrega de cada etapa (LRTI art. 61) y el comprobante
// se emite en ese momento (Rgto. de Comprobantes de Venta, art. 17 lit. e). Por eso
// cada requerimiento —la etapa— se factura UNA sola vez y queda enlazado a su factura.

/**
 * ETAPA del acuerdo con el cliente: un tramo con nombre e importe («50% al empezar»).
 * No es un requerimiento —eso es trabajo interno—; el plan lo define Fernando por
 * proyecto y, si existe, el proyecto se factura por etapas y no por requerimientos.
 */
export type BillingStage = {
  id: number;
  name: string;
  amount: number;
  sortOrder: number;
  invoiceId: number | null;
  invoiceNumber: string | null;
};

/** Requerimiento del proyecto, con su importe facturable (modo por requerimientos). */
export type ProjectStage = {
  id: number;
  title: string;
  description: string | null;
  amount: number;                  // importe facturable de la etapa
  deliveredAt: string | null;      // completed_at del requerimiento
  invoiceId: number | null;        // factura vigente que ya la cubre
  invoiceNumber: string | null;
};

export type ProjectBilling = {
  projectId: number;
  title: string;
  status: string;
  total: number;        // total costeado del proyecto (final_cost)
  stagesTotal: number;  // suma de las etapas
  invoiced: number;     // suma de las etapas ya facturadas
  billable: number;     // suma de las etapas entregadas y aún sin facturar
  /**
   * Facturas vigentes del proyecto que NO declaran etapas: las emitidas antes de
   * que existiera la facturación por fases, que cubrían el proyecto entero. Se
   * avisa en pantalla para no facturar dos veces lo mismo.
   */
  invoicedLegacy: number;
  /** `etapas` si el proyecto tiene plan definido; si no, el detalle por requerimientos. */
  mode: 'etapas' | 'requerimientos';
  /** El plan de etapas acordado con el cliente (vacío si no se definió). */
  etapas: BillingStage[];
  /** Base sobre la que se reparte el plan: el costo del proyecto. */
  baseTotal: number;
  stages: ProjectStage[];
};

/** Crea (idempotente) las tablas de facturación por etapas y de cobros. */
export async function ensureStageBilling() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.invoice_requirements (
      id SERIAL PRIMARY KEY,
      invoice_id INT NOT NULL,
      requirement_id BIGINT NOT NULL,
      project_id BIGINT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_requirements_unique ON gcc_world.invoice_requirements (invoice_id, requirement_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_requirements_req ON gcc_world.invoice_requirements (requirement_id);
    CREATE TABLE IF NOT EXISTS gcc_world.project_stages (
      id BIGSERIAL PRIMARY KEY,
      project_id BIGINT NOT NULL,
      name VARCHAR(200) NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      invoice_id INT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_project_stages_project ON gcc_world.project_stages (project_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_project_stages_invoice ON gcc_world.project_stages (invoice_id);
  `);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Importe facturable de una etapa: la suma de sus asignaciones aceptadas y, si no
 * tiene ninguna, su costo estimado. Es el mismo criterio con el que el emisor arma
 * los ítems de la factura y con el que se sincroniza `projects.final_cost`.
 */
const STAGE_AMOUNT_SQL = `COALESCE(SUM(COALESCE(ra.member_cost, ra.proposed_cost)), r.cost, 0)`;

/**
 * Facturas vigentes del proyecto que no declaran QUÉ facturaron: ni etapas del plan ni
 * requerimientos. Son las emitidas antes de este flujo, y por eso se avisan.
 *
 * Las dos exclusiones importan: sin la de `project_stages`, la factura de una etapa se
 * contaba como «antigua» y el aviso salía justo en el proyecto que mejor lo está haciendo.
 */
const LEGACY_INVOICES_SQL = `
  SELECT COALESCE(SUM(i.total), 0)
    FROM gcc_world.invoices i
   WHERE i.status <> 'cancelled'
     AND (i.project_id = p.id
          OR i.id IN (SELECT ip.invoice_id FROM gcc_world.invoice_projects ip WHERE ip.project_id = p.id::text))
     AND NOT EXISTS (SELECT 1 FROM gcc_world.invoice_requirements ir WHERE ir.invoice_id = i.id)
     AND NOT EXISTS (SELECT 1 FROM gcc_world.project_stages ps WHERE ps.invoice_id = i.id)`;

function toStage(r: any): ProjectStage {
  return {
    id: Number(r.id),
    title: r.title,
    description: r.description ?? null,
    amount: round2(Number(r.amount) || 0),
    deliveredAt: r.completed_at ?? null,
    invoiceId: r.invoice_id != null ? Number(r.invoice_id) : null,
    invoiceNumber: r.invoice_number ?? null,
  };
}

/**
 * Etapas de un proyecto con su importe y su estado de facturación.
 *
 * El importe de la etapa es el mismo que usa el emisor de facturas: la suma de las
 * asignaciones aceptadas del requerimiento y, si no tiene, su costo estimado.
 * Una factura anulada NO cuenta: su etapa vuelve a quedar facturable.
 */
export async function getProjectStages(projectId: string | number): Promise<ProjectStage[]> {
  await ensureStageBilling();
  const { rows } = await pool.query(
    `SELECT r.id, r.title, r.description, r.completed_at,
            ${STAGE_AMOUNT_SQL} AS amount,
            inv.id AS invoice_id, inv.invoice_number
       FROM gcc_world.project_requirements r
       LEFT JOIN gcc_world.requirement_assignments ra
              ON ra.requirement_id = r.id AND ra.status = 'accepted'
       LEFT JOIN LATERAL (
            SELECT i.id, i.invoice_number
              FROM gcc_world.invoice_requirements ir
              JOIN gcc_world.invoices i ON i.id = ir.invoice_id
             WHERE ir.requirement_id = r.id AND i.status <> 'cancelled'
             ORDER BY i.created_at DESC
             LIMIT 1
       ) inv ON true
      WHERE r.project_id = ($1)::bigint
      GROUP BY r.id, r.title, r.description, r.completed_at, r.cost, inv.id, inv.invoice_number
      ORDER BY r.id`,
    [String(projectId)],
  );
  return rows.map(toStage);
}

/**
 * Plan de etapas de un proyecto. Una etapa facturada por una factura ANULADA vuelve a
 * quedar libre, igual que en el resto del módulo.
 */
export async function getProjectEtapas(projectId: string | number): Promise<BillingStage[]> {
  await ensureStageBilling();
  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.amount, e.sort_order, i.id AS invoice_id, i.invoice_number
       FROM gcc_world.project_stages e
       LEFT JOIN gcc_world.invoices i ON i.id = e.invoice_id AND i.status <> 'cancelled'
      WHERE e.project_id = ($1)::bigint
      ORDER BY e.sort_order, e.id`,
    [String(projectId)],
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    name: r.name,
    amount: round2(Number(r.amount) || 0),
    sortOrder: Number(r.sort_order) || 0,
    invoiceId: r.invoice_id != null ? Number(r.invoice_id) : null,
    invoiceNumber: r.invoice_number ?? null,
  }));
}

/** Foto completa de la facturación de un proyecto: etapas, facturado y cobrado. */
export async function getProjectBilling(projectId: string | number): Promise<ProjectBilling | null> {
  await ensureStageBilling();
  const { rows: [p] } = await pool.query(
    `SELECT p.id, p.title, p.status, p.final_cost, (${LEGACY_INVOICES_SQL}) AS legacy
       FROM gcc_world.projects p WHERE p.id = ($1)::bigint`,
    [String(projectId)],
  );
  if (!p) return null;
  const stages = await getProjectStages(projectId);
  const etapas = await getProjectEtapas(projectId);
  return buildBilling(p, stages, etapas);
}

/**
 * Arma la foto de facturación. Si el proyecto tiene PLAN DE ETAPAS, lo facturado y lo
 * pendiente se miden sobre el plan; si no, sobre el detalle de requerimientos.
 */
function buildBilling(p: any, stages: ProjectStage[], etapas: BillingStage[]): ProjectBilling {
  const finalCost = round2(Number(p.final_cost) || 0);
  const requisitosTotal = round2(stages.reduce((s, e) => s + e.amount, 0));
  // Base sobre la que se reparte el plan: el costo del proyecto y, si aún no está
  // sincronizado (pasa mientras no hay asignaciones aceptadas), la suma de sus requerimientos.
  const baseTotal = finalCost > 0 ? finalCost : requisitosTotal;
  const conPlan = etapas.length > 0;
  return {
    projectId: Number(p.id),
    title: p.title,
    status: p.status,
    total: finalCost,
    stagesTotal: conPlan ? round2(etapas.reduce((s, e) => s + e.amount, 0)) : requisitosTotal,
    invoiced: conPlan
      ? round2(etapas.filter(e => e.invoiceId).reduce((s, e) => s + e.amount, 0))
      : round2(stages.filter(e => e.invoiceId).reduce((s, e) => s + e.amount, 0)),
    billable: conPlan
      ? round2(etapas.filter(e => !e.invoiceId).reduce((s, e) => s + e.amount, 0))
      : round2(stages.filter(e => !e.invoiceId).reduce((s, e) => s + e.amount, 0)),
    invoicedLegacy: round2(Number(p.legacy) || 0),
    mode: conPlan ? 'etapas' : 'requerimientos',
    etapas,
    baseTotal,
    stages,
  };
}

/**
 * Proyectos facturables por etapas, con su detalle, para el módulo de facturas.
 *
 * Quedan fuera las cotizaciones (pendientes o rechazadas) y los proyectos cancelados:
 * una cotización todavía no es un trabajo contratado, así que no hay nada que facturar.
 * Del borrador en adelante, sí.
 */
export async function getBillableProjects(): Promise<(ProjectBilling & {
  clientId: number | null; clientName: string | null; clientRuc: string | null;
  clientEmail: string | null; clientPhone: string | null; clientAddress: string | null;
})[]> {
  await ensureStageBilling();
  const { rows: projects } = await pool.query(
    `SELECT p.id, p.title, p.status, p.final_cost, p.client_id,
            c.name AS client_name, c.ruc AS client_ruc, c.email AS client_email,
            c.phone AS client_phone, c.address AS client_address,
            (${LEGACY_INVOICES_SQL}) AS legacy
       FROM gcc_world.projects p
       LEFT JOIN gcc_world.clients c ON c.id = p.client_id
      WHERE p.status NOT IN ('cotizacion', 'cotizacion_rechazada', 'cancelled')
      ORDER BY COALESCE(p.updated_at, p.created_at) DESC, p.id DESC`,
  );
  if (projects.length === 0) return [];

  const ids = projects.map((p: any) => String(p.id));
  const { rows: stageRows } = await pool.query(
    `SELECT r.project_id, r.id, r.title, r.description, r.completed_at,
            ${STAGE_AMOUNT_SQL} AS amount,
            inv.id AS invoice_id, inv.invoice_number
       FROM gcc_world.project_requirements r
       LEFT JOIN gcc_world.requirement_assignments ra
              ON ra.requirement_id = r.id AND ra.status = 'accepted'
       LEFT JOIN LATERAL (
            SELECT i.id, i.invoice_number
              FROM gcc_world.invoice_requirements ir
              JOIN gcc_world.invoices i ON i.id = ir.invoice_id
             WHERE ir.requirement_id = r.id AND i.status <> 'cancelled'
             ORDER BY i.created_at DESC
             LIMIT 1
       ) inv ON true
      WHERE r.project_id = ANY(($1)::bigint[])
      GROUP BY r.project_id, r.id, r.title, r.description, r.completed_at, r.cost, inv.id, inv.invoice_number
      ORDER BY r.id`,
    [ids],
  );
  const { rows: etapaRows } = await pool.query(
    `SELECT e.project_id, e.id, e.name, e.amount, e.sort_order, i.id AS invoice_id, i.invoice_number
       FROM gcc_world.project_stages e
       LEFT JOIN gcc_world.invoices i ON i.id = e.invoice_id AND i.status <> 'cancelled'
      WHERE e.project_id = ANY(($1)::bigint[])
      ORDER BY e.sort_order, e.id`,
    [ids],
  );
  const stagesByProject = new Map<string, ProjectStage[]>();
  for (const row of stageRows) {
    const key = String(row.project_id);
    if (!stagesByProject.has(key)) stagesByProject.set(key, []);
    stagesByProject.get(key)!.push(toStage(row));
  }
  const etapasByProject = new Map<string, BillingStage[]>();
  for (const row of etapaRows) {
    const key = String(row.project_id);
    if (!etapasByProject.has(key)) etapasByProject.set(key, []);
    etapasByProject.get(key)!.push({
      id: Number(row.id),
      name: row.name,
      amount: round2(Number(row.amount) || 0),
      sortOrder: Number(row.sort_order) || 0,
      invoiceId: row.invoice_id != null ? Number(row.invoice_id) : null,
      invoiceNumber: row.invoice_number ?? null,
    });
  }
  return projects.map((p: any) => ({
    ...buildBilling(
      p,
      stagesByProject.get(String(p.id)) || [],
      etapasByProject.get(String(p.id)) || [],
    ),
    clientId: p.client_id != null ? Number(p.client_id) : null,
    clientName: p.client_name ?? null,
    clientRuc: p.client_ruc ?? null,
    clientEmail: p.client_email ?? null,
    clientPhone: p.client_phone ?? null,
    clientAddress: p.client_address ?? null,
  }));
}
