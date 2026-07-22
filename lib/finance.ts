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
