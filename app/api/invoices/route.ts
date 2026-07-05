import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Ensure is_manual column exists
    await pool.query(`ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false`);

    const status = req.nextUrl.searchParams.get('status');
    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      where += ` AND i.status = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT i.id, i.invoice_number, i.access_key, i.authorization_number, i.authorization_date,
              i.client_ruc, i.client_name_sri, i.subtotal, i.tax, i.total, i.status, i.sri_status,
              i.created_at, i.project_id, i.is_manual, c.name as client_name
       FROM gcc_world.invoices i
       LEFT JOIN gcc_world.clients c ON c.id = i.client_id
       ${where}
       ORDER BY i.created_at DESC`,
      params
    );

    // Per-status counts for the rail (global, ignore the status filter).
    const { rows: countRows } = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM gcc_world.invoices GROUP BY status`,
    );
    const counts: Record<string, number> = {};
    let allCount = 0;
    for (const r of countRows) { counts[r.status] = Number(r.n); allCount += Number(r.n); }
    counts.all = allCount;

    return NextResponse.json({ data: rows, counts });
  } catch (err: any) {
    console.error('Invoices error:', err.message);
    return NextResponse.json({ data: [], counts: {} });
  }
}
