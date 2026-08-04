/**
 * PIEZAS DEL SITIO PÚBLICO — el lenguaje visual, en un solo sitio.
 *
 * ── POR QUÉ NO SE INSTALÓ NINGUNA LIBRERÍA ─────────────────────────────────────
 * El aspecto «de web profesional» no viene de un kit de UI: viene de cuatro cosas que son
 * CSS y ya están en el proyecto —Tailwind v4 y `lucide-react`—:
 *
 *   1. **Escala tipográfica amplia.** Titulares de 44–64 px frente a cuerpo de 16–18 px.
 *      El contraste de tamaño es lo que hace que una página respire.
 *   2. **Degradados radiales de fondo**, no planos. Un resplandor detrás del titular da
 *      profundidad sin una sola imagen.
 *   3. **Superficies con borde de 1 px muy tenue** (`white/[0.08]`) sobre fondo oscuro, en
 *      vez de sombras. Es lo que separa una tarjeta moderna de una caja de 2010.
 *   4. **Aire.** Secciones de 96–128 px de alto. Casi todo lo que parece «barato» en una
 *      web es falta de espacio, no falta de efectos.
 *
 * Instalar un kit habría traído además otro lenguaje visual que pelearía con el tema del
 * panel, que ya tiene el suyo.
 *
 * Estas piezas son Server Components: no llevan estado y tienen que estar en el HTML crudo
 * para que las lea un buscador —y un revisor de Meta— sin ejecutar JavaScript.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  MessageSquare, Layers, Zap, FileText, Users, Gamepad2, Store, Compass,
  Ticket, Vote, ArrowRight, type LucideIcon,
} from 'lucide-react';

export const ICONOS: Record<string, LucideIcon> = {
  mensaje: MessageSquare, capas: Layers, rayo: Zap, documento: FileText,
  personas: Users, juego: Gamepad2, tienda: Store, brujula: Compass,
  ticket: Ticket, voto: Vote,
};

/** Convierte los `**dobles asteriscos**` del contenido en negrita. */
export function conNegritas(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((trozo, i) =>
    trozo.startsWith('**') && trozo.endsWith('**')
      ? <strong key={i} className="text-white font-semibold">{trozo.slice(2, -2)}</strong>
      : <span key={i}>{trozo}</span>,
  );
}

