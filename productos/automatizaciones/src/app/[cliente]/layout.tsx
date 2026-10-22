import type { Metadata, Viewport } from 'next';
import { prisma } from '@/lib/db';
import { ACENTO_GCC, esHexValido } from '@/lib/marca';

type Params = Promise<{ cliente: string }>;

async function marcaDe(cliente: string) {
  const inq = await prisma.inquilino.findUnique({
    where: { slug: cliente },
    select: { nombre: true, colorAcento: true },
  });
  return {
    nombre: inq?.nombre ?? 'Automatizaciones de WhatsApp',
    color: inq && esHexValido(inq.colorAcento) ? inq.colorAcento : ACENTO_GCC,
  };
}

/**
 * ANCLADA AL INICIO DEL TELÉFONO SE COMPORTA COMO UNA APP. El manifiesto (por
 * cliente) y los meta de Apple son lo que hace que iOS y Android la abran a pantalla
 * completa, sin la barra del navegador tapando la navegación. Va en el armazón de
 * TODO el cliente —acceso incluido— porque se ancla desde donde se esté.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { cliente } = await params;
  const { nombre } = await marcaDe(cliente);
  return {
    manifest: `/${cliente}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: 'default', title: nombre },
    // Next emite `mobile-web-app-capable`; iOS sigue leyendo el suyo.
    other: { 'apple-mobile-web-app-capable': 'yes' },
  };
}

export async function generateViewport({ params }: { params: Params }): Promise<Viewport> {
  const { cliente } = await params;
  const { color } = await marcaDe(cliente);
  return { themeColor: color, viewportFit: 'cover', width: 'device-width', initialScale: 1 };
}

/** Armazón de todo lo que cuelga de /<cliente>/: solo aporta la metadata de app. */
export default function LayoutCliente({ children }: { children: React.ReactNode }) {
  return children;
}
