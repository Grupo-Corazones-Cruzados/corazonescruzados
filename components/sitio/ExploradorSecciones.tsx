/**
 * EL EXPLORADOR DE SECCIONES — **una definición para `/clientes` y `/desarrollo-humano`**.
 *
 * Secciones a la izquierda, contenido en medio, sus preguntas a la derecha. Nació como
 * `ClientesExplorador` el 2026-08-18 y se generalizó el 08-19, cuando Fernando pidió la misma
 * interfaz para Desarrollo Humano. **No se copió**: la lista de secciones y la ruta base
 * entran por prop, y todo lo demás —galería, índice, anclas, pasos— es el mismo código. Dos
 * exploradores que se parecen se separan a la primera corrección que solo se aplica a uno.
 *
 * Fernando lo rediseñó el 2026-08-18: *«dejaremos las 4 tarjetas pero en diseño galería
 * vertical dentro de un panel izquierdo, luego el contenido va a mostrarse dentro de un
 * panel derecho central, y luego otro panel derecho que tenga las preguntas que existen en
 * cada sección según la seleccionada»*.
 *
 * Antes era otra cosa: un titular «Clientes», un párrafo, y las cuatro tarjetas en rejilla
 * horizontal repetidas en las cinco rutas. Eso se quitó entero — ver `CabeceraClientes` en
 * el historial (`git log -- components/sitio/CabeceraClientes.tsx`).
 *
 * ── ⭐ ESTO NO LLEVA `use client`, Y ES LO MEJOR DEL CAMBIO ────────────────────
 * El explorador de `/soluciones` tiene que ser de cliente: sus pestañas y su buscador son
 * estado. Aquí **no hay estado ninguno**: la sección elegida es la URL (`/clientes/<id>`),
 * el panel izquierdo son enlaces y el derecho son anclas. Así que la página entera —las
 * cuatro secciones, sus preguntas, sus pasos— viaja en el HTML crudo, sin depender de que
 * se ejecute nada. Para una página cuyo trabajo es que la encuentren en Google, eso no es
 * un detalle de rendimiento: es la diferencia entre existir y no existir.
 *
 * ── EL PANEL DERECHO ES UN ÍNDICE, NO UN SELECTOR ─────────────────────────────
 * Decisión de Fernando (2026-08-18) entre las dos opciones que le planteé. Las preguntas se
 * pintan **enteras en el centro**, una debajo de otra; el panel derecho las lista y salta a
 * ellas. La alternativa —enseñar solo la pregunta seleccionada— habría escondido la mitad
 * del contenido detrás de un clic, que es justo lo que un buscador no sigue.
 *
 * Por eso el índice son `<a href="#…">` de toda la vida y no botones: el salto lo hace el
 * navegador, funciona con el teclado, y cada pregunta tiene una dirección que se puede
 * mandar por WhatsApp.
 *
 * ── ⭐ COMO SITIO WEB (Fernando, 2026-10-29: «más estilo sitio web… reformula por completo») ──
 * Antes eran tres paneles a todo el ancho: secciones en una columna a la izquierda, contenido y
 * el índice. Ahora la página abre con su PRESENTACIÓN (`PresentacionPagina`), las secciones son
 * una FILA DE PUERTAS arriba (`PuertasSecciones`, la abierta rellena de violeta como la píldora
 * de la cabecera) y debajo el contenido a ancho de lectura con el índice pegado a la derecha.
 * Sin botones de acceso: el acceso solo está en la portada (Fernando, 2026-10-29).
 * Todo sigue sin `use client` y en el HTML. Para volver a la versión anterior:
 *     git show e09e1dc0:components/sitio/ExploradorSecciones.tsx
 */

import { ArrowDown } from 'lucide-react';
import { SITIO, type Acceso } from '@/lib/sitio/contenido';
import type { Faq } from '@/lib/faqs';
import { BloqueTema, conNegritas, ICONOS, PresentacionPagina } from './piezas';
import type { ComponentProps, ReactNode } from 'react';
import GaleriaTarjetas from './GaleriaTarjetas';
import VideoYouTube from './VideoYouTube';
import FaqsClientes from './FaqsClientes';
import IndiceSeccion from './IndiceSeccion';
import PuertasBloques from './PuertasBloques';

/**
 * LAS PUERTAS — cada sección, una fila en su bloque (`PuertasBloques`, compartido con Soluciones).
 * «En esta página» (el índice de la derecha) vive en `IndiceSeccion.tsx`.
 */
function PuertasSecciones({
  secciones, activa, base, etiquetaNav,
}: {
  secciones: Acceso[]; activa: string; base: string; etiquetaNav: string;
}) {
  return (
    <PuertasBloques
      etiquetaNav={etiquetaNav}
      activa={activa}
      puertas={secciones.map((a) => {
        const Icono = ICONOS[a.icono] ?? ICONOS.capas;
        return { id: a.id, href: `${base}/${a.id}`, titulo: a.titulo, texto: a.texto, grupo: a.grupo, icono: <Icono /> };
      })}
    />
  );
}

