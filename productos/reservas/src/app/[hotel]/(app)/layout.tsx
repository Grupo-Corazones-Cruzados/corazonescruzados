import type { Metadata, Viewport } from 'next';
import { prisma } from '@/lib/db';
import { exigirContexto } from '@/lib/inquilino';
import { ACENTO_GCC, esHexValido } from '@/lib/marca';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior } from '@/componentes/Navegacion';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';

export const dynamic = 'force-dynamic';

type Params = Promise<{ hotel: string }>;

async function marcaDe(hotel: string) {
  const inq = await prisma.inquilino.findUnique({
    where: { slug: hotel },
    select: { nombre: true, colorAcento: true },
  });
  return {
    nombre: inq?.nombre ?? 'Gestión de Reservas',
    color: inq && esHexValido(inq.colorAcento) ? inq.colorAcento : ACENTO_GCC,
  };
}

/**
 * ANCLADA AL INICIO DEL TELÉFONO SE COMPORTA COMO UNA APP. El manifiesto (por
 * hotel) y los meta de Apple son lo que hace que iOS y Android la abran a pantalla
 * completa y que cambiar de módulo no salte al navegador.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { hotel } = await params;
  const { nombre } = await marcaDe(hotel);
  return {
    manifest: `/${hotel}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: 'default', title: nombre },
    // Next emite `mobile-web-app-capable`; iOS sigue leyendo el suyo.
    other: { 'apple-mobile-web-app-capable': 'yes' },
  };
}

export async function generateViewport({ params }: { params: Params }): Promise<Viewport> {
  const { hotel } = await params;
  const { color } = await marcaDe(hotel);
  return { themeColor: color, viewportFit: 'cover', width: 'device-width', initialScale: 1 };
}

/**
 * Armazón de la aplicación del hotel. `exigirContexto` es quien decide si esta
 * pantalla llega a existir: sin sesión manda a acceder, y con la mensualidad
 * vencida manda a la pantalla de suscripción. Las páginas de dentro ya no
 * comprueban nada de eso.
 */
export default async function LayoutApp({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ hotel: string }>;
}) {
  const { hotel } = await params;
  const { inquilino, sesion } = await exigirContexto(hotel);

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema}>
      <BarraLateral
        slug={hotel}
        hotel={inquilino.nombre}
        logoUrl={inquilino.logoUrl}
        usuario={sesion.nombre}
        rol={sesion.rol}
      />
      <div className="pb-16 lg:ml-16 lg:pb-0">
        {inquilino.soloLectura && <AvisoEscaparate />}
        {children}
      </div>
      <BarraInferior slug={hotel} rol={sesion.rol} />
    </AplicaMarca>
  );
}
