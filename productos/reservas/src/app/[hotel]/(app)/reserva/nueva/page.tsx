import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { CabeceraPagina } from '@/componentes/Navegacion';
import FormularioReserva, { type SuiteOpcion } from '@/componentes/FormularioReserva';
import { esFechaHora, hoyEn, sumarDias } from '@/lib/fechas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nueva reserva' };

export default async function PaginaNuevaReserva({
  params,
  searchParams,
}: {
  params: Promise<{ hotel: string }>;
  searchParams: Promise<{ suite?: string; desde?: string; volver?: string }>;
}) {
  const { hotel } = await params;
  const { suite, desde, volver } = await searchParams;
  const { inquilino } = await exigirContexto(hotel, 'GERENTE');

  const suites = await prisma.suite.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ ubicacion: { nombre: 'asc' } }, { orden: 'asc' }, { nombre: 'asc' }],
    select: { id: true, nombre: true, precioNoche: true, ubicacion: { select: { nombre: true } } },
  });

  const opciones: SuiteOpcion[] = suites.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    ubicacion: s.ubicacion.nombre,
    precioNoche: s.precioNoche ? Number(s.precioNoche) : null,
  }));

  // Valores de partida: los que traiga la agenda al pulsar un hueco (`desde` viene
  // como reloj de pared del hotel, AAAA-MM-DDTHH:mm, nunca como instante: el
  // servidor corre en UTC y lo desplazaría cinco horas) y, si no, entrada hoy a
  // las 14:00 y salida mañana a las 12:00 — hoy según el hotel, no según Railway.
  const propuesta = esFechaHora(desde ?? '') ? (desde as string) : null;
  const entrada = propuesta ?? `${hoyEn(inquilino.zonaHoraria)}T14:00`;
  const salida = `${sumarDias(entrada.slice(0, 10), 1)}T12:00`;
  const volverA = volver && volver.startsWith(`/${hotel}/`) ? volver : `/${hotel}/panel`;

  const preseleccion = suite && opciones.some((o) => String(o.id) === suite) ? Number(suite) : undefined;

  return (
    <>
      <CabeceraPagina
        titulo="Nueva reserva"
        acciones={
          <Link
            href={volverA}
            className="flex items-center gap-1 text-[13px] text-tenue hover:text-texto"
          >
            <ChevronLeft className="h-4 w-4" /> Volver
          </Link>
        }
      />
      <div className="p-4 sm:p-6">
        <div className="tarjeta mx-auto max-w-2xl p-5 sm:p-6">
          <FormularioReserva
            slug={hotel}
            suites={opciones}
            moneda={inquilino.moneda}
            inicial={{
              suiteId: preseleccion ?? opciones[0]?.id ?? 0,
              entrada,
              salida,
              propuesta: propuesta !== null,
            }}
          />
        </div>
      </div>
    </>
  );
}
