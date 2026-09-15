import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { cargarServicios } from '@/lib/servicios-db';
import { calcularDia } from '@/lib/despacho';
import { aDia, hoyEn, mesDe, sumarDias, esDia } from '@/lib/fechas';
import ReportesCliente, { type Reporte } from './ReportesCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reportes' };

/**
 * Los indicadores del negocio para un periodo. Las entregas se cuentan con la
 * misma función que arma las etiquetas, día a día: es más lento que un COUNT
 * pero es la verdad, no una aproximación.
 */
export default async function PaginaReportes({ params, searchParams }: { params: Promise<{ negocio: string }>; searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const { negocio } = await params;
  const q = await searchParams;
  const { inquilino } = await exigirContexto(negocio, 'reportes');
  const hoy = hoyEn(inquilino.zonaHoraria);
  const mes = mesDe(hoy);
  const desde = q.desde && esDia(q.desde) ? q.desde : mes.desde;
  const hasta = q.hasta && esDia(q.hasta) && q.hasta >= desde ? q.hasta : mes.hasta;

  const [servicios, clientesPorEstado, cancelaciones, restricciones, motorizados] = await Promise.all([
    cargarServicios(inquilino),
    prisma.cliente.groupBy({ by: ['estado'], where: { inquilinoId: inquilino.id }, _count: { id: true } }),
    prisma.cancelacion.findMany({ where: { inquilinoId: inquilino.id, activa: true, fecha: { gte: new Date(`${desde}T00:00:00.000Z`), lte: new Date(`${hasta}T00:00:00.000Z`) } }, select: { fecha: true, autor: true } }),
    prisma.clienteRestriccion.groupBy({ by: ['alimentoId'], where: { cliente: { inquilinoId: inquilino.id, estado: 'ACTIVO' } }, _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
    prisma.cliente.groupBy({ by: ['motorizadoId'], where: { inquilinoId: inquilino.id, estado: 'ACTIVO' }, _count: { id: true } }),
  ]);

  // Entregas del periodo, día a día (tope: 62 días, para no recorrer un año entero).
  const dias: string[] = [];
  for (let d = desde; d <= hasta && dias.length < 62; d = sumarDias(d, 1)) dias.push(d);
  const porDia = await Promise.all(dias.map(async (d) => { const x = await calcularDia(inquilino, d); return { dia: d, entregas: x.entregas.length, comidas: x.entregas.reduce((a, e) => a + e.comidas.length, 0), cancelados: x.cancelados.length }; }));

  const alimentos = await prisma.alimento.findMany({ where: { id: { in: restricciones.map((r) => r.alimentoId) } }, select: { id: true, nombre: true } });
  const nombresMoto = await prisma.motorizado.findMany({ where: { inquilinoId: inquilino.id }, select: { id: true, nombre: true } });

  const diaSemana = [0, 0, 0, 0, 0, 0, 0];
  for (const c of cancelaciones) diaSemana[c.fecha.getUTCDay()]++;

  const reporte: Reporte = {
    desde, hasta,
    kpis: {
      clientesActivos: clientesPorEstado.find((c) => c.estado === 'ACTIVO')?._count.id ?? 0,
      serviciosActivos: servicios.filter((s) => s.estado === 'ACTIVO').length,
      porVencer: servicios.filter((s) => s.estado === 'ACTIVO' && s.resumen.diasRestantes > 0 && s.resumen.diasRestantes <= 5).length,
      entregas: porDia.reduce((a, d) => a + d.entregas, 0),
      comidas: porDia.reduce((a, d) => a + d.comidas, 0),
      cancelaciones: cancelaciones.length,
      cancelacionesCliente: cancelaciones.filter((c) => c.autor === 'CLIENTE').length,
      diasConsumidosTotal: servicios.reduce((a, s) => a + s.resumen.diasConsumidos, 0),
      diasContratadosTotal: servicios.reduce((a, s) => a + s.diasTotales, 0),
    },
    clientesPorEstado: clientesPorEstado.map((c) => ({ estado: c.estado, n: c._count.id })),
    serviciosPorEstado: (['ACTIVO', 'SUSPENDIDO', 'VENCIDO'] as const).map((e) => ({ estado: e, n: servicios.filter((s) => s.estado === e).length })),
    porDia,
    cancelacionesPorDiaSemana: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d, i) => ({ dia: d, n: diaSemana[i] })),
    clientesPorMotorizado: motorizados.map((m) => ({ motorizado: nombresMoto.find((x) => x.id === m.motorizadoId)?.nombre ?? 'Sin asignar', n: m._count.id })).sort((a, b) => b.n - a.n),
    topRestricciones: restricciones.map((r) => ({ alimento: alimentos.find((a) => a.id === r.alimentoId)?.nombre ?? '?', n: r._count.id })),
    servicios: servicios.map((s) => ({ cliente: s.cliente.nombre, estado: s.estado, situacion: s.resumen.situacion, inicio: aDia(s.fechaInicio), fin: s.resumen.fechaFin, consumidos: s.resumen.diasConsumidos, total: s.diasTotales, cancelaciones: s.resumen.cancelacionesUsadas })),
  };

  return <ReportesCliente slug={negocio} reporte={reporte} mesesRetencion={inquilino.suscripcion?.plan.mesesRetencion ?? null} />;
}
