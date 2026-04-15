import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 400 });
    }

    await pool.query(`
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_docs JSONB;
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_docs_token VARCHAR(64);
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_docs_published_at TIMESTAMPTZ;
    `);

    const { rows: [row] } = await pool.query(
      `SELECT id, public_docs, public_docs_published_at,
              COALESCE(images, '{}') as images
       FROM gcc_world.projects
       WHERE public_docs_token = $1 AND public_docs IS NOT NULL
       LIMIT 1`,
      [token]
    );

    if (!row) {
      return NextResponse.json({ error: 'Documentacion no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        public_docs: row.public_docs,
        images: row.images,
        published_at: row.public_docs_published_at,
      },
    });
  } catch (err: any) {
    console.error('Public docs token GET error:', err.message);
    return NextResponse.json({ error: 'Error al obtener documentacion' }, { status: 500 });
  }
}
