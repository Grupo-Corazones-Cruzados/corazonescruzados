import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') || 'project';

    const { rows } = await pool.query(
      `SELECT pi.*, pi.cost as price, pi.item_type as type, COALESCE(pi.images, '{}') as images, m.name as member_name
       FROM gcc_world.member_portfolio_items pi
       JOIN gcc_world.members m ON m.id = pi.member_id
       WHERE pi.item_type = $1
       ORDER BY pi.created_at DESC`,
      [type]
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Portfolio public error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
