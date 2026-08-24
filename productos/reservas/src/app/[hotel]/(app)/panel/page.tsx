import { addDays } from 'date-fns';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { inicioDelDia, VIVAS } from '@/lib/reservas';
import PanelCliente, { type UbicacionVista } from './PanelCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel' };

export default async function PaginaPanel({ params }: { params: Promise<{ hotel: string }> }) {
  const { hotel } = await params;
  const { inquilino, sesion } = await exigirContexto(hotel);

  const desde = inicioDelDia();
  const hasta = addDays(desde, 8);

  // Una sola consulta por el árbol del hotel. Las reservas se acotan a la ventana
  // que el panel necesita (hoy + 7 días): traerlas todas crecería sin límite con el
  // histórico y la pantalla no lo usa.
  const ubicaciones = await prisma.ubicacion.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: {
      suites: {
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        include: {
          reservas: {
            where: { estado: { in: VIVAS }, salida: { gte: desde }, entrada: { lte: hasta } },
            orderBy: { entrada: 'asc' },
            select: {
              id: true,
              clienteNombre: true,
              entrada: true,
              salida: true,
              estado: true,
              estadoPago: true,
            },
          },
        },
      },
    },
  });

  const datos: UbicacionVista[] = ubicaciones.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    fotoUrl: u.fotoUrl,
    suites: u.suites.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      fotoUrl: s.fotoUrl,
      reservas: s.reservas.map((r) => ({
        id: r.id,
        clienteNombre: r.clienteNombre,
        entrada: r.entrada.toISOString(),
        salida: r.salida.toISOString(),
        estado: r.estado,
        estadoPago: r.estadoPago,
      })),
    })),
  }));

  return (
    <PanelCliente
      slug={hotel}
      hotel={inquilino.nombre}
      ubicaciones={datos}
      puedeOperar={sesion.rol !== 'CONSULTA'}
    />
  );
}
