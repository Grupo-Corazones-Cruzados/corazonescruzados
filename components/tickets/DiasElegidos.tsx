'use client';

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
    <div className="border-t border-digi-border pt-2">
      <p className="text-[11px] text-digi-muted mb-1.5" style={mf}>{dias.length} día(s) seleccionados:</p>
      <div className="flex flex-wrap gap-1.5">
        {dias.map(d => (
          <span key={d} className="text-[11px] px-2 py-0.5 rounded bg-accent-light border border-accent/30 text-accent flex items-center gap-1" style={mf}>
            {new Date(d + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' })}
            <button onClick={() => onQuitar(d)} aria-label="Quitar día" className="text-digi-muted hover:text-red-500">×</button>
          </span>
        ))}
      </div>
    </div>
  );
}
