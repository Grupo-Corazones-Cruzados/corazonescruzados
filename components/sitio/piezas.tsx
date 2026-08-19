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
 *   3. **Superficies con borde de 1 px muy tenue** y una sombra mínima. Es lo que separa una
 *      tarjeta moderna de una caja de 2010.
 *   4. **Aire.** Secciones de 96–128 px de alto. Casi todo lo que parece «barato» en una
 *      web es falta de espacio, no falta de efectos.
 *
 * Instalar un kit habría traído además otro lenguaje visual que pelearía con el tema del
 * panel, que ya tiene el suyo.
 *
 * Estas piezas son Server Components: no llevan estado y tienen que estar en el HTML crudo
 * para que las lea un buscador —y un revisor de Meta— sin ejecutar JavaScript.
 *
 * ── TEMA CLARO DESDE EL 2026-08-17 ─────────────────────────────────────────────
 * Nacieron en oscuro (`#0b0d14`, texto blanco, realce solo de borde). Fernando pidió que el
 * cuerpo de las cinco páginas públicas pasara a claro, y **el cambio se hizo aquí**: como
 * ninguna página compone clases por su cuenta, recolorear estas piezas recolorea el sitio.
 *
 * Los colores salen de la clase **`claro-publico`** (`app/globals.css`), que la pone el
 * `<main>` de `app/(sitio)/layout.tsx` y que comparten con el CV público. Aquí no se escribe
 * ningún color nuevo a mano: se referencian sus variables.
 *
 * ⚠️ **Dos cosas cambian de verdad al pasar a claro, y no son el fondo:**
 *  · **El violeta de texto es otro.** `#a78bfa` no llega a AA sobre blanco → `--violeta-txt`.
 *  · **Hace falta sombra.** El realce de borde que bastaba en oscuro no despega una tarjeta
 *    blanca del papel → la clase `claro-tarjeta`.
 */

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  MessageSquare, Layers, Zap, FileText, Users, Gamepad2, Store, Compass,
  Ticket, Vote, ArrowRight, CalendarClock, Handshake,
  AppWindow, Bot, Network, Database, MonitorSmartphone, BotMessageSquare, Globe, Blocks,
  Building2, Cloud, Puzzle,
  // Ampliación del 2026-08-18, para que la galería de iconos del admin sea de verdad una
  // galería: con 23 no había de dónde elegir al crear un concepto.
  BarChart3, ShieldCheck, Lock, Wrench, Cog, Rocket, Lightbulb, Target, Search, Mail,
  Phone, MapPin, Truck, ShoppingCart, CreditCard, Receipt, Wallet, PiggyBank, Scale,
  BookOpen, GraduationCap, Stethoscope, HeartPulse, Leaf, Factory, Hammer, Ruler,
  Palette, Camera, Video, Music, Mic, Radio, Newspaper, Megaphone, Share2, Link2,
  Server, HardDrive, Cpu, Code2, Terminal, GitBranch, Workflow, Boxes, Package,
  ClipboardList, CheckCircle2, AlarmClock, Timer, TrendingUp, Activity, Gauge,
  Sparkles, Star, Award, Flag, Home, Briefcase, Landmark, Plane, Ship, Car,
  type LucideIcon,
} from 'lucide-react';

/**
 * EL MAPA NOMBRE → ICONO — fuente única de la iconografía del sitio.
 *
 * Las claves son las que se guardan en la base (`solucion_conceptos.icono`, `ACCESOS.icono`)
 * y las que ofrece la **galería del admin**. Guardar un nombre y no un SVG hace que el icono
 * pese cero, cambie de color con el tema y se pueda sustituir en un sitio.
 *
 * ⚠️ **Quitar una clave de aquí no rompe nada**, pero deja al concepto que la usara con el
 * icono por defecto. Añadir una la ofrece automáticamente en el admin: no hay una segunda
 * lista que mantener.
 */
