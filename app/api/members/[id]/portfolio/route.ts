import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const type = req.nextUrl.searchParams.get('type') || 'project';

    const { rows } = await pool.query(
      `SELECT *, cost as price, item_type as type, COALESCE(images, '{}') as images
       FROM gcc_world.member_portfolio_items
       WHERE member_id = $1 AND item_type = $2
       ORDER BY sort_order, id`,
      [id, type]
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Portfolio GET error:', err.message);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const images = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
    const imageUrl = body.image_url || images[0] || null;

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.member_portfolio_items (member_id, title, description, image_url, project_url, cost, tags, item_type, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *, cost as price, item_type as type`,
      [id, body.title, body.description || null, imageUrl, body.project_url || null, body.price || 0, body.tags || [], body.type || 'project', images]
    );

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Portfolio POST error:', err.message);
    return NextResponse.json({ error: 'Error al crear' }, { status: 500 });
  }
}
