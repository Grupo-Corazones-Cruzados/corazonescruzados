'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Building2, CalendarClock, LogIn, LogOut, Plus, BedDouble } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, EstadoVacio, Insignia, Tarjeta } from '@/componentes/ui';
import {
  estadoDeSuite,
  ETIQUETA_ESTADO_SUITE,
  TONO_ESTADO_SUITE,
  activaHoy,
  type EstadoSuite,
} from '@/lib/reservas';
import { cn } from '@/lib/utils';
import type { EstadoReserva, EstadoPagoReserva } from '@/generated/prisma/enums';

export type ReservaVista = {
  id: number;
  clienteNombre: string;
  entrada: string;
  salida: string;
  estado: EstadoReserva;
  estadoPago: EstadoPagoReserva;
};
export type SuiteVista = { id: number; nombre: string; fotoUrl: string | null; reservas: ReservaVista[] };
export type UbicacionVista = { id: number; nombre: string; fotoUrl: string | null; suites: SuiteVista[] };

type Filtro = 'todas' | EstadoSuite;

const FILTROS: { clave: Filtro; etiqueta: string }[] = [
  { clave: 'todas', etiqueta: 'Todas' },
  { clave: 'libre', etiqueta: 'Libres' },
  { clave: 'por-salir', etiqueta: 'Por salir' },
  { clave: 'ocupada', etiqueta: 'Ocupadas' },
];

const aFechas = (r: ReservaVista) => ({
  ...r,
  entrada: new Date(r.entrada),
  salida: new Date(r.salida),
});

