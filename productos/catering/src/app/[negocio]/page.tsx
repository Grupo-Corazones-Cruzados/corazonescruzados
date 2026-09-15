import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario } from '@/lib/sesion';
import { INICIO_DE_ROL } from '@/lib/permisos';

export const dynamic = 'force-dynamic';

/** /mi-negocio → a su puesto si ya hay sesión de ese negocio; si no, a su acceso. */
export default async function EntradaDelNegocio({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const existe = await prisma.inquilino.findUnique({ where: { slug: negocio }, select: { id: true } });
  if (!existe) notFound();

  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== negocio || sesion.inquilinoId !== existe.id) redirect(`/${negocio}/acceso`);
  redirect(sesion.tipo === 'cliente' ? `/${negocio}/mi-servicio` : `/${negocio}/${INICIO_DE_ROL[sesion.rol]}`);
}
