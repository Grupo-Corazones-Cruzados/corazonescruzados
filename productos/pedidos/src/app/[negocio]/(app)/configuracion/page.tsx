import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { hayCloudinary } from '@/lib/imagenes';
import ConfiguracionCliente from './ConfiguracionCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino } = await exigirContexto(negocio, 'administrar');

  const zonas = await prisma.zona.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: {
      mesas: {
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        include: { _count: { select: { pedidos: true } } },
      },
    },
  });

  return (
    <ConfiguracionCliente
      slug={negocio}
      hayCloudinary={hayCloudinary}
      marca={{
        nombre: inquilino.nombre,
        colorAcento: inquilino.colorAcento,
        tema: inquilino.tema,
        logoUrl: inquilino.logoUrl,
        moneda: inquilino.moneda,
      }}
      facturacion={{
        aplicaIva: inquilino.aplicaIva,
        ivaPorcentaje: Number(inquilino.ivaPorcentaje),
        precioConIva: inquilino.precioConIva,
      }}
      plan={
        inquilino.suscripcion
          ? {
              nombre: inquilino.suscripcion.plan.nombre,
              precioMensual: Number(inquilino.suscripcion.plan.precioMensual),
              moneda: inquilino.suscripcion.plan.moneda,
              pagadoHasta: inquilino.suscripcion.pagadoHasta?.toISOString() ?? null,
              mesesRetencion: inquilino.suscripcion.plan.mesesRetencion,
              caracteristicas: inquilino.suscripcion.plan.caracteristicas,
            }
          : null
      }
      zonas={zonas.map((z) => ({
        id: z.id,
        nombre: z.nombre,
        mesas: z.mesas.map((m) => ({
          id: m.id,
          nombre: m.nombre,
          capacidad: m.capacidad,
          pedidos: m._count.pedidos,
        })),
      }))}
    />
  );
}
