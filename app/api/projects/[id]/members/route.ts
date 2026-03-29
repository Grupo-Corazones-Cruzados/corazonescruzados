import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT m.id, m.name, m.email, m.photo_url
       FROM gcc_world.project_bids pb
       JOIN gcc_world.members m ON m.id = pb.member_id
       WHERE pb.project_id = $1 AND pb.status = 'accepted'
       ORDER BY m.name`,
      [id]
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
