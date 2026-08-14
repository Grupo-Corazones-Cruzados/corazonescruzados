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
import { cvPublicoDeToken, type CvPublico } from '@/lib/members/cv-share';
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

/** Años de trayectoria: del primer año declarado a hoy. Devuelve 0 si no hay años. */
function aniosDeTrayectoria(cv: CvPublico): number {
  const anios = cv.talentos
    .flatMap((t) => t.experiencia.map((e) => parseInt(e.desde, 10)))
    .filter((n) => Number.isFinite(n) && n > 1950 && n <= new Date().getFullYear());
  if (!anios.length) return 0;
  return Math.max(0, new Date().getFullYear() - Math.min(...anios));
}

export default async function CvPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cv = await cvPublicoDeToken(token);
  // Un token revocado, regenerado o inventado responde igual: 404. La página no
  // distingue «no existe» de «ya no vale».
  if (!cv) notFound();

  return <CvCuerpo cv={cv} token={token} anios={aniosDeTrayectoria(cv)} urlPdf={`/api/cv/${token}/pdf`} />;
}
