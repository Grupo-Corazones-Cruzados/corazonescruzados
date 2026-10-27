import type { Metadata } from 'next';
import HerramientaPortal from './HerramientaPortal';

export const dynamic = 'force-dynamic';

// Un acceso compartido no se indexa ni se previsualiza con su contenido.
export const metadata: Metadata = { title: 'Herramienta · GCC World', robots: { index: false, follow: false } };

export default async function HerramientaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <HerramientaPortal token={token} />;
}
