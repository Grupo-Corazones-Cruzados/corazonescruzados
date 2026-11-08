'use client';

import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Controles de formulario propios de este producto, reusables: la fila de
 * casillas-chip (comidas, días de la semana) y el aviso de error. Una definición
 * por control: aquí, y se referencia.
 */

export function Chips<T extends string>({
  nombre,
  opciones,
  etiquetas,
  valor,
  alCambiar,
  deshabilitado,
}: {
  /** Nombre del campo: cada chip marcado se envía como `<nombre>` repetido (FormData.getAll). */
  nombre?: string;
  opciones: T[];
  etiquetas: Record<T, string>;
  valor: T[];
  alCambiar?: (v: T[]) => void;
  deshabilitado?: boolean;
}) {
  const alternar = (o: T) => {
    if (!alCambiar) return;
    alCambiar(valor.includes(o) ? valor.filter((x) => x !== o) : [...valor, o]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map((o) => {
        const marcado = valor.includes(o);
        return (
          <label
            key={o}
            className={cn(
              'inline-flex h-8 cursor-pointer select-none items-center rounded-full border px-3 text-[12px] font-semibold transition-colors',
              marcado ? 'border-acento bg-acento-suave text-acento' : 'border-borde bg-tarjeta text-tenue hover:bg-realce',
              deshabilitado && 'cursor-not-allowed opacity-50',
            )}
          >
            <input
              type="checkbox"
              name={nombre}
              value={o}
              checked={marcado}
              disabled={deshabilitado}
              onChange={() => alternar(o)}
              className="sr-only"
            />
            {etiquetas[o]}
          </label>
        );
      })}
    </div>
  );
}

export const Casilla = ({
  nombre,
  etiqueta,
  marcado,
  alCambiar,
  descripcion,
}: {
  nombre?: string;
  etiqueta: string;
  marcado: boolean;
  alCambiar?: (v: boolean) => void;
  descripcion?: string;
}) => (
  <label className="flex cursor-pointer items-start gap-2 text-[13px]">
    <input
      type="checkbox"
      name={nombre}
      checked={marcado}
      onChange={(e) => alCambiar?.(e.target.checked)}
      className="mt-0.5 h-4 w-4 accent-[var(--color-acento)]"
    />
    <span>
      {etiqueta}
      {descripcion && <span className="block text-[11px] text-tenue">{descripcion}</span>}
    </span>
  </label>
);

export const Aviso = ({ texto, tono = 'error' }: { texto: string; tono?: 'error' | 'aviso' | 'info' }) => (
  <p
    role="alert"
    className={cn(
      'flex items-start gap-2 rounded border border-borde px-3 py-2 text-[12px]',
      tono === 'error' && 'bg-error-suave text-error',
      tono === 'aviso' && 'bg-aviso-suave text-aviso',
      tono === 'info' && 'bg-acento-suave text-acento',
    )}
  >
    <AlertCircle className="mt-px h-4 w-4 shrink-0" />
    <span>{texto}</span>
  </p>
);

/** Ficha de resumen: número grande con su título (la misma que el Panel de Automatizaciones). */
export const Cifra = ({
  etiqueta,
  valor,
  destacado,
  pista,
  icono: Icono,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  destacado?: boolean;
  /** Una línea pequeña debajo, para el matiz que no cabe en la cifra. */
  pista?: string;
  icono?: React.ComponentType<{ className?: string }>;
}) => (
  <div className="tarjeta p-3 sm:p-4">
    <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-tenue sm:text-[11px]">
      {Icono && <Icono className={cn('h-3.5 w-3.5 shrink-0', destacado ? 'text-aviso' : 'text-acento')} />}
      <span className="truncate">{etiqueta}</span>
    </p>
    <p className={cn('mt-0.5 text-[19px] font-semibold tabular-nums leading-tight sm:text-[21px]', destacado ? 'text-aviso' : 'text-texto')}>{valor}</p>
    {pista && <p className="mt-0.5 truncate text-[11px] text-tenue">{pista}</p>}
  </div>
);

/** Muestra el color identificador del cliente o del motorizado: un punto. */
export const Punto = ({ color, tamano = 12 }: { color: string | null | undefined; tamano?: number }) =>
  color ? (
    <span
      className="inline-block shrink-0 rounded-full border border-borde"
      style={{ background: color, width: tamano, height: tamano }}
      aria-hidden
    />
  ) : null;
