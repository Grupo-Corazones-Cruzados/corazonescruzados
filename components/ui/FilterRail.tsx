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
  /** Segunda línea bajo la etiqueta (p. ej. el Piso en Centralizado). */
  hint?: string;
}

/** Grupo de ítems dentro del mismo rail, separado del anterior por una línea. */
export interface FilterRailSection<T extends string = string> {
  /** Encabezado del grupo. Omitir en el primero cuando el rail ya tiene `title`. */
  title?: string;
  items: FilterRailItem<T>[];
}

/**
 * RAIL de filtro (patrón "Explorador Azure", `Diseño.md`): tarjeta con un título de sección
 * en mayúsculas y una lista de ítems con icono + etiqueta + burbuja de conteo; el activo se
 * resalta con `bg-accent-light`, texto `accent` y una barra izquierda `border-accent`.
 *
 * Definición ÚNICA reusable: este control estaba duplicado inline (como `RailItem` local)
 * en una docena de páginas, lo que hacía que unas y otras se vieran distintas. **Un rail
 * nuevo se hace con este componente, no copiando el marcado.**
 *
 * Admite dos formas:
 *  · `items` — una sola lista (lo habitual).
 *  · `sections` — varios grupos con su encabezado, separados por una línea (Proyectos:
 *    Alcance + Estado; Centralizado: "Todos" + Pisos; Automatizaciones: "Todos" + tipos).
 */
export default function FilterRail<T extends string = string>({
  title,
  items,
  sections,
  value,
  onChange,
  className,
  hideZeroCounts = false,
}: {
  title?: string;
  items?: FilterRailItem<T>[];
  sections?: FilterRailSection<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  /** true = oculta la burbuja cuando el conteo es 0 (como en Reclutamiento). */
  hideZeroCounts?: boolean;
}) {
  const groups: FilterRailSection<T>[] = sections ?? [{ items: items ?? [] }];

  return (
    <aside className={`w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2 ${className || ''}`}>
      {title && (
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>{title}</p>
      )}

      {groups.map((group, gi) => (
        <div key={group.title ?? gi}>
          {gi > 0 && <div className="h-px bg-digi-border/60 my-1.5 mx-2" />}
          {group.title && (
            <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>{group.title}</p>
          )}
          <div className="space-y-0.5">
            {group.items.map((it) => {
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
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-medium truncate" style={mf}>{it.label}</span>
                    {it.hint && <span className="block text-[10px] text-digi-muted truncate" style={mf}>{it.hint}</span>}
                  </span>
                  {showCount && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums shrink-0 ${active ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>
                      {it.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}
