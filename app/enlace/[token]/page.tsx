import type { Metadata } from 'next';
import EnlacePortal from './EnlacePortal';

export const dynamic = 'force-dynamic';

// Un enlace de un solo uso no se indexa ni se previsualiza con su contenido.
export const metadata: Metadata = { title: 'Solicitud · GCC World', robots: { index: false, follow: false } };

export default async function EnlacePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <EnlacePortal token={token} />;
}
