import { notFound } from 'next/navigation';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { puede } from '@/lib/permisos';
import PedidoCliente, { type PedidoVista, type CategoriaVista } from './PedidoCliente';

export const dynamic = 'force-dynamic';

export default async function PaginaPedido({
  params,
}: {
  params: Promise<{ negocio: string; id: string }>;
}) {
  const { negocio, id } = await params;
  const { inquilino, sesion } = await exigirContexto(negocio);

  const pedido = await prisma.pedido.findFirst({
    // El filtro por inquilino va SIEMPRE, aunque el identificador sea único: es lo
    // que impide leer el pedido de otro negocio escribiendo su número en la barra.
    where: { id: Number(id) || 0, inquilinoId: inquilino.id },
    include: {
      mesa: { include: { zona: true } },
      mesero: { select: { nombre: true } },
      items: { orderBy: { creado: 'asc' } },
    },
  });
  if (!pedido) notFound();

  const categorias = await prisma.categoria.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: {
      productos: {
        where: { disponible: true },
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        select: { id: true, nombre: true, precio: true, descripcion: true },
      },
    },
  });

  const vista: PedidoVista = {
    id: pedido.id,
    numero: pedido.numero,
    estado: pedido.estado,
    mesa: pedido.mesa.nombre,
    zona: pedido.mesa.zona.nombre,
    mesero: pedido.mesero?.nombre ?? null,
    comensales: pedido.comensales,
    subtotal: Number(pedido.subtotal),
    iva: Number(pedido.iva),
    ivaPorcentaje: Number(pedido.ivaPorcentaje),
    total: Number(pedido.total),
    metodoPago: pedido.metodoPago,
    creado: pedido.creado.toISOString(),
    items: pedido.items.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      precioUnitario: Number(i.precioUnitario),
      notas: i.notas,
      estado: i.estado,
    })),
  };

  const carta: CategoriaVista[] = categorias
    .filter((c) => c.productos.length > 0)
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      productos: c.productos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: Number(p.precio),
      })),
    }));

  return (
    <PedidoCliente
      slug={negocio}
      moneda={inquilino.moneda}
      pedido={vista}
      carta={carta}
      puedeTomar={puede(sesion.rol, 'tomar-pedidos')}
      puedeCobrar={puede(sesion.rol, 'cobrar')}
      puedeCocinar={puede(sesion.rol, 'cocinar')}
      precioConIva={inquilino.precioConIva}
      aplicaIva={inquilino.aplicaIva}
    />
  );
}
