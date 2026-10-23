'use client';

import type { LucideIcon } from 'lucide-react';
import Segmentado from '@/components/ui/Segmentado';

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
    <aside className={`w-full shrink-0 lg:bg-digi-card lg:border lg:border-digi-border lg:rounded-lg lg:p-2 ${className || 'lg:w-[220px]'}`}>
      {title && (
        <p className="hidden lg:block text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>{title}</p>
      )}

      {/* ── TELÉFONO: UN SOLO CONTROL, sin tarjeta (Fernando, 2026-10-23) ─────────────
          Antes era una tira de fichas que se deslizaba de lado: en Proyectos medía 1212 px y
          escondía la mitad de las opciones. Ahora, hasta 3 opciones, el `Segmentado` de
          siempre a todo el ancho; con más, el `<select>` nativo del teléfono («Estado:
          Abiertos · 5»), con los grupos como `optgroup`. Las acciones del ítem activo van a
          su derecha. Regla en `/diseno` §4-ter.
          ⚠️ Se pintan las DOS versiones y el ancho decide (`lg:hidden` / `hidden lg:block`):
          medir la ventana al pintar da un desajuste de hidratación. */}
      <FiltroTelefono groups={groups} value={value} onChange={onChange} title={title} hideZeroCounts={hideZeroCounts} />

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

/** La versión de teléfono del rail: segmentado (≤ 3 opciones) o `<select>` nativo. */
function FiltroTelefono<T extends string>({
  groups, value, onChange, title, hideZeroCounts,
}: {
  groups: FilterRailSection<T>[];
  value: T;
  onChange: (next: T) => void;
  title?: string;
  hideZeroCounts: boolean;
}) {
  const todos = groups.flatMap((g) => g.items);
  const cuenta = (it: FilterRailItem<T>) =>
    it.count != null && (!hideZeroCounts || it.count > 0) ? it.count : undefined;
  const activo = todos.find((it) => it.value === value);

  if (todos.length <= 3) {
    return (
      <Segmentado
        etiqueta={title}
        className="lg:hidden w-full"
        valor={value}
        onChange={onChange}
        opciones={todos.map((it) => {
          const n = cuenta(it);
          return { valor: it.value, texto: n != null ? `${it.label} · ${n}` : it.label };
        })}
      />
    );
  }

  const texto = (it: FilterRailItem<T>) => {
    const n = cuenta(it);
    return `${title ? `${title}: ` : ''}${it.label}${n != null ? ` · ${n}` : ''}`;
  };
  const conGrupos = groups.length > 1;
  return (
    <div className="lg:hidden flex items-center gap-1.5">
      <select
        aria-label={title}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="field-control field-select min-w-0 flex-1 h-11 px-3 bg-digi-card border border-digi-border rounded-md text-[13.5px] text-digi-text appearance-none cursor-pointer"
        style={mf}
      >
        {conGrupos
          ? groups.map((g, gi) => (
              <optgroup key={g.title ?? gi} label={g.title ?? title ?? ''}>
                {g.items.map((it) => <option key={it.value} value={it.value}>{texto(it)}</option>)}
              </optgroup>
            ))
          : todos.map((it) => <option key={it.value} value={it.value}>{texto(it)}</option>)}
      </select>
      {activo?.actions && <span className="flex items-center gap-0.5 shrink-0">{activo.actions}</span>}
    </div>
  );
}
