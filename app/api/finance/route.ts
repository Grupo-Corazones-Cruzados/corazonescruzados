import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureFinanceTables, ensureMonth, recalcMonth } from '@/lib/finance';

/**
 * Backfill: register completed/invoiced projects and completed tickets
 * that aren't yet in finance_items. Runs on each GET — only inserts missing.
 */
async function backfillIncomes() {
  // 1. Completed projects not yet registered
  const { rows: completedProjects } = await pool.query(`
    SELECT p.id, p.title, p.final_cost, p.updated_at
    FROM gcc_world.projects p
    WHERE p.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM gcc_world.finance_items fi WHERE fi.source_type = 'project' AND fi.source_id = CAST(p.id AS TEXT)
      )
  `);

  for (const p of completedProjects) {
    const d = new Date(p.updated_at || Date.now());
    const monthId = await ensureMonth(d.getFullYear(), d.getMonth() + 1);
    const { rows: [{ max: maxOrder }] } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) as max FROM gcc_world.finance_items WHERE month_id = $1`, [monthId]
    );
    await pool.query(
      `INSERT INTO gcc_world.finance_items (month_id, type, description, amount, sort_order, source_type, source_id)
       VALUES ($1, 'income', $2, $3, $4, 'project', $5) ON CONFLICT (source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL DO NOTHING`,
      [monthId, p.title, Number(p.final_cost) || 0, maxOrder + 1, String(p.id)]
    );
    await recalcMonth(monthId);
  }

  // 2. Projects with invoices (not completed but already invoiced — prepaid)
  await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.invoice_projects (
    id SERIAL PRIMARY KEY, invoice_id INT NOT NULL, project_id TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  const { rows: invoicedProjects } = await pool.query(`
    SELECT DISTINCT p.id, p.title, p.final_cost, i.created_at as invoice_date
    FROM gcc_world.projects p
    JOIN gcc_world.invoices i ON (i.project_id = p.id OR EXISTS (
      SELECT 1 FROM gcc_world.invoice_projects ip WHERE ip.project_id = CAST(p.id AS TEXT) AND ip.invoice_id = i.id
    ))
    WHERE i.status != 'cancelled'
      AND p.status != 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM gcc_world.finance_items fi WHERE fi.source_type = 'project' AND fi.source_id = CAST(p.id AS TEXT)
      )
  `);

  for (const p of invoicedProjects) {
    const d = new Date(p.invoice_date || Date.now());
    const monthId = await ensureMonth(d.getFullYear(), d.getMonth() + 1);
    const { rows: [{ max: maxOrder }] } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) as max FROM gcc_world.finance_items WHERE month_id = $1`, [monthId]
    );
    await pool.query(
      `INSERT INTO gcc_world.finance_items (month_id, type, description, amount, sort_order, source_type, source_id)
       VALUES ($1, 'income', $2, $3, $4, 'project', $5) ON CONFLICT (source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL DO NOTHING`,
      [monthId, p.title, Number(p.final_cost) || 0, maxOrder + 1, String(p.id)]
    );
    await recalcMonth(monthId);
  }

  // 3. Completed tickets with estimated_cost not yet registered
  const { rows: completedTickets } = await pool.query(`
    SELECT t.id, t.title, t.estimated_cost, t.updated_at
    FROM gcc_world.tickets t
    WHERE t.status = 'completed' AND t.estimated_cost IS NOT NULL AND t.estimated_cost > 0
      AND NOT EXISTS (
        SELECT 1 FROM gcc_world.finance_items fi WHERE fi.source_type = 'ticket' AND fi.source_id = CAST(t.id AS TEXT)
      )
  `);

  for (const t of completedTickets) {
    const d = new Date(t.updated_at || Date.now());
    const monthId = await ensureMonth(d.getFullYear(), d.getMonth() + 1);
    const { rows: [{ max: maxOrder }] } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) as max FROM gcc_world.finance_items WHERE month_id = $1`, [monthId]
    );
    await pool.query(
      `INSERT INTO gcc_world.finance_items (month_id, type, description, amount, sort_order, source_type, source_id)
       VALUES ($1, 'income', $2, $3, $4, 'ticket', $5) ON CONFLICT (source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL DO NOTHING`,
      [monthId, t.title, Number(t.estimated_cost) || 0, maxOrder + 1, String(t.id)]
    );
    await recalcMonth(monthId);
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await ensureFinanceTables();

    // Auto-create current month
    const now = new Date();
    await ensureMonth(now.getFullYear(), now.getMonth() + 1);

    // Backfill any completed projects/tickets and invoiced projects not yet registered
    try { await backfillIncomes(); } catch (e: any) { console.error('Backfill error:', e.message); }

    const { rows } = await pool.query(
      `SELECT * FROM gcc_world.finance_months ORDER BY year DESC, month DESC`
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await ensureFinanceTables();
    const { year, month } = await req.json();

    if (!year || !month) return NextResponse.json({ error: 'year y month requeridos' }, { status: 400 });

    const monthId = await ensureMonth(year, month);
    const { rows: [m] } = await pool.query(`SELECT * FROM gcc_world.finance_months WHERE id = $1`, [monthId]);

    return NextResponse.json({ data: m }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
