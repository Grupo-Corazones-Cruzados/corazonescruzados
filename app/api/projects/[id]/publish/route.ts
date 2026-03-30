import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const { publish } = await req.json();

    // Ensure columns exist
    await pool.query(`
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS is_marketplace_published BOOLEAN DEFAULT false;
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS marketplace_source_id BIGINT;
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS marketplace_published_at TIMESTAMPTZ;
    `);

    const { rows: [project] } = await pool.query(
      `SELECT status, assigned_member_id FROM gcc_world.projects WHERE id = $1`, [id]
    );
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    if (project.status !== 'completed') return NextResponse.json({ error: 'Solo se pueden publicar proyectos completados' }, { status: 400 });

    // Only owner or admin
    if (user.role !== 'admin') {
      const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
      if (!u?.member_id || u.member_id != project.assigned_member_id) {
        return NextResponse.json({ error: 'Solo el propietario o admin puede publicar' }, { status: 403 });
      }
    }

    await pool.query(
      `UPDATE gcc_world.projects SET is_marketplace_published = $1, marketplace_published_at = $2, updated_at = NOW() WHERE id = $3`,
      [!!publish, publish ? new Date() : null, id]
    );

    return NextResponse.json({ ok: true, published: !!publish });
  } catch (err: any) {
    console.error('Publish error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
