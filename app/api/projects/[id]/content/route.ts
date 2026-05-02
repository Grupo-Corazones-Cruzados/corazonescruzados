import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

async function ensureContentColumns() {
  await pool.query(`
    ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS video_script TEXT;
    ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS video_data BYTEA;
    ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS image_metadata JSONB;
  `);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await ensureContentColumns();

    const { rows: [project] } = await pool.query(
      `SELECT video_script, (video_data IS NOT NULL) as has_video, image_metadata
       FROM gcc_world.projects WHERE id = $1`,
      [id]
    );
    if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({
      data: {
        video_script: project.video_script,
        video_url: project.has_video ? `/api/projects/${id}/video` : null,
        image_metadata: project.image_metadata,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await ensureContentColumns();

    const body = await req.json();

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.video_script !== undefined) {
      fields.push(`video_script = $${idx++}`);
      values.push(body.video_script);
    }
    if (body.image_metadata !== undefined) {
      fields.push(`image_metadata = $${idx++}`);
      values.push(JSON.stringify(body.image_metadata));
    }

    if (fields.length === 0) return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE gcc_world.projects SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Content POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
