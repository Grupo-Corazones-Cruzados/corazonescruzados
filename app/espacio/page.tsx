import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { espacioHabilitado } from '@/lib/espacio-trabajo/guardia';
import EspacioEmbebido from '@/components/espacio/EspacioEmbebido';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Espacio de trabajo', robots: { index: false, follow: false } };

/** Lo que enmarcan las apps. Fuera de la instancia local no existe. */
export default function PaginaEspacioEmbebido() {
  if (!espacioHabilitado()) notFound();
  return <Suspense fallback={null}><EspacioEmbebido /></Suspense>;
}
