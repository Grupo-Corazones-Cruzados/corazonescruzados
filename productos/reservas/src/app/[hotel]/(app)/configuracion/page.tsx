import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { hayCloudinary } from '@/lib/imagenes';
import ConfiguracionCliente from './ConfiguracionCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion({
  params,
}: {
  params: Promise<{ hotel: string }>;
}) {
  const { hotel } = await params;
  const { inquilino } = await exigirContexto(hotel, 'ADMIN');

  const ubicaciones = await prisma.ubicacion.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: {
      suites: {
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        include: { _count: { select: { reservas: true } } },
      },
    },
  });

  return (
    <ConfiguracionCliente
      slug={hotel}
      hayCloudinary={hayCloudinary}
      marca={{
        nombre: inquilino.nombre,
        colorAcento: inquilino.colorAcento,
        tema: inquilino.tema,
        logoUrl: inquilino.logoUrl,
        moneda: inquilino.moneda,
      }}
      plan={
        inquilino.suscripcion
          ? {
              nombre: inquilino.suscripcion.plan.nombre,
              precioMensual: Number(inquilino.suscripcion.plan.precioMensual),
              moneda: inquilino.suscripcion.plan.moneda,
              estado: inquilino.suscripcion.estado,
              pagadoHasta: inquilino.suscripcion.pagadoHasta?.toISOString() ?? null,
              caracteristicas: inquilino.suscripcion.plan.caracteristicas,
            }
          : null
      }
      ubicaciones={ubicaciones.map((u) => ({
        id: u.id,
        nombre: u.nombre,
        fotoUrl: u.fotoUrl,
        suites: u.suites.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          fotoUrl: s.fotoUrl,
          capacidad: s.capacidad,
          precioNoche: s.precioNoche ? Number(s.precioNoche) : null,
          reservas: s._count.reservas,
        })),
      }))}
    />
  );
}
