import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { isCloudinaryUrl, cloudinaryResized } from '@/lib/cloudinary';
import sharp from 'sharp';
import { fileIdDe, leerBytes } from '@/lib/media';

/**
 * Sirve UNA imagen de un proyecto del marketplace **redimensionada** (WebP), en vez
 * del base64 original (PNGs de varios MB). Las imágenes se guardan como data URLs en
 * `projects.images TEXT[]`; aquí se decodifica solo el elemento pedido (`images[i+1]`,
 * el array de Postgres es 1-based), se reescala a `w` y se devuelve como binario con
 * cache. Así la miniatura de la tarjeta y la vista previa del panel cargan rápido;
 * la resolución alta (w=1600) se pide solo al abrir la galería a pantalla completa.
 * Lectura pública solo para proyectos publicados; con sesión, cualquiera por id.
 */
const ALLOWED_W = new Set([240, 480, 900, 1600]);

/**
 * NÍTIDAS desde el 2026-11-04 (Fernando: «ya no quiero que se vean borrosas en ningún lado»).
 * Antes salían desenfocadas por llevar datos de clientes; ahora las imágenes son de presentación.
 */

// Cache de proceso: evita re-decodificar/reescalar la misma miniatura en cada
// petición (Railway es persistente). Acotado por FIFO simple.
const cache = new Map<string, Buffer>();
const CACHE_MAX = 300;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    const i = Math.max(0, parseInt(req.nextUrl.searchParams.get('i') || '0', 10) || 0);
    let w = parseInt(req.nextUrl.searchParams.get('w') || '480', 10) || 480;
    if (!ALLOWED_W.has(w)) w = 480;

    // Primero la base y el permiso, después la caché (auditoría de seguridad, 2026-11-14): con la caché
    // delante, una miniatura que alguien con sesión ya había pedido se servía a cualquiera, aunque el
    // proyecto no estuviera publicado o ya se hubiera borrado.
    const { rows: [row] } = await pool.query(
      `SELECT p.images[$2] as img, p.is_marketplace_published FROM gcc_world.projects p WHERE p.id = $1`,
      [id, i + 1]
    );
    if (!row || !row.img) return new NextResponse(null, { status: 404 });
    if (!user && !row.is_marketplace_published) return new NextResponse(null, { status: 404 });
    // Lo no publicado no lo guarda ningún intermediario (Cloudflare, navegador compartido).
    const cacheControl = row.is_marketplace_published
      ? 'public, max-age=86400, stale-while-revalidate=604800'
      : 'private, max-age=300';

    // La clave lleva la referencia de la imagen: si la foto cambia, no se sirve la vieja.
    const key = `${id}:${i}:${w}:${String(row.img).length}:${String(row.img).slice(-48)}`;
    const hit = cache.get(key);
    if (hit) {
      return new NextResponse(new Uint8Array(hit), {
        status: 200,
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': cacheControl },
      });
    }

    const raw = String(row.img);
    // Ya migrada a Cloudinary: redirige a la transformación de ancho (WebP/AVIF auto).
    if (isCloudinaryUrl(raw)) return NextResponse.redirect(cloudinaryResized(raw, w));
    // Otra URL remota: redirige tal cual.
    if (/^https?:\/\//i.test(raw)) return NextResponse.redirect(raw);

    // En Drive (2026-10-13) o aún base64 en la BD: se bajan los bytes y se reescala con sharp.
    // El resultado se guarda en la caché de abajo, así que Drive se toca una vez por ancho.
    let input: Buffer;
    if (fileIdDe(raw)) {
      const leida = await leerBytes(raw);
      if (!leida) return new NextResponse(null, { status: 404 });
      input = leida.datos;
    } else {
      input = Buffer.from(raw.replace(/^data:[^;]+;base64,/, ''), 'base64');
    }
    const out = await sharp(input)
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();

    cache.set(key, out);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': cacheControl },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
