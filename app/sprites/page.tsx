import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { espacioHabilitado } from '@/lib/espacio-trabajo/guardia';
import SpritesEmbebido from '@/components/herramientas/SpritesEmbebido';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cortador de sprites', robots: { index: false, follow: false } };

/** Lo que enmarcan las apps instaladas. Fuera de la instancia local no existe. */
export default function PaginaSprites() {
  if (!espacioHabilitado()) notFound();
  return <Suspense fallback={null}><SpritesEmbebido /></Suspense>;
}
