import { pool } from '@/lib/db';

let _initialized = false;

async function ensureFinanceTables() {
  if (_initialized) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.finance_months (
      id SERIAL PRIMARY KEY, year INT NOT NULL, month INT NOT NULL,
      total_income NUMERIC(12,2) DEFAULT 0, total_expense NUMERIC(12,2) DEFAULT 0,
      total_savings NUMERIC(12,2) DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(year, month)
    );
    CREATE TABLE IF NOT EXISTS gcc_world.finance_items (
      id SERIAL PRIMARY KEY, month_id INT NOT NULL REFERENCES gcc_world.finance_months(id) ON DELETE CASCADE,
      type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
      description TEXT NOT NULL, amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(),
      source_type VARCHAR(20), source_id TEXT
    );
    CREATE TABLE IF NOT EXISTS gcc_world.finance_source_log (
      source_type VARCHAR(20) NOT NULL,
      source_id TEXT NOT NULL,
      registered_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (source_type, source_id)
    );
  `);
  await pool.query(`
    ALTER TABLE gcc_world.finance_items ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);
    ALTER TABLE gcc_world.finance_items ADD COLUMN IF NOT EXISTS source_id TEXT;
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_items_source_unique
    ON gcc_world.finance_items (source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL
  `);

  _initialized = true;
}

async function ensureMonth(year: number, month: number): Promise<number> {
  await pool.query(
    `INSERT INTO gcc_world.finance_months (year, month) VALUES ($1, $2) ON CONFLICT (year, month) DO NOTHING`,
    [year, month]
  );
  const { rows: [m] } = await pool.query(
    `SELECT id FROM gcc_world.finance_months WHERE year = $1 AND month = $2`, [year, month]
  );
  return m.id;
}

async function recalcMonth(monthId: number) {
  await pool.query(`
    UPDATE gcc_world.finance_months SET
      total_income = COALESCE((SELECT SUM(amount) FROM gcc_world.finance_items WHERE month_id = $1 AND type = 'income'), 0),
      total_expense = COALESCE((SELECT SUM(amount) FROM gcc_world.finance_items WHERE month_id = $1 AND type = 'expense'), 0),
      total_savings = COALESCE((SELECT SUM(amount) FROM gcc_world.finance_items WHERE month_id = $1 AND type = 'income'), 0)
                    - COALESCE((SELECT SUM(amount) FROM gcc_world.finance_items WHERE month_id = $1 AND type = 'expense'), 0),
      updated_at = NOW()
    WHERE id = $1
  `, [monthId]);
}

/**
 * Register an income item. Uses finance_source_log to track what was ever
 * registered — if the admin deletes the item, the log entry remains so
 * the backfill won't re-add it.
 */
async function addIncomeToFinance(sourceType: string, sourceId: string, description: string, amount: number, date?: Date) {
  await ensureFinanceTables();

  // Check log — if this source was ever registered, skip (even if item was deleted by admin)
  const { rows: logged } = await pool.query(
    `SELECT 1 FROM gcc_world.finance_source_log WHERE source_type = $1 AND source_id = $2`, [sourceType, sourceId]
  );
  if (logged.length > 0) return;

  const d = date || new Date();
  const monthId = await ensureMonth(d.getFullYear(), d.getMonth() + 1);

  const { rows: [{ max: maxOrder }] } = await pool.query(
    `SELECT COALESCE(MAX(sort_order), -1) as max FROM gcc_world.finance_items WHERE month_id = $1`, [monthId]
  );

  await pool.query(
    `INSERT INTO gcc_world.finance_items (month_id, type, description, amount, sort_order, source_type, source_id)
     VALUES ($1, 'income', $2, $3, $4, $5, $6) ON CONFLICT (source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL DO NOTHING`,
    [monthId, description, amount, maxOrder + 1, sourceType, sourceId]
  );

  // Log that this source was registered (permanent — survives item deletion)
  await pool.query(
    `INSERT INTO gcc_world.finance_source_log (source_type, source_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [sourceType, sourceId]
  );

  await recalcMonth(monthId);
}

export async function addProjectIncomeToFinance(projectId: string, projectTitle: string, totalCost: number, date?: Date) {
  await addIncomeToFinance('project', projectId, projectTitle, totalCost, date);
}

export async function addTicketIncomeToFinance(ticketId: string, ticketTitle: string, totalCost: number, date?: Date) {
  await addIncomeToFinance('ticket', ticketId, ticketTitle, totalCost, date);
}

/**
 * Registra el ingreso de UNA factura concreta (usado para ABONOS: cada factura parcial
 * es un ingreso propio, keyeado por su invoiceId). Al anular esa factura se quita con
 * removeIncomeFromFinance('invoice', invoiceId).
 */
export async function addInvoiceIncomeToFinance(invoiceId: string, description: string, amount: number, date?: Date) {
  await addIncomeToFinance('invoice', invoiceId, description, amount, date);
}

/**
 * Register the income of a paid subscription month. `sourceId` must be unique per
 * billed period (e.g. `<subscriptionId>-<YYYY-MM>`) so a month can't be double-counted.
 * `date` defaults to now → the income lands in the month the cuota is marked paid.
 */
export async function addSubscriptionIncomeToFinance(sourceId: string, description: string, totalCost: number, date?: Date) {
  await addIncomeToFinance('subscription', sourceId, description, totalCost, date);
}

/**
 * Remove a previously-registered income (item + source_log entry) so it stops
 * counting in the dashboard AND a future registration of the same source can be
 * re-added. Used when a source document is reverted (e.g. an invoice is voided).
 */
export async function removeIncomeFromFinance(sourceType: string, sourceId: string) {
  await ensureFinanceTables();
  const { rows } = await pool.query(
    `SELECT DISTINCT month_id FROM gcc_world.finance_items WHERE source_type = $1 AND source_id = $2`,
    [sourceType, sourceId]
  );
  await pool.query(
    `DELETE FROM gcc_world.finance_items WHERE source_type = $1 AND source_id = $2`, [sourceType, sourceId]
  );
  await pool.query(
    `DELETE FROM gcc_world.finance_source_log WHERE source_type = $1 AND source_id = $2`, [sourceType, sourceId]
  );
  for (const r of rows) await recalcMonth(r.month_id);
}

export { ensureFinanceTables, ensureMonth, recalcMonth };

/**
 * ¿ESTE INGRESO ESTÁ FACTURADO? — definición ÚNICA, en SQL sobre `finance_items` con alias `fi`
 * (Fernando, 2026-10-29: «un filtro de solo facturado, para que de mis reportes cuente solo lo
 * facturado en ingresos»). Lo usan la lista de meses, el detalle y el reporte en PDF.
 *
 * Cuenta si existe una factura AUTORIZADA por el SRI y no anulada enlazada a él, o si el ingreso
 * es un comprobante emitido leído del SRI (su origen es la clave de acceso):
 *   · `invoice`      → la factura por su id (abonos y etapas);
 *   · `ticket`       → una factura del ticket (`ticket_id` o `source_type='ticket'`);
 *   · `project`      → una factura del proyecto (`project_id` o `invoice_projects`, que es como
 *                      se enlaza una factura de varios proyectos) que NO sea de una etapa: un
 *                      proyecto cobrado por etapas cuenta por las facturas de cada etapa, que
 *                      tienen su propio ingreso (`invoice`); contar también el del proyecto
 *                      completo lo sumaría dos veces;
 *   · `subscription` → la factura de ese periodo (`source_id` = `<suscripción>-<AAAA-MM>`);
 *   · `sri_emitida`  → siempre;
 *   · sin origen (escrito a mano) → nunca.
 * ⚠️ El origen por sí solo NO basta: tickets y proyectos se anotan también al completarse sin
 * factura (medido el 2026-10-29: 4 de 8 ingresos de proyecto no tienen factura).
 */
export const SQL_INGRESO_FACTURADO = `(fi.type = 'income' AND CASE fi.source_type
  WHEN 'sri_emitida' THEN TRUE
  WHEN 'invoice' THEN EXISTS (SELECT 1 FROM gcc_world.invoices i WHERE i.id::text = fi.source_id AND i.sri_status = 'authorized' AND i.status <> 'cancelled')
  WHEN 'ticket' THEN EXISTS (SELECT 1 FROM gcc_world.invoices i WHERE (i.ticket_id::text = fi.source_id OR (i.source_type = 'ticket' AND i.source_id = fi.source_id)) AND i.sri_status = 'authorized' AND i.status <> 'cancelled')
  WHEN 'project' THEN EXISTS (SELECT 1 FROM gcc_world.invoices i
    WHERE (i.project_id::text = fi.source_id
           OR EXISTS (SELECT 1 FROM gcc_world.invoice_projects ip WHERE ip.invoice_id = i.id AND ip.project_id::text = fi.source_id))
      AND i.sri_status = 'authorized' AND i.status <> 'cancelled'
      AND NOT EXISTS (SELECT 1 FROM gcc_world.project_stages ps WHERE ps.invoice_id = i.id))
  WHEN 'subscription' THEN EXISTS (SELECT 1 FROM gcc_world.invoices i WHERE i.source_type = 'subscription' AND i.source_id = fi.source_id AND i.sri_status = 'authorized' AND i.status <> 'cancelled')
  ELSE FALSE END)`;

/** Los orígenes que se pueden guardar desde el formulario del mes (los que escribe el sistema). */
export const ORIGENES_INGRESO = new Set(['invoice', 'ticket', 'project', 'subscription', 'sri_emitida']);

/**
 * QUÉ FACTURA ES LA DE ESTE INGRESO — condición SQL entre `fi` (finance_items) e `i` (invoices). La
 * misma relación que usa `SQL_INGRESO_FACTURADO`, pero devolviendo la factura concreta. Un comprobante
 * leído del SRI se reconoce por su clave de acceso.
 */
export const SQL_ENLACE_FACTURA = `(
  (fi.source_type = 'invoice' AND fi.source_id = i.id::text)
  OR (fi.source_type = 'sri_emitida' AND fi.source_id = i.access_key)
  OR (fi.source_type = 'ticket' AND (i.ticket_id::text = fi.source_id OR (i.source_type = 'ticket' AND i.source_id = fi.source_id)))
  OR (fi.source_type = 'subscription' AND i.source_type = 'subscription' AND i.source_id = fi.source_id)
  OR (fi.source_type = 'project'
      AND (i.project_id::text = fi.source_id
           OR EXISTS (SELECT 1 FROM gcc_world.invoice_projects ip WHERE ip.invoice_id = i.id AND ip.project_id::text = fi.source_id))
      AND NOT EXISTS (SELECT 1 FROM gcc_world.project_stages ps WHERE ps.invoice_id = i.id)))`;

// Siglas societarias que se quedan en mayúsculas al pasar el nombre del SRI a nombre propio.
const SIGLAS = /^(S\.?A\.?S?\.?|S\.?L\.?|C\.?A\.?|CIA\.?|LTDA\.?|INC\.?)$/i;
/** «MENDEZ DE LA TORRE RAFAEL ENRIQUE» → «Mendez De La Torre Rafael Enrique». Un nombre ya escrito
 *  con mayúsculas y minúsculas se respeta tal cual. */
function nombrePropio(n: string): string {
  const t = (n || '').trim();
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().split(/\s+/).map((w) => (SIGLAS.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

/** Cómo se llama un ingreso facturado (Fernando, 2026-10-29: «al guardar los ingresos debería estar
 *  escrito el nombre de la factura así: Factura 001-001-000000020 — Mendez De La Torre Rafael Enrique»). */
export function nombreIngresoFacturado(numero: string, cliente: string | null | undefined): string {
  return `Factura ${numero}${cliente ? ` — ${nombrePropio(cliente)}` : ''}`;
}

/**
 * NOMBRA CADA INGRESO POR SU FACTURA. Se llama desde el GET de `/api/finance` (el mismo paso,
 * con freno de 1 min, que el relleno de ingresos), así que vale para lo que ya existe y para lo que
 * entre por cualquier flujo —factura de ticket, de proyecto, de etapa, de suscripción, del SRI—
 * sin tocar cada uno.
 *
 * Un ingreso con UNA factura vigente toma su nombre. Si esa factura cubre VARIOS ingresos
 * (Cercasa y Pisercons van en la 001-026), cada uno lleva además lo que lo distingue detrás de
 * un «·»: «Factura 001-001-000000026 — Entheus hábitat SL · Proyecto Cercasa» (Fernando,
 * 2026-10-29: «deberían también tener [factura]»). Lo de detrás es su nombre anterior y se
 * conserva en las siguientes pasadas. Un ingreso con varias facturas no se toca. Devuelve
 * cuántos cambió.
 */
export async function nombrarIngresosFacturados(): Promise<number> {
  const { rows } = await pool.query(`
    WITH pares AS (
      SELECT fi.id AS item_id, fi.description, i.id AS invoice_id, i.invoice_number, i.client_name_sri
        FROM gcc_world.finance_items fi
        JOIN gcc_world.invoices i
          ON i.sri_status = 'authorized' AND i.status <> 'cancelled' AND i.invoice_number IS NOT NULL
         AND ${SQL_ENLACE_FACTURA}
       WHERE fi.type = 'income' AND fi.amount > 0)
    SELECT p.*, (SELECT count(*) FROM pares x WHERE x.invoice_id = p.invoice_id) AS ingresos_de_la_factura
      FROM pares p
     WHERE (SELECT count(*) FROM pares x WHERE x.item_id = p.item_id) = 1`);
  let cambiados = 0;
  for (const r of rows) {
    const base = nombreIngresoFacturado(r.invoice_number, r.client_name_sri);
    let nombre = base;
    if (Number(r.ingresos_de_la_factura) > 1) {
      const actual: string = r.description || '';
      // Si ya lleva el nombre de la factura, se conserva lo que va detrás del «·».
      nombre = actual.startsWith(`${base} · `) ? actual : `${base} · ${actual.trim() || 'parte'}`;
    }
    if (r.description === nombre) continue;
    await pool.query(`UPDATE gcc_world.finance_items SET description = $2 WHERE id = $1`, [r.item_id, nombre]);
    cambiados++;
  }
  return cambiados;
}
