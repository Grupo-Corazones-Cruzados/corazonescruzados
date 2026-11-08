import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * EL LOGO SUBIDO POR EL CLIENTE (Configuración ▸ Negocio, 2026-11-08).
 *
 * Público a propósito: se enseña en la pantalla de acceso, antes de iniciar sesión, igual
 * que el nombre. La URL lleva `?v=<logo_version>`, así que se puede guardar en caché para
 * siempre: un logo nuevo cambia la versión y, con ella, la URL.
 */
export async function GET(_: Request, { params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const inq = await prisma.inquilino.findUnique({ where: { slug: cliente }, select: { logo: true } });
  if (!inq?.logo) return new Response('No hay logo', { status: 404 });
  return new Response(new Uint8Array(inq.logo.datos), {
    headers: {
      'Content-Type': inq.logo.tipo,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
