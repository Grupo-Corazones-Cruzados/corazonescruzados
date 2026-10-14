import { NextRequest, NextResponse } from 'next/server';
import { checkCronToken, cronTokenConfigured } from '@/lib/cron-auth';
import { decodificarDataUri, fileIdDe, guardar, nombresDe, quitar, registro, renombrar, urlMediaAbsoluta, type Modulo } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/media/productos — los PRODUCTOS guardan aquí sus fotos: las imágenes de las
 * destrezas de Planificaciones y las fotos y el logo de Reservas (desde 2026-10-13). De servidor a servidor con `x-cron-token` = `GCC_TOKEN` del
 * producto, que es una referencia al `CRON_TOKEN` de la plataforma (mismo esquema que
 * `/api/productos/identidad`). El navegador del cliente nunca habla con esta ruta.
 *
 * Así los productos no necesitan la clave de Google: el Drive de la empresa se toca solo
 * desde la plataforma.
 *
 * { accion: 'subir', producto, inquilino, referencia, base, dataUri, carpeta? } → { url, fileId, nombre }
 * { accion: 'renombrar', ref, nombre }                                 → { nombre }
 * { accion: 'quitar', ref }                                            → { ok }
 * { accion: 'nombres', refs }                                          → { nombres: { fileId: nombre } }
 */
/** Qué guarda cada producto y dónde (una carpeta por producto y por cliente). */
const PRODUCTOS: Record<string, { modulo: Modulo; ruta: (inquilino: string, carpeta?: string) => string[] }> = {
  planificaciones: { modulo: 'destreza', ruta: (i) => ['Productos', 'Planificaciones', i, 'Destrezas'] },
  reservas: { modulo: 'reserva_foto', ruta: (i, c) => ['Productos', 'Reservas', i, c === 'marca' ? 'Marca' : 'Ubicaciones y suites'] },
};
const MODULOS_DE_PRODUCTO = new Set<string>(Object.values(PRODUCTOS).map((p) => p.modulo));

export async function POST(req: NextRequest) {
  if (!cronTokenConfigured()) return NextResponse.json({ error: 'Falta CRON_TOKEN en la plataforma' }, { status: 503 });
  if (!checkCronToken(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  try {
    switch (b.accion) {
      case 'subir': {
        const prod = PRODUCTOS[String(b.producto)];
        if (!prod) return NextResponse.json({ error: 'Producto desconocido' }, { status: 400 });
        const img = decodificarDataUri(b.dataUri);
        if (!img || !img.mime.startsWith('image/')) return NextResponse.json({ error: 'Solo imágenes' }, { status: 400 });
        const g = await guardar({
          datos: img.datos, mime: img.mime, base: String(b.base || 'imagen'),
          modulo: prod.modulo, referencia: String(b.referencia ?? ''),
          ruta: prod.ruta(String(b.inquilino || 'sin-cliente'), b.carpeta ? String(b.carpeta) : undefined),
        });
        return NextResponse.json({ url: urlMediaAbsoluta(g.fileId), fileId: g.fileId, nombre: g.nombre });
      }
      case 'renombrar': {
        const id = fileIdDe(b.ref);
        const r = id ? await registro(id) : null;
        if (!id || !r || !MODULOS_DE_PRODUCTO.has(r.modulo)) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
        return NextResponse.json({ nombre: await renombrar(id, String(b.nombre ?? '')) });
      }
      case 'quitar': {
        const id = fileIdDe(b.ref);
        const r = id ? await registro(id) : null;
        if (r && MODULOS_DE_PRODUCTO.has(r.modulo) && !r.borrado_en) await quitar(b.ref);
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
