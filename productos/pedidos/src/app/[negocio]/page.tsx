import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

/** /mi-negocio → al panel si ya hay sesión de ese negocio; si no, a su acceso. */
export default async function EntradaDelHotel({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const existe = await prisma.inquilino.findUnique({ where: { slug: negocio }, select: { id: true } });
  if (!existe) notFound();

  const sesion = await leerSesionUsuario();
  redirect(sesion?.slug === negocio && sesion.inquilinoId === existe.id ? `/${negocio}/panel` : `/${negocio}/acceso`);
}
