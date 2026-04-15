import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

async function ensureSocialColumn() {
  await pool.query(`
    ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS social_copy JSONB;
  `);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await ensureSocialColumn();

    const { rows: [row] } = await pool.query(
      `SELECT social_copy FROM gcc_world.projects WHERE id = $1`,
      [id]
    );
    if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({ data: { social_copy: row.social_copy } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await ensureSocialColumn();

    const body = await req.json();
    const copy = body.social_copy;
    if (!copy || typeof copy !== 'object') {
      return NextResponse.json({ error: 'social_copy requerido' }, { status: 400 });
    }

    await pool.query(
      `UPDATE gcc_world.projects SET social_copy = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(copy), id]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Social POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await ensureSocialColumn();

    await pool.query(
      `UPDATE gcc_world.projects SET social_copy = NULL, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