/**
 * EL MISMO ÍNDICE, PARA PANTALLAS ESTRECHAS — en VERTICAL (Fernando, 2026-10-29).
 *
 * Era una fila de píldoras que se deslizaba a lo ancho, y en el teléfono la segunda pregunta
 * quedaba cortada con una barra de desplazamiento debajo: *«no me gusta tener que deslizarse
 * horizontalmente en este tipo de opciones»*. Ahora es una tarjeta «En esta página» con una fila
 * por pregunta (su etiqueta, la pregunta entera y una flecha hacia abajo, porque salta más abajo
 * en la misma página). Nada se esconde a la derecha. Desde `lg` manda el índice de la derecha.
 */
function IndiceEnFila({ temas }: { temas: NonNullable<Acceso['temas']> }) {
  return (
    <nav aria-label="Preguntas de esta sección" className="indice-en-fila indice-movil mt-6 min-w-0">
      <p className="indice-movil-rotulo">En esta página</p>
      <ul>
        {temas.map((t) => (
          <li key={t.id}>
            <a href={`#${t.id}`} className="indice-movil-enlace">
              <span className="min-w-0">
                <span className="indice-movil-etiqueta">{t.etiqueta}</span>
                <span className="indice-movil-pregunta">{t.pregunta}</span>
              </span>
              <ArrowDown className="indice-movil-flecha" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function ExploradorSecciones({
  secciones, activa, faqs, base, rotulo, etiquetaNav, presentacion, children,
}: {
  /** Las secciones de las puertas. `ACCESOS` en `/clientes`, `DESARROLLO` en la otra. */
  secciones: Acceso[];
  /** El `id` de la sección abierta. En la portada de cada rama es la primera. */
  activa: string;
  /** Las preguntas frecuentes de esa sección, ya leídas en el servidor. */
  faqs: Faq[];
  /** La ruta de la que cuelgan las secciones: `/clientes` o `/desarrollo-humano`. */
  base: string;
  /** El rótulo en versalitas sobre el nombre de la sección. */
  rotulo: string;
  /** El `aria-label` del `<nav>` de las puertas. */
  etiquetaNav: string;
  /** La presentación de la página (la misma en todas sus secciones). */
  presentacion: ComponentProps<typeof PresentacionPagina>;
  /** Contenido propio de la sección, bajo su descripción (p. ej. la tabla del Modelo 4P). */
  children?: ReactNode;
}) {
  const acceso = secciones.find((a) => a.id === activa);
  if (!acceso) return null;
  const temas = acceso.temas ?? [];

  return (
    <>
      <PresentacionPagina {...presentacion} />
      <PuertasSecciones secciones={secciones} activa={acceso.id} base={base} etiquetaNav={etiquetaNav} />

      <div className="explorador-sitio" data-indice={temas.length > 0 ? 'sí' : undefined}>
        <div className="min-w-0">
          <div className="cabecera-seccion">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--violeta-txt)]">
                {rotulo}
              </p>
              {/* El `<h1>` de la página es el nombre de la sección: cada URL, su título. */}
              <h1 className="mt-2 text-[32px] sm:text-[44px] tracking-tight text-[var(--texto)] leading-[1.05]">
                {acceso.titulo}
              </h1>
            </div>
          </div>
          {/* La descripción LARGA si la sección la tiene; si no, su frase corta. */}
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--suave)] max-w-3xl whitespace-pre-line">
            {conNegritas(acceso.descripcion ?? acceso.texto)}
          </p>

          {children && <div className="mt-8 max-w-3xl">{children}</div>}

          {temas.length > 0 && <IndiceEnFila temas={temas} />}

          {/* Vídeo. Mientras no haya enlace no se pinta nada: ni hueco ni «próximamente». */}
          {acceso.video && (
            <div className="mt-10 max-w-3xl">
              <VideoYouTube url={acceso.video} titulo={`${acceso.titulo} — ${SITIO.nombre}`} />
            </div>
          )}

          {/* Las preguntas, enteras y una debajo de otra. Cada una con su ancla. */}
          {temas.map((t) => (
            <div key={t.id} className="mt-10">
              <BloqueTema {...t} />
            </div>
          ))}

          {/* La galería, para las secciones que enumeran en vez de explicar un flujo. */}
          {acceso.galeria && (
            <div className="mt-12">
              <GaleriaTarjetas {...acceso.galeria} />
            </div>
          )}

          {/* Preguntas FRECUENTES (Admin → FAQs). Sin ninguna, la sección desaparece. */}
          {faqs.length > 0 && (
            <div className="mt-14">
              <h2 className="text-[26px] sm:text-[32px] text-[var(--texto)] tracking-tight">
                Preguntas frecuentes
              </h2>
              <div className="mt-6">
                <FaqsClientes faqs={faqs} />
              </div>
            </div>
          )}
        </div>

        {temas.length > 0 && (
          <div className="indice-sitio">
            <IndiceSeccion temas={temas} />
          </div>
        )}
      </div>
    </>
  );
}
