import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { cargarServicios } from '@/lib/servicios-db';
import { aDia, hoyEn } from '@/lib/fechas';
import ServiciosCliente, { type ServicioFila } from './ServiciosCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Servicios' };

export default async function PaginaServicios({
  params,
  searchParams,
}: {
  params: Promise<{ negocio: string }>;
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { negocio } = await params;
  const { filtro } = await searchParams;
  const { inquilino } = await exigirContexto(negocio, 'servicios');

  const [servicios, sinServicio] = await Promise.all([
    cargarServicios(inquilino),
    prisma.cliente.findMany({
      where: { inquilinoId: inquilino.id, estado: 'ACTIVO', servicios: { none: { estado: { in: ['ACTIVO', 'SUSPENDIDO'] } } } },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, tiposComida: true },
    }),
  ]);

  const filas: ServicioFila[] = servicios.map((s) => ({
    id: s.id,
    clienteId: s.clienteId,
    cliente: s.cliente.nombre,
    celular: s.cliente.celular,
    motorizado: s.cliente.motorizado?.nombre ?? null,
    estado: s.estado,
    diasTotales: s.diasTotales,
    fechaInicio: aDia(s.fechaInicio),
    tiposComida: s.tiposComida,
    diasSemana: s.diasSemana,
    renovaciones: s.renovaciones,
    resumen: s.resumen,
  }));

  return (
    <ServiciosCliente
      slug={negocio}
      hoy={hoyEn(inquilino.zonaHoraria)}
      filas={filas}
      filtroInicial={filtro ?? 'vigentes'}
      comidas={inquilino.tiposComida}
      diasNegocio={inquilino.diasServicio}
      porcentajeDefecto={inquilino.porcentajeCancelacion}
      sinServicio={sinServicio}
    />
  );
}
