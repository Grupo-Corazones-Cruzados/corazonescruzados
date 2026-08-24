import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

/** /carliza → al panel si ya hay sesión de ese hotel; si no, a su acceso. */
export default async function EntradaDelHotel({ params }: { params: Promise<{ hotel: string }> }) {
  const { hotel } = await params;
  const existe = await prisma.inquilino.findUnique({ where: { slug: hotel }, select: { id: true } });
  if (!existe) notFound();

  const sesion = await leerSesionUsuario();
  redirect(sesion?.slug === hotel && sesion.inquilinoId === existe.id ? `/${hotel}/panel` : `/${hotel}/acceso`);
}
