/**
 * EL EXPLORADOR DE `/clientes` — secciones a la izquierda, contenido en medio, sus
 * preguntas a la derecha.
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
 */

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { SITIO, ACCESOS, accesoPorId, type Acceso } from '@/lib/sitio/contenido';
import type { Faq } from '@/lib/faqs';
import { BloqueTema, BotonPrimario, ExploradorTresPaneles, ICONOS } from './piezas';
import GaleriaTarjetas from './GaleriaTarjetas';
import VideoYouTube from './VideoYouTube';
import FaqsClientes from './FaqsClientes';

/**
 * LA GALERÍA VERTICAL — las cuatro secciones, una debajo de otra.
 *
 * Son las mismas cuatro tarjetas de antes (icono, nombre y su frase), puestas en columna
 * porque ahora hacen de navegación y no de portada. La abierta se marca con el borde y el
 * fondo violetas, y con `aria-current`: el color solo se lo dice a quien lo ve.
 */
function GaleriaSecciones({ activa }: { activa: string }) {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--tenue)] mb-3">
        Clientes
      </p>
      <ul className="space-y-2">
        {ACCESOS.map((a) => {
          const abierta = a.id === activa;
          const Icono = ICONOS[a.icono] ?? ICONOS.capas;
          return (
            <li key={a.id}>
              <Link
                href={`/clientes/${a.id}`}
                aria-current={abierta ? 'page' : undefined}
                className={`block rounded-xl border p-3.5 transition-colors
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b5fbf]/50
                  ${abierta
                    ? 'border-[#7b5fbf]/55 bg-[#7b5fbf]/[0.08]'
                    : 'border-[var(--linea)] bg-[var(--tarjeta)] hover:border-[var(--linea-fuerte)]'}`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={`inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg border
                      ${abierta
                        ? 'border-[#7b5fbf]/35 bg-[#7b5fbf]/[0.12]'
                        : 'border-[var(--linea)] bg-[#7b5fbf]/[0.05]'}`}
                  >
                    <Icono className="w-4 h-4 text-[var(--violeta-txt)]" />
                  </span>
                  <span className={`text-[14.5px] font-semibold leading-snug
                    ${abierta ? 'text-[var(--violeta-txt)]' : 'text-[var(--texto)]'}`}>
                    {a.titulo}
                  </span>
                </span>
                {/* La frase, más apagada: en la abierta ya la repite el centro, pero
                    quitarla solo de esa haría que la tarjeta cambiara de alto al elegirla y
                    la lista entera daría un salto. */}
                <span className="mt-2 block text-[12.5px] leading-relaxed text-[var(--tenue)]">
                  {a.texto}
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
 * EL ÍNDICE DE PREGUNTAS — el panel de la derecha.
 *
 * Solo existe si la sección tiene preguntas; si no, `ClientesExplorador` no lo pasa y la
 * rejilla vuelve a dos columnas en vez de dejar un hueco blanco. Es lo que pasa hoy con
 * Democracia (ver el aviso en `ACCESOS`).
 */
function IndicePreguntas({ temas }: { temas: NonNullable<Acceso['temas']> }) {
  return (
    <aside aria-label="Preguntas de esta sección">
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--tenue)] mb-3">
        En esta página
      </p>
      <ul className="space-y-1">
        {temas.map((t) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              className="block rounded-lg px-3 py-2.5 text-[13.5px] leading-snug text-[var(--suave)]
                         border border-transparent transition-colors
                         hover:border-[var(--linea)] hover:bg-[#7b5fbf]/[0.05] hover:text-[var(--texto)]
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b5fbf]/50"
            >
              <span className="block text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[var(--violeta-txt)]">
                {t.etiqueta}
              </span>
              <span className="mt-1 block">{t.pregunta}</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/**
 * EL MISMO ÍNDICE, PARA PANTALLAS ESTRECHAS.
 *
 * Cuando no hay ancho para la tercera columna, el índice baja al centro convertido en una
 * fila de enlaces que se desliza a lo ancho — «como aparece en teléfono», pidió Fernando
 * (2026-08-19). No es adorno: las preguntas son largas, y sin él hay que recorrer la primera
 * entera para descubrir que hay una segunda.
 *
 * ⚠️ Quién decide ese «cuando» es `.alternativa-estrecha`, que gobierna el propio armazón: el
 * umbral que oculta el panel derecho es **el mismo** que enseña esta fila. Escribirlo aquí con
 * un `lg:hidden` propio es lo que hacía que los dos se pudieran separar.
 *
 * ⚠️ `min-w-0` en el contenedor de la fila y `overflow-x-auto` en ella: sin lo primero, una
 * fila más ancha que la pantalla estira la columna y con ella la página, que es la trampa
 * de `min-width:auto` de las rejillas —ya costó una barra horizontal en todo el sitio el
 * 2026-08-18—.
 */
function IndiceEnFila({ temas }: { temas: NonNullable<Acceso['temas']> }) {
  return (
    <nav aria-label="Preguntas de esta sección" className="alternativa-estrecha mt-6 min-w-0">
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {temas.map((t) => (
          <li key={t.id} className="shrink-0">
            <a
              href={`#${t.id}`}
              className="inline-flex items-center rounded-full border border-[var(--linea)] px-3.5 py-1.5
                         text-[13px] text-[var(--suave)] transition-colors
                         hover:border-[#7b5fbf]/55 hover:text-[var(--violeta-txt)]
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b5fbf]/50"
            >
              {t.pregunta}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function ClientesExplorador({
  activa, faqs,
}: {
  /** El `id` de la sección abierta. En `/clientes` es la primera. */
  activa: string;
  /** Las preguntas frecuentes de esa sección, ya leídas en el servidor. */
  faqs: Faq[];
}) {
  const acceso = accesoPorId(activa);
  if (!acceso) return null;
  const temas = acceso.temas ?? [];

  return (
    <ExploradorTresPaneles
      etiquetaIzquierda="Secciones para clientes"
      /* `ancho`: el tercer panel espera a los 1536 px. Antes aparecía a 1024 y dejaba las
         tarjetas de pregunta en 520 px, con los pasos a 116 px de ancho. Ver el porqué
         completo en `.paneles-explorador` (`app/globals.css`). */
      corte="ancho"
      anchoIzquierda="280px"
      anchoDerecha="260px"
      izquierda={<GaleriaSecciones activa={acceso.id} />}
      /* Sin preguntas no se pasa nada: la rejilla vuelve a dos columnas sola. */
      derecha={temas.length > 0 ? <IndicePreguntas temas={temas} /> : undefined}
      centro={
        <>
          {/* El `<h1>` de la página es el nombre de la sección. La página ya no tiene
              titular propio —Fernando quitó «Clientes» y su párrafo el 2026-08-18— y un
              documento sin `<h1>` es un documento sin título para un buscador y para un
              lector de pantalla. */}
          <h1 className="text-[30px] sm:text-[40px] font-semibold tracking-tight text-[var(--texto)] leading-tight">
            {acceso.titulo}
          </h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-[var(--suave)] max-w-3xl">
            {acceso.texto}
          </p>

          {acceso.enlaceExterno && (
            <div className="mt-6">
              <BotonPrimario href={acceso.enlaceExterno.href}>
                {acceso.enlaceExterno.etiqueta} <ArrowRight className="w-4 h-4" />
              </BotonPrimario>
            </div>
          )}

          {temas.length > 0 && <IndiceEnFila temas={temas} />}

          {/* Vídeo. Mientras no haya enlace no se pinta nada: ni hueco ni «próximamente». */}
          {acceso.video && (
            <div className="mt-10 max-w-3xl">
              <VideoYouTube url={acceso.video} titulo={`${acceso.titulo} — ${SITIO.nombre}`} />
            </div>
          )}

          {/* Las preguntas, enteras y una debajo de otra. Cada una con su ancla: el índice
              de la derecha salta aquí, y el título es enlace a sí mismo. */}
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

          {/* Preguntas FRECUENTES — otra cosa que los temas, y por eso van aparte y no
              entran en el índice de la derecha: aquellas explican cómo funciona algo, estas
              resuelven dudas sueltas y se editan desde Admin → FAQs sin tocar código.
              Si no hay ninguna, la sección entera desaparece. */}
          {faqs.length > 0 && (
            <div className="mt-14">
              <h2 className="text-[24px] sm:text-[30px] font-semibold text-[var(--texto)] tracking-tight">
                Preguntas frecuentes
              </h2>
              <div className="mt-6">
                <FaqsClientes faqs={faqs} />
              </div>
            </div>
          )}
        </>
      }
    />
  );
}
