import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { aDia, hoyEn } from '@/lib/fechas';
import FeriadosCliente from './FeriadosCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Feriados' };

export default async function PaginaFeriados({ params, searchParams }: { params: Promise<{ negocio: string }>; searchParams: Promise<{ anio?: string }> }) {
  const { negocio } = await params;
  const q = await searchParams;
  const { inquilino } = await exigirContexto(negocio, 'administrar');
  const anioHoy = Number(hoyEn(inquilino.zonaHoraria).slice(0, 4));
  const anio = Number(q.anio) || anioHoy;
  const feriados = await prisma.feriado.findMany({
    where: { inquilinoId: inquilino.id, fecha: { gte: new Date(`${anio}-01-01T00:00:00.000Z`), lte: new Date(`${anio}-12-31T00:00:00.000Z`) } },
    orderBy: { fecha: 'asc' },
  });
  return <FeriadosCliente slug={negocio} anio={anio} anioHoy={anioHoy} feriados={feriados.map((f) => ({ id: f.id, fecha: aDia(f.fecha), nombre: f.nombre, esLaborable: f.esLaborable }))} />;
}
