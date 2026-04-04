import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

// GET: fetch month detail with items (admin and member only)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role === 'client') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;

    const { rows: [month] } = await pool.query(`SELECT * FROM gcc_world.finance_months WHERE id = $1`, [id]);
    if (!month) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { rows: items } = await pool.query(
      `SELECT * FROM gcc_world.finance_items WHERE month_id = $1 ORDER BY type, sort_order, id`, [id]
    );

    return NextResponse.json({ data: { ...month, items } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: save all items for a month (replace all)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const { items } = await req.json();

    if (!Array.isArray(items)) return NextResponse.json({ error: 'items requerido' }, { status: 400 });

    // Delete existing items and re-insert
    await pool.query(`DELETE FROM gcc_world.finance_items WHERE month_id = $1`, [id]);

    let totalIncome = 0;
    let totalExpense = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.description?.trim() && !item.amount) continue;
      const amount = Number(item.amount) || 0;
      await pool.query(
        `INSERT INTO gcc_world.finance_items (month_id, type, description, amount, sort_order) VALUES ($1, $2, $3, $4, $5)`,
        [id, item.type, item.description || '', amount, i]
      );
      if (item.type === 'income') totalIncome += amount;
      else totalExpense += amount;
    }

    const totalSavings = totalIncome - totalExpense;

    await pool.query(
      `UPDATE gcc_world.finance_months SET total_income = $1, total_expense = $2, total_savings = $3, updated_at = NOW() WHERE id = $4`,
      [totalIncome.toFixed(2), totalExpense.toFixed(2), totalSavings.toFixed(2), id]
    );

    // Return updated month with items
    const { rows: [month] } = await pool.query(`SELECT * FROM gcc_world.finance_months WHERE id = $1`, [id]);
    const { rows: newItems } = await pool.query(
      `SELECT * FROM gcc_world.finance_items WHERE month_id = $1 ORDER BY type, sort_order, id`, [id]
    );

    return NextResponse.json({ data: { ...month, items: newItems } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: remove a month and its items
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;

    await pool.query(`DELETE FROM gcc_world.finance_months WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
