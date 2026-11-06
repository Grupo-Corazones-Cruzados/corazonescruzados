import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { espacioHabilitado } from '@/lib/espacio-trabajo/guardia';
import GumdramonEmbebido from '@/components/gumdramon/GumdramonEmbebido';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gumdramon', robots: { index: false, follow: false } };

/** Lo que abre el teléfono por Tailscale. Fuera de la instancia local no existe. */
export default function PaginaGumdramon() {
  if (!espacioHabilitado()) notFound();
  return <Suspense fallback={null}><GumdramonEmbebido /></Suspense>;
}
