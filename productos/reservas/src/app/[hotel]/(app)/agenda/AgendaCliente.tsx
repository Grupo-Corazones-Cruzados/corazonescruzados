'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Building2,
  Plus,
  DollarSign,
  Loader2,
  BedDouble,
} from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BotonIcono, EstadoVacio, Insignia, PanelLateral, Tarjeta } from '@/componentes/ui';
import { ETIQUETA_ESTADO_RESERVA, TONO_ESTADO_RESERVA } from '@/lib/reservas';
import { dinero } from '@/lib/formato';
import { diaLocal, sumarDias, type Dia } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import type { EstadoReserva, EstadoPagoReserva } from '@/generated/prisma/enums';

type ReservaAgenda = {
  id: number;
  clienteNombre: string;
  entrada: string;
  salida: string;
  estado: EstadoReserva;
  estadoPago: EstadoPagoReserva;
  precioTotal: number;
  anticipo: number;
  /** Sale dentro del día que se mira (lo decide el servidor con la zona del hotel). */
  saleEseDia: boolean;
};
export type SuiteAgenda = { id: number; nombre: string; reservas: ReservaAgenda[] };
export type ReservaPendiente = {
  id: number;
  clienteNombre: string;
  ubicacion: string;
  suite: string;
  entrada: string;
  salida: string;
  estado: EstadoReserva;
  precioTotal: number;
  anticipo: number;
};

const MS_DIA = 24 * 60 * 60 * 1000;

/** Porcentaje del día (del hotel) que ocupa un instante. Fuera del día se recorta al borde. */
function porcentaje(instante: Date, inicioMs: number) {
  return Math.max(0, Math.min(100, ((instante.getTime() - inicioMs) / MS_DIA) * 100));
}

/**
 * La regla de horas. En el teléfono solo caben cinco marcas (00 · 06 · 12 · 18 ·
 * 23): con ocho, las etiquetas se montaban unas sobre otras. Se colocan por
 * posición y no como columnas, así la marca coincide con su raya.
 */
const MARCAS = [0, 3, 6, 9, 12, 15, 18, 21];

