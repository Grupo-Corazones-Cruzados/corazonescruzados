import type { Metadata } from 'next';
import { leerFlujoCompartido } from '@/lib/espacio-trabajo/flujo-compartido';
import FlujoPortal from './FlujoPortal';

export const dynamic = 'force-dynamic';

// El enlace es la llave: no se indexa ni viaja a otra web al salir de aquí.
export const metadata: Metadata = { title: 'Diagrama de flujo · GCC World', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function FlujoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <FlujoPortal compartido={await leerFlujoCompartido(token)} />;
}
