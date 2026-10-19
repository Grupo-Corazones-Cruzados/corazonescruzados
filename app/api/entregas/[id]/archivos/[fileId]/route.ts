import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { puedeVer } from '@/lib/enlaces';
import { asegurarTablaEntregas } from '@/lib/entregas';
import { descargaDeDrive } from '@/lib/media/descarga-privada';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/entregas/<id>/archivos/<fileId> — el creador (o el admin) baja lo que entregó. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const { id, fileId } = await params;
  await asegurarTablaEntregas();
  const { rows: [e] } = await pool.query(`SELECT creado_por, archivos FROM gcc_world.entregas_unicas WHERE id = $1`, [Number(id)]);
  if (!e || !puedeVer({ userId: String(user.userId), role: String(user.role) }, e)) return new NextResponse(null, { status: 404 });
  return descargaDeDrive(e.archivos, fileId);
}
