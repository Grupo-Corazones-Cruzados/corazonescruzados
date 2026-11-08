'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Search, AlertTriangle, ListFilter, Receipt, Ban, ChefHat, BellRing, CheckCircle2 } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, Selector, Tabla, Insignia, Tarjeta, EstadoVacio, RailFiltro, type OpcionRail } from '@/componentes/ui';
import { ETIQUETA_PEDIDO, TONO_PEDIDO, ETIQUETA_PAGO } from '@/lib/pedidos';
import { dinero, numEntero, fechaCorta, horaCorta } from '@/lib/formato';
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

/** Iconos del raíl de estados; uno por estado del pedido. */
const ICONO_ESTADO: Partial<Record<EstadoPedido, OpcionRail['icono']>> = {
  EN_PREPARACION: ChefHat,
  LISTO: BellRing,
  SERVIDO: CheckCircle2,
  COBRADO: Receipt,
  ANULADO: Ban,
};

export default function ReportesCliente({
  slug,
  zona,
  filas,
  filtro,
  moneda,
  mesesRetencion,
}: {
  slug: string;
  /** Zona horaria del negocio (horas iguales en servidor y navegador). */
  zona: string;
  filas: FilaReporte[];
  filtro: { desde: string; hasta: string; estado: string; metodo: string };
  moneda: string;
  mesesRetencion: number | null;
}) {
  const router = useRouter();
  const [f, setF] = useState(filtro);

  const consultar = (cambio: Partial<typeof f> = {}) => {
    const nuevo = { ...f, ...cambio };
    setF(nuevo);
    const p = new URLSearchParams();
    Object.entries(nuevo).forEach(([k, v]) => v && p.set(k, v));
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
    <div className="flex flex-1 flex-col">
      <CabeceraPagina
        titulo="Reportes"
        descripcion="Pedidos del periodo y lo que se cobró"
        menu={[
          { etiqueta: 'Exportar a Excel', icono: Download, href: enlaceExcel, descargar: true, deshabilitado: !filas.length },
        ]}
      />

      {/* El estado se elige en el raíl (como el resto de filtros de lista del producto); las
          fechas y el método van en la barra de encima de la tabla. Alto completo: la tabla llega al pie. */}
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <RailFiltro
          titulo="Estado"
          opciones={[
            { valor: '', etiqueta: 'Todos', icono: ListFilter },
            ...(Object.keys(ETIQUETA_PEDIDO) as EstadoPedido[]).map((e) => ({ valor: e, etiqueta: ETIQUETA_PEDIDO[e], icono: ICONO_ESTADO[e] })),
          ]}
          activo={f.estado}
          alElegir={(v) => consultar({ estado: v })}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
        {mesesRetencion && (
          <p className="flex items-center gap-2 rounded border border-borde bg-aviso-suave px-3 py-2 text-[12px] text-aviso">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Se conserva {mesesRetencion === 1 ? 'un mes' : `${mesesRetencion} meses`} de histórico: exporta a Excel lo que quieras guardar.
            </span>
          </p>
        )}

          {/* Teléfono: las fechas en dos columnas, el método y el botón debajo. */}
          <div className="grid grid-cols-2 items-end gap-3 lg:flex lg:flex-wrap">
            <Campo etiqueta="Desde" className="lg:w-40">
              <Entrada type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
            </Campo>
            <Campo etiqueta="Hasta" className="lg:w-40">
              <Entrada type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
            </Campo>
            <Campo etiqueta="Pago" className="lg:w-44">
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
              <Boton variante="secundario" icono={Search} tamano="lg" className="w-full lg:w-auto" onClick={() => consultar()}>
                Consultar
              </Boton>
            </div>
          </div>

        {/* Cifras de dos en dos en el teléfono; el total, que es lo que se busca, ocupa la fila. */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          {[
            { et: 'Cobrados', v: numEntero(totales.pedidos) },
            { et: 'Platos', v: numEntero(totales.platos) },
            { et: 'Base imponible', v: dinero(totales.base, moneda) },
            { et: 'IVA', v: dinero(totales.iva, moneda) },
            { et: 'Total', v: dinero(totales.total, moneda), destacado: true },
          ].map((c) => (
            <Tarjeta key={c.et} className={c.destacado ? 'col-span-2 p-4 xl:col-span-1' : 'p-4'}>
              <p className="text-[11px] uppercase tracking-wide text-tenue">{c.et}</p>
              <p className={`mt-1 text-[20px] font-semibold ${c.destacado ? 'text-acento' : 'text-texto'}`}>
                {c.v}
              </p>
            </Tarjeta>
          ))}
        </div>

        <Tarjeta className="flex flex-1 flex-col overflow-hidden">
          <Tabla
            filas={filas}
            claveFila={(r) => r.id}
            alPulsarFila={(r) => router.push(`/${slug}/pedido/${r.id}`)}
            recuento={`${numEntero(filas.length)} ${filas.length === 1 ? 'pedido' : 'pedidos'}`}
            vacio={
              <div className="flex flex-1 flex-col justify-center">
                <EstadoVacio titulo="Sin pedidos en este periodo" />
              </div>
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
              { clave: 'dia', titulo: 'Día', render: (r) => fechaCorta(r.dia, 'UTC') },
              { clave: 'hora', titulo: 'Hora', render: (r) => horaCorta(r.creado, zona) },
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
      </div>
    </div>
  );
}
