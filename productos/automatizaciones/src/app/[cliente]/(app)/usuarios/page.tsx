import { exigirContexto, topeUsuarios } from '@/lib/inquilino';
import { EXIGE_ROL } from '@/lib/modulos';
import { prisma } from '@/lib/db';
import PanelUsuarios, { type UsuarioVista } from './PanelUsuarios';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Usuarios' };

export default async function PaginaUsuarios({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  // ADMIN: crear cuentas es gobernar el cliente, no operarlo.
  const { inquilino, sesion } = await exigirContexto(cliente, EXIGE_ROL.usuarios, 'usuarios');

  const usuarios = await prisma.usuario.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ activo: 'desc' }, { rol: 'asc' }, { nombre: 'asc' }],
  });

  const lista: UsuarioVista[] = usuarios.map((u) => ({
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    rol: u.rol,
    origen: u.origen,
    activo: u.activo,
    ultimoAcceso: u.ultimoAcceso ? u.ultimoAcceso.toISOString() : null,
    esYo: u.id === sesion.uid,
  }));

  const tope = topeUsuarios(inquilino);

  return (
    <PanelUsuarios
      slug={cliente}
      usuarios={lista}
      tope={tope}
      activas={usuarios.filter((u) => u.activo).length}
    />
  );
}
