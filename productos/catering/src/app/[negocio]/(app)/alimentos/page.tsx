import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import AlimentosCliente from './AlimentosCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Alimentos' };

export default async function PaginaAlimentos({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino } = await exigirContexto(negocio, 'cocina');
  const alimentos = await prisma.alimento.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    include: { _count: { select: { enMenus: true, restricciones: true } } },
  });
  return (
    <AlimentosCliente
      slug={negocio}
      alimentos={alimentos.map((a) => ({ id: a.id, nombre: a.nombre, categoria: a.categoria, activo: a.activo, enMenus: a._count.enMenus, restricciones: a._count.restricciones }))}
    />
  );
}
