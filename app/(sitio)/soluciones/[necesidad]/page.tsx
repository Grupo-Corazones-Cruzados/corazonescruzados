/**
 * EL DETALLE DE UNA PUERTA — `/soluciones/<id>`.
 *
 * Una sola plantilla para las cinco páginas. Todas pintan **la misma cabecera con las mismas
 * tarjetas**, con la suya marcada, y debajo su detalle. Así, pulsar una tarjeta no cambia de
 * escenario: cambia lo que hay debajo, y las otras cuatro puertas siguen a la vista.
 *
 * ⚠️ Estas cinco rutas colgaban de `/negocio/<id>` hasta el 2026-08-17. Las viejas siguen
 * vivas como **redirección permanente (308)** en `next.config.ts`.
 *
 * ── CÓMO SE COMPORTA ───────────────────────────────────────────────────────────
 * · **Se llega pulsando o escribiendo la URL**, indistintamente. No hay estado que
 *   sincronizar: la ruta ES el estado.
 * · **Al pulsar desde `/soluciones`, la página baja sola hasta el detalle.** Lo hace el
 *   `#detalle` del enlace de la tarjeta, no JavaScript. El `scroll-mt-24` deja aire para que
 *   el título no quede tapado por la cabecera fija.
 * · **Aparece con una transición.** La clase `.aparece-detalle` (en `app/globals.css`) y un
 *   `key` con el `id`, que fuerza a React a volver a montar el bloque al cambiar de puerta —
 *   sin `key`, React reaprovecha el nodo y la animación no se repetiría.
 *
 * ── SEO ────────────────────────────────────────────────────────────────────────
 * · El `<h1>` de esta página es **el título del detalle**, no el de la sección. Si las
 *   cinco compartieran encabezado, ninguna diría de qué va (por eso `CabeceraSoluciones`
 *   baja su titular a `<p>` cuando hay una puerta abierta).
 * · `generateStaticParams` deja las cinco **prerenderizadas**: se sirven como HTML estático.
 * · Un tramo que no exista responde **404 de verdad**, no una página vacía.
 *
 * ⚠️ El contenido de cada página está **por escribir**: Fernando dio los títulos y dijo que
 * luego dictaría qué va dentro. Hasta entonces, cada una muestra su título y su frase.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { SITIO, ACCESOS, OG_IMAGEN, accesoPorId } from '@/lib/sitio/contenido';
import { faqsDeAcceso, type Faq } from '@/lib/faqs';
import CabeceraSoluciones from '@/components/sitio/CabeceraSoluciones';
import VideoYouTube from '@/components/sitio/VideoYouTube';
import FaqsSoluciones from '@/components/sitio/FaqsSoluciones';
import { Contenedor, BloqueTema, BotonPrimario } from '@/components/sitio/piezas';
import GaleriaTarjetas from '@/components/sitio/GaleriaTarjetas';

type Props = { params: Promise<{ necesidad: string }> };

export function generateStaticParams() {
  return ACCESOS.map((a) => ({ necesidad: a.id }));
}

/** Un tramo inventado no debe existir: nada fuera de `ACCESOS` se renderiza. */
export const dynamicParams = false;

/**
 * ⏱️ SE REGENERA CADA 5 MINUTOS, Y ES IMPRESCINDIBLE.
 *
 * La página se sirve como HTML ya hecho —rápido y perfectamente indexable—, pero **las
 * preguntas frecuentes salen de la base de datos**. Sin esto, una pregunta creada desde
 * Admin → FAQs **no aparecería en la web hasta el siguiente despliegue**, y nadie
 * entendería por qué: la habría guardado bien y no estaría.
 *
 * Cinco minutos es el punto medio razonable: no obliga a montar nada extra y quien escribe
 * ve su cambio publicado dentro del mismo rato en que sigue trabajando.
 */
export const revalidate = 300;

/**
 * LAS PREGUNTAS, TOLERANDO QUE LA BASE NO CONTESTE **DURANTE EL BUILD**.
 *
 * Al prerenderizarse, esta página convierte una consulta a Postgres en **requisito de
 * compilación**: si la base no responde mientras corre `next build`, no se cae la página —
 * se cae el despliegue entero. Ya pasó el 2026-08-04, y de la forma más confusa posible:
 * el servicio `agente-worker`, que comparte repo con la app, heredaba su build y acumuló
 * **20 despliegues fallidos** por no tener `DATABASE_URL` (ver MEMORIA.md → Lecciones).
 *
 * Un despliegue no debería depender de que la base esté en pie. Así que **solo en el
 * build**, un fallo deja la página sin preguntas en vez de abortar: el `revalidate` de
 * arriba la regenera con las preguntas de verdad dentro de los cinco minutos siguientes,
 * de modo que el hueco se cierra solo y sin intervención.
 *
 * ⚠️ **En ejecución no se traga nada.** El error sube, Next sigue sirviendo la última
 * versión buena y reintenta en la siguiente revalidación. Devolver «no hay preguntas»
 * cuando lo que hay es una base caída es exactamente el fallo que ya costó una
 * investigación entera —el `catch` de `/api/projects` que fingía cero proyectos—, y aquí no
 * se repite: el silencio dura lo que dura un build y queda escrito en su registro.
 */
