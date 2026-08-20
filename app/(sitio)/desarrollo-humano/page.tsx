/**
 * DESARROLLO HUMANO — la portada de la rama que le habla a miembros y candidatos.
 *
 * ── SE LLAMABA `/recursos` HASTA EL 2026-08-17 ─────────────────────────────────
 * El menú ya decía «Desarrollo Humano» mientras la ruta seguía siendo `/recursos` y el
 * titular «Un proyecto de desarrollo humano»: tres nombres para una página. Fernando los
 * igualó. La ruta vieja redirige con **308 permanente** desde `next.config.ts`.
 *
 * La URL lleva **guion** —`/desarrollo-humano`, no `/desarrollohumano`— porque es como un
 * buscador separa las palabras, y esta es justo la página con la que se quiere aparecer por
 * «desarrollo humano Ecuador».
 *
 * ── QUÉ ES DESDE EL 2026-08-19 ─────────────────────────────────────────────────
 * El **mismo explorador de tres paneles que `/clientes`**, con sus cuatro secciones: El
 * proyecto · Cómo se entra · Tu talento · Cómo se crece. Fernando lo pidió así para no
 * obligar a nadie a aprenderse dos formas de leer el mismo sitio.
 *
 * ⚠️ **NO SE HA PERDIDO NADA DE LO QUE HABÍA.** La versión anterior era una página larga con
 * cinco bloques suyos —los tres motivos, la Condiciología, el Modelo 4P, los nueve valores y
 * el violeta—, y **los cinco siguen, con su texto intacto**, repartidos entre las cuatro
 * secciones (`DESARROLLO`, en `lib/sitio/contenido.ts`). La versión anterior:
 *
 *     git show baaa033:'app/(sitio)/desarrollo-humano/page.tsx'
 *
 * Lo que ha cambiado, además de la forma, es que ahora **cada bloque tiene URL propia**. Eso
 * importa más de lo que parece: «condiciología» y «Modelo 4P» son de las pocas búsquedas
 * donde este sitio puede ser el mejor resultado y no el número treinta —nadie más las
 * escribe—, y hasta hoy vivían a media página, sin dirección a la que enlazar.
 *
 * ── EL REPARTO CON `/clientes` ──────────────────────────────────────────────────
 * `/clientes` le habla a quien viene a **contratar**; esta, a quien viene a **formar parte**.
 *
 * Corrección de Fernando (2026-08-02) que sigue mandando: el GCC es **un proyecto de
 * desarrollo humano**, y los servicios a clientes nacen de él, no al revés.
 *
 * Server Component: en el HTML crudo, como el resto del sitio público.
 */

import type { Metadata } from 'next';
import { SITIO, DESARROLLO, REDES, OG_IMAGEN } from '@/lib/sitio/contenido';
import { Contenedor } from '@/components/sitio/piezas';
import ExploradorSecciones from '@/components/sitio/ExploradorSecciones';
import { faqsTolerantesAlBuild } from '../clientes/faqs-build';

export const revalidate = 300;

export const metadata: Metadata = {
  /**
   * La pestaña, como en `/clientes`: solo el nombre de la sección. La plantilla de
   * `app/layout.tsx` le añade « · Grupo Corazones Cruzados».
   */
  title: 'Desarrollo Humano',
  description:
    'Grupo Corazones Cruzados es un proyecto de desarrollo humano: cómo se entra, cómo se estudia tu condición, cómo avanza tu caso y cómo se llega a ser miembro.',
  // ⚠️ Sin ciudad ni país desde el 2026-08-20, por decisión de Fernando. Antes había tres
  // términos con «Guayaquil»/«Ecuador», que eran los más fáciles de ganar; ver el aviso en
  // `app/layout.tsx`. (Google no usa `keywords` para posicionar, pero se deja coherente.)
  keywords: [
    'condiciología', 'Modelo 4P', 'desarrollo humano', 'GCC World', 'trabajar por talento',
  ],
  alternates: { canonical: '/desarrollo-humano' },
  openGraph: {
    title: `Desarrollo Humano — ${SITIO.nombre}`,
    description: 'Por qué existe, cómo se entra, cómo llega el trabajo y cómo se crece.',
    url: `${SITIO.url}/desarrollo-humano`,
    type: 'website',
    locale: 'es_EC',
    images: [OG_IMAGEN],
  },
};

export default async function DesarrolloHumanoPage() {
  // La primera sección, como hace `/clientes`: una página de entrada que arranca vacía
  // obliga a adivinar que hay que pulsar algo.
  const primera = DESARROLLO[0];
  const faqs = await faqsTolerantesAlBuild(primera.id);

  return (
    <>
      <section className="flex-1 overflow-x-clip bg-[var(--tarjeta)] pt-10 sm:pt-14 pb-40 sm:pb-56">
        <Contenedor ancho="amplio">
          <ExploradorSecciones
            secciones={DESARROLLO}
            activa={primera.id}
            faqs={faqs}
            base="/desarrollo-humano"
            rotulo="Desarrollo humano"
            etiquetaNav="Secciones de desarrollo humano"
          />
        </Contenedor>
      </section>

      {/* `AboutPage` + `Organization`: le dice al buscador que esta página explica **quién es**
          la organización, no qué vende. Es la contraparte del `ProfessionalService` que
          declara `/clientes`, y juntas dan la lectura completa. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            mainEntity: {
              '@type': 'Organization',
              name: SITIO.nombre,
              legalName: SITIO.razonSocial,
              taxID: SITIO.ruc,
              url: SITIO.url,
              sameAs: [...REDES],
            // ⚠️ AQUÍ IBAN EL TELÉFONO, EL CORREO, LA DIRECCIÓN Y EL PAÍS, y se quitaron el
            // 2026-08-20: *«ya no me interesa poner mis datos de contacto […] ni decir
            // Guayaquil, Ecuador»* (Fernando). No eran visibles en la página, pero sí en el
            // código fuente, que es donde los lee cualquiera.
            //
            // ⚠️⚠️ **SE QUEDAN `legalName` y `taxID` a propósito.** Son la identidad legal, no
            // datos de contacto, y son justo lo que Meta pide para creer que hay un negocio
            // real detrás —su verificación ya se rechazó una vez por eso—. Quitarlos también
            // dejaría al sitio sin nada que lo respalde. Si aun así hay que quitarlos, que sea
            // una decisión aparte y sabiendo esto.
              description:
                'Proyecto de desarrollo humano que desarrolla proyectos, personas y sistemas bajo una misma filosofía.',
            },
          }),
        }}
      />
    </>
  );
}
