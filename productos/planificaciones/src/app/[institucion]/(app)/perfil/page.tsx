import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { horarioDe, materiasDelDocente } from '@/lib/horario';
import PerfilCliente from './PerfilCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mi perfil' };

export default async function PaginaPerfil({ params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const { inquilino, sesion } = await exigirContexto(institucion);
  const [u, materias, horario] = await Promise.all([
    prisma.usuario.findUniqueOrThrow({ where: { id: sesion.uid }, select: { usuario: true, nombre: true, profesion: true, email: true, rol: true } }),
    materiasDelDocente(inquilino.id, sesion.uid, sesion.rol),
    horarioDe(sesion.uid),
  ]);
  return <PerfilCliente slug={institucion} perfil={u} materias={materias} horario={horario} soloLectura={inquilino.soloLectura} />;
}
