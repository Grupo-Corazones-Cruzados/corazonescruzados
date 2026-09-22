'use client';

import type { LucideIcon } from 'lucide-react';

/**
 * CIFRA — un número con su etiqueta. La definición ÚNICA de las «stat cards» del panel.
 *
 * ── POR QUÉ EXISTE (Fernando, 2026-09-21: «cada página con un diseño hecho para
 *    teléfono») ───────────────────────────────────────────────────────────────────────
 * En el escritorio una cifra se presentaba en una tarjeta con un chip de icono de 44 px y
 * aire alrededor: está bien, hay sitio de sobra. Ese mismo bloque en un teléfono mide
 * ~100 px de alto, y seis cifras se convierten en **850 px de desplazamiento para leer
 * seis números** — que es lo que hacía el panel de inicio.
 *
 * La regla que sale de ahí y que este componente materializa:
 *
 *   > **En el teléfono manda el DATO, no el contenedor.** El icono pasa a ser una marca
 *   > pequeña junto a la etiqueta, la tarjeta pierde el aire de escritorio y las cifras se
 *   > reparten en DOS columnas. Las mismas seis caben de una vez.
 *
 * No es una tarjeta distinta: es **la misma**, contada para cada ancho. Quien la use no
 * escribe dos diseños, escribe `<Cifra>`.
 *
 * `RejillaCifras` es su contenedor: 2 columnas en teléfono, 3 desde `lg`. Se usan juntos.
 */

const mf = { fontFamily: 'var(--font-body)' } as const;

export type TonoCifra = 'accent' | 'green' | 'red';

const CHIP: Record<TonoCifra, string> = {
  accent: 'bg-accent-light text-accent',
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-red-600',
};

/** Rejilla de cifras: dos columnas en teléfono, tres desde `lg`. */
export function RejillaCifras({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 ${className}`}>{children}</div>;
}

export function Cifra({
  Icon,
  label,
  value,
  tone = 'accent',
}: {
  Icon: LucideIcon;
  label: string;
  /** `undefined` mientras se carga: sale el esqueleto en vez de un hueco. */
  value?: number | string;
  tone?: TonoCifra;
}) {
  return (
    <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-3 sm:p-4 flex items-center gap-3">
      {/* El chip del icono solo desde `sm`: en un teléfono son 44 px que no dicen nada que
          no diga ya la etiqueta, y se los quitan a la cifra. */}
      <div className={`hidden sm:flex w-11 h-11 rounded-lg items-center justify-center shrink-0 ${CHIP[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[10.5px] sm:text-[11px] uppercase tracking-wide text-digi-muted" style={mf}>
          {/* En teléfono el icono acompaña a la etiqueta, en línea y pequeño: mantiene la
              lectura de un vistazo (verde sube, rojo baja) sin ocupar una columna. */}
          <Icon className={`sm:hidden w-3.5 h-3.5 shrink-0 ${tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-accent'}`} />
          <span className="truncate">{label}</span>
        </p>
        {value !== undefined ? (
          <p className="text-[19px] sm:text-xl font-semibold text-digi-text leading-tight tabular-nums truncate" style={mf}>
            {value}
          </p>
        ) : (
          <div className="h-6 w-16 bg-digi-border/40 animate-pulse rounded mt-1" />
        )}
      </div>
    </div>
  );
}
