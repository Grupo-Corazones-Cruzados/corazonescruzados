'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface Column<T> {
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
}

const BOTTOM_GAP = 16; // breathing room below the table
const MIN_HEIGHT = 220;

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
      const top = el.getBoundingClientRect().top;
      const h = Math.max(window.innerHeight - top - BOTTOM_GAP - bottomReserve, MIN_HEIGHT);
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
      <div className="pixel-card text-center py-12">
        <p className="pixel-heading text-sm text-digi-muted">{emptyTitle}</p>
        <p className="text-xs text-digi-muted/60 mt-1" style={{ fontFamily: 'var(--font-body)' }}>
          {emptyDesc}
        </p>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="data-table border-2 border-digi-border overflow-hidden flex flex-col" style={{ height: fillH }}>
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
            {data.map((item, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(item)}
                className={`dt-row border-b border-digi-border/50 transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-accent/5' : ''
                } ${rowClassName ? rowClassName(item) : ''}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`dt-td px-3 py-2.5 text-xs text-digi-text ${singleLine ? 'whitespace-nowrap overflow-hidden text-ellipsis' : ''} ${col.hideOnMobile ? 'hidden sm:table-cell' : ''}`}
                    style={{ fontFamily: 'var(--font-body)', width: singleLine ? col.width : undefined }}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages && totalPages > 1 && onPageChange && (
        <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-digi-card border-t-2 border-digi-border">
          <span className="text-[9px] text-digi-muted" style={{ fontFamily: 'var(--font-display)' }}>
            Pag {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange((page || 1) - 1)}
              disabled={page === 1}
              className="px-2 py-1 text-[10px] border border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow disabled:opacity-30 transition-colors"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              &lt;
            </button>
            <button
              onClick={() => onPageChange((page || 1) + 1)}
              disabled={page === totalPages}
              className="px-2 py-1 text-[10px] border border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow disabled:opacity-30 transition-colors"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
