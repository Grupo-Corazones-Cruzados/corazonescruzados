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

    if (user.role === 'client') {
      params.push(user.userId);
      where += ` AND st.user_id = $${params.length}`;
    }
    if (status && status !== 'all') {
      params.push(status);
      where += ` AND st.status = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT st.*, (SELECT COUNT(*) FROM gcc_world.support_replies sr WHERE sr.ticket_id = st.id) as reply_count
       FROM gcc_world.support_tickets st
       ${where}
       ORDER BY st.created_at DESC`,
      params
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Support error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
