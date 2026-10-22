import type { Metadata, Viewport } from 'next';
import { prisma } from '@/lib/db';
import { ACENTO_GCC, esHexValido } from '@/lib/marca';

type Params = Promise<{ negocio: string }>;

async function marcaDe(negocio: string) {
  const inq = await prisma.inquilino.findUnique({
    where: { slug: negocio },
    select: { nombre: true, colorAcento: true },
  });
  return {
    nombre: inq?.nombre ?? 'Gestión de Catering',
    color: inq && esHexValido(inq.colorAcento) ? inq.colorAcento : ACENTO_GCC,
  };
}

/**
 * ANCLADA AL INICIO DEL TELÉFONO SE COMPORTA COMO UNA APP. El manifiesto (por
 * negocio) y los meta de Apple son lo que hace que iOS y Android la abran a pantalla
 * completa, sin la barra del navegador tapando la navegación. Va en el armazón de
 * TODO el negocio —acceso y registro incluidos— porque se ancla desde donde se esté.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { negocio } = await params;
  const { nombre } = await marcaDe(negocio);
  return {
    manifest: `/${negocio}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: 'default', title: nombre },
    // Next emite `mobile-web-app-capable`; iOS sigue leyendo el suyo.
    other: { 'apple-mobile-web-app-capable': 'yes' },
  };
}

export async function generateViewport({ params }: { params: Params }): Promise<Viewport> {
  const { negocio } = await params;
  const { color } = await marcaDe(negocio);
  return { themeColor: color, viewportFit: 'cover', width: 'device-width', initialScale: 1 };
}

/** Armazón de todo lo que cuelga de /<negocio>/: solo aporta la metadata de app. */
export default function LayoutNegocio({ children }: { children: React.ReactNode }) {
  return children;
}
