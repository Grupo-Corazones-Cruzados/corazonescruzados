'use client';

import { Fragment, useRef, useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  width?: string;
  /** Si se define, la columna es ordenable por esta clave (clic en el encabezado). */
  sortKey?: string;
  /** Oculta la columna en pantallas chicas (< 640px) para que la tabla quepa en móvil. */
  hideOnMobile?: boolean;
}

interface PixelDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyTitle?: string;
  emptyDesc?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  /** Filas de una sola línea: respeta los anchos (table-layout fixed) y trunca el texto con … sin crecer la altura. */
  singleLine?: boolean;
  /** Píxeles extra a reservar bajo la tabla (p. ej. para una barra de resumen fija). */
  bottomReserve?: number;
  /** Ordenamiento por columna (estilo SharePoint): encabezado clicable + chevron. */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  /** Clase(s) extra por fila según el dato (p. ej. relleno por estado). */
  rowClassName?: (item: T) => string;
  /**
   * ⭐ EL DISEÑO DE ESTA TABLA EN UN TELÉFONO (Fernando, 2026-09-21).
   *
   * Una tabla es una rejilla de columnas, y un teléfono no tiene columnas: cuatro cifras
   * en 390 px salen apretadas, la quinta columna se cae fuera y lo que se pulsa es una
   * fila de 2 px de margen. Cuando se define esto, **por debajo de `lg` cada fila se
   * dibuja como una TARJETA** con lo que la identifica arriba y sus cifras debajo, y la
   * tabla queda para el escritorio.
   *
   * Es opcional a propósito: una tabla sin `tarjetaMovil` sigue comportándose como
   * siempre, así que añadir el modo teléfono a una pantalla no obliga a tocar las otras.
   *
   * ⚠️ Se pintan LAS DOS y el ancho decide cuál se ve (`lg:hidden` / `hidden lg:flex`),
   * no un `window.innerWidth` en el render: medir la ventana al pintar da un desajuste de
   * hidratación —el servidor no tiene ventana— y el primer fotograma sale con el diseño
   * equivocado.
   */
  tarjetaMovil?: (item: T) => React.ReactNode;
  /**
   * Hay una petición en curso (p. ej. se acaba de cambiar el filtro). Las filas que ya se
   * ven se ATENÚAN y dejan de responder hasta que llegan las nuevas, y una lista vacía dice
   * «Cargando…» en vez de «Sin datos» (2026-09-28). Sin esto, al cambiar de filtro la tabla
   * se quedaba igual un segundo largo y parecía que el clic no había hecho nada.
   */
  cargando?: boolean;
  /**
   * ⭐ EL RECUENTO (Fernando, 2026-10-29: «todas las tablas tengan recuento»). Es la última
   * franja DE LA PROPIA TARJETA, con su fondo, no una línea suelta debajo: la tabla llega al
   * pie como los paneles de los lados y el recuento se distingue por ser parte de ella.
   * Por defecto dice «N registros»; `unidad` cambia la palabra, `recuento` el texto entero
   * («28 clientes · 74 facturas») y `resumen` va a la derecha (un total).
   */
  unidad?: [singular: string, plural: string];
  recuento?: ReactNode;
  resumen?: ReactNode;
  sinRecuento?: boolean;
}

const BOTTOM_GAP = 16; // breathing room below the table

/**
 * Alto del pie fijo de la app (`DashboardBreadcrumb`, la barra con la ruta). La tabla se
 * estira hasta el borde inferior de la ventana, así que sin descontarlo TERMINA POR DEBAJO
 * del pie y las últimas filas quedan tapadas.
 *
 * Se MIDE en vez de codificar los 36 px: si el pie cambia de alto, o la página no lo tiene
 * (p. ej. `members/[id]`, fuera del dashboard), el cálculo sigue saliendo bien y no sobra
 * hueco donde no hay pie.
 */
function appFooterHeight(): number {
  if (typeof document === 'undefined') return 0;
  const el = document.querySelector('[data-app-footer]');
  return el ? Math.round(el.getBoundingClientRect().height) : 0;
}
const MIN_HEIGHT = 220;

