import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { hayCloudinary } from '@/lib/imagenes';
import CatalogoCliente, { type CategoriaVista } from './CatalogoCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Carta' };

export default async function PaginaCatalogo({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino } = await exigirContexto(negocio, 'administrar');

  const categorias = await prisma.categoria.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: {
      productos: {
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        include: { _count: { select: { items: true } } },
      },
    },
  });

  const datos: CategoriaVista[] = categorias.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    productos: c.productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: Number(p.precio),
      fotoUrl: p.fotoUrl,
      disponible: p.disponible,
      vendido: p._count.items,
    })),
  }));

  return (
    <CatalogoCliente
      slug={negocio}
      categorias={datos}
      moneda={inquilino.moneda}
      hayCloudinary={hayCloudinary}
      precioConIva={inquilino.precioConIva}
      aplicaIva={inquilino.aplicaIva}
    />
  );
}
