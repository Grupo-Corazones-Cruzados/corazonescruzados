'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X, Search, Loader2, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * CATÁLOGO DE CONTROLES — una sola definición por control.
 *
 * Es la fuente única del aspecto de la aplicación: cambiar un botón aquí lo cambia
 * en todas las pantallas. Un control «parecido» escrito en una página es la forma
 * de que dos pantallas terminen distintas sin que nadie lo decida.
 */

// ── Botón ───────────────────────────────────────────────────────────────────
const BOTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded font-semibold whitespace-nowrap ' +
  'transition-colors disabled:opacity-45 disabled:cursor-not-allowed foco-visible';

export const BOTON_PRIMARIO =
  `${BOTON_BASE} bg-acento text-acento-contraste hover:bg-acento-fuerte`;
export const BOTON_SECUNDARIO =
  `${BOTON_BASE} bg-tarjeta text-texto border border-borde hover:bg-realce`;
export const BOTON_PELIGRO =
  `${BOTON_BASE} bg-error text-white hover:brightness-90`;
export const BOTON_FANTASMA =
  `${BOTON_BASE} text-tenue hover:bg-realce hover:text-texto`;

const TAMANOS = {
  sm: 'h-7 px-2.5 text-[12px]',
  md: 'h-8 px-3 text-[13px]',
  lg: 'h-9 px-4 text-[13px]',
} as const;

export function Boton({
  variante = 'primario',
  tamano = 'md',
  icono: Icono,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma';
  tamano?: keyof typeof TAMANOS;
  icono?: React.ComponentType<{ className?: string }>;
}) {
  const estilo = {
    primario: BOTON_PRIMARIO,
    secundario: BOTON_SECUNDARIO,
    peligro: BOTON_PELIGRO,
    fantasma: BOTON_FANTASMA,
  }[variante];
  return (
    <button className={cn(estilo, TAMANOS[tamano], className)} {...props}>
      {Icono && <Icono className="h-4 w-4 shrink-0" />}
      {children}
    </button>
  );
}

/** Botón de solo icono, 32×32 — el mismo cuadrado que la X de cerrar. */
export function BotonIcono({
  icono: Icono,
  titulo,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icono: React.ComponentType<{ className?: string }>;
  titulo: string;
}) {
  return (
    <button
      title={titulo}
      aria-label={titulo}
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded-md text-tenue',
        'hover:bg-realce hover:text-texto transition-colors foco-visible',
        className,
      )}
      {...props}
    >
      <Icono className="h-4 w-4" />
    </button>
  );
}

// ── Campos ──────────────────────────────────────────────────────────────────
/**
 * REGLA DE FORMULARIOS: solo el título del campo y el campo. Nada de textos de
 * ayuda permanentes debajo de cada casilla.
 */
export function Campo({
  etiqueta,
  requerido,
  className,
  children,
}: {
  etiqueta: string;
  requerido?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="block mb-1 text-[12px] font-semibold text-texto">
        {etiqueta}
        {requerido && <span className="text-error"> *</span>}
      </span>
      {children}
    </label>
  );
}

export const Entrada = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={cn('campo', p.className)} />
);
export const AreaTexto = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={3} {...p} className={cn('campo', p.className)} />
);
export const Selector = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cn('campo', p.className)} />
);

export function Buscador({
  valor,
  alCambiar,
  marcador = 'Buscar…',
  className,
}: {
  valor: string;
  alCambiar: (v: string) => void;
  marcador?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-tenue pointer-events-none" />
      <input
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder={marcador}
        className="campo pl-8"
      />
    </div>
  );
}

// ── Insignia (estado) ───────────────────────────────────────────────────────
const TONOS = {
  exito: 'text-exito',
  aviso: 'text-aviso',
  error: 'text-error',
  info: 'text-acento',
  neutro: 'text-tenue',
} as const;

export type Tono = keyof typeof TONOS;

