import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { inicioDelDia, finDelDia, VIVAS } from '@/lib/reservas';
import AgendaCliente, { type UbicacionAgenda } from './AgendaCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agenda' };

export default async function PaginaAgenda({
  params,
  searchParams,
}: {
  params: Promise<{ hotel: string }>;
  searchParams: Promise<{ dia?: string }>;
}) {
  const { hotel } = await params;
  const { dia } = await searchParams;
  const { inquilino, sesion } = await exigirContexto(hotel);

  // El día llega por la dirección para que una agenda concreta se pueda enviar por
  // mensaje y abrirse igual: /agenda?dia=2026-08-24.
  const elegido = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? new Date(`${dia}T12:00:00`) : new Date();
  const desde = inicioDelDia(elegido);
  const hasta = finDelDia(elegido);

  const ubicaciones = await prisma.ubicacion.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: {
      suites: {
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        include: {
          reservas: {
            where: { estado: { in: VIVAS }, entrada: { lte: hasta }, salida: { gte: desde } },
            orderBy: { entrada: 'asc' },
          },
        },
      },
    },
  });

  const datos: UbicacionAgenda[] = ubicaciones.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    suites: u.suites.map((s) => ({
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
      })),
    })),
  }));

  return (
    <AgendaCliente
      slug={hotel}
      dia={desde.toISOString()}
      moneda={inquilino.moneda}
      ubicaciones={datos}
      puedeOperar={sesion.rol !== 'CONSULTA'}
    />
  );
}
