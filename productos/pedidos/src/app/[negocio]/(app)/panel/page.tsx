import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { PEDIDOS_ABIERTOS } from '@/lib/pedidos';
import { puede } from '@/lib/permisos';
import PanelCliente, { type ZonaVista } from './PanelCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mesas' };

export default async function PaginaPanel({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino, sesion } = await exigirContexto(negocio);

  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);
  const finHoy = new Date();
  finHoy.setHours(23, 59, 59, 999);

  // Una sola consulta por el árbol del local. Los pedidos se acotan a los ABIERTOS:
  // el panel es la foto de ahora mismo, y traer el histórico lo haría crecer sin
  // límite para no enseñar nada más.
  const zonas = await prisma.zona.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: {
      mesas: {
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        include: {
          pedidos: {
            where: { estado: { in: PEDIDOS_ABIERTOS } },
            orderBy: { creado: 'desc' },
            include: { items: { select: { id: true, estado: true } } },
          },
          reservas: {
            where: { estado: 'PENDIENTE', hasta: { gte: inicioHoy }, desde: { lte: finHoy } },
            orderBy: { desde: 'asc' },
          },
        },
      },
    },
  });

  const datos: ZonaVista[] = zonas.map((z) => ({
    id: z.id,
    nombre: z.nombre,
    mesas: z.mesas.map((m) => {
      const abierto = m.pedidos[0];
      return {
        id: m.id,
        nombre: m.nombre,
        capacidad: m.capacidad,
        estado: m.estado,
        desde: m.desde.toISOString(),
        pedido: abierto
          ? {
              id: abierto.id,
              numero: abierto.numero,
              estado: abierto.estado,
              total: Number(abierto.total),
              platos: abierto.items.length,
              pendientes: abierto.items.filter((i) => i.estado === 'PENDIENTE').length,
            }
          : null,
        reservas: m.reservas.map((r) => ({
          id: r.id,
          cliente: r.cliente,
          desde: r.desde.toISOString(),
          personas: r.personas,
        })),
      };
    }),
  }));

  return (
    <PanelCliente
      slug={negocio}
      negocio={inquilino.nombre}
      moneda={inquilino.moneda}
      zonas={datos}
      puedeOperar={puede(sesion.rol, 'operar-mesas')}
      puedeTomarPedidos={puede(sesion.rol, 'tomar-pedidos')}
    />
  );
}
