import { NextRequest, NextResponse } from 'next/server';
import { checkCronToken, cronTokenConfigured } from '@/lib/cron-auth';
import { decodificarDataUri, fileIdDe, guardar, nombresDe, quitar, registro, renombrar, urlMediaAbsoluta } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/media/productos — los PRODUCTOS guardan aquí sus fotos (hoy: las imágenes de las
 * destrezas de Planificaciones). De servidor a servidor con `x-cron-token` = `GCC_TOKEN` del
 * producto, que es una referencia al `CRON_TOKEN` de la plataforma (mismo esquema que
 * `/api/productos/identidad`). El navegador del cliente nunca habla con esta ruta.
 *
 * Así los productos no necesitan la clave de Google: el Drive de la empresa se toca solo
 * desde la plataforma.
 *
 * { accion: 'subir', producto, inquilino, referencia, base, dataUri } → { url, fileId, nombre }
 * { accion: 'renombrar', ref, nombre }                                 → { nombre }
 * { accion: 'quitar', ref }                                            → { ok }
 * { accion: 'nombres', refs }                                          → { nombres: { fileId: nombre } }
 */
const PRODUCTOS = new Set(['planificaciones']);

export async function POST(req: NextRequest) {
  if (!cronTokenConfigured()) return NextResponse.json({ error: 'Falta CRON_TOKEN en la plataforma' }, { status: 503 });
  if (!checkCronToken(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  try {
    switch (b.accion) {
      case 'subir': {
        if (!PRODUCTOS.has(b.producto)) return NextResponse.json({ error: 'Producto desconocido' }, { status: 400 });
        const img = decodificarDataUri(b.dataUri);
        if (!img || !img.mime.startsWith('image/')) return NextResponse.json({ error: 'Solo imágenes' }, { status: 400 });
        const g = await guardar({
          datos: img.datos, mime: img.mime, base: String(b.base || 'imagen'),
          modulo: 'destreza', referencia: String(b.referencia ?? ''),
          ruta: ['Productos', 'Planificaciones', String(b.inquilino || 'sin-institucion')],
        });
        return NextResponse.json({ url: urlMediaAbsoluta(g.fileId), fileId: g.fileId, nombre: g.nombre });
      }
      case 'renombrar': {
        const id = fileIdDe(b.ref);
        const r = id ? await registro(id) : null;
        if (!id || !r || r.modulo !== 'destreza') return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
        return NextResponse.json({ nombre: await renombrar(id, String(b.nombre ?? '')) });
      }
      case 'quitar': {
        const id = fileIdDe(b.ref);
        const r = id ? await registro(id) : null;
        if (r && r.modulo === 'destreza' && !r.borrado_en) await quitar(b.ref);
        return NextResponse.json({ ok: true });
      }
      case 'nombres': {
        const refs: string[] = Array.isArray(b.refs) ? b.refs.map(String).slice(0, 500) : [];
        return NextResponse.json({ nombres: await nombresDe(refs) });
      }
      default:
        return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('[media/productos]', b.accion, e?.message);
    return NextResponse.json({ error: e?.message || 'Error con Google Drive' }, { status: 502 });
  }
}
