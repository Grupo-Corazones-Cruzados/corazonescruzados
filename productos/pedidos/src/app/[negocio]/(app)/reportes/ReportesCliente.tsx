'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, Filter, Search, AlertTriangle } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, Selector, Tabla, Insignia, Tarjeta, EstadoVacio } from '@/componentes/ui';
import { ETIQUETA_PEDIDO, TONO_PEDIDO, ETIQUETA_PAGO } from '@/lib/pedidos';
import { dinero, numEntero } from '@/lib/formato';
import type { EstadoPedido, MetodoPagoPedido } from '@/generated/prisma/enums';

export type FilaReporte = {
  id: number;
  numero: number;
  dia: string;
  creado: string;
  mesa: string;
  zona: string;
  mesero: string | null;
  estado: EstadoPedido;
  metodoPago: MetodoPagoPedido | null;
  platos: number;
  subtotal: number;
  iva: number;
  total: number;
};

export default function ReportesCliente({
  slug,
  filas,
  filtro,
  moneda,
  mesesRetencion,
}: {
  slug: string;
  filas: FilaReporte[];
  filtro: { desde: string; hasta: string; estado: string; metodo: string };
  moneda: string;
  mesesRetencion: number | null;
}) {
  const router = useRouter();
  const [f, setF] = useState(filtro);

  const consultar = () => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    router.push(`/${slug}/reportes?${p}`);
  };

  // Solo lo COBRADO es venta. Sumar lo anulado inflaría la caja.
  const totales = useMemo(() => {
    const cobrados = filas.filter((r) => r.estado === 'COBRADO');
    return {
      pedidos: cobrados.length,
      platos: cobrados.reduce((a, r) => a + r.platos, 0),
      base: cobrados.reduce((a, r) => a + r.subtotal, 0),
      iva: cobrados.reduce((a, r) => a + r.iva, 0),
      total: cobrados.reduce((a, r) => a + r.total, 0),
      abiertos: filas.length - cobrados.length,
    };
  }, [filas]);

  const enlaceExcel = `/${slug}/api/reportes/excel?${new URLSearchParams(
    Object.entries(f).filter(([, v]) => v) as [string, string][],
  )}`;

  return (
    <>
      <CabeceraPagina
        titulo="Reportes"
        descripcion="Pedidos del periodo y lo que se cobró"
        acciones={
          <a href={enlaceExcel} download>
            <Boton variante="secundario" icono={Download} disabled={!filas.length}>
              Exportar a Excel
            </Boton>
          </a>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {mesesRetencion && (
          <p className="flex items-start gap-2 rounded border border-borde bg-aviso-suave px-3 py-2 text-[12px] text-aviso">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
            Tu plan conserva {mesesRetencion === 1 ? 'un mes' : `${mesesRetencion} meses`} de histórico.
            En la última hora del último día de cada mes se borra lo anterior.{' '}
            <strong>Exporta a Excel lo que quieras guardar.</strong>
          </p>
        )}

        <Tarjeta className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Filter className="h-4 w-4 text-tenue" />
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">Filtros</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Campo etiqueta="Desde">
              <Entrada type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
            </Campo>
            <Campo etiqueta="Hasta">
              <Entrada type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
            </Campo>
            <Campo etiqueta="Estado">
              <Selector value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
                <option value="">Todos</option>
                {(Object.keys(ETIQUETA_PEDIDO) as EstadoPedido[]).map((e) => (
                  <option key={e} value={e}>
                    {ETIQUETA_PEDIDO[e]}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Método de pago">
              <Selector value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value })}>
                <option value="">Todos</option>
                {(Object.keys(ETIQUETA_PAGO) as MetodoPagoPedido[]).map((m) => (
                  <option key={m} value={m}>
                    {ETIQUETA_PAGO[m]}
                  </option>
                ))}
              </Selector>
            </Campo>
            <div className="flex items-end">
              <Boton icono={Search} tamano="lg" className="w-full" onClick={consultar}>
                Consultar
              </Boton>
            </div>
          </div>
        </Tarjeta>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { et: 'Pedidos cobrados', v: numEntero(totales.pedidos) },
            { et: 'Platos servidos', v: numEntero(totales.platos) },
            { et: 'Base imponible', v: dinero(totales.base, moneda) },
            { et: 'IVA', v: dinero(totales.iva, moneda) },
            { et: 'Total cobrado', v: dinero(totales.total, moneda), destacado: true },
          ].map((c) => (
            <Tarjeta key={c.et} className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-tenue">{c.et}</p>
              <p className={`mt-1 text-[20px] font-semibold ${c.destacado ? 'text-acento' : 'text-texto'}`}>
                {c.v}
              </p>
            </Tarjeta>
          ))}
        </div>

        <Tarjeta className="overflow-hidden">
          <Tabla
            filas={filas}
            claveFila={(r) => r.id}
            alPulsarFila={(r) => router.push(`/${slug}/pedido/${r.id}`)}
            vacio={
              <EstadoVacio titulo="Sin pedidos en este periodo" detalle="Cambia las fechas o quita algún filtro." />
            }
            columnas={[
              {
                clave: 'numero',
                titulo: 'Pedido',
                render: (r) => (
                  <Link href={`/${slug}/pedido/${r.id}`} className="font-semibold text-texto hover:text-acento">
                    #{r.numero}
                  </Link>
                ),
              },
              { clave: 'dia', titulo: 'Día', render: (r) => format(new Date(r.dia), 'dd/MM/yyyy', { locale: es }) },
              { clave: 'hora', titulo: 'Hora', render: (r) => format(new Date(r.creado), 'HH:mm') },
              {
                clave: 'mesa',
                titulo: 'Mesa',
                render: (r) => (
                  <span className="text-tenue">
                    {r.mesa} <span className="text-[11px]">· {r.zona}</span>
                  </span>
                ),
              },
              { clave: 'mesero', titulo: 'Atendió', render: (r) => r.mesero ?? '—' },
              { clave: 'platos', titulo: 'Platos', alinear: 'der', render: (r) => numEntero(r.platos) },
              { clave: 'total', titulo: 'Total', alinear: 'der', render: (r) => dinero(r.total, moneda) },
              { clave: 'pago', titulo: 'Pago', render: (r) => (r.metodoPago ? ETIQUETA_PAGO[r.metodoPago] : '—') },
              {
                clave: 'estado',
                titulo: 'Estado',
                render: (r) => <Insignia tono={TONO_PEDIDO[r.estado]}>{ETIQUETA_PEDIDO[r.estado]}</Insignia>,
              },
            ]}
          />
        </Tarjeta>
      </div>
    </>
  );
}
