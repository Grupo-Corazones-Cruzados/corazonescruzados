import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { isCloudinaryUrl, cloudinaryDesenfocada } from '@/lib/cloudinary';
import sharp from 'sharp';

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
 * ⇒ LAS IMÁGENES DEL MARKETPLACE SALEN DESENFOCADAS, Y SE DESENFOCAN **AQUÍ**.
 *
 * Son capturas de sistemas que están funcionando, con datos de clientes de verdad
 * dentro: nombres, importes, teléfonos. Enseñan lo que sabemos hacer, y ese es su
 * trabajo — pero un vistazo tiene que dejar ver **la forma de la plataforma, no lo que
 * pone en ella**.
 *
 * ⚠️ NO SE HACE CON CSS. Un `filter: blur()` en el navegador es maquillaje: se quita
 * desde las herramientas de desarrollo en dos clics, y la imagen original sigue
 * descargándose entera. Si el motivo es que hay datos reales, el desenfoque tiene que
 * ir en los píxeles que salen del servidor. Lo que llega al navegador ya no tiene esos
 * datos: no hay nada que revelar.
 *
 * El radio va **proporcional al ancho** a propósito. Un desenfoque fijo se ve fuerte en
 * una miniatura de 240 px y no hace nada en una de 1600: lo que el ojo percibe depende
 * del tamaño al que se muestra, no de los píxeles. Así las cuatro medidas se ven igual
 * de suaves.
 */
const DESENFOQUE_BASE = 1.1;   // sigma para 240 px de ancho
function desenfoqueDe(w: number) {
  return Math.round((DESENFOQUE_BASE * (w / 240)) * 100) / 100;
}

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

    const key = `${id}:${i}:${w}`;
    const hit = cache.get(key);
    if (hit) {
      return new NextResponse(new Uint8Array(hit), {
        status: 200,
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
      });
    }

    const { rows: [row] } = await pool.query(
      `SELECT p.images[$2] as img, p.is_marketplace_published FROM gcc_world.projects p WHERE p.id = $1`,
      [id, i + 1]
    );
    if (!row || !row.img) return new NextResponse(null, { status: 404 });
    if (!user && !row.is_marketplace_published) return new NextResponse(null, { status: 404 });

    const raw = String(row.img);
    // Ya migrada a Cloudinary: redirige a la transformación de ancho (WebP/AVIF auto).
    if (isCloudinaryUrl(raw)) return NextResponse.redirect(cloudinaryDesenfocada(raw, w, desenfoqueDe(w)));
    // Otra URL remota: redirige tal cual.
    if (/^https?:\/\//i.test(raw)) return NextResponse.redirect(raw);

    // Fallback (aún base64 en BD): reescala con sharp.
    const b64 = raw.replace(/^data:[^;]+;base64,/, '');
    const input = Buffer.from(b64, 'base64');
    // El desenfoque va DESPUÉS de reescalar: aplicado antes, el reescalado lo diluiría
    // y cada ancho quedaría con una suavidad distinta.
    const out = await sharp(input)
      .resize({ width: w, withoutEnlargement: true })
      .blur(desenfoqueDe(w))
      .webp({ quality: 72 })
      .toBuffer();

    cache.set(key, out);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