/** Envoltorio de ancho de lectura. Todo el sitio usa el mismo. */
export function Contenedor({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-5 sm:px-6 ${className}`}>{children}</div>;
}

/**
 * Sección con su aire. `tono="realce"` le pone un fondo apenas distinto para separar dos
 * secciones seguidas sin dibujar una línea.
 */
export function Seccion({
  id, children, tono = 'normal',
}: { id?: string; children: ReactNode; tono?: 'normal' | 'realce' }) {
  return (
    <section id={id} className={`py-20 sm:py-28 ${tono === 'realce' ? 'bg-white/[0.02]' : ''}`}>
      <Contenedor>{children}</Contenedor>
    </section>
  );
}

/** Encabezado de sección: etiqueta pequeña, titular grande, entradilla. */
export function TituloSeccion({
  etiqueta, titulo, entradilla, centrado = false,
}: { etiqueta?: string; titulo: string; entradilla?: string; centrado?: boolean }) {
  return (
    <div className={`max-w-2xl ${centrado ? 'mx-auto text-center' : ''}`}>
      {etiqueta && (
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#a78bfa] mb-3">
          {etiqueta}
        </p>
      )}
      <h2 className="text-[30px] sm:text-[38px] leading-[1.15] font-semibold text-white tracking-tight">
        {titulo}
      </h2>
      {entradilla && (
        <p className="mt-4 text-[16.5px] leading-relaxed text-white/55">{entradilla}</p>
      )}
    </div>
  );
}

/** Tarjeta con borde tenue. El realce al pasar por encima es de borde, no de sombra. */
export function Tarjeta({
  children, className = '', id,
}: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div
      id={id}
      className={`rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-7
                  transition-colors hover:border-white/[0.16] ${className}`}
    >
      {children}
    </div>
  );
}

/** El icono en su cuadro, con el resplandor de la marca. */
export function IconoCuadro({ nombre }: { nombre: string }) {
  const Icono = ICONOS[nombre] ?? Layers;
  return (
    <span
      className="inline-flex items-center justify-center w-11 h-11 rounded-lg shrink-0
                 border border-[#7B5FBF]/30 bg-[#7B5FBF]/10"
    >
      <Icono className="w-5 h-5 text-[#a78bfa]" />
    </span>
  );
}

/**
 * El fondo del héroe: un resplandor radial y una rejilla muy tenue.
 *
 * Es lo que más aporta al «se ve profesional» y no cuesta ni una petición de red: dos
 * degradados CSS y una máscara para que la rejilla se desvanezca hacia abajo en vez de
 * cortarse en seco.
 */
export function FondoHeroe() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 55% at 50% 0%, rgba(123,95,191,0.28) 0%, rgba(123,95,191,0.08) 45%, transparent 75%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'linear-gradient(to bottom, black 0%, transparent 70%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

/* ── Rejilla de accesos ──────────────────────────────────────────────────────── */

/**
 * LAS TARJETAS DE ACCESO — cabecera de `/negocio` (2026-08-04).
 *
 * Cinco puertas de entrada. **Se reparten solas según el ancho que haya**: tres arriba y
 * dos centradas debajo en pantalla grande, dos y dos y una en tableta, una por fila en el
 * móvil.
 *
 * ── POR QUÉ `flex-wrap` Y NO UNA REJILLA ───────────────────────────────────────
 * Nació como una tira que se arrastraba y Fernando la cambió a esto en el momento: *«mejor
 * muéstralas todas según el espacio disponible»*. Con `grid-cols-3` las dos últimas
 * quedarían pegadas a la izquierda y con un hueco a la derecha. Con `flex-wrap` +
 * `justify-center` **la última fila se centra sola**, y —lo que más importa— el reparto
 * **no depende de que sean cinco**: si mañana hay seis o cuatro, se recolocan sin tocar
 * este archivo.
 *
 * ── EL RESTO DE DECISIONES ─────────────────────────────────────────────────────
 * · **Sin JavaScript.** Es un Server Component: las cinco frases están en el HTML crudo que
 *   lee un buscador, no detrás de una hidratación.
 * · **Ancho fijo de 280 px a partir de `sm`**, y `w-full` en el móvil. Fijo mantiene todas
 *   las tarjetas iguales aunque sus textos midan distinto; en el móvil, ocupar el ancho
 *   completo es lo natural.
 * · **`items-stretch`** para que todas las de una fila midan lo mismo de alto, y `mt-auto`
 *   en el botón para que quede pegado abajo. Sin eso, la del marketplace —que es la única
 *   con botón— dejaría el enlace a una altura distinta y la fila se vería descuadrada.
 * · **El botón solo aparece si la tarjeta trae `enlace`.** Hoy solo el marketplace, por
 *   petición expresa. Añadir otro es poner `enlace` en `contenido.ts`, no tocar esto.
 */
export function RejillaAccesos({
  accesos, etiqueta, activa,
}: {
  accesos: { id: string; icono: string; titulo: string; texto: string }[];
  etiqueta: string;
  /** `id` de la puerta abierta. Marca su tarjeta y le pone `aria-current`. */
  activa?: string;
}) {
  return (
    <ul aria-label={etiqueta} className="flex flex-wrap items-stretch justify-center gap-4 text-left">
      {accesos.map((a) => {
        const Icono = ICONOS[a.icono] ?? Layers;
        const abierta = a.id === activa;
        return (
          <li key={a.id} className="w-full sm:w-[280px] flex">
            {/* `#detalle` es lo que hace que al pulsar desde /negocio la página baje sola
                hasta el detalle. Sin JavaScript: lo resuelve el navegador, y el
                `scroll-smooth` del documento hace que se deslice en vez de saltar. */}
            <Link
              href={`/negocio/${a.id}#detalle`}
              aria-current={abierta ? 'page' : undefined}
              className={`group w-full flex flex-col rounded-xl border p-5 transition-colors
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B5FBF]/60
                ${abierta
                  ? 'border-[#7B5FBF]/55 bg-[#7B5FBF]/[0.09]'
                  : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.18] hover:bg-white/[0.04]'}`}
            >
              <span
                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 border transition-colors
                  ${abierta ? 'border-[#7B5FBF]/60 bg-[#7B5FBF]/25' : 'border-[#7B5FBF]/30 bg-[#7B5FBF]/10'}`}
              >
                <Icono className={`w-[18px] h-[18px] ${abierta ? 'text-[#c4b5fd]' : 'text-[#a78bfa]'}`} />
              </span>
              {/* El nombre de la puerta. Es un `<p>` y no un encabezado a propósito: estas
                  tarjetas se repiten en las seis páginas de la sección, y una ristra de
                  `<h3>` repetidos en todas confundiría la jerarquía que lee un buscador. */}
              <p className={`mt-3.5 text-[15.5px] font-semibold leading-snug transition-colors
                             ${abierta ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                {a.titulo}
              </p>
              <p className={`mt-1.5 text-[14px] leading-relaxed transition-colors
                             ${abierta ? 'text-white/75' : 'text-white/55 group-hover:text-white/70'}`}>
                {a.texto}
              </p>
              {/* `mt-auto` empuja esta línea al fondo: con textos de distinto largo, si no,
                  cada flecha queda a una altura y la fila se ve descuadrada. */}
              <span className={`mt-auto pt-4 inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors
                                ${abierta ? 'text-[#c4b5fd]' : 'text-white/35 group-hover:text-[#a78bfa]'}`}>
                {abierta ? 'Estás aquí' : 'Ver más'}
                {!abierta && <ArrowRight className="w-3.5 h-3.5" />}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Botones ─────────────────────────────────────────────────────────────────── */

export function BotonPrimario({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg
                 bg-[#7B5FBF] hover:bg-[#6b4faf] text-white text-[15px] font-medium transition-colors"
    >
      {children}
    </a>
  );
}

export function BotonSecundario({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg
                 border border-white/15 hover:border-white/30 hover:bg-white/[0.04]
                 text-white/85 text-[15px] font-medium transition-colors"
    >
      {children}
    </a>
  );
}