export const ICONOS: Record<string, LucideIcon> = {
  mensaje: MessageSquare, capas: Layers, rayo: Zap, documento: FileText,
  personas: Users, juego: Gamepad2, tienda: Store, brujula: Compass,
  ticket: Ticket, voto: Vote, calendario: CalendarClock, acuerdo: Handshake,
  // Nacieron con la galería de Automatización (2026-08-06) y hoy son conceptos.
  aplicacion: AppWindow, robot: Bot, red: Network, 'base-datos': Database,
  pantallas: MonitorSmartphone, agente: BotMessageSquare, web: Globe, modulos: Blocks,
  integracion: Puzzle, inquilinos: Building2, nube: Cloud,
  // Ampliación del 2026-08-18 para la galería del admin.
  grafico: BarChart3, escudo: ShieldCheck, candado: Lock, herramienta: Wrench,
  engranaje: Cog, cohete: Rocket, idea: Lightbulb, diana: Target, buscar: Search,
  correo: Mail, telefono: Phone, ubicacion: MapPin, camion: Truck, carrito: ShoppingCart,
  tarjeta: CreditCard, recibo: Receipt, billetera: Wallet, ahorro: PiggyBank,
  balanza: Scale, libro: BookOpen, formacion: GraduationCap, salud: Stethoscope,
  pulso: HeartPulse, hoja: Leaf, fabrica: Factory, martillo: Hammer, regla: Ruler,
  paleta: Palette, camara: Camera, video: Video, musica: Music, microfono: Mic,
  radio: Radio, prensa: Newspaper, altavoz: Megaphone, compartir: Share2, enlace: Link2,
  servidor: Server, disco: HardDrive, procesador: Cpu, codigo: Code2, terminal: Terminal,
  rama: GitBranch, flujo: Workflow, cajas: Boxes, paquete: Package,
  lista: ClipboardList, verificado: CheckCircle2, alarma: AlarmClock, cronometro: Timer,
  tendencia: TrendingUp, actividad: Activity, medidor: Gauge, destello: Sparkles,
  estrella: Star, premio: Award, bandera: Flag, casa: Home, maletin: Briefcase,
  institucion: Landmark, avion: Plane, barco: Ship, coche: Car,
};

/** Los nombres de icono disponibles, para la galería del admin. */
export const NOMBRES_DE_ICONO = Object.keys(ICONOS).sort();

/** Convierte los `**dobles asteriscos**` del contenido en negrita. */
export function conNegritas(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((trozo, i) =>
    trozo.startsWith('**') && trozo.endsWith('**')
      ? <strong key={i} className="text-[var(--texto)] font-semibold">{trozo.slice(2, -2)}</strong>
      : <span key={i}>{trozo}</span>,
  );
}

/**
 * Envoltorio de ancho. Dos anchos, y la diferencia no es estética:
 *
 * · **`lectura`** (por omisión, 1152 px) — para páginas de LEER. Una línea de texto muy
 *   larga se lee mal: el ojo pierde el renglón al volver. Es el ancho de Clientes,
 *   Desarrollo Humano y Contacto.
 * · **`amplio`** (1560 px) — para pantallas que **no se leen, se recorren**: `/soluciones`
 *   es un explorador de tres columnas —carpetas, contenido, conceptos—, y ahí el ancho no
 *   alarga renglones, reparte columnas. Fernando lo pidió el 2026-08-18: *«aprovecha todo el
 *   ancho disponible»*. Es el mismo 1560 que ya usaban los documentos legales por el mismo
 *   motivo: llevan índice a los lados.
 */
export function Contenedor({
  children, className = '', ancho = 'lectura',
}: {
  children: ReactNode;
  className?: string;
  ancho?: 'lectura' | 'amplio';
}) {
  const max = ancho === 'amplio' ? 'max-w-[1560px]' : 'max-w-6xl';
  return <div className={`mx-auto ${max} px-5 sm:px-6 ${className}`}>{children}</div>;
}

