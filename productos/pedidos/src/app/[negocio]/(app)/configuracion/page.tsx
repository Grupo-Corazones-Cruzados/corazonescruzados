import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { urlLogo } from '@/lib/marca';
import { cupoDeCuentas } from '@/lib/limites';
import ConfiguracionCliente, { type PagoVista } from './ConfiguracionCliente';
import type { UsuarioVista } from './SeccionUsuarios';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino, sesion } = await exigirContexto(negocio, 'administrar');

  const [zonas, usuarios, pagos] = await Promise.all([
    prisma.zona.findMany({
      where: { inquilinoId: inquilino.id },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: {
        mesas: {
          orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
          include: { _count: { select: { pedidos: true } } },
        },
      },
    }),
    // Los usuarios del negocio: antes, la página «Usuarios» (2026-11-08).
    prisma.usuario.findMany({
      where: { inquilinoId: inquilino.id },
      orderBy: [{ activo: 'desc' }, { rol: 'asc' }, { nombre: 'asc' }],
    }),
    prisma.pagoMensual.findMany({
      where: { inquilinoId: inquilino.id },
      orderBy: { periodo: 'desc' },
      take: 12,
    }),
  ]);

  const cupo = await cupoDeCuentas(
    inquilino.id,
    // El inquilino del grupo no tiene topes (Fernando, 2026-09-16).
    inquilino.cortesia ? null : (inquilino.suscripcion?.plan.maxUsuarios ?? null),
  );

  const lista: UsuarioVista[] = usuarios.map((u) => ({
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    activo: u.activo,
    ultimoAcceso: u.ultimoAcceso?.toISOString() ?? null,
  }));

  const historial: PagoVista[] = pagos.map((p) => ({
    id: p.id,
    periodo: p.periodo,
    monto: Number(p.monto),
    moneda: p.moneda,
    estado: p.estado,
    metodo: p.metodo,
    pagadoEn: p.pagadoEn?.toISOString() ?? null,
  }));

  return (
    <ConfiguracionCliente
      slug={negocio}
      zona={inquilino.zonaHoraria}
      negocio={{
        nombre: inquilino.nombre,
        logoUrl: urlLogo(inquilino),
        moneda: inquilino.moneda,
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
      pagos={historial}
      usuarios={{ lista, cupo, yoSoy: sesion.uid }}
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
