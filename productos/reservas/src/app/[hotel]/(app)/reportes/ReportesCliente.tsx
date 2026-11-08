'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Search } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, Selector, Tabla, Insignia, Tarjeta, EstadoVacio } from '@/componentes/ui';
import { ETIQUETA_ESTADO_RESERVA, TONO_ESTADO_RESERVA, noches } from '@/lib/reservas';
import { dinero, numEntero, fechaHora } from '@/lib/formato';
import type { EstadoReserva, EstadoPagoReserva } from '@/generated/prisma/enums';
import { conBase } from '@/lib/base';

export type FilaReporte = {
  id: number;
  clienteNombre: string;
  suite: string;
  ubicacion: string;
  entrada: string;
  salida: string;
  precioTotal: number;
  anticipo: number;
  estado: EstadoReserva;
  estadoPago: EstadoPagoReserva;
};

export default function ReportesCliente({
  slug,
  filas,
  suites,
  filtro,
  moneda,
  zona,
}: {
  slug: string;
  filas: FilaReporte[];
  suites: { id: number; nombre: string; ubicacion: string }[];
  filtro: { desde: string; hasta: string; suite: string; estado: string };
  moneda: string;
  /** Zona del hotel: las horas se escriben igual en el servidor y en el navegador. */
  zona: string;
}) {
  const router = useRouter();
  const [f, setF] = useState(filtro);

  const consultar = () => {
    const p = new URLSearchParams();
    if (f.desde) p.set('desde', f.desde);
    if (f.hasta) p.set('hasta', f.hasta);
    if (f.suite) p.set('suite', f.suite);
    if (f.estado) p.set('estado', f.estado);
    router.push(`/${slug}/reportes?${p}`);
  };

  const totales = useMemo(() => {
    const total = filas.reduce((a, r) => a + r.precioTotal, 0);
    const abonos = filas.reduce((a, r) => a + r.anticipo, 0);
    const nochesTotales = filas.reduce(
      (a, r) => a + noches(new Date(r.entrada), new Date(r.salida)),
      0,
    );
    return { total, abonos, saldo: total - abonos, noches: nochesTotales };
  }, [filas]);

  const enlaceExcel = conBase(`/${slug}/api/reportes/excel?${new URLSearchParams(
    Object.entries(f).filter(([, v]) => v) as [string, string][],
  )}`);

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraPagina
        titulo="Reportes"
        descripcion="Reservas del periodo, con su cuenta"
        // El Excel es lo que se viene a buscar aquí: es la principal (en el teléfono, la
        // barra de abajo). Sin filas no hay nada que bajar: el botón se deshabilita.
        acciones={
          filas.length ? (
            <a href={enlaceExcel} download>
              <Boton icono={Download}>Exportar a Excel</Boton>
            </a>
          ) : (
            <Boton icono={Download} disabled>
              Exportar a Excel
            </Boton>
          )
        }
      />

      {/* Los filtros, en la franja bajo la cabecera, como el filtro del panel: sin tarjeta ni título.
          Teléfono: el periodo en dos columnas, suite y estado debajo y «Consultar» a todo el
          ancho. Desde lg, una fila. */}
      <div className="border-b border-borde bg-tarjeta px-4 py-3 sm:px-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Campo etiqueta="Desde">
              <Entrada
                type="date"
                value={f.desde}
                onChange={(e) => setF({ ...f, desde: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Hasta">
              <Entrada
                type="date"
                value={f.hasta}
                onChange={(e) => setF({ ...f, hasta: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Suite">
              <Selector value={f.suite} onChange={(e) => setF({ ...f, suite: e.target.value })}>
                <option value="">Todas</option>
                {suites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ubicacion} · {s.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Estado">
              <Selector value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
                <option value="">Todos</option>
                <option value="OCUPADA">Ocupada</option>
                <option value="POR_SALIR">Por salir</option>
                <option value="FINALIZADA">Finalizada</option>
                <option value="ELIMINADA">Eliminada</option>
              </Selector>
            </Campo>
            <div className="col-span-2 flex items-end lg:col-span-1">
              <Boton icono={Search} tamano="lg" className="w-full" onClick={consultar}>
                Consultar
              </Boton>
            </div>
          </div>
      </div>

      {/* El cuerpo llega hasta abajo (regla 2026-11-08): la tabla es el último bloque y crece. */}
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { et: 'Reservas', v: numEntero(filas.length) },
            { et: 'Noches', v: numEntero(totales.noches) },
            { et: 'Ingresos', v: dinero(totales.total, moneda) },
            { et: 'Saldo pendiente', v: dinero(totales.saldo, moneda), tono: totales.saldo > 0 },
          ].map((c) => (
            <Tarjeta key={c.et} className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-tenue">{c.et}</p>
              <p className={`mt-1 text-[20px] font-semibold ${c.tono ? 'text-aviso' : 'text-texto'}`}>
                {c.v}
              </p>
            </Tarjeta>
          ))}
        </div>

        <Tarjeta className={filas.length ? 'flex-1 overflow-hidden' : 'flex flex-1 items-center justify-center'}>
          <Tabla
            filas={filas}
            claveFila={(r) => r.id}
            alPulsarFila={(r) => router.push(`/${slug}/reserva/${r.id}`)}
            recuento={`${numEntero(filas.length)} ${filas.length === 1 ? 'reserva' : 'reservas'} · ${dinero(totales.abonos, moneda)} cobrados`}
            vacio={<EstadoVacio titulo="Sin reservas en este periodo" detalle="Cambia las fechas o quita algún filtro." />}
            columnas={[
              {
                clave: 'cliente',
                titulo: 'Huésped',
                ancho: '18%',
                render: (r) => (
                  <Link
                    href={`/${slug}/reserva/${r.id}`}
                    className="block truncate font-semibold text-texto hover:text-acento"
                  >
                    {r.clienteNombre}
                  </Link>
                ),
              },
              {
                clave: 'suite',
                titulo: 'Suite',
                ancho: '18%',
                render: (r) => (
                  <span className="block truncate text-tenue">
                    {r.suite} <span className="text-[11px]">· {r.ubicacion}</span>
                  </span>
                ),
              },
              {
                clave: 'entrada',
                titulo: 'Entrada',
                ancho: '13%',
                render: (r) => <span className="tabular-nums">{fechaHora(r.entrada, zona)}</span>,
              },
              {
                clave: 'salida',
                titulo: 'Salida',
                ancho: '13%',
                render: (r) => <span className="tabular-nums">{fechaHora(r.salida, zona)}</span>,
              },
              {
                clave: 'total',
                titulo: 'Total',
                ancho: '9%',
                alinear: 'der',
                render: (r) => dinero(r.precioTotal, moneda),
              },
              {
                clave: 'abono',
                titulo: 'Abono',
                ancho: '9%',
                alinear: 'der',
                render: (r) => dinero(r.anticipo, moneda),
              },
              {
                clave: 'saldo',
                titulo: 'Saldo',
                ancho: '9%',
                alinear: 'der',
                render: (r) => {
                  const s = r.precioTotal - r.anticipo;
                  return <span className={s > 0 ? 'font-semibold text-aviso' : ''}>{dinero(s, moneda)}</span>;
                },
              },
              {
                clave: 'estado',
                titulo: 'Estado',
                ancho: '11%',
                render: (r) => (
                  <Insignia tono={TONO_ESTADO_RESERVA[r.estado]}>
                    {ETIQUETA_ESTADO_RESERVA[r.estado]}
                  </Insignia>
                ),
              },
            ]}
          />
        </Tarjeta>
      </div>
    </div>
  );
}
