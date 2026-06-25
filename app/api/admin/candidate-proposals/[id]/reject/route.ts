import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

// POST — rechaza (elimina) una postulación de candidato (solo admin). Libera el
// correo para una futura postulación.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const { id } = await params;
    const r = await pool.query(
      `DELETE FROM gcc_world.candidate_proposals WHERE id = $1 RETURNING id`,
      [id],
    );
    if (r.rowCount === 0) {
      return NextResponse.json({ error: 'Postulación no encontrada' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Reject proposal error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
