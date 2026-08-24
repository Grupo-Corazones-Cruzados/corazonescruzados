'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addDays, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, Building2, Plus } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, EstadoVacio, Insignia, RailFiltro, Tarjeta } from '@/componentes/ui';
import { ETIQUETA_ESTADO_RESERVA, TONO_ESTADO_RESERVA } from '@/lib/reservas';
import { dinero } from '@/lib/formato';
import { aCampoFecha } from '@/lib/fechas';
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
};
type SuiteAgenda = { id: number; nombre: string; reservas: ReservaAgenda[] };
export type UbicacionAgenda = { id: number; nombre: string; suites: SuiteAgenda[] };

const MINUTOS_DIA = 24 * 60;

/** Porcentaje del día que ocupa un instante. Fuera del día se recorta al borde. */
function porcentaje(instante: Date, dia: Date) {
  const inicio = new Date(dia);
  inicio.setHours(0, 0, 0, 0);
  const min = (instante.getTime() - inicio.getTime()) / 60000;
  return Math.max(0, Math.min(100, (min / MINUTOS_DIA) * 100));
}

export default function AgendaCliente({
  slug,
  dia,
  ubicaciones,
  moneda,
  puedeOperar,
}: {
  slug: string;
  dia: string;
  ubicaciones: UbicacionAgenda[];
  moneda: string;
  puedeOperar: boolean;
}) {
  const router = useRouter();
  const elDia = useMemo(() => new Date(dia), [dia]);
  const [ubicacionSel, setUbicacionSel] = useState<string>(String(ubicaciones[0]?.id ?? ''));

  const irA = (d: Date) => router.push(`/${slug}/agenda?dia=${aCampoFecha(d)}`);

  const actual = ubicaciones.find((u) => String(u.id) === ubicacionSel) ?? ubicaciones[0];
  const suites = actual?.suites ?? [];

  const delDia = suites.flatMap((s) => s.reservas.map((r) => ({ ...r, suite: s.nombre })));
  const ingresos = delDia.reduce((a, r) => a + r.precioTotal, 0);
  const abonos = delDia.reduce((a, r) => a + r.anticipo, 0);
  const ocupadas = suites.filter((s) => s.reservas.length > 0).length;

  // Tira de días: la semana que empieza tres días antes del elegido, para que el
  // día de hoy no quede pegado al borde.
  const tira = Array.from({ length: 7 }, (_, i) => addDays(elDia, i - 3));

  /** Al pulsar un hueco de la barra se crea una reserva a esa hora. */
  function crearEn(suiteId: number, e: React.MouseEvent<HTMLDivElement>) {
    if (!puedeOperar) return;
    const caja = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - caja.left) / caja.width;
    const hora = Math.max(0, Math.min(23, Math.floor(pct * 24)));
    const desde = new Date(elDia);
    desde.setHours(hora, 0, 0, 0);
    router.push(`/${slug}/reserva/nueva?suite=${suiteId}&desde=${desde.toISOString()}`);
  }

  if (!ubicaciones.length) {
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

  return (
    <>
      <CabeceraPagina
        titulo={format(elDia, "EEEE d 'de' MMMM", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())}
        descripcion="Agenda del día"
        acciones={
          <>
            <div className="flex items-center gap-1">
              <button
                onClick={() => irA(addDays(elDia, -1))}
                className="flex h-8 w-8 items-center justify-center rounded-md text-tenue hover:bg-realce foco-visible"
                aria-label="Día anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Boton variante="secundario" onClick={() => irA(new Date())}>
                Hoy
              </Boton>
              <button
                onClick={() => irA(addDays(elDia, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-md text-tenue hover:bg-realce foco-visible"
                aria-label="Día siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {puedeOperar && (
              <Link href={`/${slug}/reserva/nueva`}>
                <Boton icono={Plus}>Nueva reserva</Boton>
              </Link>
            )}
          </>
        }
      />

      {/* Tira de días */}
      <div className="desplaza flex gap-2 overflow-x-auto border-b border-borde bg-tarjeta px-4 py-3 sm:px-6">
        {tira.map((d) => {
          const sel = isSameDay(d, elDia);
          const hoy = isSameDay(d, new Date());
          return (
            <button
              key={d.toISOString()}
              onClick={() => irA(d)}
              className={cn(
                'flex w-14 shrink-0 flex-col items-center rounded-md border px-2 py-1.5 transition-colors foco-visible',
                sel
                  ? 'border-acento bg-acento text-acento-contraste'
                  : 'border-borde bg-tarjeta text-texto hover:bg-realce',
              )}
            >
              <span className="text-[10px] uppercase opacity-80">
                {format(d, 'EEE', { locale: es })}
              </span>
              <span className="text-[15px] font-semibold">{format(d, 'd')}</span>
              {hoy && !sel && <span className="h-1 w-1 rounded-full bg-acento" />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-6 xl:flex-row">
        <RailFiltro
          titulo="Ubicaciones"
          opciones={ubicaciones.map((u) => ({
            valor: String(u.id),
            etiqueta: u.nombre,
            icono: Building2,
            conteo: u.suites.length,
          }))}
          activo={String(actual?.id ?? '')}
          alElegir={setUbicacionSel}
        />

        {/* Barras por suite */}
        <div className="min-w-0 flex-1">
          <Tarjeta className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-borde px-4 py-2.5">
              <CalendarDays className="h-4 w-4 text-tenue" />
              <p className="text-[12px] text-tenue">
                {puedeOperar
                  ? 'Pulsa un hueco para crear una reserva a esa hora; pulsa un bloque para abrirla.'
                  : 'Ocupación del día por suite.'}
              </p>
            </div>

            {/* Regla de horas */}
            <div className="flex border-b border-borde bg-realce/60 pl-32 pr-3">
              {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                <div key={h} className="flex-1 py-1 text-[10px] text-tenue">
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {suites.map((s) => (
              <div key={s.id} className="flex items-center border-b border-borde last:border-0">
                <div className="w-32 shrink-0 truncate px-3 py-2.5 text-[12px] font-semibold">
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
                  {[3, 6, 9, 12, 15, 18, 21].map((h) => (
                    <span
                      key={h}
                      className="absolute inset-y-0 w-px bg-borde"
                      style={{ left: `${(h / 24) * 100}%` }}
                    />
                  ))}
                  {s.reservas.map((r) => {
                    const ini = porcentaje(new Date(r.entrada), elDia);
                    const fin = porcentaje(new Date(r.salida), elDia);
                    return (
                      <Link
                        key={r.id}
                        href={`/${slug}/reserva/${r.id}`}
                        onClick={(e) => e.stopPropagation()}
                        title={`${r.clienteNombre} · ${format(new Date(r.entrada), 'HH:mm')}–${format(new Date(r.salida), 'HH:mm')}`}
                        className={cn(
                          'absolute inset-y-0.5 flex items-center overflow-hidden rounded px-2 text-[11px] font-semibold transition-opacity hover:opacity-90',
                          r.estado === 'POR_SALIR'
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
            {!suites.length && <EstadoVacio titulo="Esta ubicación no tiene suites" />}
          </Tarjeta>
        </div>

        {/* Resumen del día */}
        <div className="xl:w-72 xl:shrink-0">
          <Tarjeta className="p-4">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-tenue">
              Resumen del día
            </h2>
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
                    href={`/${slug}/reserva/${r.id}`}
                    className="block rounded border border-borde p-2.5 transition-colors hover:bg-realce"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold">{r.clienteNombre}</span>
                      <Insignia tono={TONO_ESTADO_RESERVA[r.estado]}>
                        {ETIQUETA_ESTADO_RESERVA[r.estado]}
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
    </>
  );
}
