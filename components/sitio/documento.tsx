/**
 * DOCUMENTO LEGAL — el lenguaje visual de las páginas de términos y políticas.
 *
 * ── QUÉ CAMBIÓ Y POR QUÉ ───────────────────────────────────────────────────────
 * Antes eran páginas sueltas con estilos en línea: fondo propio, sin cabecera, sin pie,
 * sin forma de volver. Funcionaban, pero se leían como un anexo pegado al sitio en vez de
 * como parte de él — y son justo las páginas que abre un revisor de Meta y un cliente que
 * quiere saber qué se hace con sus datos.
 *
 * Ahora viven dentro del marco del sitio (`app/(sitio)/layout.tsx`), así que traen su
 * cabecera y su pie, y usan las mismas clases que el resto.
 *
 * ── LO QUE APORTA UN DOCUMENTO LARGO, Y QUE UNA PÁGINA SUELTA NO TENÍA ─────────
 * · **Índice fijo** en pantallas anchas. Estos documentos tienen más de veinte secciones;
 *   sin índice, encontrar «cómo elimino mis datos» es desplazarse a ciegas.
 * · **Anclas visibles** en cada título, para poder enlazar una sección concreta. Meta pide
 *   exactamente eso: la URL de las instrucciones de eliminación, no la de la política.
 * · **Ancho de lectura acotado** (~68 caracteres). Un párrafo legal a 1.200 px de ancho no
 *   se lee: se abandona.
 *
 * Las clases se exportan como CADENAS y no como objetos de estilo, para que el tema, los
 * `hover` y las variantes responsivas funcionen igual que en el resto del sitio.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';

import { DOCUMENTOS_LEGALES } from '@/lib/negocio/legal';

/* ═══════════════ CLASES DEL DOCUMENTO ═══════════════ */

export const h1 = 'text-[34px] sm:text-[44px] leading-[1.12] font-semibold text-white tracking-tight';

/** Título de sección. Lleva `scroll-mt-24` para que el ancla no quede bajo la cabecera fija. */
export const h2 =
  'group text-[21px] sm:text-[23px] leading-snug font-semibold text-white tracking-tight mt-14 mb-3 scroll-mt-24';

/** Título de PARTE: separa bloques dirigidos a públicos distintos dentro del mismo documento. */
export const h2Parte =
  'group text-[26px] sm:text-[29px] leading-snug font-semibold text-white tracking-tight mt-20 mb-4 pt-9 border-t border-white/[0.09] scroll-mt-24';

export const p = 'text-[15.5px] leading-[1.75] text-white/60 mt-4';
export const ul = 'mt-4 space-y-3 text-[15.5px] leading-[1.75] text-white/60 list-disc pl-5 marker:text-white/25';
export const b = 'text-white font-semibold';
export const link = 'text-[#a78bfa] hover:text-white underline underline-offset-2 transition-colors';
export const sutil = 'text-white/40';

export const tabla = 'w-full border-collapse mt-5 text-[14.5px]';
export const th =
  'text-left align-top py-3 px-3.5 border-b border-white/[0.09] text-white font-semibold text-[13.5px]';
export const td = 'align-top py-3 px-3.5 border-b border-white/[0.05] text-white/60 leading-relaxed';

/** Recuadro destacado. `aviso` para lo que puede salir mal; `nota` para orientar. */
export function recuadro(tono: 'aviso' | 'nota' = 'nota'): string {
  return tono === 'aviso'
    ? 'mt-6 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] p-5 text-[15px] leading-relaxed text-white/65'
    : 'mt-6 rounded-lg border border-[#7B5FBF]/30 bg-[#7B5FBF]/[0.08] p-5 text-[15px] leading-relaxed text-white/65';
}

/* ═══════════════ ESTRUCTURA ═══════════════ */

export interface EntradaIndice {
  id: string;
  label: string;
}

/**
 * El índice va **agrupado por categorías**, no como una lista de veintidós enlaces.
 * Veintidós entradas seguidas no son un índice: son un muro. Agrupadas, se localiza el
 * tema primero y la sección después.
 */
export interface GrupoIndice {
  label: string;
  entradas: EntradaIndice[];
}

