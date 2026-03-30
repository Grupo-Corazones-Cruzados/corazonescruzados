import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const search = req.nextUrl.searchParams.get('search');
    const memberOnly = req.nextUrl.searchParams.get('member') === 'true';

    // Ensure columns exist
    await pool.query(`
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS is_marketplace_published BOOLEAN DEFAULT false;
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS marketplace_published_at TIMESTAMPTZ;
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS images TEXT[];
    `);

    let where = `WHERE p.is_marketplace_published = true AND p.status = 'completed'`;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      where += ` AND p.title ILIKE $${params.length}`;
    }

    // Filter by current user's member_id (for portfolio view)
    if (memberOnly && user.role !== 'admin') {
      const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
      if (u?.member_id) {
        params.push(u.member_id);
        where += ` AND EXISTS (SELECT 1 FROM gcc_world.project_bids pb2 WHERE pb2.project_id = p.id AND pb2.member_id = $${params.length} AND pb2.status = 'accepted')`;
      }
    }

    const { rows } = await pool.query(
      `SELECT p.id, p.title, p.description, p.final_cost,
              p.marketplace_published_at, p.created_at,
              COALESCE(p.images, '{}') as images,
              COALESCE(
                (SELECT json_agg(json_build_object('name', m.name, 'photo_url', m.photo_url))
                 FROM gcc_world.project_bids pb
                 JOIN gcc_world.members m ON m.id = pb.member_id
                 WHERE pb.project_id = p.id AND pb.status = 'accepted'),
                '[]'::json
              ) as team,
              (SELECT COUNT(*) FROM gcc_world.project_requirements r WHERE r.project_id = p.id) as requirements_count
       FROM gcc_world.projects p
       ${where}
       ORDER BY p.marketplace_published_at DESC`,
      params
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Marketplace projects error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
