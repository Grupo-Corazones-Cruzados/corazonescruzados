import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { haySubida } from '@/lib/imagenes';
import { cupoDeCuentas } from '@/lib/limites';
import type { UsuarioVista } from './SeccionUsuarios';
import ConfiguracionCliente from './ConfiguracionCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion({
  params,
}: {
  params: Promise<{ hotel: string }>;
}) {
  const { hotel } = await params;
  const { inquilino, sesion } = await exigirContexto(hotel, 'ADMIN');

  // Los usuarios del alojamiento: antes, la página «Usuarios» (2026-11-08).
  const cuentas = await prisma.usuario.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ activo: 'desc' }, { rol: 'asc' }, { nombre: 'asc' }],
  });
  const usuarios: UsuarioVista[] = cuentas.map((u) => ({
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
    // El inquilino del grupo no tiene topes (Fernando, 2026-09-16).
    inquilino.cortesia ? null : (inquilino.suscripcion?.plan.maxUsuarios ?? null),
  );

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
      haySubida={haySubida}
      zona={inquilino.zonaHoraria}
      usuarios={{ lista: usuarios, yoSoy: sesion.uid, cupo }}
      marca={{
        nombre: inquilino.nombre,
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
