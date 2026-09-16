import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario } from '@/lib/sesion';
import { INICIO_DE_ROL } from '@/lib/permisos';

export const dynamic = 'force-dynamic';

/** /mi-institucion → a su inicio si ya hay sesión de esa institución; si no, a su acceso. */
export default async function EntradaDeLaInstitucion({ params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const existe = await prisma.inquilino.findUnique({ where: { slug: institucion }, select: { id: true } });
  if (!existe) notFound();

  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== institucion || sesion.inquilinoId !== existe.id) redirect(`/${institucion}/acceso`);
  redirect(`/${institucion}/${INICIO_DE_ROL[sesion.rol]}`);
}
