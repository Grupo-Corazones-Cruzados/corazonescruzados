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
 *
 * Las clases `cifra`, `cifra-icono`, `cifra-etiqueta` y `cifra-valor` le dan, dentro del
 * panel, el aspecto de las tarjetas de la portada (`app/tema-progreso.css`, 2026-10-29). Solo
 * la usa el panel (el CV público tiene su propia `Cifra` en `components/cv/CvCuerpo.tsx`).
 */

const mf = { fontFamily: 'var(--font-body)' } as const;

export type TonoCifra = 'accent' | 'green' | 'red';

const CHIP: Record<TonoCifra, string> = {
  accent: 'bg-accent-light text-accent',
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-red-600',
};

/**
 * Rejilla de cifras COMPACTA (Fernando, 2026-10-29: «los indicadores ocupan muchísimo espacio de
 * altura […] me interesa más espacio para la tabla»). Dos columnas en el teléfono, tres desde
 * `md` y, desde `xl`, las seis en UNA fila. Antes eran tarjetas de ~90 px en dos filas.
 */
export function RejillaCifras({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  // En dos columnas, una cifra que queda sola en su fila ocupa la fila entera (sin hueco al lado).
  return <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 max-md:[&>*:last-child:nth-child(odd)]:col-span-2 ${className}`}>{children}</div>;
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
    // Una línea de alto: icono pequeño a la izquierda y, a su lado, etiqueta y cifra. ~58 px.
    <div className="cifra bg-digi-card border border-digi-border rounded-lg shadow-sm px-3 py-2.5 flex items-center gap-2.5 min-w-0">
      <div data-tono={tone} className={`cifra-icono flex w-7 h-7 rounded-md items-center justify-center shrink-0 ${CHIP[tone]}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="cifra-etiqueta text-[10px] uppercase tracking-wide text-digi-muted truncate leading-tight" style={mf} title={label}>
          {label}
        </p>
        {value !== undefined ? (
          <p className="cifra-valor text-[16px] font-semibold text-digi-text leading-tight tabular-nums truncate" style={mf} title={String(value)}>
            {value}
          </p>
        ) : (
          <div className="h-4 w-14 bg-digi-border/40 animate-pulse rounded mt-1" />
        )}
      </div>
    </div>
  );
}