/**
 * El armazón de un documento legal: portada + **tres columnas**.
 *
 *   ┌──────────┬────────────────────────┬──────────┐
 *   │ Documentos│      el documento      │ Contenido│
 *   │  (fijo)  │   (ancho de lectura)   │  (fijo)  │
 *   └──────────┴────────────────────────┴──────────┘
 *
 * Los dos paneles **flotan pegados** con `position: sticky` y **no invaden el centro**:
 * son columnas de la retícula, no capas superpuestas. El texto nunca queda tapado.
 *
 * ── POR QUÉ TRES Y NO DOS ──────────────────────────────────────────────────────
 * Antes los dos índices —el de documentos y el de secciones— compartían la columna
 * izquierda, uno debajo del otro. Con veintidós secciones, la lista de documentos quedaba
 * arriba del todo y desaparecía al desplazarse. Separados, cada uno tiene su sitio y los
 * dos están siempre visibles: **a la izquierda dónde estoy, a la derecha qué hay dentro.**
 *
 * ── POR DEBAJO DE `xl` ─────────────────────────────────────────────────────────
 * No hay sitio para tres columnas, así que los dos paneles se funden en un desplegable
 * **`<details>` nativo** justo bajo la portada: sin JavaScript, funciona en el HTML crudo y
 * el navegador se encarga de abrirlo y cerrarlo.
 */
export default function DocumentoLegal({
  id, titulo, subtitulo, actualizado, indice, aviso, children,
}: {
  /** El `id` de este documento en `DOCUMENTOS_LEGALES`. Marca cuál está activo. */
  id: string;
  titulo: string;
  subtitulo?: string;
  actualizado: string;
  indice: GrupoIndice[];
  /** Nota breve bajo la portada. Opcional: no todos los documentos necesitan una. */
  aviso?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {/* ── CABECERA DE ALTO FIJO ──────────────────────────────────────────────
          ⚠️ EL ALTO ES FIJO A PROPÓSITO, y es la corrección de un fallo real: antes la
          portada crecía o encogía según lo largo que fuese el título y el subtítulo de
          cada documento, y como los paneles laterales empiezan donde ella acaba, **al
          cambiar de documento los dos paneles subían o bajaban**. La navegación se sentía
          inestable sin que se viera por qué.
          Con `h-[112px]` la geometría es idéntica en todos: se cambia de documento y los
          paneles no se mueven ni un píxel. El subtítulo se fue al cuerpo, donde puede
          ocupar lo que necesite sin arrastrar a nadie. */}
      <section className="border-b border-white/[0.07] bg-white/[0.015]">
        <ContenedorDoc className="h-[112px] flex items-center justify-between gap-6">
          <h1 className="text-[23px] sm:text-[27px] font-semibold text-white tracking-tight leading-tight min-w-0">
            {titulo}
          </h1>
          <p className="hidden sm:block text-[12.5px] text-white/30 shrink-0 whitespace-nowrap">
            Actualizado el {actualizado}
          </p>
        </ContenedorDoc>
      </section>

      {/* Navegación compacta por debajo de `xl`, donde no caben tres columnas. */}
      <div className="xl:hidden border-b border-white/[0.07] bg-white/[0.02]">
        <ContenedorDoc className="py-3">
          <details className="group">
            <summary className="flex items-center justify-between gap-3 cursor-pointer list-none py-1.5">
              <span className="text-[13px] font-semibold text-white/80">Documentos y contenido</span>
              <span aria-hidden className="text-white/35 text-[12px] transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="pt-4 pb-2 space-y-6">
              <ListaDocumentos activo={id} />
              <IndiceSecciones grupos={indice} />
            </div>
          </details>
        </ContenedorDoc>
      </div>

      <ContenedorDoc className="py-10">
        <div className="xl:grid xl:grid-cols-[236px_minmax(0,1fr)_260px] xl:gap-12">
          {/* ── Izquierda: los documentos ── */}
          <nav className="hidden xl:block" aria-label="Documentos legales">
            <div className="sticky top-24 max-h-[calc(100vh-130px)] overflow-y-auto pr-1">
              <ListaDocumentos activo={id} />
            </div>
          </nav>

          {/* ── Centro: el documento ── */}
          <article className="max-w-[74ch] mx-auto xl:mx-0">
            {subtitulo && (
              <p className="text-[16.5px] leading-relaxed text-white/50 pb-7 mb-2 border-b border-white/[0.07]">
                {subtitulo}
              </p>
            )}
            {aviso && <div className={recuadro('nota')}>{aviso}</div>}
            {children}
          </article>

          {/* ── Derecha: el contenido de este documento ── */}
          <nav className="hidden xl:block" aria-label="Contenido del documento">
            <div className="sticky top-24 max-h-[calc(100vh-130px)] overflow-y-auto pl-1">
              <IndiceSecciones grupos={indice} />
            </div>
          </nav>
        </div>
      </ContenedorDoc>
    </>
  );
}

