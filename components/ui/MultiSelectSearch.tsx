'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { FilaMarcable } from './ListaMarcable';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface MultiOption { value: string; label: string }

/**
 * Selector MÚLTIPLE con BUSCADOR. Reutilizable para cualquier lista (valores, talentos…).
 * Lo elegido se ve **dentro** del desplegable, en la casilla de cada fila. Fuera no hay
 * nada: las etiquetas que antes colgaban debajo le robaban una fila de alto a la tabla
 * cada vez que se filtraba, y movían todo lo de abajo justo cuando uno está mirando los
 * resultados. Para deshacer, un botón en el borde del propio control.
 * Limita los resultados visibles para listas grandes (p. ej. 500+ talentos).
 *
 * ⚠️ Es la variante **desplegable**, para elegir dos o tres cosas dentro de un formulario
 * apretado. Cuando hay sitio para ver el catálogo entero en una columna, la variante es
 * `ListaMarcable` — y las dos comparten la FILA (`FilaMarcable`), para que la casilla no se
 * vea de dos maneras.
 */
export default function MultiSelectSearch({
  options,
  selected,
  onChange,
  placeholder = 'Buscar…',
  emptyText = 'Sin coincidencias',
  maxVisible = 60,
}: {
  options: MultiOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  maxVisible?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    return base.slice(0, maxVisible);
  }, [options, query, maxVisible]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = (value: string) => {
    onChange(selectedSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  const hayFiltro = selected.length > 0;
  const totalMatches = query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())).length : options.length;

  return (
    <div ref={wrapRef} className="relative">
      {/* Buscador (con el desplegable anclado justo debajo) */}
      <div className="relative">
        <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={hayFiltro ? `${selected.length} seleccionado${selected.length > 1 ? 's' : ''}` : placeholder}
          className={`w-full pl-8 py-2 bg-digi-darker border-2 rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none ${
            hayFiltro
              // Con filtro puesto, el control lo dice por sí mismo: borde de acento y el
              // recuento en el hueco del texto. Así se sabe que está filtrando sin mirar
              // debajo, que es de donde se quitaron las etiquetas.
              ? 'border-accent placeholder:text-accent pr-9'
              : 'border-digi-border placeholder:text-digi-muted/50 pr-3'
          }`}
          style={mf}
        />

        {/* Deshacer el filtro de ESTE control, en su propio borde derecho. Solo existe
            cuando hay algo que deshacer: un botón permanente que la mitad del tiempo no
            hace nada enseña a ignorarlo. */}
        {hayFiltro && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange([]); setQuery(''); }}
            title="Quitar este filtro"
            aria-label="Quitar este filtro"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-accent hover:bg-accent-light transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Desplegable */}
        {open && (
          <div className="absolute z-20 top-full mt-1 left-0 w-full max-h-64 overflow-y-auto rounded-md border-2 border-digi-border bg-digi-card shadow-lg">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-digi-muted" style={mf}>{emptyText}</p>
            ) : (
              <>
                {filtered.map((o) => (
                  <FilaMarcable key={o.value} marcada={selectedSet.has(o.value)}
                    etiqueta={o.label} onClick={() => toggle(o.value)} />
                ))}
                {totalMatches > filtered.length && (
                  <p className="px-3 py-2 text-[11px] text-digi-muted border-t border-digi-border" style={mf}>
                    Mostrando {filtered.length} de {totalMatches}. Escribe para afinar la búsqueda.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
