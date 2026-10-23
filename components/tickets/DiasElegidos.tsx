'use client';

import { X } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * Los días marcados en el calendario de «Días de trabajo», como etiquetas con «×». Es lo
 * ÚNICO que se muestra bajo el calendario, en «Nuevo ticket» y en el detalle: la hora, el
 * Meet y el tiempo de cada día se configuran en el detalle del día (`RegistroTrabajo`), no
 * aquí (Fernando, 2026-10-16).
 */
export default function DiasElegidos({ dias, onQuitar }: { dias: string[]; onQuitar: (d: string) => void }) {
  if (dias.length === 0) return null;
  return (
    <div className="border-t border-digi-border pt-2.5">
      <p className="text-[12px] font-medium text-digi-text mb-2" style={mf}>{dias.length} día(s) seleccionados</p>
      {/* ⭐ CON CONTRASTE EN LOS DOS TEMAS (Fernando, 2026-10-23). Eran `bg-accent-light` +
          `text-accent`: en el tema oscuro, morado oscuro sobre morado oscuro, no se leían.
          Ahora son el morado RELLENO de los días marcados del calendario de encima, con texto
          blanco: dicen sin explicarlo que son los mismos días. Un tono más oscuro
          (`accent-dark`) porque con `accent` el oscuro daba 4,3:1 y el texto de 12 px pide
          4,5; medido: 5,9:1 en oscuro y 14:1 en claro. La «×» es un botón de verdad. */}
      <div className="flex flex-wrap gap-1.5">
        {dias.map(d => (
          <span key={d} className="inline-flex items-center gap-0.5 h-7 pl-2.5 pr-1 rounded-md bg-accent-dark text-white text-[12px] font-medium tabular-nums" style={mf}>
            {new Date(d + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' })}
            <button type="button" onClick={() => onQuitar(d)} aria-label="Quitar día" title="Quitar día"
              className="destino-tactil w-5 h-5 flex items-center justify-center rounded text-white/75 hover:text-white hover:bg-white/20 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
