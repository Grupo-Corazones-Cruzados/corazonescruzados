/**
 * CANDIDATOS — `/candidatos` (Fernando, 2026-11-01; desde 2026-11-11 solo la presentación y el botón
 * «Postularme», que abre la ventana con los apartados y el formulario). Hasta que Fernando la dé por
 * buena no se indexa.
 */

import type { Metadata } from 'next';
import PaginaCandidatos from '@/components/sitio/PaginaCandidatos';

export const metadata: Metadata = {
  title: 'Candidatos',
  alternates: { canonical: '/candidatos' },
  robots: { index: false, follow: true },
};

export default function CandidatosPage() {
  return <PaginaCandidatos />;
}
