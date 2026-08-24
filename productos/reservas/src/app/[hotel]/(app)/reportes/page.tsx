import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import ReportesCliente, { type FilaReporte } from './ReportesCliente';
import { aCampoFecha } from '@/lib/fechas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reportes' };

export default async function PaginaReportes({
  params,
  searchParams,
}: {
  params: Promise<{ hotel: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string; suite?: string; estado?: string }>;
}) {
  const { hotel } = await params;
  const f = await searchParams;
  const { inquilino } = await exigirContexto(hotel);

  // Por defecto, el mes en curso: es lo que se consulta el 95 % de las veces y
  // evita traer el histórico entero solo por abrir la pantalla.
  const hoy = new Date();
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const desde = f.desde || aCampoFecha(primero);
  const hasta = f.hasta || aCampoFecha(hoy);

  const suites = await prisma.suite.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ ubicacion: { nombre: 'asc' } }, { orden: 'asc' }, { nombre: 'asc' }],
    select: { id: true, nombre: true, ubicacion: { select: { nombre: true } } },
  });

  const reservas = await prisma.reserva.findMany({
    where: {
      inquilinoId: inquilino.id,
      entrada: { lte: new Date(`${hasta}T23:59:59`) },
      salida: { gte: new Date(`${desde}T00:00:00`) },
      ...(f.suite ? { suiteId: Number(f.suite) } : {}),
      ...(f.estado
        ? { estado: f.estado as never }
        : { estado: { not: 'ELIMINADA' as never } }),
    },
    orderBy: { entrada: 'desc' },
    include: { suite: { include: { ubicacion: true } } },
  });

  const filas: FilaReporte[] = reservas.map((r) => ({
    id: r.id,
    clienteNombre: r.clienteNombre,
    suite: r.suite.nombre,
    ubicacion: r.suite.ubicacion.nombre,
    entrada: r.entrada.toISOString(),
    salida: r.salida.toISOString(),
    precioTotal: Number(r.precioTotal),
    anticipo: Number(r.anticipo),
    estado: r.estado,
    estadoPago: r.estadoPago,
  }));

  return (
    <ReportesCliente
      slug={hotel}
      moneda={inquilino.moneda}
      filas={filas}
      suites={suites.map((s) => ({ id: s.id, nombre: s.nombre, ubicacion: s.ubicacion.nombre }))}
      filtro={{ desde, hasta, suite: f.suite ?? '', estado: f.estado ?? '' }}
    />
  );
}
