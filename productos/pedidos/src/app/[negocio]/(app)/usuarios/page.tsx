import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { cupoDeCuentas } from '@/lib/limites';
import UsuariosCliente, { type UsuarioVista } from './UsuariosCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Usuarios' };

export default async function PaginaUsuarios({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino, sesion } = await exigirContexto(negocio, 'administrar');

  const usuarios = await prisma.usuario.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ activo: 'desc' }, { rol: 'asc' }, { nombre: 'asc' }],
  });

  const filas: UsuarioVista[] = usuarios.map((u) => ({
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    activo: u.activo,
    ultimoAcceso: u.ultimoAcceso?.toISOString() ?? null,
  }));

  const cupo = await cupoDeCuentas(
    inquilino.id,
    inquilino.suscripcion?.plan.maxUsuarios ?? null,
  );

  return <UsuariosCliente cupo={cupo} slug={negocio} usuarios={filas} yoSoy={sesion.uid} />;
}
