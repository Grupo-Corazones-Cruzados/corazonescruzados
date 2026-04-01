import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

async function ensureFinanceTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.finance_months (
      id SERIAL PRIMARY KEY,
      year INT NOT NULL,
      month INT NOT NULL,
      total_income NUMERIC(12,2) DEFAULT 0,
      total_expense NUMERIC(12,2) DEFAULT 0,
      total_savings NUMERIC(12,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(year, month)
    );
    CREATE TABLE IF NOT EXISTS gcc_world.finance_items (
      id SERIAL PRIMARY KEY,
      month_id INT NOT NULL REFERENCES gcc_world.finance_months(id) ON DELETE CASCADE,
      type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
      description TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await ensureFinanceTables();

    // Auto-create current month if it doesn't exist
    const now = new Date();
    await pool.query(
      `INSERT INTO gcc_world.finance_months (year, month) VALUES ($1, $2) ON CONFLICT (year, month) DO NOTHING`,
      [now.getFullYear(), now.getMonth() + 1]
    );

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

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.finance_months (year, month) VALUES ($1, $2)
       ON CONFLICT (year, month) DO NOTHING RETURNING *`,
      [year, month]
    );

    if (rows.length === 0) {
      const { rows: existing } = await pool.query(
        `SELECT * FROM gcc_world.finance_months WHERE year = $1 AND month = $2`, [year, month]
      );
      return NextResponse.json({ data: existing[0] });
    }

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
