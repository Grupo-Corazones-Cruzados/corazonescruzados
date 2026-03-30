import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

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

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Invoices error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
