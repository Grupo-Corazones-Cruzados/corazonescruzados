'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, Filter, Search } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, Selector, Tabla, Insignia, Tarjeta, EstadoVacio } from '@/componentes/ui';
import { ETIQUETA_ESTADO_RESERVA, TONO_ESTADO_RESERVA, noches } from '@/lib/reservas';
import { dinero, numEntero } from '@/lib/formato';
import type { EstadoReserva, EstadoPagoReserva } from '@/generated/prisma/enums';

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
}: {
  slug: string;
  filas: FilaReporte[];
  suites: { id: number; nombre: string; ubicacion: string }[];
  filtro: { desde: string; hasta: string; suite: string; estado: string };
  moneda: string;
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

  const enlaceExcel = `/${slug}/api/reportes/excel?${new URLSearchParams(
    Object.entries(f).filter(([, v]) => v) as [string, string][],
  )}`;

  return (
    <>
      <CabeceraPagina
        titulo="Reportes"
        descripcion="Reservas del periodo, con su cuenta"
        acciones={
          <a href={enlaceExcel} download>
            <Boton variante="secundario" icono={Download} disabled={!filas.length}>
              Exportar a Excel
            </Boton>
          </a>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <Tarjeta className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Filter className="h-4 w-4 text-tenue" />
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">Filtros</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
                <option value="">Todos (salvo eliminadas)</option>
                <option value="OCUPADA">Ocupada</option>
                <option value="POR_SALIR">Por salir</option>
                <option value="FINALIZADA">Finalizada</option>
                <option value="ELIMINADA">Eliminada</option>
              </Selector>
            </Campo>
            <div className="flex items-end">
              <Boton icono={Search} tamano="lg" className="w-full" onClick={consultar}>
                Consultar
              </Boton>
            </div>
          </div>
        </Tarjeta>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

        <Tarjeta className="overflow-hidden">
          <Tabla
            filas={filas}
            claveFila={(r) => r.id}
            alPulsarFila={(r) => router.push(`/${slug}/reserva/${r.id}`)}
            vacio={
              <EstadoVacio
                titulo="Sin reservas en este periodo"
                detalle="Cambia las fechas o quita algún filtro."
              />
            }
            columnas={[
              {
                clave: 'cliente',
                titulo: 'Huésped',
                render: (r) => (
                  <Link
                    href={`/${slug}/reserva/${r.id}`}
                    className="font-semibold text-texto hover:text-acento"
                  >
                    {r.clienteNombre}
                  </Link>
                ),
              },
              {
                clave: 'suite',
                titulo: 'Suite',
                render: (r) => (
                  <span className="text-tenue">
                    {r.suite} <span className="text-[11px]">· {r.ubicacion}</span>
                  </span>
                ),
              },
              {
                clave: 'entrada',
                titulo: 'Entrada',
                render: (r) => format(new Date(r.entrada), 'dd/MM/yyyy HH:mm', { locale: es }),
              },
              {
                clave: 'salida',
                titulo: 'Salida',
                render: (r) => format(new Date(r.salida), 'dd/MM/yyyy HH:mm', { locale: es }),
              },
              {
                clave: 'total',
                titulo: 'Total',
                alinear: 'der',
                render: (r) => dinero(r.precioTotal, moneda),
              },
              {
                clave: 'abono',
                titulo: 'Abono',
                alinear: 'der',
                render: (r) => dinero(r.anticipo, moneda),
              },
              {
                clave: 'saldo',
                titulo: 'Saldo',
                alinear: 'der',
                render: (r) => {
                  const s = r.precioTotal - r.anticipo;
                  return <span className={s > 0 ? 'font-semibold text-aviso' : ''}>{dinero(s, moneda)}</span>;
                },
              },
              {
                clave: 'estado',
                titulo: 'Estado',
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
    </>
  );
}
