'use client';

import { useCallback, useRef, useState } from 'react';
import { FilterX } from 'lucide-react';
import { BTN_ICONO_FILA } from '@/components/ui/Button';
import { TIPOS_NODO } from '@/services/espacio-trabajo/flujo-catalogo.mjs';
import type { DocFlujo, TipoNodo } from './colocar';
import { PIEZA_CONECTOR, PIEZAS } from './piezas';

/** Lo que atenúa el diagrama: el nodo elegido y el rol. Los comparten el panel del Espacio y la página pública. */
export function useFiltroFlujo() {
  const [elegido, setElegido] = useState<string | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const sinMover = useRef(false);
  const cambiarRol = useCallback((r: string | null) => { setRol(r); setElegido(null); }, []);
  /* Vuelve a verse todo, sin mover la vista: quien lo pulsa quiere ver lo que rodea a lo que estaba mirando. */
  const quitarFiltro = useCallback(() => { if (rol) sinMover.current = true; setRol(null); setElegido(null); }, [rol]);
  const limpiar = useCallback(() => { setRol(null); setElegido(null); }, []);
  return { elegido, setElegido, rol, cambiarRol, quitarFiltro, limpiar, sinMover, hayFiltro: !!elegido || !!rol };
}

export function BotonQuitarFiltro({ activo, alPulsar }: { activo: boolean; alPulsar: () => void }) {
  return (
    <button type="button" disabled={!activo} onClick={alPulsar} aria-label="Quitar filtro" title="Quitar filtro" className={`${BTN_ICONO_FILA} ${activo ? '!text-accent' : ''}`}>
      <FilterX className="w-3.5 h-3.5" />
    </button>
  );
}

export function Leyenda() {
  return (
    <div aria-label="Piezas del diagrama" className="hidden md:flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 border-t border-digi-border">
      {(Object.keys(TIPOS_NODO) as TipoNodo[]).map((t) => {
        const { Icono, texto } = PIEZAS[t];
        return <span key={t} title={TIPOS_NODO[t].uso} className="inline-flex items-center gap-1.5 text-[11.5px] text-digi-muted"><Icono className={`w-3.5 h-3.5 ${texto}`} />{TIPOS_NODO[t].nombre}</span>;
      })}
      <span title={PIEZA_CONECTOR.uso} className="inline-flex items-center gap-1.5 text-[11.5px] text-digi-muted"><PIEZA_CONECTOR.Icono className="w-3.5 h-3.5 text-accent" />{PIEZA_CONECTOR.nombre}</span>
    </div>
  );
}

export function SelectorRol({ doc, rol, alCambiar, className = '' }: { doc: DocFlujo; rol: string | null; alCambiar: (r: string | null) => void; className?: string }) {
  return (
    <select aria-label="Rol" value={rol ?? ''} onChange={(e) => alCambiar(e.target.value || null)}
      className={`select-compacto min-w-0 !text-[16px] lg:!h-7 lg:!min-h-0 lg:!text-[12px] ${className}`}>
      <option value="">Todos los roles</option>
      {doc.roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
    </select>
  );
}
