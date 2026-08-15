/**
 * CV PÚBLICO — la página que abre un reclutador con el enlace.
 *
 * Aquí solo se **resuelve el token y se calculan las cifras**; la maqueta vive en
 * `components/cv/CvCuerpo.tsx`, que necesita estado para conmutar las pestañas.
 *
 * ── LO QUE NO ESTÁ AQUÍ ───────────────────────────────────────────────────────
 * Ni un solo filtro de privacidad. Lo que no debe verse **no sale del servidor**
 * (`armarCvPublico`), así que no hay ningún `if (mostrarTelefono)`: si el teléfono
 * llega, es que se publica. Por eso también es seguro que el objeto entero viaje al
 * componente de cliente — es exactamente lo que la página enseña.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cvPublicoDeToken } from '@/lib/members/cv-share';
import CvCuerpo from '@/components/cv/CvCuerpo';

export const dynamic = 'force-dynamic';

/** El título de la pestaña lleva el nombre; el resto no se declara: es `noindex`. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const cv = await cvPublicoDeToken(token);
  return {
    title: cv ? `${cv.nombre} — Currículum` : 'Currículum',
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function CvPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cv = await cvPublicoDeToken(token);
  // Un token revocado, regenerado o inventado responde igual: 404. La página no
  // distingue «no existe» de «ya no vale».
  if (!cv) notFound();

  // Los años de trayectoria se calculan en el cuerpo: dependen del talento elegido.
  return <CvCuerpo cv={cv} token={token} urlPdf={`/api/cv/${token}/pdf`} />;
}
