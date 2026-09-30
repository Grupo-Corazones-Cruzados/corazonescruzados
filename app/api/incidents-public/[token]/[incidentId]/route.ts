import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { ownerByIncidentsToken, COLUMNA_DUENO } from '@/lib/incidents/schema';

export const dynamic = 'force-dynamic';

/** Portal público: detalle completo de un incidente (con imágenes), validado por token. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string; incidentId: string }> }) {
  try {
    const { token, incidentId } = await params;
    const owner = await ownerByIncidentsToken(token);
    if (!owner) return NextResponse.json({ error: 'Enlace inválido o revocado' }, { status: 403 });
    const { rows } = await pool.query(
      `SELECT * FROM gcc_world.project_incidents WHERE id = $1 AND ${COLUMNA_DUENO[owner.tipo]} = $2`,
      [Number(incidentId) || 0, owner.id],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Public incident detail error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
