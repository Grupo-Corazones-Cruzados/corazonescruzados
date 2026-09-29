'use client';

const mf = { fontFamily: 'var(--font-body)' } as const;

export type OpcionSegmentado<T extends string> = {
  valor: T;
  texto: string;
  /** Segunda línea pequeña (p. ej. el importe de esa opción). */
  detalle?: string;
  deshabilitada?: boolean;
  /** Por qué está deshabilitada: sale al pasar el ratón. */
  porque?: string;
};

/**
 * ELEGIR UNA ENTRE DOS O TRES OPCIONES — definición ÚNICA (2026-09-29).
 *
 * Nació como «Cliente | Consumidor final» en el formulario de facturar y se extrajo al pasar
 * lo mismo al ticket, que además elige «Factura total | Abono parcial» y «Título del ticket |
 * Desglose de acciones». Antes cada uno tenía su estilo (botones con borde de acento); ahora
 * los tres son este control: una caja con las opciones dentro y la elegida rellena de acento.
 * Una opción que no se puede usar se ve deshabilitada, con el porqué en `title` — nunca con
 * una nota debajo.
 */
export default function Segmentado<T extends string>({
  opciones, valor, onChange, className = 'max-w-sm', etiqueta,
}: {
  opciones: OpcionSegmentado<T>[];
  valor: T;
  onChange: (v: T) => void;
  className?: string;
  /** Nombre del grupo para lectores de pantalla. */
  etiqueta?: string;
}) {
  return (
    <div role="group" aria-label={etiqueta} className={`flex gap-1 p-1 rounded-lg border border-digi-border bg-digi-card ${className}`}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" onClick={() => !o.deshabilitada && onChange(o.valor)} disabled={o.deshabilitada}
          title={o.deshabilitada ? o.porque : undefined} aria-pressed={valor === o.valor}
          className={`flex-1 px-3 py-1.5 rounded-md text-[12.5px] font-medium leading-tight transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            valor === o.valor ? 'bg-accent text-white' : 'text-digi-text enabled:hover:bg-black/[0.04]'}`} style={mf}>
          {o.texto}
          {o.detalle && <span className={`block text-[11px] font-normal tabular-nums ${valor === o.valor ? 'text-white/80' : 'text-digi-muted'}`}>{o.detalle}</span>}
        </button>
      ))}
    </div>
  );
}