export default function PanelCliente({
  slug,
  hotel,
  ubicaciones,
  puedeOperar,
}: {
  slug: string;
  hotel: string;
  ubicaciones: UbicacionVista[];
  puedeOperar: boolean;
}) {
  const [ubicacionSel, setUbicacionSel] = useState<number | null>(ubicaciones[0]?.id ?? null);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const estadoDe = useMemo(() => {
    const mapa = new Map<number, EstadoSuite>();
    for (const u of ubicaciones)
      for (const s of u.suites) mapa.set(s.id, estadoDeSuite(s.reservas.map(aFechas)));
    return mapa;
  }, [ubicaciones]);

  const todas = ubicaciones.flatMap((u) => u.suites);
  const cuenta = (e: EstadoSuite, lista = todas) => lista.filter((s) => estadoDe.get(s.id) === e).length;

  const actual = ubicaciones.find((u) => u.id === ubicacionSel);
  const suites = actual?.suites ?? [];
  const visibles = suites.filter((s) => filtro === 'todas' || estadoDe.get(s.id) === filtro);

  // Entradas y salidas de los próximos 7 días, en orden. Es la columna que
  // convierte el panel en algo que se mira por la mañana.
  const proximos = useMemo(() => {
    const ahora = new Date();
    const tope = new Date(ahora.getTime() + 7 * 86_400_000);
    const eventos: {
      tipo: 'entrada' | 'salida';
      fecha: Date;
      reserva: ReservaVista;
      suite: string;
      ubicacion: string;
    }[] = [];
    for (const u of ubicaciones)
      for (const s of u.suites)
        for (const r of s.reservas) {
          const e = new Date(r.entrada);
          const x = new Date(r.salida);
          if (e > ahora && e < tope)
            eventos.push({ tipo: 'entrada', fecha: e, reserva: r, suite: s.nombre, ubicacion: u.nombre });
          if (x > ahora && x < tope)
            eventos.push({ tipo: 'salida', fecha: x, reserva: r, suite: s.nombre, ubicacion: u.nombre });
        }
    return eventos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }, [ubicaciones]);

  if (!ubicaciones.length) {
    return (
      <>
        <CabeceraPagina titulo={hotel} descripcion="Panel de control" />
        <EstadoVacio
          icono={Building2}
          titulo="Todavía no hay ubicaciones"
          detalle="Crea la primera ubicación y sus suites en Configuración; el panel se llena solo."
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
        titulo={hotel}
        descripcion="Panel de control"
        acciones={
          <>
            <div className="flex items-center gap-2">
              <Insignia tono="exito">{cuenta('libre')} libres</Insignia>
              <Insignia tono="aviso">{cuenta('por-salir')} por salir</Insignia>
              <Insignia tono="info">{cuenta('ocupada')} ocupadas</Insignia>
            </div>
            {puedeOperar && (
              <Link href={`/${slug}/reserva/nueva`}>
                <Boton icono={Plus}>Nueva reserva</Boton>
              </Link>
            )}
          </>
        }
      />

      <div className="border-b border-borde bg-tarjeta px-4 pb-3 sm:px-6">
        <div className="desplaza flex gap-2 overflow-x-auto">
          {FILTROS.map((f) => (
            <button
              key={f.clave}
              onClick={() => setFiltro(f.clave)}
              className={cn(
                'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors foco-visible',
                filtro === f.clave
                  ? 'bg-acento text-acento-contraste'
                  : 'border border-borde bg-tarjeta text-tenue hover:bg-realce',
              )}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-6 xl:flex-row">
        {/* Ubicaciones */}
        <div className="xl:w-64 xl:shrink-0">
          <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-tenue">
            Ubicaciones
          </h2>
          <div className="desplaza flex gap-3 overflow-x-auto pb-2 xl:flex-col xl:overflow-visible xl:pb-0">
            {ubicaciones.map((u) => {
              const sel = u.id === ubicacionSel;
              return (
                <button
                  key={u.id}
                  onClick={() => setUbicacionSel(u.id)}
                  className={cn(
                    'tarjeta w-52 shrink-0 overflow-hidden p-3 text-left transition-colors foco-visible xl:w-full',
                    sel ? 'border-acento bg-acento-suave' : 'hover:bg-realce',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-realce">
                      {u.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.fotoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-4 w-4 text-tenue" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-[13px] font-semibold', sel && 'text-acento')}>
                        {u.nombre}
                      </p>
                      <p className="text-[11px] text-tenue">{u.suites.length} suites</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-3 text-[11px]">
                    <span className="text-exito">{cuenta('libre', u.suites)} libres</span>
                    <span className="text-aviso">{cuenta('por-salir', u.suites)} por salir</span>
                    <span className="text-acento">{cuenta('ocupada', u.suites)} ocup.</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Suites */}
        <div className="min-w-0 flex-1">
          <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-tenue">
            {actual?.nombre} ({visibles.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {visibles.map((s) => {
              const estado = estadoDe.get(s.id)!;
              const hoy = s.reservas.map(aFechas).find(activaHoyFn);
              return (
                <Tarjeta key={s.id} className="overflow-hidden">
                  <div className="flex items-start gap-3 p-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded bg-realce">
                      {s.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.fotoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <BedDouble className="h-5 w-5 text-tenue" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[14px] font-semibold">{s.nombre}</p>
                        <Insignia tono={TONO_ESTADO_SUITE[estado]}>
                          {ETIQUETA_ESTADO_SUITE[estado]}
                        </Insignia>
                      </div>
                      {hoy ? (
                        <div className="mt-1">
                          <p className="truncate text-[12px] text-texto">{hoy.clienteNombre}</p>
                          <p className="text-[11px] text-tenue">
                            Sale el {format(hoy.salida, "d 'de' MMMM, HH:mm", { locale: es })}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1 text-[12px] text-tenue">Sin ocupación hoy</p>
                      )}
                    </div>
                  </div>
                  {hoy && (
                    <Link
                      href={`/${slug}/reserva/${hoy.id}`}
                      className="block border-t border-borde px-3 py-2 text-[12px] font-semibold text-acento hover:bg-realce"
                    >
                      Ver reserva →
                    </Link>
                  )}
                </Tarjeta>
              );
            })}
          </div>
          {!visibles.length && (
            <EstadoVacio titulo="Ninguna suite con este filtro" icono={BedDouble} />
          )}
        </div>

        {/* Próximos 7 días */}
        <div className="xl:w-80 xl:shrink-0">
          <div className="mb-2 flex items-center gap-2 px-1">
            <CalendarClock className="h-4 w-4 text-acento" />
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-tenue">
              Próximos 7 días {proximos.length > 0 && `(${proximos.length})`}
            </h2>
          </div>
          {proximos.length === 0 ? (
            <Tarjeta className="p-6 text-center">
              <CalendarClock className="mx-auto mb-2 h-8 w-8 text-borde" />
              <p className="text-[12px] text-tenue">Sin entradas ni salidas próximas</p>
            </Tarjeta>
          ) : (
            <div className="desplaza max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto">
              {proximos.map((ev, i) => (
                <Link
                  key={`${ev.tipo}-${ev.reserva.id}-${i}`}
                  href={`/${slug}/reserva/${ev.reserva.id}`}
                  className="tarjeta flex items-center gap-3 p-3 transition-colors hover:bg-realce"
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded',
                      ev.tipo === 'entrada' ? 'bg-acento-suave text-acento' : 'bg-aviso-suave text-aviso',
                    )}
                  >
                    {ev.tipo === 'entrada' ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">{ev.reserva.clienteNombre}</p>
                    <p className="truncate text-[11px] text-tenue">
                      {ev.suite} · {ev.ubicacion}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] font-semibold">
                      {format(ev.fecha, 'd MMM', { locale: es })}
                    </p>
                    <p className="text-[10px] text-tenue">{format(ev.fecha, 'HH:mm')}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const activaHoyFn = (r: { entrada: Date; salida: Date; estado: EstadoReserva }) => activaHoy(r);
