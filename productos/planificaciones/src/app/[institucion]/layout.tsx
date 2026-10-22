import type { Metadata, Viewport } from 'next';
import { prisma } from '@/lib/db';
import { ACENTO_GCC, esHexValido } from '@/lib/marca';

type Params = Promise<{ institucion: string }>;

async function marcaDe(institucion: string) {
  const inq = await prisma.inquilino.findUnique({
    where: { slug: institucion },
    select: { nombre: true, colorAcento: true },
  });
  return {
    nombre: inq?.nombre ?? 'Planificación de Clases',
    color: inq && esHexValido(inq.colorAcento) ? inq.colorAcento : ACENTO_GCC,
  };
}

/**
 * ANCLADA AL INICIO DEL TELÉFONO SE COMPORTA COMO UNA APP. El manifiesto (por
 * institución) y los meta de Apple son lo que hace que iOS y Android la abran a pantalla
 * completa, sin la barra del navegador tapando la navegación. Va en el armazón de
 * TODO el institución —acceso incluido— porque se ancla desde donde se esté.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { institucion } = await params;
  const { nombre } = await marcaDe(institucion);
  return {
    manifest: `/${institucion}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: 'default', title: nombre },
    // Next emite `mobile-web-app-capable`; iOS sigue leyendo el suyo.
    other: { 'apple-mobile-web-app-capable': 'yes' },
  };
}

export async function generateViewport({ params }: { params: Params }): Promise<Viewport> {
  const { institucion } = await params;
  const { color } = await marcaDe(institucion);
  return { themeColor: color, viewportFit: 'cover', width: 'device-width', initialScale: 1 };
}

/** Armazón de todo lo que cuelga de /<institucion>/: solo aporta la metadata de app. */
export default function LayoutInstitucion({ children }: { children: React.ReactNode }) {
  return children;
}
