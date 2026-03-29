import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { member_ids } = await req.json();

    if (!member_ids?.length) return NextResponse.json({ error: 'member_ids required' }, { status: 400 });

    for (const memberId of member_ids) {
      await pool.query(
        `INSERT INTO gcc_world.project_bids (project_id, member_id, status)
         VALUES ($1, $2, 'invited')
         ON CONFLICT (project_id, member_id) DO NOTHING`,
        [id, memberId]
      );
    }
    return NextResponse.json({ message: 'Invited' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
