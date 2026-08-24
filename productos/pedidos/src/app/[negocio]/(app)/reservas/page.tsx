import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import ReservasCliente, { type ReservaVista, type MesaOpcion } from './ReservasCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reservas' };

export default async function PaginaReservas({
  params,
  searchParams,
}: {
  params: Promise<{ negocio: string }>;
  searchParams: Promise<{ dia?: string }>;
}) {
  const { negocio } = await params;
  const { dia } = await searchParams;
  const { inquilino } = await exigirContexto(negocio, 'reservar-mesas');

  const elegido = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? new Date(`${dia}T12:00:00`) : new Date();
  const desde = new Date(elegido);
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date(elegido);
  hasta.setHours(23, 59, 59, 999);

  const [reservas, mesas] = await Promise.all([
    prisma.reservaMesa.findMany({
      where: { inquilinoId: inquilino.id, desde: { lte: hasta }, hasta: { gte: desde } },
      orderBy: { desde: 'asc' },
      include: { mesa: { include: { zona: true } } },
    }),
    prisma.mesa.findMany({
      where: { inquilinoId: inquilino.id },
      orderBy: [{ zona: { nombre: 'asc' } }, { orden: 'asc' }, { nombre: 'asc' }],
      include: { zona: { select: { nombre: true } } },
    }),
  ]);

  const vista: ReservaVista[] = reservas.map((r) => ({
    id: r.id,
    mesaId: r.mesaId,
    mesa: r.mesa.nombre,
    zona: r.mesa.zona.nombre,
    cliente: r.cliente,
    telefono: r.telefono,
    personas: r.personas,
    desde: r.desde.toISOString(),
    hasta: r.hasta.toISOString(),
    estado: r.estado,
    notas: r.notas,
  }));

  const opciones: MesaOpcion[] = mesas.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    zona: m.zona.nombre,
    capacidad: m.capacidad,
  }));

  return (
    <ReservasCliente
      slug={negocio}
      dia={desde.toISOString()}
      reservas={vista}
      mesas={opciones}
    />
  );
}
