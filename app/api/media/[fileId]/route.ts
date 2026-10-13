import { Readable } from 'stream';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { abrir } from '@/lib/media/drive';
import { registro, renombrar } from '@/lib/media';
import { puedeGestionarImagenes } from '@/lib/projects/permisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/media/<fileId> — una foto o video de Proyectos/Productos, servido desde el Drive de
 * la empresa.
 *
 * Solo sirve archivos REGISTRADOS en `gcc_world.media_drive`: sin ese filtro, esta ruta
 * dejaría leer cualquier archivo del Drive de lfgonzalezm0@grupocc.org conociendo su id.
 *
 * Quien tiene el enlace lo ve, igual que antes con Cloudinary: los portales de cliente
 * (`/portal/…`) y el marketplace los muestran sin sesión. El id de Drive no se adivina.
 *
 * El contenido de un id no cambia nunca (renombrar solo cambia el nombre), así que el
 * navegador lo guarda un año: cada foto pasa por aquí una sola vez por visitante.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const r = await registro(fileId).catch(() => null);
  if (!r || r.borrado_en) return new NextResponse(null, { status: 404 });

  try {
    const rango = req.headers.get('range');
    const d = await abrir(fileId, rango);
    const headers: Record<string, string> = {
      'Content-Type': r.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(r.nombre)}`,
      'X-Content-Type-Options': 'nosniff',
    };
    if (d.contentLength) headers['Content-Length'] = d.contentLength;
    if (d.contentRange) headers['Content-Range'] = d.contentRange;
    return new Response(Readable.toWeb(d.stream) as ReadableStream, { status: d.status === 206 ? 206 : 200, headers });
  } catch (e: any) {
    console.error('[media] no se pudo leer de Drive', fileId, e?.message);
    return new NextResponse(null, { status: 502 });
  }
}

/**
 * PATCH /api/media/<fileId> { nombre } — renombra en Drive y en la plataforma.
 * Se manda el nombre SIN extensión; la extensión se conserva.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });

  const { fileId } = await params;
  const r = await registro(fileId);
  if (!r || r.borrado_en) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });

  // Mismo permiso que para subir o quitar en cada sitio.
  if (r.modulo === 'proyecto_foto' || r.modulo === 'proyecto_video') {
    if (!(await puedeGestionarImagenes({ userId: String(user.userId), role: String(user.role) }, r.referencia))) {
      return NextResponse.json({ error: 'No tienes permiso sobre las fotos de este proyecto' }, { status: 403 });
    }
  } else if (r.modulo === 'incidencia') {
    if (user.role !== 'admin' && user.role !== 'member') {
      return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
    }
  } else {
    // Las destrezas son de un producto: se renombran desde el producto (/api/media/productos).
    return NextResponse.json({ error: 'Este archivo se renombra desde su producto' }, { status: 403 });
  }

  const { nombre } = await req.json().catch(() => ({}));
  if (typeof nombre !== 'string') return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 });
  try {
    const final = await renombrar(fileId, nombre);
    return NextResponse.json({ ok: true, nombre: final });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'No se pudo renombrar en Drive' }, { status: 502 });
  }
}