/**
 * Qué está enseñando la tabla: cuántas filas y cuáles son las primeras. Cuando cambia (otro
 * filtro, otra búsqueda, otra página) las filas se vuelven a montar y entran escalonadas
 * (`.fila-entra`, `app/movimiento.css`). Recargar los MISMOS datos no la cambia, así que un
 * refresco no hace bailar la tabla.
 */
function firmaDatos(data: unknown[]): string {
  return data.length + ':' + data.slice(0, 8).map((d: any) => String(d?.id ?? JSON.stringify(d)?.slice(0, 60))).join('|');
}
const posicion = (i: number) => ({ '--i': i } as CSSProperties);

export default function PixelDataTable<T>({
  columns,
  data,
  onRowClick,
  emptyTitle = 'Sin datos',
  emptyDesc = 'No hay registros aun.',
  page,
  totalPages,
  onPageChange,
  singleLine = false,
  bottomReserve = 0,
  sortBy,
  sortDir,
  onSort,
  rowClassName,
  tarjetaMovil,
  cargando = false,
  unidad = ['registro', 'registros'],
  recuento,
  resumen,
  sinRecuento = false,
}: PixelDataTableProps<T>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fillH, setFillH] = useState<number>();

  // Fixed height = from the table's top to the bottom of the viewport, so the
  // table fills the available screen space and scrolls INTERNALLY (the page
  // itself doesn't scroll). Recomputes on resize / data change.
  useEffect(() => {
    const compute = () => {
      const el = wrapRef.current;
      if (!el) return;

      /**
       * ⚠️ EN PANTALLA ESTRECHA LA TABLA NO SE ESTIRA. Mide lo que ocupa y ya.
       *
       * Estirarse hasta el pie tiene sentido cuando la tabla es lo único de la pantalla y
       * hay sitio de sobra: se desplaza por dentro y la página no se mueve. Pero por
       * debajo de `lg` los diseños se APILAN —la tabla arriba, su panel de detalle
       * debajo—, y una tabla que llega hasta el borde inferior deja al panel siguiente
       * **fuera de la pantalla**, detrás del pie. Se veía en Herramientas: dos filas, un
       * hueco enorme, y «Selecciona una herramienta» cortado abajo.
       *
       * Y con dos filas, ocupar un teléfono entero para enseñar dos líneas tampoco es lo
       * que uno quiere. Sin altura impuesta, la tabla mide su contenido y la página se
       * desplaza como cualquier otra — que es lo normal en un móvil.
       *
       * 1024 es el mismo corte que usan los diseños para pasar de apilado a columnas.
       */
      if (window.innerWidth < 1024) { setFillH(undefined); return; }

      const top = el.getBoundingClientRect().top;
      const h = Math.max(window.innerHeight - top - BOTTOM_GAP - appFooterHeight() - bottomReserve, MIN_HEIGHT);
      setFillH((prev) => (prev === undefined || Math.abs(prev - h) > 1 ? h : prev));
    };
    // run after layout settles (content above may still be rendering)
    const raf = requestAnimationFrame(compute);
    window.addEventListener('resize', compute);
    // recompute if content above the table changes height (e.g. async loads)
    const ro = new ResizeObserver(() => requestAnimationFrame(compute));
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', compute);
      ro.disconnect();
    };
  }, [data.length]);

  if (data.length === 0) {
    return (
      <div className="pixel-card text-center py-12" aria-busy={cargando || undefined}>
        <p className="pixel-heading text-sm text-digi-muted">{cargando ? 'Cargando…' : emptyTitle}</p>
        {!cargando && (
          <p className="text-xs text-digi-muted/60 mt-1" style={{ fontFamily: 'var(--font-body)' }}>
            {emptyDesc}
          </p>
        )}
      </div>
    );
  }

  const conPaginas = !!(totalPages && totalPages > 1 && onPageChange);
  const textoRecuento = recuento ?? `${data.length} ${data.length === 1 ? unidad[0] : unidad[1]}`;
  const botonPagina = 'inline-flex items-center justify-center w-11 h-11 sm:w-7 sm:h-7 border border-digi-border rounded text-digi-text hover:border-accent hover:text-accent disabled:opacity-40 disabled:pointer-events-none transition-colors';
  const pie = !sinRecuento || conPaginas ? (
    <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 bg-digi-card border-t border-digi-border text-[12px]" style={{ fontFamily: 'var(--font-body)' }}>
      <span className="min-w-0 truncate text-digi-muted">{!sinRecuento && textoRecuento}</span>
      <div className="flex items-center gap-3 shrink-0">
        {!sinRecuento && resumen && <span className="text-digi-text">{resumen}</span>}
        {conPaginas && (
          <div className="flex items-center gap-1">
            <span className="text-digi-muted mr-1 tabular-nums">Página {page} de {totalPages}</span>
            <button onClick={() => onPageChange!((page || 1) - 1)} disabled={page === 1} className={botonPagina} aria-label="Página anterior" title="Página anterior"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <button onClick={() => onPageChange!((page || 1) + 1)} disabled={page === totalPages} className={botonPagina} aria-label="Página siguiente" title="Página siguiente"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div aria-busy={cargando || undefined}
      className={`transition-opacity duration-150 ${cargando ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* ── El mismo contenido, contado para un teléfono ── */}
      {tarjetaMovil && (
        <div className="lg:hidden space-y-2">
          <Fragment key={firmaDatos(data)}>
          {data.map((item, i) => (
            <div
              key={i}
              style={posicion(i)}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(item); } } : undefined}
              className={`fila-entra bg-digi-card border border-digi-border rounded-lg p-3 transition-colors ${
                onRowClick ? 'cursor-pointer active:bg-black/[0.04]' : ''
              } ${rowClassName?.(item) ?? ''}`}
            >
              {tarjetaMovil(item)}
            </div>
          ))}
          </Fragment>
        </div>
      )}

      {/* ── Sin `tarjetaMovil`, la GALERÍA AUTOMÁTICA (Fernando, 2026-10-23) ──────────
          En un teléfono una tabla obliga a deslizar de lado y se pierden datos de vista (en
          Centralizado eran 641 px dentro de 356). Por debajo de `md` cada fila es una tarjeta
          que sale de las MISMAS columnas: la primera es la cabecera, las que no tienen título
          (acciones) van a su derecha y el resto en una rejilla «TÍTULO / valor». Así ninguna
          tabla se queda fuera. Regla en `/diseno` §4-ter. */}
      {!tarjetaMovil && <GaleriaTabla columns={columns} data={data} onRowClick={onRowClick} rowClassName={rowClassName} />}
      {/* En el teléfono la tabla está escondida, y con ella su pie: va también aquí. */}
      {pie && <div className={`${tarjetaMovil ? 'lg:hidden' : 'md:hidden'} mt-2 border border-digi-border rounded-lg overflow-hidden`}>{pie}</div>}

      <div
        ref={wrapRef}
        className={`data-table border-2 border-digi-border overflow-hidden flex-col ${tarjetaMovil ? 'hidden lg:flex' : 'hidden md:flex'}`}
        style={{ height: fillH }}
      >
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm" style={singleLine ? { tableLayout: 'fixed' } : undefined}>
          <thead>
            <tr>
              {columns.map((col) => {
                const sortable = !!col.sortKey && !!onSort;
                const active = sortable && sortBy === col.sortKey;
                return (
                  <th
                    key={col.key}
                    className={`dt-th sticky top-0 z-10 bg-digi-card border-b-2 border-digi-border px-3 py-2.5 text-left text-[9px] text-digi-muted uppercase tracking-wider ${singleLine ? 'whitespace-nowrap overflow-hidden text-ellipsis' : ''} ${col.hideOnMobile ? 'hidden sm:table-cell' : ''}`}
                    style={{ fontFamily: 'var(--font-display)', width: col.width }}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort!(col.sortKey!)}
                        className="flex items-center justify-between gap-1 w-full uppercase tracking-wider hover:text-digi-text transition-colors"
                        style={{ fontFamily: 'var(--font-display)' }}
                        title="Ordenar"
                      >
                        <span className="truncate">{col.header}</span>
                        {active
                          ? (sortDir === 'asc' ? <ChevronUp size={12} className="shrink-0 text-accent-glow" /> : <ChevronDown size={12} className="shrink-0 text-accent-glow" />)
                          : <ChevronsUpDown size={12} className="shrink-0 opacity-30" />}
                      </button>
                    ) : col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <Fragment key={firmaDatos(data)}>
            {data.map((item, i) => (
              <tr
                key={i}
                style={posicion(i)}
                onClick={() => onRowClick?.(item)}
                className={`fila-entra dt-row border-b border-digi-border/50 transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-accent/5' : ''
                } ${rowClassName ? rowClassName(item) : ''}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    // Una columna SIN título es de acciones (iconos): nunca se recorta con «…»
                    // (Fernando, 2026-10-29: salían tres puntos junto al icono del PDF).
                    className={`dt-td px-3 py-2.5 text-xs text-digi-text ${singleLine && col.header.trim() ? 'whitespace-nowrap overflow-hidden text-ellipsis' : ''} ${col.hideOnMobile ? 'hidden sm:table-cell' : ''}`}
                    style={{ fontFamily: 'var(--font-body)', width: singleLine ? col.width : undefined }}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
            </Fragment>
          </tbody>
        </table>
      </div>

      {pie}
      </div>
    </div>
  );
}

/**
 * ⭐ LA TABLA CONTADA PARA UN TELÉFONO — una tarjeta por fila (Fernando, 2026-10-23 y 2026-10-29).
 *
 * La usa `PixelDataTable` sola, y la exportan las tablas que no pueden ser `PixelDataTable`
 * (la tabla de la factura, la del portafolio, la mensual de Pensamientos…): se pinta esto con
 * `md:hidden` y su `<table>` con `hidden md:block`. Así hay UNA galería en todo el panel.
 *
 * - La primera columna es la cabecera de la tarjeta; las columnas SIN título (acciones) van a su
 *   derecha y no abren la fila; el resto, rejilla «TÍTULO / valor» en dos columnas.
 * - `onRowClick` abre el detalle completo: con muchas columnas se pasan solo las que caben en
 *   una tarjeta y el resto se ve al tocarla.
 */
export function GaleriaTabla<T>({
  columns, data, onRowClick, rowClassName, className = 'md:hidden',
}: {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
  /** Desde qué ancho desaparece (por defecto `md:hidden`, el corte de la tabla). */
  className?: string;
}) {
  const [cabecera, ...resto] = columns;
  const acciones = resto.filter((c) => !c.header.trim());
  const campos = resto.filter((c) => c.header.trim());
  return (
    <div className={`${className} space-y-2`}>
      <Fragment key={firmaDatos(data)}>
      {data.map((item, i) => (
        <div
          key={i}
          onClick={onRowClick ? () => onRowClick(item) : undefined}
          role={onRowClick ? 'button' : undefined}
          tabIndex={onRowClick ? 0 : undefined}
          onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(item); } } : undefined}
          className={`fila-entra bg-digi-card border border-digi-border rounded-lg p-3.5 transition-colors ${
            onRowClick ? 'cursor-pointer active:bg-black/[0.04]' : ''
          } ${rowClassName?.(item) ?? ''}`}
          style={{ fontFamily: 'var(--font-body)', ...posicion(i) }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 text-[13.5px] font-semibold text-digi-text break-words">{cabecera?.render(item)}</div>
            {acciones.length > 0 && (
              // Las acciones no abren la fila: el clic se queda en el botón.
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {acciones.map((c) => <span key={c.key}>{c.render(item)}</span>)}
              </div>
            )}
          </div>
          {campos.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 mt-2.5">
              {/* Un campo que queda solo en su fila ocupa las dos columnas: si no, una descripción
                  se cortaba a media tarjeta con la otra mitad vacía (Herramientas, 2026-10-29). */}
              {campos.map((c, j) => (
                <div key={c.key} className={`min-w-0 ${j === campos.length - 1 && campos.length % 2 === 1 ? 'col-span-2' : ''}`}>
                  <dt className="text-[10px] uppercase tracking-wide text-digi-muted">{c.header}</dt>
                  <dd className="text-[12.5px] text-digi-text break-words">{c.render(item)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
      </Fragment>
    </div>
  );
}
