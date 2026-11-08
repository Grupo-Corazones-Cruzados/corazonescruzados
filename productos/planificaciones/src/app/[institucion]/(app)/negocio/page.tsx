import { redirect } from 'next/navigation';

/**
 * El módulo «Negocio» vive ahora en Configuración ▸ Negocio (Fernando, 2026-11-08, como en
 * Automatizaciones), junto con el logo y la plantilla por defecto. Esta ruta lleva allí.
 */
export default async function PaginaNegocio({ params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  redirect(`/${institucion}/configuracion?seccion=negocio`);
}
