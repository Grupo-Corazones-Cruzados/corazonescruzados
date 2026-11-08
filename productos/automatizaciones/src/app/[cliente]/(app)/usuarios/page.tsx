import { redirect } from 'next/navigation';

/**
 * El módulo «Cuentas» ya no existe (Fernando, 2026-11-08): los usuarios se administran en
 * Configuración ▸ Usuarios. Esta ruta solo lleva allí a quien tenga un enlace viejo.
 */
export default async function PaginaUsuarios({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  redirect(`/${cliente}/configuracion?seccion=usuarios`);
}
