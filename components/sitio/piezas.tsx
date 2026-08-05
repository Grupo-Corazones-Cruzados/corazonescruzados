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
import Image from 'next/image';
import {
  MessageSquare, Layers, Zap, FileText, Users, Gamepad2, Store, Compass,
  Ticket, Vote, ArrowRight, CalendarClock, Handshake, type LucideIcon,
} from 'lucide-react';

export const ICONOS: Record<string, LucideIcon> = {
  mensaje: MessageSquare, capas: Layers, rayo: Zap, documento: FileText,
  personas: Users, juego: Gamepad2, tienda: Store, brujula: Compass,
  ticket: Ticket, voto: Vote, calendario: CalendarClock, acuerdo: Handshake,
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
              {/* Icono y nombre en la misma línea (Fernando, 2026-08-04). Antes iban uno
                  debajo del otro y la tarjeta gastaba dos alturas en su rótulo; así el
                  encabezado ocupa una sola y queda más sitio para la frase. */}
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 border transition-colors
                    ${abierta ? 'border-[#7B5FBF]/60 bg-[#7B5FBF]/25' : 'border-[#7B5FBF]/30 bg-[#7B5FBF]/10'}`}
                >
                  <Icono className={`w-[18px] h-[18px] ${abierta ? 'text-[#c4b5fd]' : 'text-[#a78bfa]'}`} />
                </span>
                {/* El nombre de la puerta. Es un `<p>` y no un encabezado a propósito: estas
                    tarjetas se repiten en las seis páginas de la sección, y una ristra de
                    `<h3>` repetidos en todas confundiría la jerarquía que lee un buscador. */}
                <p className={`text-[15.5px] font-semibold leading-snug transition-colors
                               ${abierta ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                  {a.titulo}
                </p>
              </div>
              <p className={`mt-3.5 text-[14px] leading-relaxed transition-colors
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

/* ── Bloque destacado ────────────────────────────────────────────────────────── */

/**
 * EL BLOQUE QUE LE HABLA AL CLIENTE — entre el vídeo y las preguntas frecuentes.
 *
 * Fernando pidió «un diseño muy impactante a primera vista y atractivo para clientes».
 * Lo que da ese golpe de vista aquí son cuatro cosas, y ninguna es un efecto:
 *
 * 1. **Una pregunta enorme.** 30/44 px frente a los 14-17 del resto de la página. El
 *    contraste de tamaño es lo que hace que la vista caiga ahí y no en otro sitio.
 * 2. **La pregunta habla de SU problema, no de nosotros.** Es lo que hace que alguien siga
 *    leyendo: se ha reconocido en la primera línea.
 * 3. **Un resplandor violeta propio**, más marcado que el del resto de la página, que separa
 *    este bloque del fondo sin necesidad de una caja de color plano.
 * 4. **Los pasos numerados en números grandes y tenues.** Convierten una promesa en un
 *    mecanismo; el número grande da ritmo visual y ordena la lectura de un vistazo.
 *
 * Sin sombras, sin degradados de moda y sin animación de entrada: el sitio se ve serio
 * porque usa aire y tipografía, no efectos. Server Component.
 */
export function BloqueTema({
  id, etiqueta, pregunta, texto, pasos,
}: {
  id: string;
  etiqueta: string;
  pregunta: string;
  texto: string;
  pasos?: {
    titulo: string;
    texto: string;
    icono?: string;
    imagen?: { src: string; ancho: number; alto: number };
  }[];
}) {
  return (
    <section
      id={id}
      // `scroll-mt-24`: al abrir un enlace con ancla, deja aire por arriba para que la
      // cabecera fija no tape el título del tema.
      className="tema-anima group/tema relative overflow-hidden rounded-2xl border border-[#7B5FBF]/25 bg-white/[0.02] scroll-mt-24"
    >
      {/* El resplandor. Es un degradado CSS: ni una petición de red, ni una imagen que
          cargar, y se ve igual en cualquier pantalla. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(75% 120% at 12% 0%, rgba(123,95,191,0.30) 0%, rgba(123,95,191,0.10) 42%, transparent 72%)',
        }}
      />

      <div className="relative px-6 py-10 sm:px-12 sm:py-14">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#a78bfa]">
          {etiqueta}
        </p>

        {/* El título es su propio enlace: pulsarlo deja el ancla en la barra del navegador,
            listo para copiar y mandar por WhatsApp. La almohadilla solo asoma al acercar el
            puntero —a quien está leyendo no le estorba— pero el enlace existe siempre, y por
            eso funciona igual con el teclado. */}
        <h2 className="mt-4 max-w-3xl">
          <a
            href={`#${id}`}
            className="group/ancla inline text-[30px] sm:text-[44px] leading-[1.1] font-semibold
                       text-white tracking-tight focus:outline-none focus-visible:underline
                       focus-visible:decoration-[#7B5FBF] decoration-2 underline-offset-4"
          >
            {pregunta}
            <span
              aria-hidden
              className="ml-3 align-middle text-[0.5em] text-[#7B5FBF]/0 transition-colors
                         group-hover/tema:text-[#7B5FBF]/70 group-focus-within/tema:text-[#7B5FBF]/70"
            >
              #
            </span>
          </a>
        </h2>

        <p className="mt-6 text-[16.5px] sm:text-[18px] leading-relaxed text-white/60 max-w-2xl">
          {texto}
        </p>

        {pasos && pasos.length > 0 && (
          <ol className="mt-12 grid gap-8 sm:gap-6 sm:grid-cols-3">
            {pasos.map((p, i) => {
              const Icono = p.icono ? ICONOS[p.icono] : null;
              return (
                // La línea superior separa los pasos entre sí sin dibujar cajas: tres
                // recuadros dentro de otro recuadro sería una caja de más.
                // `flex flex-col` + `mt-auto` en el icono: los textos miden distinto y, sin
                // esto, cada icono quedaría a una altura y las tres columnas se verían
                // descuadradas. Así se alinean todos abajo.
                <li key={p.titulo} className="flex flex-col border-t border-white/[0.12] pt-5">
                  <span className="block text-[34px] leading-none font-semibold text-[#7B5FBF]/55 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="mt-4 text-[15.5px] font-semibold text-white leading-snug">
                    {p.titulo}
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/55">{p.texto}</p>
                  {/* La ilustración manda sobre el icono. Es una ESCENA, no un pictograma:
                      ocupa el ancho de su columna, no un recuadro de 44 px, o su línea de
                      tiempo y sus tarjetas no se leerían.
                      `aria-hidden` y `alt=""`: no aporta nada que no diga ya el texto del
                      paso, así que a un lector de pantalla solo le estorbaría. */}
                  {p.imagen ? (
                    <div className="mt-auto pt-8">
                      <Image
                        src={p.imagen.src}
                        alt=""
                        aria-hidden
                        width={p.imagen.ancho}
                        height={p.imagen.alto}
                        className="w-full max-w-[240px] h-auto"
                      />
                    </div>
                  ) : Icono ? (
                    // El hueco va en un envoltorio, no en el recuadro: con `pt-6` sobre el
                    // propio recuadro, el relleno quedaría DENTRO del borde y saldría una
                    // caja alta con el icono descentrado.
                    <div aria-hidden className="mt-auto pt-6">
                      <span className="inline-flex items-center justify-center w-11 h-11 rounded-lg
                                       border border-[#7B5FBF]/30 bg-[#7B5FBF]/10">
                        <Icono className="w-[22px] h-[22px] text-[#a78bfa]" />
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
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