/**
 * EL ARMAZÓN DE TRES PANELES — **una sola definición** para `/soluciones` y `/clientes`.
 *
 * Izquierda: por dónde se navega. Centro: lo que se está mirando. Derecha: un acompañante
 * de eso —los conceptos de la solución, las preguntas de la sección—.
 *
 * Nació dentro del explorador de `/soluciones` el 2026-08-18 y se extrajo aquí el mismo día,
 * cuando Fernando pidió la misma forma para `/clientes`. No se copió: **dos rejillas que se
 * parecen se separan a la primera corrección que solo se aplica a una**, y esta rejilla
 * lleva dentro tres reglas que costaron medir (ver abajo).
 *
 * ── LO QUE ESTE COMPONENTE GARANTIZA, Y QUE ES FÁCIL OLVIDAR ───────────────────
 * 1. **`min-w-0` en el centro y en la derecha.** Una casilla de rejilla mide por defecto
 *    `min-width: auto` —«no me encojas por debajo de mi hijo más ancho»—, así que un
 *    contenido deliberadamente ancho (una tira horizontal, una tabla) estira la columna y
 *    con ella la página entera. Costó una barra de desplazamiento horizontal en todo el
 *    sitio el 2026-08-18.
 * 2. **`sticky` + `self-start` en los laterales, y en el ENVOLTORIO.** Van juntos siempre:
 *    sin `self-start` la casilla se estira, no queda holgura y el pegado no hace nada.
 *    Poner el `sticky` dentro del envoltorio es el mismo error con otra cara.
 * 3. **La tercera columna solo existe si hay algo que poner.** Sin `derecha` la rejilla
 *    vuelve a dos columnas en vez de dejar un hueco blanco.
 *
 * ── DESDE QUÉ ANCHURA CABE EL TERCER PANEL: `corte` ───────────────────────────
 * No es igual en las dos páginas, y depende de **qué haya en el centro**. La tira de
 * `/soluciones` acompaña a tarjetas que se reparten solas: a 1024 px ya cabe. El índice de
 * `/clientes` acompaña a las tarjetas de pregunta, que llevan dentro tres columnas de pasos,
 * y a 1170 px las dejaba en 116 px de ancho — una palabra por línea (Fernando, 2026-08-19).
 * Ahí el tercer panel espera hasta 1536 px. Los umbrales viven en `.paneles-explorador`
 * (`app/globals.css`).
 *
 * ── LO QUE **NO** HACE ────────────────────────────────────────────────────────
 * Fuera del corte oculta el panel derecho y enseña, si lo hay, un sustituto marcado con
 * `.alternativa-estrecha` **dentro del centro**. Qué sea ese sustituto es cosa de cada
 * página: `/soluciones` tumba su tira en horizontal, `/clientes` convierte el índice en una
 * fila de enlaces. Aquí no se decide, porque no hay una respuesta buena para las dos — pero
 * sí se garantiza que **el umbral que esconde uno es el mismo que enseña el otro**, que es lo
 * que se desincronizaba cuando cada página lo escribía con sus propias clases.
 */
export function ExploradorTresPaneles({
  izquierda, centro, derecha, corte = 'lg',
  etiquetaIzquierda, anchoIzquierda = '240px', anchoDerecha = '280px',
}: {
  izquierda: ReactNode;
  centro: ReactNode;
  /** Si no se pasa, la rejilla es de dos columnas. */
  derecha?: ReactNode;
  /** El `aria-label` del panel de navegación. Obligatorio: es un `<nav>`. */
  etiquetaIzquierda: string;
  /** `lg` = tercer panel desde 1024 px · `ancho` = desde 1536 px. Ver arriba. */
  corte?: 'lg' | 'ancho';
  anchoIzquierda?: string;
  anchoDerecha?: string;
}) {
  return (
    <div
      className="paneles-explorador"
      data-corte={corte}
      data-derecha={derecha ? 'sí' : undefined}
      style={{ '--panel-izq': anchoIzquierda, '--panel-der': anchoDerecha } as CSSProperties}
    >
      <nav aria-label={etiquetaIzquierda} className="panel-explorador-fijo min-w-0">
        {izquierda}
      </nav>

      <div className="min-w-0">{centro}</div>

      {derecha && (
        <div className="panel-derecho-explorador panel-explorador-fijo min-w-0">{derecha}</div>
      )}
    </div>
  );
}

