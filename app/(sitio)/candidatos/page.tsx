/**
 * CANDIDATOS — `/candidatos` y `/candidatos/<apartado>` (Fernando, 2026-11-01).
 *
 * Arriba, la presentación (titular con el cruce del corazón y su texto); debajo,
 * los apartados del formulario de postulación en su orden, uno por pestaña (`TemasCandidatos`), para
 * revisar todo el contenido desde aquí. Hasta que Fernando lo dé por bueno no se indexa.
 */

import type { Metadata } from 'next';
import PaginaCandidatos from '@/components/sitio/PaginaCandidatos';
import { PASOS_POSTULACION_IDS } from '@/lib/sitio/pasosPostulacion';

export const metadata: Metadata = {
  title: 'Candidatos',
  alternates: { canonical: '/candidatos' },
  robots: { index: false, follow: true },
};

export default function CandidatosPage() {
  return <PaginaCandidatos paso={PASOS_POSTULACION_IDS[0].id} />;
}
