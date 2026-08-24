import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { PEDIDOS_ABIERTOS } from '@/lib/pedidos';
import CocinaCliente, { type ComandaVista } from './CocinaCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cocina' };

export default async function PaginaCocina({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino } = await exigirContexto(negocio, 'cocinar');

  // La cocina solo mira lo que está abierto, y lo más viejo primero: lo que lleva
  // más tiempo esperando es lo que hay que sacar ya.
  const pedidos = await prisma.pedido.findMany({
    where: { inquilinoId: inquilino.id, estado: { in: PEDIDOS_ABIERTOS } },
    orderBy: { creado: 'asc' },
    include: {
      mesa: { include: { zona: true } },
      items: { orderBy: { creado: 'asc' } },
    },
  });

  const comandas: ComandaVista[] = pedidos.map((p) => ({
    id: p.id,
    numero: p.numero,
    mesa: p.mesa.nombre,
    zona: p.mesa.zona.nombre,
    creado: p.creado.toISOString(),
    estado: p.estado,
    items: p.items.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      notas: i.notas,
      estado: i.estado,
    })),
  }));

  return <CocinaCliente slug={negocio} comandas={comandas} />;
}
