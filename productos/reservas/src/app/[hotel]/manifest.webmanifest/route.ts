import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ACENTO_GCC, esHexValido } from '@/lib/marca';

export const dynamic = 'force-dynamic';

/**
 * EL MANIFIESTO, POR HOTEL. Es lo que hace que la aplicación anclada al inicio
 * del teléfono se abra y se mantenga como una app (`display: standalone`) en vez
 * de saltar al navegador al cambiar de módulo (Fernando, 2026-09-20). Lleva el
 * nombre y el color del inquilino, y su ámbito es la carpeta del hotel: todo lo
 * que cuelga de /<hotel>/ —panel, agenda, acceso— se queda dentro.
 *
 * Es público a propósito: el navegador pide el manifiesto SIN cookies, y aquí
 * no hay más que el nombre y el color, que ya se ven en la pantalla de acceso.
 */
export async function GET(_: Request, { params }: { params: Promise<{ hotel: string }> }) {
  const { hotel } = await params;
  const inquilino = await prisma.inquilino.findUnique({
    where: { slug: hotel },
    select: { nombre: true, colorAcento: true, tema: true },
  });
  if (!inquilino) return NextResponse.json({ error: 'No existe' }, { status: 404 });

  const color = esHexValido(inquilino.colorAcento) ? inquilino.colorAcento : ACENTO_GCC;
  const fondo = inquilino.tema === 'OSCURO' ? '#1b1a19' : '#faf9f8';

  return NextResponse.json(
    {
      name: `${inquilino.nombre} · Reservas`,
      short_name: inquilino.nombre.slice(0, 12),
      description: 'Gestión de reservas: ubicaciones, suites, agenda y reportes.',
      id: `/${hotel}/`,
      start_url: `/${hotel}/panel`,
      scope: `/${hotel}/`,
      display: 'standalone',
      orientation: 'portrait',
      lang: 'es',
      theme_color: color,
      background_color: fondo,
      icons: [
        { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
}
