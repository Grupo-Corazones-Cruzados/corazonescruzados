/**
 * Imágenes del portafolio en el CV público, REDIMENSIONADAS.
 *
 * `member_portfolio_items.images` guarda **data URLs base64 dentro de la fila** (PNG
 * de hasta ~2 MB cada uno). Mandarlas en el JSON del CV repetiría el fallo que en el
 * marketplace dejó la lista en 4,8 MB / 3,7 s. Aquí se decodifica solo la imagen
 * pedida, se reescala con `sharp` y se sirve en WebP con caché.
 *
 * ⚠️ **El token también manda aquí.** Si la imagen se sirviera por id de ítem sin
 * comprobar el token, revocar el enlace dejaría las fotos accesibles: se comprueba
 * que el ítem sea **del miembro de ese token**, no solo que exista.
 */
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { pool } from '@/lib/db';
import { isCloudinaryUrl, cloudinaryResized } from '@/lib/cloudinary';
import { miembroDeToken } from '@/lib/members/cv-share';

export const dynamic = 'force-dynamic';

const ANCHOS = new Set([240, 480, 900, 1600]);

// Caché de proceso (Railway es persistente), acotada por FIFO.
const cache = new Map<string, Buffer>();
const CACHE_MAX = 200;

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const memberId = await miembroDeToken(token);
    if (!memberId) return new NextResponse(null, { status: 404 });

    const itemId = parseInt(req.nextUrl.searchParams.get('item') || '', 10);
    if (!Number.isFinite(itemId)) return new NextResponse(null, { status: 400 });
    const i = Math.max(0, parseInt(req.nextUrl.searchParams.get('i') || '0', 10) || 0);
    let w = parseInt(req.nextUrl.searchParams.get('w') || '480', 10) || 480;
    if (!ANCHOS.has(w)) w = 480;

    const key = `${memberId}:${itemId}:${i}:${w}`;
    const hit = cache.get(key);
    if (hit) {
      return new NextResponse(new Uint8Array(hit), {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }

    // El `AND member_id` es lo que ata la imagen al token: con el token de una persona
    // no se saca la foto del portafolio de otra aunque se adivine el id del ítem.
    const { rows: [row] } = await pool.query(
      `SELECT COALESCE(images[$3], CASE WHEN $3 = 1 THEN image_url END) AS img
         FROM gcc_world.member_portfolio_items
        WHERE id = $1 AND member_id = $2`,
      [itemId, memberId, i + 1],
    );
    if (!row?.img) return new NextResponse(null, { status: 404 });

    const raw = String(row.img);
    if (isCloudinaryUrl(raw)) return NextResponse.redirect(cloudinaryResized(raw, w));
    if (/^https?:\/\//i.test(raw)) return NextResponse.redirect(raw);

    const b64 = raw.replace(/^data:[^;]+;base64,/, '');
    const out = await sharp(Buffer.from(b64, 'base64'))
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();

    cache.set(key, out);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);

    return new NextResponse(new Uint8Array(out), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (err: any) {
    console.error('CV imagen error:', err?.message);
    return new NextResponse(null, { status: 500 });
  }
}
