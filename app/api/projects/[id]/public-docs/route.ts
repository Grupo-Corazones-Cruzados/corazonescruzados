import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

async function ensurePublicDocsColumns() {
  await pool.query(`
    ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_docs JSONB;
    ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_docs_token VARCHAR(64);
    ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_docs_published_at TIMESTAMPTZ;
  `);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await ensurePublicDocsColumns();

    const { rows: [row] } = await pool.query(
      `SELECT public_docs, public_docs_token, public_docs_published_at
       FROM gcc_world.projects WHERE id = $1`,
      [id]
    );
    if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({
      data: {
        public_docs: row.public_docs,
        public_docs_token: row.public_docs_token,
        public_docs_published_at: row.public_docs_published_at,
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
    await ensurePublicDocsColumns();

    const body = await req.json();
    const docs = body.public_docs;
    if (!docs || typeof docs !== 'object') {
      return NextResponse.json({ error: 'public_docs requerido' }, { status: 400 });
    }
    if (!Array.isArray(docs.sections)) {
      return NextResponse.json({ error: 'public_docs.sections debe ser un array' }, { status: 400 });
    }

    const { rows: [existing] } = await pool.query(
      `SELECT public_docs_token FROM gcc_world.projects WHERE id = $1`,
      [id]
    );
    const token = existing?.public_docs_token || crypto.randomBytes(24).toString('hex');

    await pool.query(
      `UPDATE gcc_world.projects
       SET public_docs = $1, public_docs_token = $2, public_docs_published_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(docs), token, id]
    );

    return NextResponse.json({ ok: true, token });
  } catch (err: any) {
    console.error('Public docs POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await ensurePublicDocsColumns();

    await pool.query(
      `UPDATE gcc_world.projects
       SET public_docs_token = NULL, public_docs_published_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
