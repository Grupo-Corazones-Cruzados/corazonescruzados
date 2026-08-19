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
 * ⚠️ **Democracia no tiene preguntas todavía, y es deliberado**: su módulo no existe y su
 * frase choca con lo que `MEMORIA.md` recoge como principio del proyecto. El motivo entero
 * está escrito junto a su entrada en `ACCESOS` (`lib/sitio/contenido.ts`).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITIO, ACCESOS, OG_IMAGEN, accesoPorId } from '@/lib/sitio/contenido';
import { Contenedor } from '@/components/sitio/piezas';
import ClientesExplorador from '@/components/sitio/ClientesExplorador';
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
          un contenedor de scroll y rompería el salto a las anclas de las preguntas. */}
      <section className="flex-1 overflow-x-clip bg-[var(--tarjeta)] py-10 sm:py-14">
        <Contenedor ancho="amplio">
          <ClientesExplorador activa={acceso.id} faqs={faqs} />
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

      {/* ⭐ `FAQPage` — de todo lo que se ha hecho por el posicionamiento, esto es lo que más
          puede rendir. Es el formato que Google convierte en **respuestas desplegables dentro
          de sus propios resultados**: ocupa más sitio en la página, se lee sin entrar y
          responde justo lo que alguien tecleó.

          ⚠️ Declara las preguntas frecuentes **y también los temas de la sección**, que son
          preguntas de verdad con su respuesta escrita — es justo lo que este formato pide.
          Solo se declara si hay alguna: un `FAQPage` vacío es un dato falso. */}
      {(() => {
        const preguntas = [
          ...(acceso.temas ?? []).map((t) => ({ name: t.pregunta, text: t.texto })),
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