/**
 * Sección con su aire. `tono="realce"` le pone un fondo apenas distinto para separar dos
 * secciones seguidas sin dibujar una línea.
 */
export function Seccion({
  id, children, tono = 'normal',
}: { id?: string; children: ReactNode; tono?: 'normal' | 'realce' }) {
  return (
    <section id={id} className={`py-20 sm:py-28 ${tono === 'realce' ? 'bg-[var(--tarjeta)]' : ''}`}>
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
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--violeta-txt)] mb-3">
          {etiqueta}
        </p>
      )}
      <h2 className="text-[30px] sm:text-[38px] leading-[1.15] font-semibold text-[var(--texto)] tracking-tight">
        {titulo}
      </h2>
      {entradilla && (
        <p className="mt-4 text-[16.5px] leading-relaxed text-[var(--suave)]">{entradilla}</p>
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
      className={`claro-tarjeta rounded-xl border border-[var(--linea)] bg-[var(--tarjeta)] p-6 sm:p-7
                  hover:border-[var(--linea-fuerte)] ${className}`}
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
                 border border-[#7b5fbf]/25 bg-[#7b5fbf]/[0.08]"
    >
      <Icono className="w-5 h-5 text-[var(--violeta-txt)]" />
    </span>
  );
}

/**
 * El fondo del héroe: un resplandor radial y una rejilla muy tenue.
 *
 * Es lo que más aporta al «se ve profesional» y no cuesta ni una petición de red: dos
 * degradados CSS y una máscara para que la rejilla se desvanezca hacia abajo en vez de
 * cortarse en seco.
 *
 * ⚠️ **Al pasar a claro no basta con bajar la opacidad: la rejilla cambia de color.** Sus
 * líneas eran blancas —se ven sobre negro y desaparecen sobre papel—, así que ahora son
 * violeta al 5,5 %, exactamente las mismas del CV público. El resplandor sí solo se
 * suaviza: sobre blanco, el 28 % de violeta que quedaba bien sobre negro se lee como una
 * mancha.
 */
export function FondoHeroe() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 55% at 50% 0%, rgba(123,95,191,0.20) 0%, rgba(123,95,191,0.06) 45%, transparent 75%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(75,45,142,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(75,45,142,0.055) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'linear-gradient(to bottom, black 0%, transparent 70%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

/* ── Rejilla de accesos ──────────────────────────────────────────────────────── */

/* ── `RejillaAccesos` SE BORRÓ EL 2026-08-18 ──────────────────────────────────────
   Era la rejilla horizontal de las cuatro puertas de `/clientes`, repetida en las cinco
   rutas por `CabeceraClientes`. Fernando rediseñó la página: las tarjetas pasaron a una
   **galería vertical** en el panel izquierdo del explorador, que vive en
   `components/sitio/ClientesExplorador.tsx`.

   No se deja aquí sin usar porque un componente que no pinta nadie confunde a quien lo lea
   después: parece que sale en algún sitio y no sale. Para recuperarla:

       git show HEAD~1:components/sitio/piezas.tsx
       git show HEAD~1:components/sitio/CabeceraClientes.tsx                            */

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
  /** Opcional: sin respuesta escrita no se pinta párrafo. Ver el aviso en `Tema`. */
  texto?: string;
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
      className="tema-anima group/tema relative overflow-hidden rounded-2xl border border-[#7b5fbf]/20 bg-[var(--tarjeta)] scroll-mt-24"
    >
      {/* El resplandor. Es un degradado CSS: ni una petición de red, ni una imagen que
          cargar, y se ve igual en cualquier pantalla. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(75% 120% at 12% 0%, rgba(123,95,191,0.16) 0%, rgba(123,95,191,0.05) 42%, transparent 72%)',
        }}
      />

      <div className="relative px-6 py-10 sm:px-12 sm:py-14">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--violeta-txt)]">
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
                       text-[var(--texto)] tracking-tight focus:outline-none focus-visible:underline
                       focus-visible:decoration-[#7b5fbf] decoration-2 underline-offset-4"
          >
            {pregunta}
            <span
              aria-hidden
              className="ml-3 align-middle text-[0.5em] text-[#7b5fbf]/0 transition-colors
                         group-hover/tema:text-[#7b5fbf]/70 group-focus-within/tema:text-[#7b5fbf]/70"
            >
              #
            </span>
          </a>
        </h2>

        {/* Sin respuesta escrita no se pinta el párrafo —ni un hueco, ni un relleno—. Es la
            regla del sitio, y aquí además evita publicar texto que nadie ha escrito. */}
        {texto && (
          <p className="mt-6 text-[16.5px] sm:text-[18px] leading-relaxed text-[var(--suave)] max-w-2xl">
            {texto}
          </p>
        )}

        {pasos && pasos.length > 0 && (
          <ol className="pasos-tema mt-12 grid gap-8 sm:gap-6">
            {pasos.map((p, i) => {
              const Icono = p.icono ? ICONOS[p.icono] : null;
              return (
                // La línea superior separa los pasos entre sí sin dibujar cajas: tres
                // recuadros dentro de otro recuadro sería una caja de más.
                // `flex flex-col` + `mt-auto` en el icono: los textos miden distinto y, sin
                // esto, cada icono quedaría a una altura y las tres columnas se verían
                // descuadradas. Así se alinean todos abajo.
                <li
                  key={p.titulo}
                  className="relative overflow-hidden border-t border-[var(--linea-fuerte)] pt-5 pb-24"
                >
                  {/* ── LA ILUSTRACIÓN, COMO MARCA DE AGUA ────────────────────────────
                      Pasó por tres sitios antes de acabar aquí (Fernando, 2026-08-04):
                      debajo del texto a ancho completo, luego encajada en una caja, luego
                      arriba junto al número. Ninguna funcionaba, y el motivo es el mismo en
                      las tres: como ELEMENTO, tres dibujos de proporciones muy distintas
                      —uno de 4:1 junto a dos casi cuadrados— nunca se ven del mismo tamaño.
                      Como FONDO deja de importar: al 16 % de opacidad y al pie del paso, lo
                      que se percibe es una textura, no una figura que compita con la de al
                      lado.
                      `aria-hidden` y `pointer-events-none`: es decoración pura; ni se lee ni
                      se puede pulsar. El `pb-24` de arriba es su banda — sin él, el texto
                      del paso se le sentaría encima. */}
                  {p.imagen && (
                    <Image
                      src={p.imagen.src}
                      alt=""
                      aria-hidden
                      width={p.imagen.ancho}
                      height={p.imagen.alto}
                      className="pointer-events-none select-none absolute bottom-0 right-0
                                 w-[200px] h-[92px] object-contain object-right-bottom opacity-[0.22]"
                    />
                  )}

                  <span className="relative block text-[34px] leading-none font-semibold text-[#4b2d8e]/30 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="relative mt-4 text-[15.5px] font-semibold text-[var(--texto)] leading-snug">
                    {p.titulo}
                  </p>
                  <p className="relative mt-2 text-[14px] leading-relaxed text-[var(--tenue)]">{p.texto}</p>

                  {/* Si el paso no trae ilustración, el icono sigue haciendo de rótulo. */}
                  {!p.imagen && Icono && (
                    <span aria-hidden className="relative mt-5 inline-flex items-center justify-center w-11 h-11
                                                 rounded-lg border border-[#7b5fbf]/25 bg-[#7b5fbf]/[0.08]">
                      <Icono className="w-[22px] h-[22px] text-[var(--violeta-txt)]" />
                    </span>
                  )}
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
                 bg-[var(--violeta)] hover:bg-[#3f2578] text-white text-[15px] font-medium transition-colors"
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
                 border border-[var(--linea-fuerte)] hover:border-[var(--violeta)] hover:bg-[#7b5fbf]/[0.06]
                 text-[var(--texto)] text-[15px] font-medium transition-colors"
    >
      {children}
    </a>
  );
}
