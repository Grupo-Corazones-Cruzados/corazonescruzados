import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

/**
 * LA PUERTA DEL CLIENTE: `/peter-tours` → al panel si ya hay sesión suya, y si no, a su
 * acceso.
 *
 * ⚠️ FALTABA, y el síntoma era mudo: el botón «Entrar a Organización» del marketplace
 * construye la dirección como `<producto>/<slug>` (ver `lib/productos/accesos.ts` en la
 * plataforma), así que abría una pestaña en 404 y parecía que el botón «no hacía nada».
 * Las pantallas existían todas; lo que no existía era la entrada.
 */
export default async function EntradaDelCliente({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const existe = await prisma.inquilino.findUnique({ where: { slug: cliente }, select: { id: true } });
  if (!existe) notFound();

  const sesion = await leerSesionUsuario();
  redirect(
    sesion?.slug === cliente && sesion.inquilinoId === existe.id
      ? `/${cliente}/panel`
      : `/${cliente}/acceso`,
  );
}
