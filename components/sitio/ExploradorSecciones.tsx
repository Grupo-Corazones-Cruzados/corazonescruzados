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
 */

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { SITIO, type Acceso } from '@/lib/sitio/contenido';
import type { Faq } from '@/lib/faqs';
import { BloqueTema, ExploradorTresPaneles, ICONOS } from './piezas';
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
function GaleriaSecciones({
  secciones, activa, base, rotulo,
}: {
  secciones: Acceso[]; activa: string; base: string; rotulo: string;
}) {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--tenue)] mb-3">
        {rotulo}
      </p>
      <ul className="space-y-2">
        {secciones.map((a) => {
          const abierta = a.id === activa;
          const Icono = ICONOS[a.icono] ?? ICONOS.capas;
          return (
            <li
              key={a.id}
              /**
               * ⚠️ `relative` Y LA TARJETA YA NO ES UN `<Link>`, Y ES OBLIGADO.
               *
               * Lo era: un enlace envolvía toda la tarjeta. Al pedir Fernando un botón «Ir»
               * dentro (2026-08-19) eso dejó de valer — **un `<a>` dentro de otro `<a>` es
               * marcado inválido**: el navegador lo desarma y uno de los dos deja de
               * funcionar. Es el mismo motivo por el que el botón grande vivía en el
               * contenido y no en la tarjeta, hasta que dejó de haber ninguno (2026-08-20).
               *
               * La solución es el enlace estirado: el `<Link>` envuelve **solo el título** —de
               * ahí saca su nombre accesible— y su `::after` se extiende sobre toda la
               * tarjeta, así que pulsar en cualquier parte sigue navegando a la sección. El
               * botón «Ir» se pone por encima con `relative z-10` y recibe sus propios clics.
               */
              className={`relative rounded-xl border p-3.5 transition-colors
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
                <Link
                  href={`${base}/${a.id}`}
                  aria-current={abierta ? 'page' : undefined}
                  className={`text-[14.5px] font-semibold leading-snug rounded-sm
                              after:absolute after:inset-0 after:rounded-xl
                              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b5fbf]/50
                    ${abierta ? 'text-[var(--violeta-txt)]' : 'text-[var(--texto)]'}`}
                >
                  {a.titulo}
                </Link>
              </span>

              {/* La frase, más apagada: en la abierta ya la repite el centro, pero quitarla
                  solo de esa haría que la tarjeta cambiara de alto al elegirla y la lista
                  entera daría un salto. */}
              <span className="mt-2 block text-[12.5px] leading-relaxed text-[var(--tenue)]">
                {a.texto}
              </span>

              {/* ── EL BOTÓN DE ACCIÓN ──────────────────────────────────────────────
                  Solo si la sección tiene a dónde mandar: Democracia no lo pinta, y no deja
                  hueco. `relative z-10` lo levanta por encima del enlace estirado de arriba;
                  sin eso, pulsarlo navegaría a la sección en vez de abrir el acceso.

                  Es un `<a>` de toda la vida —no un botón con JavaScript— y por eso este
                  componente sigue sin `use client`: lleva a una «puerta con nombre» que
                  redirige al único formulario de acceso, el de la portada. */}
              {a.accion && (
                <Link
                  href={a.accion.href}
                  className="relative z-10 mt-3 inline-flex items-center gap-1 rounded-md
                             border border-[#7b5fbf]/40 bg-[#7b5fbf]/[0.06] px-2.5 py-1
                             text-[12px] font-medium text-[var(--violeta-txt)] transition-colors
                             hover:border-[#7b5fbf]/70 hover:bg-[#7b5fbf]/[0.12]
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b5fbf]/50"
                >
                  {a.accion.etiqueta}
                  <ArrowRight className="w-3 h-3" aria-hidden />
                </Link>
              )}
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
 * Solo existe si la sección tiene preguntas; si no, `ExploradorSecciones` no lo pasa y la
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

export default function ExploradorSecciones({
  secciones, activa, faqs, base, rotulo, etiquetaNav,
}: {
  /** Las secciones del panel izquierdo. `ACCESOS` en `/clientes`, `DESARROLLO` en la otra. */
  secciones: Acceso[];
  /** El `id` de la sección abierta. En la portada de cada rama es la primera. */
  activa: string;
  /** Las preguntas frecuentes de esa sección, ya leídas en el servidor. */
  faqs: Faq[];
  /** La ruta de la que cuelgan las secciones: `/clientes` o `/desarrollo-humano`. */
  base: string;
  /** El rótulo en versalitas sobre la galería. */
  rotulo: string;
  /** El `aria-label` del `<nav>` izquierdo. */
  etiquetaNav: string;
}) {
  const acceso = secciones.find((a) => a.id === activa);
  if (!acceso) return null;
  const temas = acceso.temas ?? [];

  return (
    <ExploradorTresPaneles
      etiquetaIzquierda={etiquetaNav}
      /* `ancho`: el tercer panel espera a los 1536 px. Antes aparecía a 1024 y dejaba las
         tarjetas de pregunta en 520 px, con los pasos a 116 px de ancho. Ver el porqué
         completo en `.paneles-explorador` (`app/globals.css`). */
      corte="ancho"
      anchoIzquierda="280px"
      anchoDerecha="260px"
      izquierda={<GaleriaSecciones secciones={secciones} activa={acceso.id} base={base} rotulo={rotulo} />}
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
          {/* La descripción LARGA si la sección la tiene; si no, su frase corta. Son dos
              campos distintos a propósito: `texto` va también en la tarjeta del panel
              izquierdo y en la descripción de la pestaña, donde un párrafo de cinco frases
              haría daño. Ver el aviso en `Acceso` (`lib/sitio/contenido.ts`). */}
          <p className="mt-3 text-[15.5px] leading-relaxed text-[var(--suave)] max-w-3xl whitespace-pre-line">
            {acceso.descripcion ?? acceso.texto}
          </p>


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
