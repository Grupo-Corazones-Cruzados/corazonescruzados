'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

const bodyFont = { fontFamily: 'var(--font-body)' } as const;

/** `hint` es una segunda línea bajo la etiqueta (p. ej. el correo) y entra en la búsqueda;
 *  `icon` va a la izquierda de la primera línea; `meta` es una tercera línea (p. ej. el rol) y
 *  `metaRight` va en esa misma línea, al borde derecho (p. ej. la prospección); `keywords` es
 *  texto que se busca sin enseñarse (p. ej. los talentos). Todos son opcionales. */
interface Option {
  value: string; label: string; hint?: string; icon?: ReactNode;
  meta?: ReactNode; metaRight?: ReactNode; keywords?: string;
}
interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

/**
 * Desplegable CON buscador (combobox). Mismo aspecto que PixelSelect pero, al abrir,
 * muestra un campo de búsqueda que filtra la lista — útil cuando hay muchas opciones
 * (p. ej. todas las zonas horarias). Cierra al hacer clic fuera o con Escape.
 */
export default function SearchableSelect({
  label, value, onChange, options, placeholder = 'Selecciona…', searchPlaceholder = 'Buscar…', disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) || null;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s) || (o.hint?.toLowerCase().includes(s) ?? false) || (o.keywords?.toLowerCase().includes(s) ?? false));
  }, [q, options]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  useEffect(() => { if (open) { setQ(''); const id = setTimeout(() => inputRef.current?.focus(), 0); return () => clearTimeout(id); } }, [open]);

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      {label && (
        <label className="field-label text-[10px] text-accent-glow opacity-70" style={{ fontFamily: 'var(--font-display)' }}>{label}</label>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="field-control w-full px-3 py-2.5 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:outline-none flex items-center justify-between gap-2 text-left disabled:opacity-50"
          style={bodyFont}
        >
          <span className={`truncate ${selected ? '' : 'text-digi-muted/60'}`}>{selected ? selected.label : placeholder}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 text-digi-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-[80] mt-1 w-full bg-digi-card border-2 border-digi-border rounded-md shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-2.5 py-2 border-b border-digi-border">
              <Search className="w-3.5 h-3.5 text-digi-muted shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="field-plain w-full bg-transparent text-[13px] text-digi-text placeholder:text-digi-muted/50 focus:outline-none"
                style={bodyFont}
              />
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-[12px] text-digi-muted text-center" style={bodyFont}>Sin resultados</p>
              ) : filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full flex ${o.hint || o.meta ? 'items-start py-2' : 'items-center py-1.5'} gap-2 px-3 text-left text-[13px] transition-colors ${o.value === value ? 'bg-accent-light text-accent' : 'text-digi-text hover:bg-black/[0.04]'}`}
                  style={bodyFont}
                >
                  {o.icon && <span className="shrink-0 h-[18px] flex items-center">{o.icon}</span>}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate leading-[18px]">{o.label}</span>
                    {o.hint && <span className="block truncate text-[11.5px] leading-4 text-digi-muted">{o.hint}</span>}
                    {(o.meta || o.metaRight) && (
                      <span className="flex items-center gap-2 mt-0.5 text-[11px] leading-4 text-digi-muted">
                        <span className="flex-1 min-w-0 truncate">{o.meta}</span>
                        {o.metaRight && <span className="shrink-0">{o.metaRight}</span>}
                      </span>
                    )}
                  </span>
                  {o.value === value && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
