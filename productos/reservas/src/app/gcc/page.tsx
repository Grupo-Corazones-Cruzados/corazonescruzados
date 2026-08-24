import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionOperador } from '@/lib/sesion';
import { evaluarAcceso } from '@/lib/inquilino';
import PanelGcc, { type InquilinoGcc, type PlanGcc } from './PanelGcc';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Equipo GCC' };

export default async function PaginaGcc() {
  const op = await leerSesionOperador();
  if (!op) redirect('/gcc/acceso');

  const [inquilinos, planes] = await Promise.all([
    prisma.inquilino.findMany({
      orderBy: { creado: 'desc' },
      include: {
        suscripcion: { include: { plan: true } },
        _count: { select: { usuarios: true, suites: true, reservas: true } },
        pagos: { orderBy: { periodo: 'desc' }, take: 6 },
      },
    }),
    prisma.plan.findMany({ orderBy: { orden: 'asc' } }),
  ]);

  const filas: InquilinoGcc[] = inquilinos.map((i) => ({
    id: i.id,
    slug: i.slug,
    nombre: i.nombre,
    estado: i.estado,
    soloLectura: i.soloLectura,
    creado: i.creado.toISOString(),
    contactoEmail: i.contactoEmail,
    contactoTelefono: i.contactoTelefono,
    acceso: evaluarAcceso(i),
    plan: i.suscripcion ? { id: i.suscripcion.plan.id, nombre: i.suscripcion.plan.nombre } : null,
    precioMensual: i.suscripcion ? Number(i.suscripcion.plan.precioMensual) : 0,
    moneda: i.suscripcion?.plan.moneda ?? 'USD',
    pagadoHasta: i.suscripcion?.pagadoHasta?.toISOString() ?? null,
    estadoSuscripcion: i.suscripcion?.estado ?? null,
    cuentas: i._count.usuarios,
    suites: i._count.suites,
    reservas: i._count.reservas,
    pagos: i.pagos.map((p) => ({
      periodo: p.periodo,
      monto: Number(p.monto),
      estado: p.estado,
      metodo: p.metodo,
      pagadoEn: p.pagadoEn?.toISOString() ?? null,
    })),
  }));

  const listaPlanes: PlanGcc[] = planes.map((p) => ({
    id: p.id,
    slug: p.slug,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precioMensual: Number(p.precioMensual),
    moneda: p.moneda,
    maxUbicaciones: p.maxUbicaciones,
    maxSuites: p.maxSuites,
    maxUsuarios: p.maxUsuarios,
    caracteristicas: p.caracteristicas,
    activo: p.activo,
  }));

  return <PanelGcc operador={op.nombre} inquilinos={filas} planes={listaPlanes} />;
}
