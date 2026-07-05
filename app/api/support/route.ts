import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const status = req.nextUrl.searchParams.get('status');

    // Base (visibility) filter, shared by list and per-status counts.
    let baseWhere = 'WHERE 1=1';
    const baseParams: any[] = [];
    if (user.role === 'client') {
      baseParams.push(user.userId);
      baseWhere += ` AND st.user_id = $${baseParams.length}`;
    }

    let where = baseWhere;
    const params: any[] = [...baseParams];
    if (status && status !== 'all') {
      params.push(status);
      where += ` AND st.status = $${params.length}`;
    }

    // Per-status counts for the rail (respect visibility, ignore status filter).
    const countsQ = await pool.query(
      `SELECT st.status, COUNT(*)::int AS n FROM gcc_world.support_tickets st ${baseWhere} GROUP BY st.status`,
      baseParams,
    );
    const counts: Record<string, number> = {};
    let allCount = 0;
    for (const r of countsQ.rows) { counts[r.status] = Number(r.n); allCount += Number(r.n); }
    counts.all = allCount;

    const { rows } = await pool.query(
      `SELECT st.*, (SELECT COUNT(*) FROM gcc_world.support_replies sr WHERE sr.ticket_id = st.id) as reply_count
       FROM gcc_world.support_tickets st
       ${where}
       ORDER BY st.created_at DESC`,
      params
    );

    return NextResponse.json({ data: rows, counts });
  } catch (err: any) {
    console.error('Support error:', err.message);
    return NextResponse.json({ data: [], counts: {} });
  }
}
