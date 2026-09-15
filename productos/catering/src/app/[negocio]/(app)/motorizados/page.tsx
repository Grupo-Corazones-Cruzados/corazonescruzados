import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { puede } from '@/lib/permisos';
import MotorizadosCliente from './MotorizadosCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Motorizados' };

export default async function PaginaMotorizados({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino, sesion } = await exigirContexto(negocio, 'despacho');
  const [motorizados, clientes] = await Promise.all([
    prisma.motorizado.findMany({ where: { inquilinoId: inquilino.id }, orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] }),
    prisma.cliente.findMany({
      where: { inquilinoId: inquilino.id, estado: 'ACTIVO' },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, direccion: true, direccion2: true, motorizadoId: true, motorizado2Id: true, colorIdentificador: true },
    }),
  ]);
  return (
    <MotorizadosCliente
      slug={negocio}
      veClientes={puede(sesion.rol, 'clientes')}
      motorizados={motorizados.map((m) => ({ id: m.id, nombre: m.nombre, celular: m.celular, color: m.color, activo: m.activo }))}
      clientes={clientes}
    />
  );
}
