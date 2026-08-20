/**
 * CLIENTES — la portada de la sección comercial.
 *
 * ⚠️ Se llamó «Negocios» (`/negocio`) y luego «Soluciones» (`/soluciones`). Desde el
 * 2026-08-18 es **«Clientes»** en `/clientes`: el nombre «Soluciones» pasó a la página de
 * las soluciones, que es donde Fernando quería ese contenido. Las rutas viejas redirigen.
 *
 * ── QUÉ ES DESDE EL 2026-08-18 ─────────────────────────────────────────────────
 * Un explorador de tres paneles, como pidió Fernando: las cuatro secciones en galería
 * vertical a la izquierda, el contenido de la abierta en el centro, y sus preguntas a la
 * derecha. **Se fueron el titular «Clientes» y su párrafo** —lo pidió él— y con ellos la
 * rejilla horizontal de tarjetas que se repetía en las cinco rutas (`CabeceraClientes`,
 * borrada; sigue en el historial).
 *
 * ⚠️ **Esta portada abre la PRIMERA sección**, igual que `/soluciones` abre el primer
 * talento. Es lo que evita que la página de entrada se vea a medias, pero significa que
 * `/clientes` y `/clientes/requerimientos` enseñan lo mismo. Cada una declara su propio
 * `canonical` y su propio título; si algún día conviene, la portada puede pasar a redirigir.
 *
 * ── QUÉ SE QUITÓ EL 2026-08-04, Y QUE CONSTE ───────────────────────────────────
 * Fernando pidió vaciar todo lo que había debajo de las tarjetas: servicios por públicos,
 * precios, el apartado de WhatsApp, el alta de cliente y **la identidad legal**.
 *
 * ⚠️ **La identidad legal se quitó sabiendo lo que era.** Esta es la URL declarada a Meta,
 * su verificación se rechazó una vez con «no puede determinar que pertenezca a un negocio
 * real», y este archivo llevaba un aviso escrito de que esa sección no podía faltar. Se le
 * advirtió y decidió quitarla. **Si Meta vuelve a rechazar la verificación, esto es lo
 * primero que hay que mirar.**
 *
 * ⚠️⚠️ **Y EL 2026-08-20 EMPEORÓ:** Fernando borró también `/contacto`, que era la otra
 * página con la identidad y la única con teléfono, correo y dirección juntos. Hoy el RUC y
 * los correos **solo están en `/legal`**, y el domicilio y el teléfono **no están en ninguna
 * página visible** —siguen en los datos estructurados de esta y en `SITIO`, nada más—. Se le
 * advirtió antes de borrarla. Si hay que rehacer la verificación, el camino corto es
 * recuperar aquella página: `git show 4c44581:'app/(sitio)/contacto/page.tsx'`.
 *
 * El texto de los servicios NO se ha borrado: sigue en `SERVICIOS`
 * (`lib/sitio/contenido.ts`), listo para repartirse entre las secciones cuando Fernando
 * dicte qué va en cada una.
 *
 * ── LAS REGLAS QUE SIGUEN EN PIE ───────────────────────────────────────────────
 * 1. **Server Component, sin `use client`** — y ahora el explorador tampoco lo lleva, así
 *    que las cuatro secciones enteras están en el HTML crudo.
 * 2. **Nada que no sea verificable.** Sin cifras de clientes ni años de experiencia.
 * 3. **El texto vive en `lib/sitio/contenido.ts`**, no aquí.
 */

import type { Metadata } from 'next';
import { SITIO, ACCESOS, REDES, OG_IMAGEN } from '@/lib/sitio/contenido';
import { Contenedor } from '@/components/sitio/piezas';
import ExploradorSecciones from '@/components/sitio/ExploradorSecciones';
import { faqsTolerantesAlBuild } from './faqs-build';

/** Las preguntas frecuentes salen de la base y se editan en Admin → FAQs. Ver la página hija. */
export const revalidate = 300;

export const metadata: Metadata = {
  /**
   * El nombre de la pestaña. Aquí va solo esa palabra porque la plantilla de
   * `app/layout.tsx` le añade « · Grupo Corazones Cruzados» — que es lo que hace que en un
   * resultado de Google se sepa de quién es la página.
   */
  title: 'Clientes',
  description:
    'Grupo Corazones Cruzados es un proyecto de desarrollo humano de Guayaquil, Ecuador: tickets y proyectos, el videojuego GCC World, el marketplace y la votación de mejoras.',
  alternates: { canonical: '/clientes' },
  openGraph: {
    title: `${SITIO.nombre} — Qué puedes hacer aquí`,
    description:
      'Tickets y proyectos, el videojuego GCC World, el marketplace y la votación de mejoras.',
    url: `${SITIO.url}/clientes`,
    type: 'website',
    locale: 'es_EC',
    images: [OG_IMAGEN],
  },
};

export default async function ClientesPage() {
  // La primera sección, como `/soluciones` abre el primer talento: una página de entrada
  // que arranca vacía obliga a adivinar que hay que pulsar algo.
  const primera = ACCESOS[0];
  const faqs = await faqsTolerantesAlBuild(primera.id);

  return (
    <>
      {/* `flex-1`: la sección ocupa TODO el alto que sobre. Con poco contenido, su fondo
          blanco terminaba donde terminaba el contenido y debajo asomaba el papel `#f6f5f9`
          de la página — un cambio de color a media pantalla. Un solo color, como pidió
          Fernando (2026-08-18). */}
      <section className="flex-1 bg-[var(--tarjeta)] py-10 sm:py-14">
        <Contenedor ancho="amplio">
          <ExploradorSecciones
            secciones={ACCESOS}
            activa={primera.id}
            faqs={faqs}
            base="/clientes"
            rotulo="Clientes"
            etiquetaNav="Secciones para clientes"
          />
        </Contenedor>
      </section>

      {/* Datos estructurados: le dan al buscador la lectura de que esto es una organización
          real con dirección, teléfono e identificador fiscal, y le enumeran las páginas de
          dentro para que las descubra sin depender del mapa del sitio. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfessionalService',
            name: SITIO.nombre,
            legalName: SITIO.razonSocial,
            taxID: SITIO.ruc,
            url: `${SITIO.url}/clientes`,
            sameAs: [...REDES],
            email: SITIO.correo,
            telephone: SITIO.telefonoPlano,
            address: {
              '@type': 'PostalAddress',
              streetAddress: SITIO.direccion,
              addressLocality: SITIO.ciudad,
              addressCountry: 'EC',
            },
            areaServed: 'EC',
            description:
              'Proyecto de desarrollo humano que ofrece soluciones para las necesidades individuales y grupales de sus colaboradores, en función de resolver determinadas problemáticas sociales, teniendo como meta final la unión del mundo.',
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name: 'Lo que ofrecemos',
              itemListElement: ACCESOS.map((a) => ({
                '@type': 'Offer',
                url: `${SITIO.url}/clientes/${a.id}`,
                itemOffered: { '@type': 'Service', name: a.titulo, description: a.texto },
              })),
            },
          }),
        }}
      />
    </>
  );
}
