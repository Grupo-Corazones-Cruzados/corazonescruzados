/**
 * SOLUCIONES — la portada de la sección comercial.
 *
 * ── QUÉ ES AHORA ───────────────────────────────────────────────────────────────
 * El titular, el subtítulo y **cinco puertas**. Nada más. Cada tarjeta lleva a su propia
 * página (`/soluciones/<id>`), donde el detalle aparece **debajo de las mismas tarjetas**,
 * con la suya marcada.
 *
 * ── SE LLAMABA `/negocio` HASTA EL 2026-08-17 ──────────────────────────────────
 * Fernando lo reconsideró: la sección se llama **Soluciones** en el titular, en la pestaña,
 * en el menú y en la URL. Las seis rutas viejas (`/negocio` y sus cinco hijas) siguen vivas
 * como **redirección permanente 301** en `next.config.ts`, para no romper ningún enlace ya
 * publicado ni tirar lo que esas URLs hubieran posicionado.
 *
 * ⚠️ **`/negocio` es la URL declarada a Meta** para la verificación de proveedor de
 * tecnología. La redirección evita el 404, pero **hay que actualizarla en el formulario de
 * Meta** a `/soluciones`.
 *
 * ── QUÉ SE QUITÓ EL 2026-08-04, Y QUE CONSTE ───────────────────────────────────
 * Fernando pidió vaciar todo lo que había debajo de las tarjetas: servicios por públicos,
 * precios, el apartado de WhatsApp, el alta de cliente y **la identidad legal**.
 *
 * ⚠️ **La identidad legal se quitó sabiendo lo que era.** Esta es la URL declarada a Meta,
 * su verificación se rechazó una vez con «no puede determinar que pertenezca a un negocio
 * real», y este archivo llevaba un aviso escrito de que esa sección no podía faltar. Se le
 * advirtió y decidió quitarla: sigue estando en `/contacto` y en `/legal`, y avisó de que
 * también la quitará de `/contacto`. **Si Meta vuelve a rechazar la verificación, esto es
 * lo primero que hay que mirar.**
 *
 * El texto de los servicios NO se ha borrado: sigue en `SERVICIOS`
 * (`lib/sitio/contenido.ts`), listo para repartirse entre las cinco páginas cuando Fernando
 * dicte qué va en cada una.
 *
 * ── LAS REGLAS QUE SIGUEN EN PIE ───────────────────────────────────────────────
 * 1. **Server Component, sin `use client`.** Tiene que estar en el HTML crudo: un buscador
 *    y un revisor pueden no ejecutar JavaScript.
 * 2. **Nada que no sea verificable.** Sin cifras de clientes ni años de experiencia.
 * 3. **El texto vive en `lib/sitio/contenido.ts`**, no aquí.
 */

import type { Metadata } from 'next';
import { SITIO, ACCESOS, REDES, OG_IMAGEN } from '@/lib/sitio/contenido';
import CabeceraSoluciones from '@/components/sitio/CabeceraSoluciones';

export const metadata: Metadata = {
  /**
   * El nombre de la pestaña, decidido por Fernando el 2026-08-17: **«Soluciones»**.
   * Aquí va solo esa palabra porque la plantilla de `app/layout.tsx` le añade
   * « · Grupo Corazones Cruzados» — que es lo que hace que en un resultado de Google se
   * sepa de quién es la página, y no compita a ciegas con las miles que se llaman igual.
   */
  title: 'Soluciones',
  description:
    'Grupo Corazones Cruzados es un proyecto de desarrollo humano de Guayaquil, Ecuador: tickets y proyectos, automatización con agentes de IA, el videojuego GCC World, el marketplace y la votación de mejoras.',
  alternates: { canonical: '/soluciones' },
  openGraph: {
    title: `${SITIO.nombre} — Qué puedes hacer aquí`,
    description:
      'Tickets y proyectos, automatización con agentes de IA, el videojuego GCC World, el marketplace y la votación de mejoras.',
    url: `${SITIO.url}/soluciones`,
    type: 'website',
    locale: 'es_EC',
    images: [OG_IMAGEN],
  },
};

export default function SolucionesPage() {
  return (
    <>
      <CabeceraSoluciones />

      {/* Datos estructurados: le dan al buscador la lectura de que esto es una organización
          real con dirección, teléfono e identificador fiscal, y le enumeran las cinco
          páginas de dentro para que las descubra sin depender del mapa del sitio. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfessionalService',
            name: SITIO.nombre,
            legalName: SITIO.razonSocial,
            taxID: SITIO.ruc,
            url: `${SITIO.url}/soluciones`,
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
                url: `${SITIO.url}/soluciones/${a.id}`,
                itemOffered: { '@type': 'Service', name: a.titulo, description: a.texto },
              })),
            },
          }),
        }}
      />
    </>
  );
}
