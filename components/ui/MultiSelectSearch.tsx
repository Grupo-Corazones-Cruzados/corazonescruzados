'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { FilaMarcable } from './ListaMarcable';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface MultiOption { value: string; label: string }

/**
 * Selector MÚLTIPLE con BUSCADOR. Reutilizable para cualquier lista (valores, talentos…).
 * Muestra las selecciones como chips y un desplegable filtrable donde se marcan/desmarcan.
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

  const labelOf = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
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
          placeholder={placeholder}
          className="w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
          style={mf}
        />

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

      {/* Chips seleccionados (DEBAJO del buscador para no descolocar el layout) */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {selected.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-light border border-accent/25 text-[11.5px] text-accent" style={mf}>
              {labelOf.get(v) || v}
              <button type="button" onClick={() => toggle(v)} className="hover:text-accent-hover" aria-label={`Quitar ${labelOf.get(v) || v}`}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
