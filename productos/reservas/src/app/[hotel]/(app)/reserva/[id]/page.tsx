import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, BedDouble, Building2, Phone, IdCard, User } from 'lucide-react';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Insignia } from '@/componentes/ui';
import { ETIQUETA_ESTADO_RESERVA, TONO_ESTADO_RESERVA, noches } from '@/lib/reservas';
import { dinero } from '@/lib/formato';
import { aCampoFechaHora } from '@/lib/fechas';
import DetalleReserva from './DetalleReserva';

export const dynamic = 'force-dynamic';

export default async function PaginaReserva({
  params,
}: {
  params: Promise<{ hotel: string; id: string }>;
}) {
  const { hotel, id } = await params;
  const { inquilino, sesion } = await exigirContexto(hotel);

  const reserva = await prisma.reserva.findFirst({
    // El filtro por inquilino va SIEMPRE, aunque el identificador sea único: es lo
    // que impide leer la reserva de otro hotel escribiendo su número en la barra.
    where: { id: Number(id) || 0, inquilinoId: inquilino.id },
    include: { suite: { include: { ubicacion: true } } },
  });
  if (!reserva) notFound();

  const suites = await prisma.suite.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ ubicacion: { nombre: 'asc' } }, { orden: 'asc' }, { nombre: 'asc' }],
    select: { id: true, nombre: true, precioNoche: true, ubicacion: { select: { nombre: true } } },
  });

  const saldo = Number(reserva.precioTotal) - Number(reserva.anticipo);
  const n = noches(reserva.entrada, reserva.salida);

  const datos = [
    { icono: User, etiqueta: 'Huésped', valor: reserva.clienteNombre },
    { icono: Phone, etiqueta: 'Teléfono', valor: reserva.telefono || '—' },
    { icono: IdCard, etiqueta: 'Documento', valor: reserva.documento || '—' },
    { icono: BedDouble, etiqueta: 'Suite', valor: reserva.suite.nombre },
    { icono: Building2, etiqueta: 'Ubicación', valor: reserva.suite.ubicacion.nombre },
  ];

  return (
    <>
      <CabeceraPagina
        titulo={reserva.clienteNombre}
        descripcion={`${reserva.suite.nombre} · ${reserva.suite.ubicacion.nombre}`}
        acciones={
          <>
            <Insignia tono={TONO_ESTADO_RESERVA[reserva.estado]}>
              {ETIQUETA_ESTADO_RESERVA[reserva.estado]}
            </Insignia>
            <Insignia tono={reserva.estadoPago === 'PAGADO' ? 'exito' : 'aviso'}>
              {reserva.estadoPago === 'PAGADO' ? 'Pagada' : 'Pago pendiente'}
            </Insignia>
            <Link
              href={`/${hotel}/panel`}
              className="flex items-center gap-1 text-[13px] text-tenue hover:text-texto"
            >
              <ChevronLeft className="h-4 w-4" /> Volver
            </Link>
          </>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="tarjeta p-5">
            <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-tenue">
              Estancia
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-tenue">Entrada</p>
                <p className="text-[14px] font-semibold">
                  {format(reserva.entrada, "d 'de' MMMM", { locale: es })}
                </p>
                <p className="text-[12px] text-tenue">{format(reserva.entrada, 'HH:mm')}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-tenue">Salida</p>
                <p className="text-[14px] font-semibold">
                  {format(reserva.salida, "d 'de' MMMM", { locale: es })}
                </p>
                <p className="text-[12px] text-tenue">{format(reserva.salida, 'HH:mm')}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-tenue">Noches</p>
                <p className="text-[14px] font-semibold">{n}</p>
              </div>
            </div>
          </div>

          <div className="tarjeta p-5">
            <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-tenue">
              Huésped
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {datos.map((d) => (
                <div key={d.etiqueta} className="flex items-start gap-2.5">
                  <d.icono className="mt-0.5 h-4 w-4 shrink-0 text-tenue" />
                  <div className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-tenue">{d.etiqueta}</dt>
                    <dd className="truncate text-[13px] font-medium">{d.valor}</dd>
                  </div>
                </div>
              ))}
            </dl>
            {reserva.comentarios && (
              <div className="mt-4 border-t border-borde pt-4">
                <p className="text-[11px] uppercase tracking-wide text-tenue">Comentarios</p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">
                  {reserva.comentarios}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="tarjeta p-5">
            <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-tenue">
              Cuenta
            </h2>
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-tenue">Precio total</dt>
                <dd className="font-semibold">{dinero(reserva.precioTotal, inquilino.moneda)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tenue">Anticipo</dt>
                <dd className="font-semibold">{dinero(reserva.anticipo, inquilino.moneda)}</dd>
              </div>
              <div className="flex justify-between border-t border-borde pt-2.5">
                <dt className="font-semibold">Saldo</dt>
                <dd className={saldo > 0 ? 'font-bold text-aviso' : 'font-bold text-exito'}>
                  {dinero(saldo, inquilino.moneda)}
                </dd>
              </div>
            </dl>
          </div>

          <DetalleReserva
            slug={hotel}
            moneda={inquilino.moneda}
            puedeOperar={sesion.rol !== 'CONSULTA'}
            reserva={{
              id: reserva.id,
              suiteId: reserva.suiteId,
              clienteNombre: reserva.clienteNombre,
              telefono: reserva.telefono,
              documento: reserva.documento,
              entrada: aCampoFechaHora(reserva.entrada),
              salida: aCampoFechaHora(reserva.salida),
              precioTotal: Number(reserva.precioTotal),
              anticipo: Number(reserva.anticipo),
              estadoPago: reserva.estadoPago as 'PENDIENTE' | 'PAGADO',
              estado: (reserva.estado === 'ELIMINADA' ? 'FINALIZADA' : reserva.estado) as
                | 'OCUPADA'
                | 'POR_SALIR'
                | 'FINALIZADA',
              comentarios: reserva.comentarios,
            }}
            suites={suites.map((s) => ({
              id: s.id,
              nombre: s.nombre,
              ubicacion: s.ubicacion.nombre,
              precioNoche: s.precioNoche ? Number(s.precioNoche) : null,
            }))}
            yaPagada={reserva.estadoPago === 'PAGADO'}
            yaFinalizada={reserva.estado === 'FINALIZADA' || reserva.estado === 'ELIMINADA'}
          />
        </div>
      </div>
    </>
  );
}
