import { pool } from '@/lib/db';

async function ensureFinanceTables() {
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
  `);
  // Ensure source columns exist (for linking to projects/invoices)
  await pool.query(`
    ALTER TABLE gcc_world.finance_items ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);
    ALTER TABLE gcc_world.finance_items ADD COLUMN IF NOT EXISTS source_id TEXT;
  `);
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
 * Register an income item in the monthly finance table.
 * @param sourceType - 'project' or 'ticket'
 * @param sourceId - unique ID of the source
 * @param description - display name
 * @param amount - USD amount
 * @param date - optional date to determine which month (defaults to now)
 */
async function addIncomeToFinance(sourceType: string, sourceId: string, description: string, amount: number, date?: Date) {
  await ensureFinanceTables();

  const d = date || new Date();
  const monthId = await ensureMonth(d.getFullYear(), d.getMonth() + 1);

  // Prevent duplicates
  const { rows: existing } = await pool.query(
    `SELECT id FROM gcc_world.finance_items WHERE source_type = $1 AND source_id = $2`, [sourceType, sourceId]
  );
  if (existing.length > 0) return;

  const { rows: [{ max: maxOrder }] } = await pool.query(
    `SELECT COALESCE(MAX(sort_order), -1) as max FROM gcc_world.finance_items WHERE month_id = $1`, [monthId]
  );

  await pool.query(
    `INSERT INTO gcc_world.finance_items (month_id, type, description, amount, sort_order, source_type, source_id)
     VALUES ($1, 'income', $2, $3, $4, $5, $6)`,
    [monthId, description, amount, maxOrder + 1, sourceType, sourceId]
  );

  await recalcMonth(monthId);
}

export async function addProjectIncomeToFinance(projectId: string, projectTitle: string, totalCost: number, date?: Date) {
  await addIncomeToFinance('project', projectId, projectTitle, totalCost, date);
}

export async function addTicketIncomeToFinance(ticketId: string, ticketTitle: string, totalCost: number, date?: Date) {
  await addIncomeToFinance('ticket', ticketId, ticketTitle, totalCost, date);
}

export { ensureFinanceTables, ensureMonth, recalcMonth };
