import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { espacioHabilitado } from '@/lib/espacio-trabajo/guardia';
import ContenidoEmbebido from '@/components/centralized/generacion-contenido/ContenidoEmbebido';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Generación de Contenido', robots: { index: false, follow: false } };

/** Lo que enmarcan las apps instaladas. Fuera de la instancia local no existe. */
export default function PaginaContenido() {
  if (!espacioHabilitado()) notFound();
  return <Suspense fallback={null}><ContenidoEmbebido /></Suspense>;
}