async function faqsTolerantesAlBuild(accesoId: string): Promise<Faq[]> {
  if (process.env.NEXT_PHASE !== 'phase-production-build') return faqsDeAcceso(accesoId);

  try {
    return await faqsDeAcceso(accesoId);
  } catch (e) {
    console.warn(
      `⚠ Las FAQs de «${accesoId}» no se pudieron leer durante el build: ${(e as Error).message}\n` +
        '  La página se prerenderiza sin ellas; la primera revalidación (5 min) las traerá.',
    );
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { necesidad } = await params;
  const acceso = accesoPorId(necesidad);
  if (!acceso) return {};

  return {
    title: acceso.titulo,
    description: acceso.texto,
    alternates: { canonical: `/soluciones/${acceso.id}` },
    openGraph: {
      title: `${acceso.titulo} — ${SITIO.nombre}`,
      description: acceso.texto,
      url: `${SITIO.url}/soluciones/${acceso.id}`,
      type: 'website',
      locale: 'es_EC',
      images: [OG_IMAGEN],
    },
  };
}

export default async function DetalleNecesidadPage({ params }: Props) {
  const { necesidad } = await params;
  const acceso = accesoPorId(necesidad);
  if (!acceso) notFound();

  // Se leen en el servidor, al generar la página: las preguntas y sus respuestas viajan ya
  // escritas dentro del HTML. Si se pidieran por red desde el navegador, el buscador —que es
  // para quien más valen— no las vería.
  const faqs = await faqsTolerantesAlBuild(acceso.id);

  return (
    <>
      <CabeceraSoluciones activa={acceso.id} />

      <section
        id="detalle"
        key={acceso.id}
        // `overflow-x-clip`: la tira de tarjetas de Automatización se sale a lo ancho de la
        // ventana, y `100vw` incluye la barra de desplazamiento. Sin esto, la página entera
        // ganaría una barra horizontal. Se usa `clip` y NO `hidden` porque `hidden` crearía
        // un contenedor de scroll y rompería el salto a las anclas de los temas.
        className="aparece-detalle scroll-mt-24 overflow-x-clip border-t border-[var(--linea)] bg-[var(--tarjeta)] py-16 sm:py-20"
      >
        <Contenedor>
          {/* ── EL TITULAR DE LA PUERTA, SOLO SI HACE FALTA ─────────────────────────
              Repetía lo que ya dicen la tarjeta abierta de arriba —que ahora lleva el `<h1>`
              de la página— y su propia frase. Fernando lo quitó de Automatización el
              2026-08-06; la bandera deja hacer lo mismo en las demás cuando toque. */}
          {!acceso.sinTitular && (
            <>
              <p className="text-[30px] sm:text-[40px] leading-[1.12] font-semibold text-[var(--texto)] tracking-tight">
                {acceso.titulo}
              </p>
              <p className="mt-5 text-[17px] leading-relaxed text-[var(--suave)] max-w-3xl">
                {acceso.texto}
              </p>
            </>
          )}

          {/* Era un `<a>` con las clases de `BotonPrimario` copiadas a mano. Se vio al pasar
              el sitio a claro: la copia se quedaba con el color viejo mientras el botón de
              verdad ya había cambiado. Ahora usa la pieza, que es la única definición. */}
          {acceso.enlaceExterno && (
            <div className="mt-8">
              <BotonPrimario href={acceso.enlaceExterno.href}>
                {acceso.enlaceExterno.etiqueta} <ArrowRight className="w-4 h-4" />
              </BotonPrimario>
            </div>
          )}

          {/* Vídeo. Mientras no haya enlace no se pinta nada: ni hueco ni «próximamente». */}
          {acceso.video && (
            <div className="mt-12 max-w-3xl">
              <VideoYouTube url={acceso.video} titulo={`${acceso.titulo} — ${SITIO.nombre}`} />
            </div>
          )}

          {/* Los temas. Van DESPUÉS del vídeo y ANTES de las preguntas, como pidió
              Fernando: primero se ve, luego se entiende, y al final se resuelven las dudas.
              Cada uno tiene su ancla —`#<id>`— y su título es un enlace a sí mismo, para
              poder mandar a alguien directo al tema que responde su duda.
              Sin temas, no se pinta nada. */}
          {acceso.temas?.map((t) => (
            <div key={t.id} className="mt-14">
              <BloqueTema {...t} />
            </div>
          ))}

          {/* La galería, para las puertas que enumeran en vez de explicar un flujo. */}
          {acceso.galeria && (
            <div className="mt-14">
              <GaleriaTarjetas {...acceso.galeria} />
            </div>
          )}

          {/* Preguntas frecuentes. Igual: si no hay ninguna, la sección entera desaparece. */}
          {faqs.length > 0 && (
            <div className="mt-16">
              <h2 className="text-[24px] sm:text-[30px] font-semibold text-[var(--texto)] tracking-tight">
                Preguntas frecuentes
              </h2>
              <div className="mt-8">
                <FaqsSoluciones faqs={faqs} />
              </div>
            </div>
          )}
        </Contenedor>
      </section>

      {/* Migas de pan para el buscador: le dicen que esta página cuelga de `/soluciones` y
          no es una URL suelta. Es lo que hace que en los resultados salga la ruta en vez de
          una dirección pelada. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: SITIO.nombre, item: SITIO.url },
              { '@type': 'ListItem', position: 2, name: 'Soluciones', item: `${SITIO.url}/soluciones` },
              {
                '@type': 'ListItem', position: 3, name: acceso.titulo,
                item: `${SITIO.url}/soluciones/${acceso.id}`,
              },
            ],
          }),
        }}
      />

      {/* ⭐ `FAQPage` — de todo lo que se ha hecho por el posicionamiento, esto es lo que más
          puede rendir. Es el formato que Google convierte en **respuestas desplegables dentro
          de sus propios resultados**: ocupa más sitio en la página, se lee sin entrar y
          responde justo lo que alguien tecleó.
          Solo se declara si hay preguntas de verdad: un `FAQPage` vacío es un dato falso. */}
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqs.map((f) => ({
                '@type': 'Question',
                name: f.pregunta,
                acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
              })),
            }),
          }}
        />
      )}
    </>
  );
}
