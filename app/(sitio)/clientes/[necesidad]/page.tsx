/**
 * EL DETALLE DE UNA SECCIÓN — `/clientes/<id>`.
 *
 * Una sola plantilla para las cuatro. Todas pintan **el mismo explorador de tres paneles**,
 * con su sección marcada en la galería de la izquierda: pulsar otra no cambia de escenario,
 * cambia el centro y la derecha, y las demás siguen a la vista.
 *
 * ⚠️ Estas rutas colgaban de `/negocio/<id>` hasta el 2026-08-17. Las viejas siguen vivas
 * como **redirección permanente (308)** en `next.config.ts`.
 *
 * ── CÓMO SE COMPORTA ───────────────────────────────────────────────────────────
 * · **Se llega pulsando o escribiendo la URL**, indistintamente. No hay estado que
 *   sincronizar: la ruta ES el estado, y por eso el explorador no necesita `use client`.
 * · **El panel derecho lista las preguntas de la sección** y salta a ellas con anclas.
 *
 * ── SEO ────────────────────────────────────────────────────────────────────────
 * · El `<h1>` es **el nombre de la sección**, dentro del explorador. Si las cuatro
 *   compartieran encabezado, ninguna diría de qué va.
 * · `generateStaticParams` deja las cuatro **prerenderizadas**: se sirven como HTML estático.
 * · Un tramo que no exista responde **404 de verdad**, no una página vacía.
 *
 * Las cuatro secciones tienen ya sus preguntas. Si alguna se quedara sin ellas, su panel
 * derecho simplemente no se pinta y la rejilla vuelve a dos columnas — no deja hueco.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITIO, ACCESOS, OG_IMAGEN, accesoPorId } from '@/lib/sitio/contenido';
import { Contenedor } from '@/components/sitio/piezas';
import { ACCESOS as SECCIONES } from '@/lib/sitio/contenido';
import ExploradorSecciones from '@/components/sitio/ExploradorSecciones';
import { faqsTolerantesAlBuild } from '../faqs-build';

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
 */
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { necesidad } = await params;
  const acceso = accesoPorId(necesidad);
  if (!acceso) return {};

  return {
    title: acceso.titulo,
    description: acceso.texto,
    alternates: { canonical: `/clientes/${acceso.id}` },
    openGraph: {
      title: `${acceso.titulo} — ${SITIO.nombre}`,
      description: acceso.texto,
      url: `${SITIO.url}/clientes/${acceso.id}`,
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
      {/* `flex-1` y el mismo fondo que la portada: sin él, con una sección corta el blanco
          terminaba a media pantalla y debajo asomaba el papel de la página.
          `overflow-x-clip`: una galería que se sale a lo ancho de la ventana daría barra
          horizontal a la página entera. Se usa `clip` y NO `hidden` porque `hidden` crearía
          un contenedor de scroll y rompería el salto a las anclas de las preguntas.

          ⚠️ **`pb-40` NO es aire decorativo: es sitio para desplazarse.** Un enlace con ancla
          deja el bloque a 96 px del borde (`scroll-mt-24`, para que la cabecera fija no lo
          tape), pero eso solo puede cumplirse si por debajo queda página que recorrer. Sin
          este margen, la ÚLTIMA pregunta de cada sección se quedaba a 33-64 px del borde
          —medido— porque el navegador ya no tenía a dónde bajar, y el título se acercaba
          demasiado a la cabecera. Es el mismo motivo por el que los sitios de documentación
          llevan un hueco al final. */}
      <section className="flex-1 overflow-x-clip bg-[var(--tarjeta)] pt-10 sm:pt-14 pb-40 sm:pb-56">
        <Contenedor ancho="amplio">
          <ExploradorSecciones
            secciones={SECCIONES}
            activa={acceso.id}
            faqs={faqs}
            base="/clientes"
            rotulo="Clientes"
            etiquetaNav="Secciones para clientes"
          />
        </Contenedor>
      </section>

      {/* Migas de pan para el buscador: le dicen que esta página cuelga de `/clientes` y
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
              { '@type': 'ListItem', position: 2, name: 'Clientes', item: `${SITIO.url}/clientes` },
              {
                '@type': 'ListItem', position: 3, name: acceso.titulo,
                item: `${SITIO.url}/clientes/${acceso.id}`,
              },
            ],
          }),
        }}
      />

      {/* `FAQPage` — declara las preguntas de la sección en un formato que un buscador lee
          sin tener que interpretar el diseño.

          ⚠️ **CORRECCIÓN (2026-08-19): esto NO va a salir como respuestas desplegables en
          Google.** Aquí ponía que era «lo que más puede rendir» de todo el posicionamiento, y
          era falso: en agosto de 2023 Google **restringió los resultados enriquecidos de FAQ a
          sitios oficiales de gobierno y de salud**. Para un sitio como este, el marcado ya no
          produce ese despliegue en los resultados.

          Se mantiene porque **sigue siendo cierto y sigue sirviendo**: le dice al buscador, sin
          ambigüedad, que esta página contiene preguntas con su respuesta. Lo que ya no hay que
          esperar de él es el adorno en los resultados. Lo que de verdad hace que a esta página
          la encuentren es el texto: preguntas en `<h2>`, respuesta debajo, y todo en el HTML.

          Declara las preguntas frecuentes **y también los temas de la sección**. Solo se
          declara si hay alguna: un `FAQPage` vacío es un dato falso. */}
      {(() => {
        // ⚠️ Un tema sin respuesta escrita NO se declara: una pregunta sin su respuesta es
        // un dato falso, y es el caso de Videojuego mientras Fernando no dicte su párrafo.
        const preguntas = [
          ...(acceso.temas ?? [])
            .filter((t) => t.texto)
            .map((t) => ({ name: t.pregunta, text: t.texto as string })),
          ...faqs.map((f) => ({ name: f.pregunta, text: f.respuesta })),
        ];
        if (preguntas.length === 0) return null;
        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: preguntas.map((p) => ({
                  '@type': 'Question',
                  name: p.name,
                  acceptedAnswer: { '@type': 'Answer', text: p.text },
                })),
              }),
            }}
          />
        );
      })()}
    </>
  );
}
