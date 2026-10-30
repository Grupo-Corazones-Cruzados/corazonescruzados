/**
 * UNA SECCIÓN DE DESARROLLO HUMANO — `/desarrollo-humano/<id>`.
 *
 * Gemela de `/clientes/[necesidad]`: **el mismo explorador**, la misma plantilla, el mismo
 * comportamiento. Lo único que cambia es de qué lista salen las secciones y de qué ruta
 * cuelgan, y las dos entran por prop (ver `ExploradorSecciones`).
 *
 * ── A QUIÉN LE HABLA ───────────────────────────────────────────────────────────
 * `/clientes` le habla a quien viene a contratar; esta, a quien viene a **formar parte**.
 * Fernando lo pidió así el 2026-08-19, con la misma interfaz para no obligar a nadie a
 * aprenderse dos formas de leer el mismo sitio.
 *
 * ── SEO ────────────────────────────────────────────────────────────────────────
 * · El `<h1>` es el nombre de la sección, dentro del explorador.
 * · `generateStaticParams` deja las cuatro prerenderizadas.
 * · Un tramo que no exista responde **404 de verdad**.
 * · ⚠️ Aquí viven las páginas que sostienen «condiciología» y «Modelo 4P», que son de las
 *   pocas búsquedas donde este sitio puede ser el mejor resultado y no el número treinta:
 *   nadie más las escribe. Por eso ese contenido tiene ahora **URL propia** en vez de ser un
 *   bloque a media página.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITIO, DESARROLLO, OG_IMAGEN } from '@/lib/sitio/contenido';
import { Contenedor } from '@/components/sitio/piezas';
import { PRESENTACION_DESARROLLO } from '@/components/sitio/presentaciones';
import ExploradorSecciones from '@/components/sitio/ExploradorSecciones';
import { faqsTolerantesAlBuild } from '../../clientes/faqs-build';
import Modelo4P, { ReglasModelo4P } from '@/components/landing/Modelo4P';
import { sinNegritas } from '@/lib/sitio/modeloGcc';

/**
 * Lo que una sección enseña además de sus temas. El Modelo 4P es una TABLA (pisos × pasos) y sus
 * seis reglas: los mismos componentes del formulario de postulación (2026-10-30).
 */
const CONTENIDO_PROPIO: Record<string, React.ReactNode> = {
  'modelo-organizacional-4p': (
    <div className="flex flex-col gap-6">
      <Modelo4P />
      <ReglasModelo4P />
    </div>
  ),
};

type Props = { params: Promise<{ seccion: string }> };

export function generateStaticParams() {
  return DESARROLLO.map((a) => ({ seccion: a.id }));
}

/** Un tramo inventado no debe existir: nada fuera de `DESARROLLO` se renderiza. */
export const dynamicParams = false;

/** Las preguntas frecuentes salen de la base y se editan en Admin → FAQs. */
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seccion } = await params;
  const a = DESARROLLO.find((x) => x.id === seccion);
  if (!a) return {};

  return {
    title: a.titulo,
    description: a.texto,
    alternates: { canonical: `/desarrollo-humano/${a.id}` },
    openGraph: {
      title: `${a.titulo} — ${SITIO.nombre}`,
      description: a.texto,
      url: `${SITIO.url}/desarrollo-humano/${a.id}`,
      type: 'website',
      locale: 'es_EC',
      images: [OG_IMAGEN],
    },
  };
}

export default async function SeccionDesarrolloPage({ params }: Props) {
  const { seccion } = await params;
  const acceso = DESARROLLO.find((x) => x.id === seccion);
  if (!acceso) notFound();

  const faqs = await faqsTolerantesAlBuild(acceso.id);

  return (
    <>
      {/* `pb-40 sm:pb-56` no es aire decorativo: es sitio para desplazarse, para que la
          ÚLTIMA pregunta pueda colocarse a 96 px del borde cuando se llega por su ancla. Ver
          el aviso completo en `/clientes/[necesidad]`. */}
      <section className="flex-1 overflow-x-clip pt-6 sm:pt-10 pb-40 sm:pb-56">
        <Contenedor ancho="sitio">
          <ExploradorSecciones
            secciones={DESARROLLO}
            activa={acceso.id}
            faqs={faqs}
            base="/desarrollo-humano"
            rotulo="Desarrollo humano"
            presentacion={PRESENTACION_DESARROLLO}
            etiquetaNav="Secciones de desarrollo humano"
          >
            {CONTENIDO_PROPIO[acceso.id]}
          </ExploradorSecciones>
        </Contenedor>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: SITIO.nombre, item: SITIO.url },
              {
                '@type': 'ListItem', position: 2, name: 'Desarrollo Humano',
                item: `${SITIO.url}/desarrollo-humano`,
              },
              {
                '@type': 'ListItem', position: 3, name: acceso.titulo,
                item: `${SITIO.url}/desarrollo-humano/${acceso.id}`,
              },
            ],
          }),
        }}
      />

      {/* Las preguntas de la sección, en el formato que un buscador lee sin interpretar el
          diseño. Un tema sin respuesta escrita no se declara: sería una pregunta sin
          respuesta, que es un dato falso. */}
      {(() => {
        const preguntas = [
          ...(acceso.temas ?? [])
            .filter((t) => t.texto)
            .map((t) => ({ name: t.pregunta, text: sinNegritas(t.texto as string).replace(/\n{2,}/g, ' ') })),
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
