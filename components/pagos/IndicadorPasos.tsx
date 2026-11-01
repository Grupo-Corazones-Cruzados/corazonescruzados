'use client';

/**
 * EL CAMINO DE UN FORMULARIO POR PASOS, en el lenguaje del sitio (Fernando, 2026-10-31: «que la
 * presentación del formulario sea como por pasos […] aplicando tu estilo»).
 *
 * Nodos redondos unidos por una línea que se llena de violeta según se avanza:
 *   · hecho → violeta lleno con ✓ (se puede volver a él si `alcanzable`);
 *   · actual → borde violeta con su icono y un halo suave;
 *   · por venir → borde gris con su número.
 * El nombre va debajo de cada nodo. Es el mismo «camino» de la postulación, puesto en
 * horizontal y en claro para que quepa encima de un formulario.
 */

import { Check, type LucideIcon } from 'lucide-react';

export type PasoCamino = { id: string; nombre: string; Icon: LucideIcon };

export default function IndicadorPasos({ pasos, actual, alcanzable, onIr }: {
  pasos: PasoCamino[];
  actual: number;
  /** Si se puede saltar a ese paso tocándolo (solo los ya hechos). */
  alcanzable?: (i: number) => boolean;
  onIr?: (i: number) => void;
}) {
  return (
    <ol className="flex items-start" aria-label="Pasos">
      {pasos.map((p, i) => {
        const hecho = i < actual;
        const esActual = i === actual;
        const puede = hecho && !!alcanzable?.(i);
        return (
          <li key={p.id} className="relative flex-1 min-w-0 flex flex-col items-center">
            {/* La línea hacia el siguiente: se llena cuando este paso ya está hecho. */}
            {i < pasos.length - 1 && (
              <span aria-hidden className="absolute top-4 left-[calc(50%+22px)] right-[calc(-50%+22px)] h-[2px] rounded-full bg-[var(--linea)] overflow-hidden">
                <span className={`block h-full bg-[var(--violeta)] transition-[width] duration-500 ease-out ${hecho ? 'w-full' : 'w-0'}`} />
              </span>
            )}
            <button type="button" disabled={!puede} onClick={() => puede && onIr?.(i)}
              aria-current={esActual ? 'step' : undefined}
              aria-label={`Paso ${i + 1}: ${p.nombre}${hecho ? ' (hecho)' : ''}`}
              className={`relative z-[1] w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold tabular-nums transition-all duration-300 ${
                hecho
                  ? 'bg-[var(--violeta)] text-white enabled:hover:scale-110'
                  : esActual
                    ? 'bg-[var(--tarjeta)] border-2 border-[var(--violeta-vivo)] text-[var(--violeta-txt)] shadow-[0_0_0_5px_rgba(123,95,191,0.14)]'
                    : 'bg-[var(--tarjeta)] border border-[var(--linea-fuerte)] text-[var(--tenue)]'}`}>
              {hecho ? <Check className="w-4 h-4" strokeWidth={2.5} /> : esActual ? <p.Icon className="w-4 h-4" /> : i + 1}
            </button>
            <span className={`mt-2 max-w-full truncate px-1 text-[12px] ${
              esActual ? 'font-semibold text-[var(--texto)]' : 'text-[var(--tenue)]'}`}>
              {p.nombre}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
