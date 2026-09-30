'use client';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * PESTAÑAS DE LA COLUMNA DERECHA de un detalle («Propiedades / Incidentes»). Nació en el
 * detalle del proyecto y se extrajo al llevarla al ticket (2026-09-30): una sola definición.
 * Tarjeta con las pestañas a partes iguales; la activa en `bg-accent-light text-accent`.
 */
export default function PestanasRail<T extends string>({ valor, onChange, opciones }: {
  valor: T;
  onChange: (v: T) => void;
  opciones: { valor: T; texto: string }[];
}) {
  return (
    <div role="tablist" className="flex gap-1 bg-digi-card border border-digi-border rounded-lg p-1">
      {opciones.map((o) => (
        <button key={o.valor} type="button" role="tab" aria-selected={valor === o.valor} onClick={() => onChange(o.valor)}
          className={`flex-1 min-h-11 sm:min-h-0 text-[12px] font-medium py-1.5 rounded-md transition-colors ${valor === o.valor ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text'}`}
          style={mf}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}
