import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { cargarServicios } from '@/lib/servicios-db';
import ClientesCliente, { type ClienteFila } from './ClientesCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clientes' };

export default async function PaginaClientes({
  params,
  searchParams,
}: {
  params: Promise<{ negocio: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { negocio } = await params;
  const { estado } = await searchParams;
  const { inquilino } = await exigirContexto(negocio, 'clientes');

  const [clientes, servicios, motorizados] = await Promise.all([
    prisma.cliente.findMany({
      where: { inquilinoId: inquilino.id },
      orderBy: [{ estado: 'asc' }, { nombre: 'asc' }],
      include: { motorizado: { select: { nombre: true, color: true } }, _count: { select: { restricciones: true } } },
    }),
    cargarServicios(inquilino, { estado: { in: ['ACTIVO', 'SUSPENDIDO'] } }),
    prisma.motorizado.findMany({ where: { inquilinoId: inquilino.id, activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
  ]);
  const vigente = new Map(servicios.map((s) => [s.clienteId, s]));

  const filas: ClienteFila[] = clientes.map((c) => {
    const s = vigente.get(c.id);
    return {
      id: c.id,
      nombre: c.nombre,
      email: c.email,
      celular: c.celular,
      estado: c.estado,
      direccion: c.direccion,
      colorIdentificador: c.colorIdentificador,
      motorizado: c.motorizado?.nombre ?? null,
      restricciones: c._count.restricciones,
      creado: c.creado.toISOString(),
      servicio: s
        ? { situacion: s.resumen.situacion, diasRestantes: s.resumen.diasRestantes, diasTotales: s.diasTotales, fechaFin: s.resumen.fechaFin }
        : null,
    };
  });

  return (
    <ClientesCliente
      slug={negocio}
      filas={filas}
      filtroInicial={estado ?? 'TODOS'}
      comidas={inquilino.tiposComida}
      motorizados={motorizados}
    />
  );
}
