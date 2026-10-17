import { Readable } from 'stream';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { abrir } from '@/lib/media/drive';
import { asegurarTablaEnlaces, puedeVer, type Archivo } from '@/lib/enlaces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/enlaces/<id>/archivos/<fileId> — descarga un archivo recibido. Solo quien creó el
 * enlace y el admin, y solo si ese archivo es de la respuesta de ESTE enlace: con el id de
 * Drive a secas se podría leer cualquier archivo de la cuenta de la empresa.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const { id, fileId } = await params;
  await asegurarTablaEnlaces();
  const { rows: [e] } = await pool.query(`SELECT creado_por, archivos FROM gcc_world.enlaces_unicos WHERE id = $1`, [Number(id)]);
  if (!e || !puedeVer({ userId: String(user.userId), role: String(user.role) }, e)) return new NextResponse(null, { status: 404 });
  const a = (e.archivos as Archivo[]).find((x) => x.id === fileId);
  if (!a) return new NextResponse(null, { status: 404 });
  try {
    const d = await abrir(fileId);
    const headers: Record<string, string> = {
      'Content-Type': a.mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(a.nombre)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    if (d.contentLength) headers['Content-Length'] = d.contentLength;
    return new Response(Readable.toWeb(d.stream) as ReadableStream, { headers });
  } catch (err: any) {
    console.error('[enlaces] no se pudo leer de Drive', fileId, err?.message);
    return new NextResponse(null, { status: 502 });
  }
}
