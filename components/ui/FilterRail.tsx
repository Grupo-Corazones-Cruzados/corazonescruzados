'use client';

import type { LucideIcon } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

export interface FilterRailItem<T extends string = string> {
  value: T;
  label: string;
  Icon: LucideIcon;
  /** Conteo a la derecha. `undefined` = sin badge. */
  count?: number;
}

/**
 * RAIL de filtro (patrón "Explorador Azure", `Diseño.md`): tarjeta con un título de sección
 * en mayúsculas y una lista de ítems con icono + etiqueta + burbuja de conteo; el activo se
 * resalta con `bg-accent-light`, texto `accent` y una barra izquierda `border-accent`.
 *
 * Definición ÚNICA reusable. Este control estaba **duplicado inline** (como `RailItem` local)
 * en más de una docena de páginas (tickets, proyectos, clientes, suscripciones, flows,
 * Reclutamiento…). Los nuevos usos deben importar ESTE componente; los antiguos están
 * pendientes de migrar (ver PROPUESTAS.md).
 */
export default function FilterRail<T extends string = string>({
  title,
  items,
  value,
  onChange,
  className,
  hideZeroCounts = false,
}: {
  title: string;
  items: FilterRailItem<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  /** true = oculta la burbuja cuando el conteo es 0 (como en Reclutamiento). */
  hideZeroCounts?: boolean;
}) {
  return (
    <aside className={`w-full lg:w-[200px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2 ${className || ''}`}>
      <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>{title}</p>
      <div className="space-y-0.5">
        {items.map((it) => {
          const active = value === it.value;
          const showCount = it.count != null && (!hideZeroCounts || it.count > 0);
          return (
            <button
              key={it.value}
              onClick={() => onChange(it.value)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${
                active ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'
              }`}
            >
              <it.Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
              <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>{it.label}</span>
              {showCount && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>
                  {it.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
