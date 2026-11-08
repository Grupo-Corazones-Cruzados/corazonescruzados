import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * EL LOGO SUBIDO POR LA INSTITUCIÓN (Configuración ▸ Negocio, 2026-11-08).
 *
 * Se guarda como `data:` en `logo_url` (sin tabla nueva) y se sirve aquí para no viajar dentro
 * de cada página. Público a propósito: se enseña en la pantalla de acceso, antes de iniciar
 * sesión, igual que el nombre. La URL lleva `?v=<huella>` (`lib/marca.ts › urlLogo`), así que se
 * puede guardar en caché para siempre: un logo nuevo cambia la huella y, con ella, la URL.
 */
export async function GET(_: Request, { params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const inq = await prisma.inquilino.findUnique({ where: { slug: institucion }, select: { logoUrl: true } });
  const m = inq?.logoUrl?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!m) return new Response('No hay logo', { status: 404 });
  return new Response(new Uint8Array(Buffer.from(m[2], 'base64')), {
    headers: {
      'Content-Type': m[1],
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
