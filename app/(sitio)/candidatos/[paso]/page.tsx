/** Un apartado de Candidatos abierto directo: la misma página con su pestaña elegida. */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PASOS_POSTULACION_IDS } from '@/lib/sitio/pasosPostulacion';
import PaginaCandidatos from '@/components/sitio/PaginaCandidatos';

type Props = { params: Promise<{ paso: string }> };

export function generateStaticParams() {
  return PASOS_POSTULACION_IDS.map((p) => ({ paso: p.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { paso } = await params;
  const p = PASOS_POSTULACION_IDS.find((x) => x.id === paso);
  if (!p) return {};
  return { title: `${p.titulo} · Candidatos`, alternates: { canonical: `/candidatos/${p.id}` }, robots: { index: false, follow: true } };
}

export default async function PasoCandidatoPage({ params }: Props) {
  const { paso } = await params;
  if (!PASOS_POSTULACION_IDS.some((p) => p.id === paso)) notFound();
  return <PaginaCandidatos paso={paso} />;
}
