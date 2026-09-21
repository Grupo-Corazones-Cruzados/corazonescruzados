import type { Metadata, Viewport } from 'next';
import { prisma } from '@/lib/db';
import { ACENTO_GCC, esHexValido } from '@/lib/marca';

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
 * completa y que cambiar de módulo no salte al navegador. Va en el armazón de
 * TODO el hotel —acceso y suscripción incluidos— porque se ancla desde donde se
 * esté, y el acceso es lo primero que se ve.
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


/** Armazón de todo lo que cuelga de /<hotel>/: solo aporta la metadata de app. */
export default function LayoutHotel({ children }: { children: React.ReactNode }) {
  return children;
}
