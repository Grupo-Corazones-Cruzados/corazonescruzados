import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureFinanceTables, ensureMonth, recalcMonth } from '@/lib/finance';

/**
 * Backfill: register completed/invoiced projects that aren't yet in finance_items.
 * Runs once per GET — only inserts missing projects.
 */
async function backfillProjectIncomes() {
  // Get all completed projects or projects with invoices that aren't registered yet
  const { rows: projects } = await pool.query(`
    SELECT p.id, p.title, p.final_cost, p.updated_at
    FROM gcc_world.projects p
    WHERE p.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM gcc_world.finance_items fi WHERE fi.source_type = 'project' AND fi.source_id = CAST(p.id AS TEXT)
      )
  `);

  for (const p of projects) {
    const d = new Date(p.updated_at || Date.now());
    const monthId = await ensureMonth(d.getFullYear(), d.getMonth() + 1);
    const { rows: [{ max: maxOrder }] } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) as max FROM gcc_world.finance_items WHERE month_id = $1`, [monthId]
    );
    await pool.query(
      `INSERT INTO gcc_world.finance_items (month_id, type, description, amount, sort_order, source_type, source_id)
       VALUES ($1, 'income', $2, $3, $4, 'project', $5)`,
      [monthId, p.title, Number(p.final_cost) || 0, maxOrder + 1, String(p.id)]
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

    // Backfill any completed projects not yet registered
    try { await backfillProjectIncomes(); } catch (e: any) { console.error('Backfill error:', e.message); }

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
