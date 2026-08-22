'use client';

import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * LISTA DE UNA COLUMNA CON CASILLAS — definición única de «elegir varios de un catálogo
 * largo cuando hay sitio para verlo entero».
 *
 * Es la **hermana de `MultiSelectSearch`**, no una copia: aquella es un desplegable con
 * chips, para elegir dos o tres cosas desde dentro de un formulario apretado; esta ocupa
 * todo el alto que le den y enseña el catálogo de corrido, para elegir mirando la lista.
 * La FILA es literalmente la misma pieza (`FilaMarcable`, exportada aquí e importada por
 * `MultiSelectSearch`): así no hay dos casillas que se vean distinto.
 *
 * Nació el 2026-08-21 con el panel «Talentos de la solución» (Admin → Soluciones), que
 * Fernando pidió **en una sola columna y en orden alfabético ascendente**.
 */

/** Una fila marcable: casilla con `Check` + etiqueta. NUNCA un `<input type=checkbox>`. */
export function FilaMarcable({
  marcada, etiqueta, nota, onClick, disabled = false,
}: {
  marcada: boolean;
  etiqueta: string;
  /** Segunda línea o texto a la derecha (p. ej. cuánto trabajo respalda al talento). */
  nota?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={marcada}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12.5px] transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${marcada ? 'bg-accent-light text-accent' : 'text-digi-text hover:bg-black/[0.03]'}`}
      style={mf}
    >
      <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center
        ${marcada ? 'bg-accent border-accent text-white' : 'border-digi-border'}`}>
        {marcada && <Check className="w-3 h-3" />}
      </span>
      <span className="truncate">{etiqueta}</span>
      {nota !== undefined && <span className="ml-auto shrink-0 text-[11.5px] text-digi-muted">{nota}</span>}
    </button>
  );
}

export interface OpcionMarcable {
  valor: string;
  etiqueta: string;
  nota?: React.ReactNode;
  /** Se pinta apagada y no se puede marcar (p. ej. un talento que ya es de otra solución). */
  bloqueada?: boolean;
  /** Motivo del bloqueo, como `title` de la fila. */
  motivo?: string;
}

export default function ListaMarcable({
  opciones, elegidas, onChange, buscador = true, placeholder = 'Buscar…',
  vacio = 'Sin coincidencias', orden = 'alfabetico',
}: {
  opciones: OpcionMarcable[];
  elegidas: string[];
  onChange: (siguiente: string[]) => void;
  buscador?: boolean;
  placeholder?: string;
  vacio?: string;
  /** `alfabetico` = ascendente por etiqueta (es-ES, ignora tildes y mayúsculas). */
  orden?: 'alfabetico' | 'dado';
}) {
  const [busca, setBusca] = useState('');
  const marcadas = useMemo(() => new Set(elegidas), [elegidas]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q ? opciones.filter((o) => o.etiqueta.toLowerCase().includes(q)) : opciones;
    if (orden === 'dado') return base;
    // `localeCompare` con es-ES: «Ábaco» va antes que «Buceo», y no al final como haría un
    // orden por código de carácter.
    return [...base].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es-ES', { sensitivity: 'base' }));
  }, [opciones, busca, orden]);

  const alternar = (valor: string) =>
    onChange(marcadas.has(valor) ? elegidas.filter((v) => v !== valor) : [...elegidas, valor]);

  return (
    <div className="flex flex-col min-h-0 gap-2">
      {buscador && (
        <div className="relative shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-digi-muted pointer-events-none" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={placeholder}
            className="field-control w-full pl-9 pr-3 py-2 bg-digi-darker border border-digi-border rounded
                       text-[13px] text-digi-text placeholder:text-digi-muted/60 focus:border-accent focus:outline-none transition-colors"
            style={mf}
          />
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto rounded border border-digi-border divide-y divide-digi-border/60">
        {lista.length === 0 ? (
          <p className="px-3 py-3 text-[12px] text-digi-muted" style={mf}>{vacio}</p>
        ) : (
          lista.map((o) => (
            <div key={o.valor} title={o.bloqueada ? o.motivo : undefined}>
              <FilaMarcable
                marcada={marcadas.has(o.valor)}
                etiqueta={o.etiqueta}
                nota={o.nota}
                disabled={o.bloqueada}
                onClick={() => alternar(o.valor)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
