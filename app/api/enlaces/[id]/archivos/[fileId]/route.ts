import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { asegurarTablaEnlaces, puedeVer } from '@/lib/enlaces';
import { descargaDeDrive } from '@/lib/media/descarga-privada';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/enlaces/<id>/archivos/<fileId> — descarga un archivo recibido. Solo quien creó el
 * enlace y el admin, y solo si ese archivo es de la respuesta de ESTE enlace (`descargaDeDrive`).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const { id, fileId } = await params;
  await asegurarTablaEnlaces();
  const { rows: [e] } = await pool.query(`SELECT creado_por, archivos FROM gcc_world.enlaces_unicos WHERE id = $1`, [Number(id)]);
  if (!e || !puedeVer({ userId: String(user.userId), role: String(user.role) }, e)) return new NextResponse(null, { status: 404 });
  return descargaDeDrive(e.archivos, fileId);
}
