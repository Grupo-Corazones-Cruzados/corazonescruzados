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
  /**
   * Acciones del ítem (editar / eliminar). Se pintan a la derecha, **fuera** del botón de
   * selección para que no se traguen el clic, y aparecen al pasar el puntero o cuando el
   * ítem está activo. Se usa en el rail de campañas de Automatizaciones.
   */
  actions?: React.ReactNode;
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
  wrapLabels = false,
}: {
  title?: string;
  items?: FilterRailItem<T>[];
  sections?: FilterRailSection<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  /** true = oculta la burbuja cuando el conteo es 0 (como en Reclutamiento). */
  hideZeroCounts?: boolean;
  /**
   * true = la etiqueta se parte en hasta 2 líneas en vez de cortarse con puntos suspensivos.
   * Para railes cuyos ítems son NOMBRES largos y no categorías cortas (las campañas de
   * Automatizaciones: un asunto de correo no se reconoce en 12 caracteres).
   */
  wrapLabels?: boolean;
}) {
  const groups: FilterRailSection<T>[] = sections ?? [{ items: items ?? [] }];

  return (
    <aside className={`w-full shrink-0 bg-digi-card border border-digi-border rounded-lg p-2 ${className || 'lg:w-[220px]'}`}>
      {title && (
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>{title}</p>
      )}

      {/* ── TELÉFONO: la misma lista, como una tira de fichas ────────────────────────
          Apilado, este rail son N filas de 35 px encima del contenido: en Recordatorios
          eran 4 (140 px), en Centralizado o Proyectos bastantes más, y **hay que
          recorrerlas enteras para llegar a lo que se venía a ver**. Aquí ocupan una
          línea que se desliza con el dedo.
          ⚠️ Se pintan las DOS y el ancho decide (`lg:hidden` / `hidden lg:block`): medir
          la ventana al pintar da un desajuste de hidratación. */}
      <div className="lg:hidden desplaza-x flex gap-1.5 overflow-x-auto pb-0.5">
        {groups.flatMap((group, gi) =>
          group.items.map((it, ii) => {
            const active = value === it.value;
            const showCount = it.count != null && (!hideZeroCounts || it.count > 0);
            return (
              <div key={`${gi}-${it.value}`} className="flex items-center gap-1 shrink-0">
                {/* Separador entre grupos: la línea que en vertical los separa. */}
                {gi > 0 && ii === 0 && <span className="w-px h-6 bg-digi-border/60 mx-0.5" />}
                <button
                  onClick={() => onChange(it.value)}
                  title={it.hint || it.label}
                  className={`h-11 inline-flex items-center gap-1.5 px-3 rounded-full border text-[12.5px] font-medium whitespace-nowrap transition-colors ${
                    active ? 'bg-accent text-white border-accent' : 'border-digi-border text-digi-text'
                  }`}
                  style={mf}
                >
                  <it.Icon className="w-4 h-4 shrink-0" />
                  {it.label}
                  {showCount && <span className="tabular-nums opacity-75">{it.count}</span>}
                </button>
                {/* Las acciones del ítem solo en el ACTIVO: en una tira, repetirlas en
                    cada ficha sería una fila de botones sin sitio. */}
                {it.actions && active && (
                  <span className="flex items-center gap-0.5 shrink-0">{it.actions}</span>
                )}
              </div>
            );
          }),
        )}
      </div>

      <div className="hidden lg:block">
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
                <div
                  key={it.value}
                  className={`group group/rail relative flex items-center rounded-md transition-colors border-l-2 ${
                    active ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.03]'
                  }`}
                >
                  <button
                    onClick={() => onChange(it.value)}
                    className={`flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 text-left ${active ? 'text-accent' : 'text-digi-text'}`}
                  >
                    <it.Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[12.5px] font-medium ${wrapLabels ? 'line-clamp-2 leading-snug' : 'truncate'}`} style={mf}>{it.label}</span>
                      {it.hint && <span className="block text-[10px] text-digi-muted truncate" style={mf}>{it.hint}</span>}
                    </span>
                    {showCount && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums shrink-0 ${active ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>
                        {it.count}
                      </span>
                    )}
                  </button>
                  {it.actions && (
                    <span className={`acciones-al-pasar flex items-center gap-0.5 pr-1.5 shrink-0 ${active ? '!opacity-100' : ''}`}>
                      {it.actions}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      </div>
    </aside>
  );
}
