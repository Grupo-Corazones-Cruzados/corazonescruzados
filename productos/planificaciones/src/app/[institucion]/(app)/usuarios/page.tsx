import { redirect } from 'next/navigation';

/**
 * El módulo «Usuarios» ya no existe (Fernando, 2026-11-08, como en Automatizaciones): las cuentas
 * se administran en Configuración ▸ Usuarios. Esta ruta solo lleva allí a quien tenga un enlace viejo.
 */
export default async function PaginaUsuarios({ params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  redirect(`/${institucion}/configuracion?seccion=usuarios`);
}
