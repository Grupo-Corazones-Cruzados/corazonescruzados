import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    // Same query used by createInvoiceFromProject in SRI lib
    const { rows } = await pool.query(
      `SELECT r.title, r.description,
              COALESCE(SUM(COALESCE(ra.member_cost, ra.proposed_cost)), r.cost, 0) as cost
       FROM gcc_world.project_requirements r
       LEFT JOIN gcc_world.requirement_assignments ra ON ra.requirement_id = r.id AND ra.status = 'accepted'
       WHERE r.project_id = $1
       GROUP BY r.id, r.title, r.description, r.cost
       ORDER BY r.id`, [id]
    );

    const data = rows.map((r: any) => ({
      description: r.title + (r.description ? ` - ${r.description}` : ''),
      cost: Number(r.cost) || 0,
    }));

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