/** Píldora neutra + punto semántico: la identidad nunca depende solo del color. */
export function Insignia({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-realce px-2 py-0.5 text-[11px] font-semibold',
        TONOS[tono],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export const PUNTO_TONO: Record<Tono, string> = {
  exito: 'bg-exito',
  aviso: 'bg-aviso',
  error: 'bg-error',
  info: 'bg-acento',
  neutro: 'bg-tenue',
};

// ── Superficies ─────────────────────────────────────────────────────────────
export const Tarjeta = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn('tarjeta', className)}>{children}</div>
);

export function EstadoVacio({
  icono: Icono = Inbox,
  titulo,
  detalle,
  accion,
}: {
  icono?: React.ComponentType<{ className?: string }>;
  titulo: string;
  detalle?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <Icono className="h-8 w-8 text-borde" />
      <p className="text-[13px] font-semibold text-texto">{titulo}</p>
      {detalle && <p className="max-w-sm text-[12px] text-tenue">{detalle}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}

export const Cargando = ({ texto }: { texto?: string }) => (
  <div className="flex items-center justify-center gap-2 py-12 text-tenue">
    <Loader2 className="h-5 w-5 animate-spin" />
    {texto && <span className="text-[13px]">{texto}</span>}
  </div>
);

// ── Panel lateral (el formulario NO se edita en línea) ───────────────────────
/**
 * Los formularios van en un panel lateral derecho con velo. La ventanita centrada
 * se reserva para una o dos casillas (confirmar, renombrar).
 */
export function PanelLateral({
  abierto,
  alCerrar,
  titulo,
  descripcion,
  ancho = 'md',
  pie,
  children,
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  descripcion?: string;
  ancho?: 'sm' | 'md' | 'lg';
  pie?: ReactNode;
  children: ReactNode;
}) {
  const anchos = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' }[ancho];
  useEscape(abierto, alCerrar);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={alCerrar} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          'relative flex h-full w-full flex-col bg-tarjeta shadow-2xl border-l border-borde',
          anchos,
        )}
      >
        <div className="flex items-start gap-3 border-b border-borde px-5 py-4 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold text-texto">{titulo}</h2>
            {descripcion && <p className="mt-0.5 text-[12px] text-tenue">{descripcion}</p>}
          </div>
          <BotonIcono icono={X} titulo="Cerrar" onClick={alCerrar} />
        </div>
        <div className="desplaza min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {pie && (
          <div className="flex items-center justify-end gap-2 border-t border-borde px-5 py-3 shrink-0">
            {pie}
          </div>
        )}
      </div>
    </div>
  );
}

/** Ventanita centrada — solo para una o dos casillas. */
export function Ventanita({
  abierto,
  alCerrar,
  titulo,
  pie,
  children,
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  pie?: ReactNode;
  children: ReactNode;
}) {
  useEscape(abierto, alCerrar);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={alCerrar} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="relative w-full max-w-md rounded-md border border-borde bg-tarjeta shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-borde px-5 py-3.5">
          <h2 className="flex-1 truncate text-[15px] font-semibold">{titulo}</h2>
          <BotonIcono icono={X} titulo="Cerrar" onClick={alCerrar} />
        </div>
        <div className="px-5 py-4">{children}</div>
        {pie && (
          <div className="flex items-center justify-end gap-2 border-t border-borde px-5 py-3">{pie}</div>
        )}
      </div>
    </div>
  );
}

/** Confirmación. NUNCA el confirm() del navegador. */
export function Confirmar({
  abierto,
  titulo,
  mensaje,
  textoAceptar = 'Eliminar',
  peligro = true,
  alAceptar,
  alCerrar,
  ocupado,
}: {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  textoAceptar?: string;
  peligro?: boolean;
  alAceptar: () => void;
  alCerrar: () => void;
  ocupado?: boolean;
}) {
  return (
    <Ventanita
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={titulo}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton variante={peligro ? 'peligro' : 'primario'} onClick={alAceptar} disabled={ocupado}>
            {ocupado ? 'Un momento…' : textoAceptar}
          </Boton>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-tenue">{mensaje}</p>
    </Ventanita>
  );
}

