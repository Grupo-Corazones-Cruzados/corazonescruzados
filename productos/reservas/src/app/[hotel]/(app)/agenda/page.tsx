import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { VIVAS, saleEnElDia } from '@/lib/reservas';
import { esDia, hoyEn, inicioDelDiaEn, finDelDiaEn } from '@/lib/fechas';
import AgendaCliente, { type SuiteAgenda, type ReservaPendiente } from './AgendaCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agenda' };

/**
 * La agenda de UNA ubicación en UN día. Las dos cosas llegan por la dirección
 * (/agenda?dia=2026-08-24&ubicacion=3) para que una agenda concreta se pueda
 * enviar por mensaje y abrirse igual. A la agenda se entra desde el «+» de cada
 * ubicación del panel (Fernando, 2026-09-20): aquí ya no hay selector.
 *
 * ⚠️ El día se calcula con la zona del HOTEL. El servidor corre en UTC, y hacerlo
 * con la del proceso es lo que mandaba «Hoy» al día anterior.
 */
export default async function PaginaAgenda({
  params,
  searchParams,
}: {
  params: Promise<{ hotel: string }>;
  searchParams: Promise<{ dia?: string; ubicacion?: string }>;
}) {
  const { hotel } = await params;
  const { dia: diaPedido, ubicacion: ubicacionPedida } = await searchParams;
  const { inquilino, sesion } = await exigirContexto(hotel);
  const zona = inquilino.zonaHoraria;

  const hoy = hoyEn(zona);
  const dia = esDia(diaPedido) ? diaPedido : hoy;
  const desde = inicioDelDiaEn(dia, zona);
  const hasta = finDelDiaEn(dia, zona);

  const ubicaciones = await prisma.ubicacion.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    select: { id: true, nombre: true },
  });
  const ubicacion =
    ubicaciones.find((u) => String(u.id) === ubicacionPedida) ?? ubicaciones[0] ?? null;

  const [suites, pendientes] = await Promise.all([
    ubicacion
      ? prisma.suite.findMany({
          where: { inquilinoId: inquilino.id, ubicacionId: ubicacion.id },
          orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
          include: {
            reservas: {
              where: { estado: { in: VIVAS }, entrada: { lte: hasta }, salida: { gte: desde } },
              orderBy: { entrada: 'asc' },
            },
          },
        })
      : Promise.resolve([]),
    // Saldos pendientes de TODO el hotel (no solo de este día ni de esta
    // ubicación): es la lista que se abre con el «$» del resumen. Lo eliminado
    // no debe nada; lo finalizado con saldo sí, aunque hoy ya no pueda pasar.
    prisma.reserva.findMany({
      where: { inquilinoId: inquilino.id, estadoPago: 'PENDIENTE', estado: { not: 'ELIMINADA' } },
      orderBy: { entrada: 'desc' },
      take: 200,
      include: { suite: { select: { nombre: true, ubicacion: { select: { nombre: true } } } } },
    }),
  ]);

  const datos: SuiteAgenda[] = suites.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    reservas: s.reservas.map((r) => ({
      id: r.id,
      clienteNombre: r.clienteNombre,
      entrada: r.entrada.toISOString(),
      salida: r.salida.toISOString(),
      estado: r.estado,
      estadoPago: r.estadoPago,
      precioTotal: Number(r.precioTotal),
      anticipo: Number(r.anticipo),
      saleEseDia: r.estado === 'POR_SALIR' || saleEnElDia(r.salida, dia, zona),
    })),
  }));

  const deudas: ReservaPendiente[] = pendientes.map((r) => ({
    id: r.id,
    clienteNombre: r.clienteNombre,
    ubicacion: r.suite.ubicacion.nombre,
    suite: r.suite.nombre,
    entrada: r.entrada.toISOString(),
    salida: r.salida.toISOString(),
    estado: r.estado,
    precioTotal: Number(r.precioTotal),
    anticipo: Number(r.anticipo),
  }));

  return (
    <AgendaCliente
      slug={hotel}
      dia={dia}
      hoy={hoy}
      inicioMs={desde.getTime()}
      ubicacion={ubicacion}
      suites={datos}
      pendientes={deudas}
      moneda={inquilino.moneda}
      puedeOperar={sesion.rol !== 'CONSULTA'}
    />
  );
}
