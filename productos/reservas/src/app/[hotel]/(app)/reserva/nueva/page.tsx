import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { CabeceraPagina } from '@/componentes/Navegacion';
import FormularioReserva, { type SuiteOpcion } from '@/componentes/FormularioReserva';
import { aCampoFechaHora } from '@/lib/fechas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nueva reserva' };

export default async function PaginaNuevaReserva({
  params,
  searchParams,
}: {
  params: Promise<{ hotel: string }>;
  searchParams: Promise<{ suite?: string; desde?: string }>;
}) {
  const { hotel } = await params;
  const { suite, desde } = await searchParams;
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

  // Valores de partida: los que traiga la agenda al pulsar un hueco y, si no,
  // entrada hoy a las 14:00 y salida mañana a las 12:00.
  const dePetición = desde ? new Date(desde) : null;
  const hoy = dePetición && !Number.isNaN(dePetición.getTime()) ? dePetición : new Date();
  if (!dePetición) hoy.setHours(14, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);
  manana.setHours(12, 0, 0, 0);

  const preseleccion = suite && opciones.some((o) => String(o.id) === suite) ? Number(suite) : undefined;

  return (
    <>
      <CabeceraPagina
        titulo="Nueva reserva"
        acciones={
          <Link
            href={`/${hotel}/panel`}
            className="flex items-center gap-1 text-[13px] text-tenue hover:text-texto"
          >
            <ChevronLeft className="h-4 w-4" /> Volver al panel
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
              entrada: aCampoFechaHora(hoy),
              salida: aCampoFechaHora(manana),
            }}
          />
        </div>
      </div>
    </>
  );
}
