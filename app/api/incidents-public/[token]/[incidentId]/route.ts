import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { ensureIncidentTables } from '@/lib/incidents/schema';

export const dynamic = 'force-dynamic';

/** Portal público: detalle completo de un incidente (con imágenes), validado por token. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string; incidentId: string }> }) {
  try {
    const { token, incidentId } = await params;
    if (!token || token.length < 16) return NextResponse.json({ error: 'Enlace inválido' }, { status: 403 });
    await ensureIncidentTables();
    const { rows } = await pool.query(
      `SELECT i.* FROM gcc_world.project_incidents i
         JOIN gcc_world.projects p ON p.id = i.project_id
        WHERE i.id = $1 AND p.incidents_token = $2`,
      [incidentId, token],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Public incident detail error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
