import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { rows } = await pool.query(`SELECT * FROM gcc_world.invoice_items_sri WHERE invoice_id = $1 ORDER BY id`, [id]);
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ data: [] });
  }
}
