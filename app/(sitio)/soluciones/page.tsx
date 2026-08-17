/**
 * NEGOCIO — la portada de la sección comercial.
 *
 * ── QUÉ ES AHORA ───────────────────────────────────────────────────────────────
 * El titular, el subtítulo y **cinco puertas**. Nada más. Cada tarjeta lleva a su propia
 * página (`/negocio/<id>`), donde el detalle aparece **debajo de las mismas tarjetas**, con
 * la suya marcada.
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
import CabeceraNegocio from '@/components/sitio/CabeceraNegocio';

export const metadata: Metadata = {
  title: 'Qué hacemos — un proyecto de desarrollo humano y sus servicios',
  description:
    'Grupo Corazones Cruzados es un proyecto de desarrollo humano de Guayaquil, Ecuador: tickets y proyectos, automatización con agentes de IA, el videojuego GCC World, el marketplace y la votación de mejoras.',
  alternates: { canonical: '/negocio' },
  openGraph: {
    title: `${SITIO.nombre} — Qué puedes hacer aquí`,
    description:
      'Tickets y proyectos, automatización con agentes de IA, el videojuego GCC World, el marketplace y la votación de mejoras.',
    url: `${SITIO.url}/negocio`,
    type: 'website',
    locale: 'es_EC',
    images: [OG_IMAGEN],
  },
};

export default function NegocioPage() {
  return (
    <>
      <CabeceraNegocio />

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
            url: `${SITIO.url}/negocio`,
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
                url: `${SITIO.url}/negocio/${a.id}`,
                itemOffered: { '@type': 'Service', name: a.titulo, description: a.texto },
              })),
            },
          }),
        }}
      />
    </>
  );
}
