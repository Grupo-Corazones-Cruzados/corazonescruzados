import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { aCampoFecha } from '@/lib/fechas';
import ReportesCliente, { type FilaReporte } from './ReportesCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reportes' };

export default async function PaginaReportes({
  params,
  searchParams,
}: {
  params: Promise<{ negocio: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string; estado?: string; metodo?: string }>;
}) {
  const { negocio } = await params;
  const f = await searchParams;
  const { inquilino } = await exigirContexto(negocio, 'cobrar');

  // Por defecto, el mes en curso: es lo que se consulta casi siempre, y además es
  // todo lo que va a existir cuando la purga haya corrido.
  const hoy = new Date();
  const desde = f.desde || aCampoFecha(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const hasta = f.hasta || aCampoFecha(hoy);

  const pedidos = await prisma.pedido.findMany({
    where: {
      inquilinoId: inquilino.id,
      dia: { gte: new Date(`${desde}T00:00:00.000Z`), lte: new Date(`${hasta}T00:00:00.000Z`) },
      ...(f.estado ? { estado: f.estado as never } : {}),
      ...(f.metodo ? { metodoPago: f.metodo as never } : {}),
    },
    orderBy: [{ dia: 'desc' }, { numero: 'desc' }],
    include: {
      mesa: { include: { zona: true } },
      mesero: { select: { nombre: true } },
      items: { select: { id: true, cantidad: true } },
    },
  });

  const filas: FilaReporte[] = pedidos.map((p) => ({
    id: p.id,
    numero: p.numero,
    dia: p.dia.toISOString(),
    creado: p.creado.toISOString(),
    mesa: p.mesa.nombre,
    zona: p.mesa.zona.nombre,
    mesero: p.mesero?.nombre ?? null,
    estado: p.estado,
    metodoPago: p.metodoPago,
    platos: p.items.reduce((a, i) => a + i.cantidad, 0),
    subtotal: Number(p.subtotal),
    iva: Number(p.iva),
    total: Number(p.total),
  }));

  return (
    <ReportesCliente
      slug={negocio}
      moneda={inquilino.moneda}
      filas={filas}
      filtro={{ desde, hasta, estado: f.estado ?? '', metodo: f.metodo ?? '' }}
      mesesRetencion={inquilino.suscripcion?.plan.mesesRetencion ?? null}
    />
  );
}
