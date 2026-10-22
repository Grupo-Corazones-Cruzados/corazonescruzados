'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { X, Search, Loader2, Inbox, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PALETA_GRADOS, TEXTO_SOBRE_GRADO } from '@/lib/grados-color';

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

/**
 * El estado es TEXTO DE COLOR, sin píldora ni punto (Fernando, 2026-10-22: «el estado ya
 * no sea un punto con fondo de relleno de color, me basta con que el texto tenga un
 * color»). La palabra ya dice el estado, así que no depende solo del color.
 */
export function Insignia({
  tono = 'neutro',
  icono: Icono,
  children,
}: {
  tono?: Tono;
  /** Un icono delante del texto, cuando de verdad aporta. */
  icono?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[12px] font-semibold', TONOS[tono])}>
      {Icono && <Icono className="h-3 w-3 shrink-0" />}
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
  const { montado, visible } = useAparicion(abierto);
  const cuerpo = useUltimoContenido(abierto, children);
  const pieVisto = useUltimoContenido(abierto, pie);
  const tituloVisto = useUltimoContenido(abierto, titulo);
  const descripcionVista = useUltimoContenido(abierto, descripcion);
  if (!montado) return null;
  return (
    <div className={cn('fixed inset-0 z-50 flex justify-end', !abierto && 'pointer-events-none')}>
      <div
        className={cn('absolute inset-0 bg-black/30 transition-opacity duration-200', visible ? 'opacity-100' : 'opacity-0')}
        onClick={alCerrar}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          'relative flex h-full w-full flex-col bg-tarjeta shadow-2xl border-l border-borde pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          'transition-transform duration-200 ease-out',
          visible ? 'translate-x-0' : 'translate-x-full',
          anchos,
        )}
      >
        <div className="flex items-start gap-3 border-b border-borde px-5 py-4 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold text-texto">{tituloVisto}</h2>
            {descripcionVista && <p className="mt-0.5 text-[12px] text-tenue">{descripcionVista}</p>}
          </div>
          <BotonIcono icono={X} titulo="Cerrar" onClick={alCerrar} />
        </div>
        <div className="desplaza min-h-0 flex-1 overflow-y-auto px-5 py-4">{cuerpo}</div>
        {pieVisto && (
          <div className="flex items-center justify-end gap-2 border-t border-borde px-5 py-3 shrink-0">
            {pieVisto}
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
  const { montado, visible } = useAparicion(abierto);
  const cuerpo = useUltimoContenido(abierto, children);
  const pieVisto = useUltimoContenido(abierto, pie);
  const tituloVisto = useUltimoContenido(abierto, titulo);
  if (!montado) return null;
  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]', !abierto && 'pointer-events-none')}>
      <div
        className={cn('absolute inset-0 bg-black/30 transition-opacity duration-200', visible ? 'opacity-100' : 'opacity-0')}
        onClick={alCerrar}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          'relative w-full max-w-md rounded-md border border-borde bg-tarjeta shadow-2xl',
          'transition-[opacity,transform] duration-200 ease-out',
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        )}
      >
        <div className="flex items-center gap-3 border-b border-borde px-5 py-3.5">
          <h2 className="flex-1 truncate text-[15px] font-semibold">{tituloVisto}</h2>
          <BotonIcono icono={X} titulo="Cerrar" onClick={alCerrar} />
        </div>
        <div className="px-5 py-4">{cuerpo}</div>
        {pieVisto && (
          <div className="flex items-center justify-end gap-2 border-t border-borde px-5 py-3">{pieVisto}</div>
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

// ── Aparición animada ───────────────────────────────────────────────────────
/**
 * LO QUE APARECE, ENTRA CON MOVIMIENTO (Fernando, 2026-10-22: «aplicar animaciones de
 * movimiento cuando se pueda durante la navegación»). Paneles, menús y ventanitas no
 * saltan: entran y salen en `DURACION_APARICION` ms.
 *
 * `montado` dice si se pinta; `visible`, hacia dónde va la transición. Al abrir se
 * monta fuera de sitio y un cuadro después se marca visible (sin ese cuadro el
 * navegador no ve el «antes» y no hay transición). Al cerrar se quita `visible` y se
 * desmonta cuando la salida terminó, así escondido sigue sin existir.
 * Con «reducir movimiento» del sistema, `globals.css` deja las transiciones en ~0.
 */
export const DURACION_APARICION = 200;

export function useAparicion(abierto: boolean) {
  const [montado, setMontado] = useState(abierto);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (abierto) {
      setMontado(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => (r2 = requestAnimationFrame(() => setVisible(true))));
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    setVisible(false);
    const t = setTimeout(() => setMontado(false), DURACION_APARICION);
    return () => clearTimeout(t);
  }, [abierto]);
  return { montado, visible };
}

/**
 * Lo último que se pintó mientras estaba abierto. Durante la salida el padre suele
 * haber vaciado ya su estado (`editando = null`): sin esto el panel se iría en blanco.
 */
function useUltimoContenido(abierto: boolean, contenido: ReactNode) {
  const ref = useRef(contenido);
  if (abierto) ref.current = contenido;
  return abierto ? contenido : ref.current;
}

// ── Rail de filtro ──────────────────────────────────────────────────────────
export type OpcionRail = {
  valor: string;
  etiqueta: string;
  icono?: React.ComponentType<{ className?: string }>;
  conteo?: number;
  pista?: string;
};

/**
 * El ÚNICO rail de filtro. Uno nuevo se hace con esto, nunca copiando el marcado.
 *
 * En el teléfono NO es una tira que se desliza a la derecha (las últimas opciones
 * quedaban fuera de la vista; Fernando, 2026-10-22): con hasta 3 opciones es un
 * segmentado que reparte el ancho a partes iguales; con más, un `<select>` nativo
 * a todo el ancho, como `SelectorEstado`. Desde `lg`, el raíl vertical de siempre.
 */
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
    <>
      {opciones.length <= 3 ? (
        <div role="tablist" aria-label={titulo}
          className={cn('grid gap-0.5 rounded-md border border-borde bg-realce p-0.5 lg:hidden', className)}
          style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
          {opciones.map((o) => {
            const sel = o.valor === activo;
            const Icono = o.icono;
            return (
              <button key={o.valor} type="button" role="tab" aria-selected={sel} onClick={() => alElegir(o.valor)}
                className={cn(
                  'flex h-9 min-w-0 items-center justify-center gap-1.5 rounded px-2 text-[13px] transition-colors duration-200 foco-visible',
                  sel ? 'bg-tarjeta font-semibold text-acento shadow-sm ring-1 ring-borde' : 'text-tenue hover:text-texto',
                )}>
                {Icono && <Icono className="h-4 w-4 shrink-0" />}
                <span className="truncate">{o.etiqueta}</span>
                {o.conteo !== undefined && <span className="text-[11px] font-normal">{o.conteo}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className={cn('relative lg:hidden', className)}>
          <select value={activo} onChange={(e) => alElegir(e.target.value)} aria-label={titulo ?? 'Sección'}
            className="campo appearance-none pr-8 font-semibold">
            {opciones.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}{o.conteo !== undefined ? ` · ${o.conteo}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className={cn('tarjeta hidden p-1.5 lg:block lg:w-[220px] shrink-0', className)}>
        {titulo && (
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-tenue">
            {titulo}
          </p>
        )}
        <div className="flex flex-col gap-1">
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
    </>
  );
}

// ── Burbuja de detalles ─────────────────────────────────────────────────────
/** Un dato secundario de una cabecera: correo, teléfono, fechas… */
export type Detalle = {
  icono: React.ComponentType<{ className?: string }>;
  etiqueta: string;
  valor: string;
  /** `mailto:`/`tel:` para que en el teléfono se pueda escribir o llamar desde la burbuja. */
  href?: string;
};

/**
 * LO QUE IBA BAJO EL TÍTULO VA EN UNA BURBUJA (Fernando, 2026-10-22). La descripción de la
 * página y los datos secundarios (correo, teléfono, fechas) no se escriben como líneas bajo
 * el título: «ocupan espacio y rellenan de forma innecesaria». Van detrás de un botón (i)
 * junto al título que abre una burbuja con el mismo contenido, con movimiento, y se cierra
 * al tocar fuera o con Escape.
 */
export function BurbujaDetalles({ texto, detalles = [], titulo = 'Detalles', className }: { texto?: string; detalles?: Detalle[]; titulo?: string; className?: string }) {
  const [abierta, setAbierta] = useState(false);
  const { montado, visible } = useAparicion(abierta);
  const boton = useRef<HTMLButtonElement>(null);
  // Fija y medida al abrir: el botón puede estar pegado a cualquier borde de la pantalla, y la
  // burbuja se encaja dentro de ella; la flecha sigue apuntando al botón.
  const [sitio, setSitio] = useState({ top: 0, left: 0, flecha: 0, ancho: 288 });
  useLayoutEffect(() => {
    if (!abierta || !boton.current) return;
    const r = boton.current.getBoundingClientRect();
    const ancho = Math.min(288, window.innerWidth - 32);
    const centro = r.left + r.width / 2;
    const left = Math.max(16, Math.min(centro - ancho / 2, window.innerWidth - 16 - ancho));
    setSitio({ top: r.bottom + 8, left, flecha: centro - left, ancho });
  }, [abierta]);
  useEffect(() => {
    if (!abierta) return;
    const cerrar = () => setAbierta(false);
    window.addEventListener('scroll', cerrar, { passive: true });
    window.addEventListener('resize', cerrar);
    return () => { window.removeEventListener('scroll', cerrar); window.removeEventListener('resize', cerrar); };
  }, [abierta]);
  useEffect(() => {
    if (!abierta) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierta(false);
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierta]);
  return (
    <span className={cn('relative inline-flex', className)}>
      <button ref={boton} type="button" aria-label={titulo} title={titulo} aria-expanded={abierta} onClick={() => setAbierta((v) => !v)}
        className={cn('foco-visible flex h-7 w-7 items-center justify-center rounded-full transition-colors',
          abierta ? 'bg-acento-suave text-acento' : 'text-tenue hover:bg-realce hover:text-texto')}>
        <Info className="h-4 w-4" />
      </button>
      {montado && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setAbierta(false)} />
          <span role="dialog" aria-label={titulo}
            style={{ top: sitio.top, left: sitio.left, width: sitio.ancho, transformOrigin: `${sitio.flecha}px 0` }}
            className={cn(
              'fixed z-50 block rounded-md border border-borde bg-tarjeta p-1.5 shadow-lg',
              'transition duration-200 ease-out',
              visible ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0',
            )}>
            <span aria-hidden style={{ left: sitio.flecha }} className="absolute -top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-borde bg-tarjeta" />
            {texto && <span className="relative block px-2.5 py-2 text-[13px] leading-snug text-texto">{texto}</span>}
            {detalles.map((d) => {
              const Icono = d.icono;
              const fila = (
                <>
                  <Icono className="mt-0.5 h-4 w-4 shrink-0 text-tenue" />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-tenue">{d.etiqueta}</span>
                    <span className={cn('block break-words text-[13px]', d.href ? 'text-acento' : 'text-texto')}>{d.valor}</span>
                  </span>
                </>
              );
              const clase = 'relative flex items-start gap-2.5 rounded px-2.5 py-2';
              return d.href
                ? <a key={d.etiqueta} href={d.href} className={cn(clase, 'hover:bg-realce')}>{fila}</a>
                : <span key={d.etiqueta} className={clase}>{fila}</span>;
            })}
          </span>
        </>
      )}
    </span>
  );
}

// ── Selector de estado ──────────────────────────────────────────────────────
/**
 * EL FILTRO DE ESTADOS ES UN SOLO CONTROL (Fernando, 2026-10-22: «una forma de filtrar
 * los estados que se vea bien como un solo control selector»). Sustituye al raíl
 * vertical para filtrar una lista; el raíl queda para navegar entre SECCIONES.
 *
 * - Escritorio (lg+): control segmentado. Una cápsula blanca marca la opción elegida y
 *   se DESLIZA hasta la nueva (regla de movimiento); cada segmento lleva su cuenta.
 * - Teléfono: un `<select>` nativo con la misma lista («Activos · 7»): una fila, el
 *   selector del sistema, nada escondido a la derecha.
 * Las dos versiones se montan y el CSS enseña una: no son diálogos, no bloquean nada.
 */
export function SelectorEstado({
  opciones,
  activo,
  alElegir,
  etiqueta = 'Estado',
  className,
}: {
  opciones: OpcionRail[];
  activo: string;
  alElegir: (v: string) => void;
  /** Para lectores de pantalla y como prefijo en el teléfono. */
  etiqueta?: string;
  className?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [marca, setMarca] = useState<{ left: number; width: number } | null>(null);

  // La cápsula se coloca midiendo el botón elegido; se vuelve a medir si cambia el
  // tamaño (las cuentas cambian el ancho de los segmentos).
  useLayoutEffect(() => {
    const medir = () => {
      const b = caja.current?.querySelector<HTMLElement>('[data-sel="1"]');
      if (b) setMarca({ left: b.offsetLeft, width: b.offsetWidth });
    };
    medir();
    const ro = new ResizeObserver(medir);
    if (caja.current) ro.observe(caja.current);
    return () => ro.disconnect();
  }, [activo, opciones]);

  return (
    <div className={className}>
      <div
        ref={caja}
        role="radiogroup"
        aria-label={etiqueta}
        className="relative hidden max-w-full items-center rounded-md border border-borde bg-realce p-0.5 lg:inline-flex"
      >
        {marca && (
          <span
            aria-hidden
            className="absolute inset-y-0.5 rounded bg-tarjeta shadow-sm ring-1 ring-borde transition-[left,width] duration-200 ease-out"
            style={{ left: marca.left, width: marca.width }}
          />
        )}
        {opciones.map((o) => {
          const sel = o.valor === activo;
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={sel}
              data-sel={sel ? '1' : undefined}
              title={o.pista}
              onClick={() => alElegir(o.valor)}
              className={cn(
                'relative flex h-8 items-center gap-1.5 whitespace-nowrap rounded px-3 text-[13px] transition-colors foco-visible',
                sel ? 'font-semibold text-texto' : 'text-tenue hover:text-texto',
              )}
            >
              {o.etiqueta}
              {o.conteo !== undefined && (
                <span className={cn('text-[11px] tabular-nums', sel ? 'text-acento' : 'text-tenue')}>{o.conteo}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="relative lg:hidden">
        <select
          aria-label={etiqueta}
          value={activo}
          onChange={(e) => alElegir(e.target.value)}
          className="campo appearance-none pr-8 font-semibold"
        >
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {etiqueta}: {o.etiqueta}
              {o.conteo !== undefined ? ` · ${o.conteo}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue" />
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
  /*
    EN EL TELÉFONO, GALERÍA Y NO TABLA (Fernando, 2026-10-22: «como tabla hay que
    deslizarse también a la derecha y a veces se pierden de vista datos»). Cada fila es
    una tarjeta: la primera columna es su cabecera, las columnas sin título (acciones)
    van a su derecha y el resto es una rejilla «TÍTULO / valor» de dos columnas. Todo
    a la vista, sin desplazamiento lateral. Lo hace la tabla, así que vale para todas.
  */
  const [cabeza, ...resto] = columnas;
  const acciones = resto.filter((c) => !c.titulo);
  const datos = resto.filter((c) => c.titulo);
  return (
    <>
    <div className="space-y-2 bg-fondo p-2 md:hidden">
      {filas.map((f) => (
        <div
          key={claveFila(f)}
          onClick={alPulsarFila ? () => alPulsarFila(f) : undefined}
          className={cn(
            'rounded-md border border-borde bg-tarjeta p-3.5 text-[13px] transition-colors',
            alPulsarFila && 'cursor-pointer active:bg-realce',
            filaActiva?.(f) && 'border-acento bg-acento-suave',
          )}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">{cabeza.render(f)}</div>
            {acciones.map((c) => (
              <div key={c.clave} className="shrink-0" onClick={(e) => e.stopPropagation()}>
                {c.render(f)}
              </div>
            ))}
          </div>
          {datos.length > 0 && (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-borde pt-3">
              {datos.map((c) => (
                <div key={c.clave} className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-tenue">{c.titulo}</dt>
                  <dd className="mt-0.5 break-words">{c.render(f)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
    </div>
    <div className="desplaza hidden overflow-x-auto md:block">
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
    </>
  );
}

/**
 * LA ETIQUETA DE UN GRADO: una píldora con el relleno del grado (`grados.color`,
 * al azar al crearlo) y texto oscuro. Va DEBAJO de la materia en los controles
 * de selección para que el grado se distinga de la materia de un vistazo
 * (Fernando, 2026-09-16). `pequena` para las celdas del horario.
 */
export function EtiquetaGrado({ nombre, color, pequena, className }: { nombre: string; color: string; pequena?: boolean; className?: string }) {
  return (
    <span
      className={cn('inline-block max-w-full truncate rounded-full font-semibold leading-tight', pequena ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]', className)}
      style={{ backgroundColor: color, color: TEXTO_SOBRE_GRADO }}
      title={nombre}
    >
      {nombre}
    </span>
  );
}

/** Los doce rellenos de la paleta para elegir el color de un grado (casillas de radio). */
export function PaletaGrado({ name, valor }: { name: string; valor: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETA_GRADOS.map((c) => (
        <label key={c} className="cursor-pointer" title={c}>
          <input type="radio" name={name} value={c} defaultChecked={c === valor} className="peer sr-only" />
          <span className="block h-6 w-6 rounded-full border-2 border-transparent ring-borde peer-checked:border-texto peer-focus-visible:ring-2" style={{ backgroundColor: c }} />
        </label>
      ))}
    </div>
  );
}