function useEscape(activo: boolean, alCerrar: () => void) {
  const ref = useRef(alCerrar);
  ref.current = alCerrar;
  useEffect(() => {
    if (!activo) return;
    const f = (e: KeyboardEvent) => e.key === 'Escape' && ref.current();
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [activo]);
}

// ── Rail de filtro ──────────────────────────────────────────────────────────
export type OpcionRail = {
  valor: string;
  etiqueta: string;
  icono?: React.ComponentType<{ className?: string }>;
  conteo?: number;
  pista?: string;
};

/** El ÚNICO rail de filtro. Uno nuevo se hace con esto, nunca copiando el marcado. */
export function RailFiltro({
  opciones,
  activo,
  alElegir,
  titulo,
  className,
}: {
  opciones: OpcionRail[];
  activo: string;
  alElegir: (v: string) => void;
  titulo?: string;
  className?: string;
}) {
  return (
    <div className={cn('tarjeta p-1.5 lg:w-[220px] shrink-0', className)}>
      {titulo && (
        <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-tenue">
          {titulo}
        </p>
      )}
      <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {opciones.map((o) => {
          const sel = o.valor === activo;
          const Icono = o.icono;
          return (
            <button
              key={o.valor}
              onClick={() => alElegir(o.valor)}
              className={cn(
                'flex w-full items-center gap-2.5 whitespace-nowrap rounded px-2.5 py-2 text-left text-[13px] transition-colors foco-visible',
                sel
                  ? 'bg-acento-suave text-acento font-semibold border-l-2 border-acento'
                  : 'text-texto hover:bg-realce border-l-2 border-transparent',
              )}
            >
              {Icono && <Icono className={cn('h-4 w-4 shrink-0', sel ? 'text-acento' : 'text-tenue')} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.etiqueta}</span>
                {o.pista && <span className="block truncate text-[11px] text-tenue">{o.pista}</span>}
              </span>
              {o.conteo !== undefined && (
                <span className={cn('rounded-full px-1.5 text-[11px]', sel ? 'text-acento' : 'text-tenue')}>
                  {o.conteo}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Barra de módulo: filtros a la izquierda, acciones a la derecha ───────────
export function BarraModulo({
  izquierda,
  derecha,
  className,
}: {
  izquierda?: ReactNode;
  derecha?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">{izquierda}</div>
      <div className="flex flex-wrap items-center gap-2">{derecha}</div>
    </div>
  );
}

// ── Tabla ───────────────────────────────────────────────────────────────────
export type Columna<T> = {
  clave: string;
  titulo: string;
  ancho?: string;
  alinear?: 'izq' | 'der' | 'centro';
  render: (fila: T) => ReactNode;
};

export function Tabla<T>({
  columnas,
  filas,
  claveFila,
  alPulsarFila,
  filaActiva,
  vacio,
}: {
  columnas: Columna<T>[];
  filas: T[];
  claveFila: (f: T) => string | number;
  alPulsarFila?: (f: T) => void;
  filaActiva?: (f: T) => boolean;
  vacio?: ReactNode;
}) {
  if (!filas.length) return <>{vacio ?? <EstadoVacio titulo="No hay nada que mostrar" />}</>;
  const alinea = (a?: string) =>
    a === 'der' ? 'text-right' : a === 'centro' ? 'text-center' : 'text-left';
  return (
    <div className="desplaza overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-borde bg-tarjeta">
            {columnas.map((c) => (
              <th
                key={c.clave}
                style={{ width: c.ancho }}
                className={cn(
                  'px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-tenue',
                  alinea(c.alinear),
                )}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr
              key={claveFila(f)}
              onClick={alPulsarFila ? () => alPulsarFila(f) : undefined}
              className={cn(
                'border-b border-borde last:border-0 transition-colors',
                alPulsarFila && 'cursor-pointer hover:bg-realce',
                filaActiva?.(f) && 'bg-acento-suave',
              )}
            >
              {columnas.map((c) => (
                <td key={c.clave} className={cn('px-3 py-2.5 align-middle', alinea(c.alinear))}>
                  {c.render(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
