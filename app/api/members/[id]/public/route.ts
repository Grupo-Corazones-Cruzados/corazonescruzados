import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Member info
    const memberRes = await pool.query(
      `SELECT m.id, m.name, m.phone, m.photo_url, m.email,
              p.name AS position
       FROM gcc_world.members m
       LEFT JOIN gcc_world.positions p ON p.id = m.position_id
       WHERE m.id = $1 AND m.is_active = true`,
      [id]
    );

    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 });
    }

    const member = memberRes.rows[0];

    // CV
    const cvRes = await pool.query(
      `SELECT bio, skills, languages, linkedin_url, website_url, education, experience
       FROM gcc_world.member_cv_profiles WHERE member_id = $1`,
      [id]
    );

    // Portfolio items (all types)
    const portfolioRes = await pool.query(
      `SELECT id, title, description, image_url, project_url, cost as price, tags, item_type as type, COALESCE(images, '{}') as images
       FROM gcc_world.member_portfolio_items
       WHERE member_id = $1
       ORDER BY item_type, sort_order, id`,
      [id]
    );

    return NextResponse.json({
      member,
      cv: cvRes.rows[0] || null,
      portfolio: portfolioRes.rows,
    });
  } catch (err: any) {
    console.error('Member public profile error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
