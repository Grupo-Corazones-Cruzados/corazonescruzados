import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import PerfilCliente from './PerfilCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mi perfil' };

export default async function PaginaPerfil({ params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const { sesion } = await exigirContexto(institucion);
  const u = await prisma.usuario.findUniqueOrThrow({ where: { id: sesion.uid }, select: { usuario: true, nombre: true, profesion: true, email: true, rol: true } });
  return <PerfilCliente slug={institucion} perfil={u} />;
}
