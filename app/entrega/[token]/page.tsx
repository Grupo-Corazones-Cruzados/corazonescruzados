import type { Metadata } from 'next';
import EntregaPortal from './EntregaPortal';

export const dynamic = 'force-dynamic';

// Una entrega de un solo uso no se indexa ni se previsualiza con su contenido.
export const metadata: Metadata = { title: 'Entrega · GCC World', robots: { index: false, follow: false } };

export default async function EntregaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <EntregaPortal token={token} />;
}