export default function AgendaCliente({
  slug,
  dia,
  hoy,
  inicioMs,
  ubicacion,
  suites,
  pendientes,
  moneda,
  puedeOperar,
}: {
  slug: string;
  dia: Dia;
  hoy: Dia;
  inicioMs: number;
  ubicacion: { id: number; nombre: string } | null;
  suites: SuiteAgenda[];
  pendientes: ReservaPendiente[];
  moneda: string;
  puedeOperar: boolean;
}) {
  const router = useRouter();
  const [cargando, arranca] = useTransition();
  // El día elegido se pinta AL INSTANTE, antes de que el servidor conteste: es lo
  // que hace que la tira y el título respondan al toque aunque la red tarde.
  const [diaSel, setDiaSel] = useState<Dia>(dia);
  useEffect(() => setDiaSel(dia), [dia]);
  const [verSaldos, setVerSaldos] = useState(false);

  const direccion = (d: Dia) =>
    `/${slug}/agenda?dia=${d}${ubicacion ? `&ubicacion=${ubicacion.id}` : ''}`;
  const volver = encodeURIComponent(direccion(diaSel));

  const irA = (d: Dia) => {
    if (d === diaSel && !cargando) return;
    setDiaSel(d);
    arranca(() => router.push(direccion(d)));
  };

  const elDia = diaLocal(diaSel);
  const tira = Array.from({ length: 7 }, (_, i) => sumarDias(diaSel, i - 3));

  const delDia = suites.flatMap((s) => s.reservas.map((r) => ({ ...r, suite: s.nombre })));
  const ingresos = delDia.reduce((a, r) => a + r.precioTotal, 0);
  const abonos = delDia.reduce((a, r) => a + r.anticipo, 0);
  const ocupadas = suites.filter((s) => s.reservas.length > 0).length;
  const deudaTotal = pendientes.reduce((a, r) => a + (r.precioTotal - r.anticipo), 0);

  /** Al pulsar un hueco de la barra se propone una reserva a esa hora (del hotel). */
  function crearEn(suiteId: number, e: React.MouseEvent<HTMLDivElement>) {
    if (!puedeOperar) return;
    const caja = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - caja.left) / caja.width;
    const hora = Math.max(0, Math.min(23, Math.floor(pct * 24)));
    const desde = `${diaSel}T${String(hora).padStart(2, '0')}:00`;
    router.push(`/${slug}/reserva/nueva?suite=${suiteId}&desde=${desde}&volver=${volver}`);
  }

  if (!ubicacion) {
    return (
      <>
        <CabeceraPagina titulo="Agenda" />
        <EstadoVacio
          icono={Building2}
          titulo="Todavía no hay ubicaciones"
          detalle="La agenda se dibuja sobre las suites de cada ubicación. Créalas en Configuración."
          accion={
            <Link href={`/${slug}/configuracion`}>
              <Boton>Ir a Configuración</Boton>
            </Link>
          }
        />
      </>
    );
  }

  const enlaceNueva = `/${slug}/reserva/nueva?${suites[0] ? `suite=${suites[0].id}&` : ''}desde=${diaSel}T14:00&volver=${volver}`;

  return (
    <>
      <CabeceraPagina
        titulo={format(elDia, "EEEE d 'de' MMMM", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())}
        descripcion={`Agenda · ${ubicacion.nombre}`}
        acciones={
          <>
            <Link
              href={`/${slug}/panel`}
              className="flex items-center gap-1 text-[13px] text-tenue hover:text-texto"
            >
              <ChevronLeft className="h-4 w-4" /> Panel
            </Link>
            <div className="flex items-center gap-1">
              <BotonIcono icono={ChevronLeft} titulo="Día anterior" onClick={() => irA(sumarDias(diaSel, -1))} />
              <Boton variante="secundario" onClick={() => irA(hoy)} disabled={diaSel === hoy && !cargando}>
                Hoy
              </Boton>
              <BotonIcono icono={ChevronRight} titulo="Día siguiente" onClick={() => irA(sumarDias(diaSel, 1))} />
              {cargando && <Loader2 className="ml-1 h-4 w-4 animate-spin text-tenue" aria-label="Cargando" />}
            </div>
            {puedeOperar && (
              <Link href={enlaceNueva}>
                <Boton icono={Plus}>Nueva reserva</Boton>
              </Link>
            )}
          </>
        }
      />

      {/* Tira de días: la semana que empieza tres días antes del elegido, para que el
          día no quede pegado al borde. Se recalcula sobre el día PINTADO, no sobre el
          que ya contestó el servidor. */}
      <div className="desplaza flex gap-2 overflow-x-auto border-b border-borde bg-tarjeta px-4 py-3 sm:px-6">
        {tira.map((d) => {
          const sel = d === diaSel;
          const esHoy = d === hoy;
          const f = diaLocal(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => irA(d)}
              className={cn(
                'flex w-14 shrink-0 flex-col items-center rounded-md border px-2 py-1.5 transition-colors foco-visible',
                sel
                  ? 'border-acento bg-acento text-acento-contraste'
                  : 'border-borde bg-tarjeta text-texto hover:bg-realce',
              )}
            >
              <span className="text-[10px] uppercase opacity-80">{format(f, 'EEE', { locale: es })}</span>
              <span className="text-[15px] font-semibold">{format(f, 'd')}</span>
              {esHoy && !sel && <span className="h-1 w-1 rounded-full bg-acento" />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-6 xl:flex-row">
        {/* Barras por suite */}
        <div className="min-w-0 flex-1">
          <Tarjeta className={cn('overflow-hidden transition-opacity', cargando && 'opacity-60')}>
            <div className="flex items-center gap-2 border-b border-borde px-4 py-2.5">
              <CalendarDays className="h-4 w-4 text-tenue" />
              <p className="text-[12px] text-tenue">
                {puedeOperar
                  ? 'Pulsa un hueco para proponer una reserva a esa hora; pulsa un bloque para abrirla.'
                  : 'Ocupación del día por suite.'}
              </p>
            </div>

            {/* Regla de horas */}
            <div className="flex border-b border-borde bg-realce/60">
              <div className="w-20 shrink-0 sm:w-32" />
              <div className="relative mr-3 h-6 flex-1">
                {MARCAS.map((h) => (
                  <span
                    key={h}
                    className={cn(
                      'absolute top-1 text-[10px] text-tenue',
                      h % 6 !== 0 && 'hidden sm:block',
                    )}
                    style={{ left: `${(h / 24) * 100}%` }}
                  >
                    {`${String(h).padStart(2, '0')}:00`}
                  </span>
                ))}
                <span className="absolute right-0 top-1 text-[10px] text-tenue sm:hidden">23:00</span>
              </div>
            </div>

            {suites.map((s) => (
              <div key={s.id} className="flex items-center border-b border-borde last:border-0">
                <div className="w-20 shrink-0 truncate px-2 py-2.5 text-[12px] font-semibold sm:w-32 sm:px-3">
                  {s.nombre}
                </div>
                <div
                  onClick={(e) => crearEn(s.id, e)}
                  className={cn(
                    'relative mr-3 h-9 flex-1 overflow-hidden rounded bg-realce',
                    puedeOperar && 'cursor-copy',
                  )}
                >
                  {/* Rayas de las horas: orientan sin competir con los bloques. */}
                  {MARCAS.filter((h) => h > 0).map((h) => (
                    <span
                      key={h}
                      className={cn('absolute inset-y-0 w-px bg-borde', h % 6 !== 0 && 'hidden sm:block')}
                      style={{ left: `${(h / 24) * 100}%` }}
                    />
                  ))}
                  {s.reservas.map((r) => {
                    const ini = porcentaje(new Date(r.entrada), inicioMs);
                    const fin = porcentaje(new Date(r.salida), inicioMs);
                    return (
                      <Link
                        key={r.id}
                        href={`/${slug}/reserva/${r.id}?volver=${volver}`}
                        onClick={(e) => e.stopPropagation()}
                        title={`${r.clienteNombre} · ${format(new Date(r.entrada), 'HH:mm')}–${format(new Date(r.salida), 'HH:mm')}`}
                        className={cn(
                          'absolute inset-y-0.5 flex items-center overflow-hidden rounded px-2 text-[11px] font-semibold transition-opacity hover:opacity-90',
                          r.saleEseDia
                            ? 'bg-aviso-suave text-aviso border border-aviso/40'
                            : 'bg-acento text-acento-contraste',
                        )}
                        style={{ left: `${ini}%`, width: `${Math.max(fin - ini, 2)}%` }}
                      >
                        <span className="truncate">{r.clienteNombre}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            {!suites.length && <EstadoVacio icono={BedDouble} titulo="Esta ubicación no tiene suites" />}
          </Tarjeta>
        </div>

        {/* Resumen del día */}
        <div className="xl:w-72 xl:shrink-0">
          <Tarjeta className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-tenue">
                Resumen del día
              </h2>
              <BotonIcono
                icono={DollarSign}
                titulo={
                  pendientes.length
                    ? `${pendientes.length} reserva(s) con saldo pendiente`
                    : 'Sin saldos pendientes'
                }
                onClick={() => setVerSaldos(true)}
                className={cn('relative', pendientes.length && 'text-aviso hover:text-aviso')}
              >
                {pendientes.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-aviso px-1 text-center text-[9px] font-bold leading-4 text-white">
                    {pendientes.length}
                  </span>
                )}
              </BotonIcono>
            </div>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-tenue">Suites ocupadas</dt>
                <dd className="font-semibold">
                  {ocupadas} / {suites.length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tenue">Ingresos</dt>
                <dd className="font-semibold">{dinero(ingresos, moneda)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tenue">Abonos</dt>
                <dd className="font-semibold">{dinero(abonos, moneda)}</dd>
              </div>
              <div className="flex justify-between border-t border-borde pt-2">
                <dt className="font-semibold">Saldo pendiente</dt>
                <dd className={cn('font-bold', ingresos - abonos > 0 ? 'text-aviso' : 'text-exito')}>
                  {dinero(ingresos - abonos, moneda)}
                </dd>
              </div>
            </dl>

            <h3 className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-wider text-tenue">
              Reservas del día ({delDia.length})
            </h3>
            {delDia.length === 0 ? (
              <p className="py-3 text-[12px] text-tenue">Sin reservas este día.</p>
            ) : (
              <div className="desplaza max-h-80 space-y-2 overflow-y-auto">
                {delDia.map((r) => (
                  <Link
                    key={r.id}
                    href={`/${slug}/reserva/${r.id}?volver=${volver}`}
                    className="block rounded border border-borde p-2.5 transition-colors hover:bg-realce"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold">{r.clienteNombre}</span>
                      <Insignia tono={r.saleEseDia && r.estado === 'OCUPADA' ? 'aviso' : TONO_ESTADO_RESERVA[r.estado]}>
                        {r.saleEseDia && r.estado === 'OCUPADA' ? 'Por salir' : ETIQUETA_ESTADO_RESERVA[r.estado]}
                      </Insignia>
                    </div>
                    <p className="mt-0.5 text-[11px] text-tenue">
                      {r.suite} · {format(new Date(r.entrada), 'HH:mm')} →{' '}
                      {format(new Date(r.salida), 'HH:mm')}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Tarjeta>
        </div>
      </div>

      {/* Saldos pendientes de todo el hotel. Pulsar una tarjeta abre la reserva YA
          EN EDICIÓN, que es donde se anota el cobro (el pago se deriva de ahí). */}
      <PanelLateral
        abierto={verSaldos}
        alCerrar={() => setVerSaldos(false)}
        titulo="Saldos pendientes"
        descripcion={
          pendientes.length
            ? `${pendientes.length} reserva(s) · ${dinero(deudaTotal, moneda)} por cobrar`
            : 'Todas las reservas están al día'
        }
      >
        {pendientes.length === 0 ? (
          <EstadoVacio icono={DollarSign} titulo="Sin saldos pendientes" />
        ) : (
          <div className="space-y-2">
            {pendientes.map((r) => (
              <Link
                key={r.id}
                href={`/${slug}/reserva/${r.id}?editar=1&volver=${volver}`}
                onClick={() => setVerSaldos(false)}
                className="block rounded border border-borde p-3 transition-colors hover:bg-realce"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold">{r.clienteNombre}</span>
                  <Insignia tono={TONO_ESTADO_RESERVA[r.estado]}>{ETIQUETA_ESTADO_RESERVA[r.estado]}</Insignia>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-tenue">
                  {r.ubicacion} · {r.suite} · {format(new Date(r.entrada), 'd MMM', { locale: es })} →{' '}
                  {format(new Date(r.salida), 'd MMM', { locale: es })}
                </p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-tenue">Total</dt>
                    <dd className="font-semibold">{dinero(r.precioTotal, moneda)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-tenue">Abono</dt>
                    <dd className="font-semibold">{dinero(r.anticipo, moneda)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-tenue">Saldo</dt>
                    <dd className="font-bold text-aviso">{dinero(r.precioTotal - r.anticipo, moneda)}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </PanelLateral>
    </>
  );
}
