import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET: serve proforma HTML publicly if token is valid
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 403 });
    }

    const { rows } = await pool.query(
      `SELECT proforma, proforma_token, proforma_token_expires_at FROM gcc_world.projects WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    const project = rows[0];

    if (!project.proforma) {
      return NextResponse.json({ error: 'Proforma no disponible' }, { status: 404 });
    }

    if (!project.proforma_token || token !== project.proforma_token) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 403 });
    }

    if (project.proforma_token_expires_at && new Date(project.proforma_token_expires_at) < new Date()) {
      return NextResponse.json({ error: 'El enlace ha expirado' }, { status: 403 });
    }

    return NextResponse.json({ html: project.proforma });
  } catch (err: any) {
    console.error('Proforma public GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
