import { redirect } from 'next/navigation';

/**
 * El módulo «Usuarios» ya no existe (Fernando, 2026-11-08, como en Automatizaciones): los usuarios
 * se administran en Configuración ▸ Usuarios. Esta ruta solo lleva allí a quien tenga un enlace viejo.
 */
export default async function PaginaUsuarios({ params }: { params: Promise<{ hotel: string }> }) {
  const { hotel } = await params;
  redirect(`/${hotel}/configuracion?seccion=usuarios`);
}