/**
 * El contenedor de los documentos legales. **Más ancho que el del resto del sitio.**
 *
 * El sitio usa `max-w-6xl` (1152 px), que es lo correcto para una página de marketing de
 * una sola columna. Aquí hay TRES, y con ese ancho el texto quedaba estrujado en el medio
 * mientras sobraba media pantalla a los lados. `1560px` reparte: paneles cómodos y una
 * columna de lectura de ~74 caracteres, que sigue siendo ancho de lectura y no de cartel.
 */
function ContenedorDoc({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1560px] px-5 sm:px-8 ${className}`}>{children}</div>;
}

/** La lista de documentos. Sale del registro: un servicio nuevo aparece aquí solo. */
function ListaDocumentos({ activo }: { activo: string }) {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/30 mb-2.5">
        Documentos
      </p>
      <ul className="space-y-1">
        {DOCUMENTOS_LEGALES.map((d) => {
          const esActivo = d.id === activo;
          return (
            <li key={d.id}>
              <Link
                href={d.ruta}
                aria-current={esActivo ? 'page' : undefined}
                className={`block rounded-md px-2.5 py-2 text-[12.5px] leading-snug transition-colors border-l-2 ${
                  esActivo
                    ? 'border-[#7B5FBF] bg-[#7B5FBF]/[0.12] text-white'
                    : 'border-transparent text-white/45 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {d.corto}
                <span className={`block mt-0.5 text-[10.5px] ${esActivo ? 'text-[#a78bfa]' : 'text-white/25'}`}>
                  {d.papel === 'encargado' ? 'Somos encargados' : 'Somos responsables'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * El índice del documento, por categorías y **desplegado**.
 *
 * Sin plegar a propósito: en un documento legal la gente no explora, busca. Un acordeón
 * cerrado obliga a abrir tres cajas para encontrar «cómo elimino mis datos».
 *
 * El salto es suave gracias a `scroll-smooth` en `<html>`, y las secciones llevan
 * `scroll-mt-24` para no quedar debajo de la cabecera fija.
 */
function IndiceSecciones({ grupos }: { grupos: GrupoIndice[] }) {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/30 mb-2.5">
        En este documento
      </p>
      <div className="space-y-5">
        {grupos.map((g) => (
          <div key={g.label}>
            <p className="text-[12px] font-semibold text-white/70 mb-1.5">{g.label}</p>
            {/* La línea vertical hace de agrupador sin gastar una caja ni un borde. */}
            <ul className="space-y-0.5 border-l border-white/[0.09] pl-3">
              {g.entradas.map((e) => (
                <li key={e.id}>
                  <a
                    href={`#${e.id}`}
                    className="block py-0.5 text-[12.5px] leading-snug text-white/40 hover:text-white transition-colors"
                  >
                    {e.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
/** Título de sección con ancla enlazable. El `#` aparece al pasar por encima. */
export function Titulo({
  id, children, parte = false,
}: { id: string; children: ReactNode; parte?: boolean }) {
  return (
    <h2 id={id} className={parte ? h2Parte : h2}>
      <a href={`#${id}`} className="no-underline">
        {children}
        <span
          aria-hidden
          className="ml-2 text-[#7B5FBF] opacity-0 group-hover:opacity-100 transition-opacity select-none"
        >
          #
        </span>
      </a>
    </h2>
  );
}
