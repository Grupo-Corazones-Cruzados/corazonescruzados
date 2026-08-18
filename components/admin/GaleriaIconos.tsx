'use client';

/**
 * GALERÍA DE ICONOS — se elige el icono viéndolo, no escribiendo su nombre.
 *
 * Fernando: *«que la interfaz permita seleccionar de una galería de iconos el icono que
 * queremos presentar para ese concepto»*.
 *
 * ── DE DÓNDE SALEN ─────────────────────────────────────────────────────────────
 * Del mapa `ICONOS` de `components/sitio/piezas.tsx`, que es la iconografía del sitio.
 * **No hay una segunda lista que mantener**: añadir un icono allí lo ofrece aquí solo, y
 * quitarlo lo retira de las dos partes a la vez.
 *
 * El buscador filtra por el nombre de la clave —`robot`, `nube`, `base-datos`—, que es lo
 * único que se puede escribir de un icono. Con más de cien, sin buscador no se encuentra.
 */

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ICONOS, NOMBRES_DE_ICONO } from '@/components/sitio/piezas';

const mf = { fontFamily: 'var(--font-body)' } as const;

export default function GaleriaIconos({
  valor, onChange,
}: {
  valor: string;
  onChange: (icono: string) => void;
}) {
  const [busca, setBusca] = useState('');

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? NOMBRES_DE_ICONO.filter((n) => n.includes(q)) : NOMBRES_DE_ICONO;
  }, [busca]);

  return (
    <div>
      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-digi-muted pointer-events-none" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar icono…"
          className="field-control w-full pl-8 pr-3 py-1.5 bg-digi-darker border border-digi-border rounded
                     text-[12.5px] text-digi-text placeholder:text-digi-muted/60 focus:border-accent focus:outline-none"
          style={mf}
        />
      </div>

      {/* Alto fijo con desplazamiento propio: sin él, cien iconos empujan el botón de
          guardar fuera del panel y hay que recorrer todo para llegar a él. */}
      <div className="max-h-[190px] overflow-y-auto rounded border border-digi-border p-2">
        {visibles.length === 0 ? (
          <p className="text-[12px] text-digi-muted py-2 text-center" style={mf}>Sin coincidencias.</p>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {visibles.map((n) => {
              const Icono = ICONOS[n];
              const activo = n === valor;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange(n)}
                  title={n}
                  aria-label={n}
                  aria-pressed={activo}
                  className={`aspect-square inline-flex items-center justify-center rounded border transition-colors
                              focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                    ${activo
                      ? 'border-accent bg-accent-light/20 text-accent'
                      : 'border-transparent text-digi-muted hover:border-digi-border hover:text-digi-text'}`}
                >
                  <Icono className="w-[18px] h-[18px]" />
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11.5px] text-digi-muted" style={mf}>
        Elegido: <strong className="text-digi-text">{valor}</strong>
      </p>
    </div>
  );
}
