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
import { Contenedor } from './piezas';
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
  /** `true` para las cabeceras de PARTE, que se pintan destacadas. */
  parte?: boolean;
}

/**
 * El armazón de un documento legal: portada, índice fijo y columna de lectura.
 *
 * El índice se pasa a mano en vez de deducirlo del DOM: deducirlo obligaría a que la
 * página fuese de cliente, y estas tienen que estar enteras en el HTML crudo.
 */
export default function DocumentoLegal({
  id, titulo, subtitulo, actualizado, indice, aviso, children,
}: {
  /** El `id` de este documento en `DOCUMENTOS_LEGALES`. Marca cuál está activo. */
  id: string;
  titulo: string;
  subtitulo?: string;
  actualizado: string;
  indice: EntradaIndice[];
  /** Nota breve bajo la portada: a quién le aplica este documento. */
  aviso?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <section className="border-b border-white/[0.07]">
        <Contenedor className="py-16 sm:py-20">
          <h1 className={h1}>{titulo}</h1>
          {subtitulo && <p className="mt-4 text-[16.5px] leading-relaxed text-white/50 max-w-2xl">{subtitulo}</p>}
          <p className="mt-6 text-[13.5px] text-white/35">Última actualización: {actualizado}</p>
          {aviso && (
            <div className={`${recuadro('nota')} max-w-2xl`}>{aviso}</div>
          )}
        </Contenedor>
      </section>

      <Contenedor className="py-14 sm:py-16">
        <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-14">
          {/* Índice fijo. Oculto por debajo de `lg`: en móvil una columna lateral de
              veinte enlaces empuja el documento hasta el olvido. */}
          <nav className="hidden lg:block" aria-label="Documentación legal">
            <div className="sticky top-24 max-h-[calc(100vh-140px)] overflow-y-auto pr-2">
              {/* ── LOS DOCUMENTOS ─────────────────────────────────────────────
                  Va ARRIBA del índice de secciones a propósito: se navega entre
                  documentos como en una documentación, sin tener que volver atrás.
                  Sale del registro, así que un servicio nuevo aparece aquí solo. */}
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-white/30 mb-3">
                Documentos
              </p>
              <ul className="space-y-1 mb-8">
                {DOCUMENTOS_LEGALES.map((d) => {
                  const activo = d.id === id;
                  return (
                    <li key={d.id}>
                      <Link
                        href={d.ruta}
                        aria-current={activo ? 'page' : undefined}
                        className={`block rounded-md px-2.5 py-2 text-[12.5px] leading-snug transition-colors ${
                          activo
                            ? 'bg-[#7B5FBF]/12 text-white border-l-2 border-[#7B5FBF] rounded-l-none'
                            : 'text-white/45 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        {d.corto}
                        <span className={`block mt-0.5 text-[11px] ${activo ? 'text-[#a78bfa]' : 'text-white/25'}`}>
                          {d.papel === 'encargado' ? 'Somos encargados' : 'Somos responsables'}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-white/30 mb-3">
                En este documento
              </p>
              <ul className="space-y-1.5">
                {indice.map((e) => (
                  <li key={e.id}>
                    <a
                      href={`#${e.id}`}
                      className={`block text-[13px] leading-snug transition-colors ${
                        e.parte
                          ? 'mt-3 font-semibold text-white/70 hover:text-white'
                          : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {e.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Ancho de lectura acotado a propósito. */}
          <article className="max-w-[68ch]">{children}</article>
        </div>
      </Contenedor>
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
