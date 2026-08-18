/**
 * SOLUCIONES — los tipos de proyecto que el grupo es capaz de manejar.
 *
 * ⚠️ Vivía en `/soluciones` hasta el 2026-08-18. Fernando le dio el nombre «Soluciones» —que
 * era el que tenía pensado para este contenido— y movió la página anterior a `/clientes`.
 * El concepto interno sigue siendo **solución**: la tabla, el admin y este código.
 *
 * Panel izquierdo con las carpetas —una solución, y dentro sus talentos— y, al elegir un
 * talento, a la derecha los proyectos y tickets **terminados** que se hicieron con él.
 * Al estilo de `/legal`, como pidió Fernando.
 *
 * ── DE DÓNDE SALE CADA COSA ────────────────────────────────────────────────────
 * · Los **soluciones** y sus talentos: `gcc_world.soluciones`, que se editan en Admin → Soluciones.
 * · El **trabajo** de cada talento: NO está guardado en ninguna parte. Un proyecto es de un
 *   talento si alguno de sus requerimientos lo pide, y un ticket lo declara en
 *   `required_talents`. Se consulta al vuelo (`lib/soluciones.ts`), así que no puede quedar
 *   desincronizado con la realidad.
 *
 * ── SOLO LO TERMINADO ──────────────────────────────────────────────────────────
 * Decisión de Fernando (2026-08-18). En la base hay proyectos en borrador, en cotización y
 * en curso; nada de eso es trabajo hecho, y anunciar en la web lo que aún no existe es lo
 * que ya tumbó una verificación de Meta.
 *
 * ── SERVER COMPONENT, Y TODO EL TEXTO EN EL HTML ───────────────────────────────
 * Los datos se leen aquí, en el servidor. El explorador es de cliente solo para desplegar
 * carpetas, y pinta **también** el contenido de los talentos no elegidos, oculto: es lo que
 * evita que un buscador vea un proyecto de once.
 *
 * ⏱️ `revalidate`: la página es HTML ya hecho, pero su contenido sale de la base y cambia
 * cuando se cierra un proyecto o se toca una solución en el admin. Cinco minutos, el mismo
 * criterio que las preguntas frecuentes de `/soluciones`.
 */

import type { Metadata } from 'next';
import { Contenedor } from '@/components/sitio/piezas';
import SolucionesExplorador from '@/components/sitio/SolucionesExplorador';
import { SITIO, OG_IMAGEN } from '@/lib/sitio/contenido';
import { cargarSolucionesConContenido } from './datos';

export const revalidate = 300;

export const metadata: Metadata = {
  /** Solo el nombre: la plantilla de `app/layout.tsx` añade « · Grupo Corazones Cruzados». */
  title: 'Soluciones',
  description:
    'Los tipos de proyecto que Grupo Corazones Cruzados es capaz de manejar, con el trabajo terminado en cada uno: automatización de procesos, desarrollo y más.',
  alternates: { canonical: '/soluciones' },
  openGraph: {
    title: `Soluciones — ${SITIO.nombre}`,
    description: 'Los tipos de proyecto que manejamos y el trabajo terminado en cada uno.',
    url: `${SITIO.url}/soluciones`,
    type: 'website',
    locale: 'es_EC',
    images: [OG_IMAGEN],
  },
};

export default async function SolucionesPage() {
  const soluciones = await cargarSolucionesConContenido();
  const totalTrabajos = soluciones.reduce(
    (n, a) => n + Object.values(a.contenido).reduce(
      (m, c) => m + c.proyectos.length + c.tickets.length + c.productos.length, 0), 0,
  );

  return (
    <>
      {/* ── SIN ENCABEZADO, POR PETICIÓN (Fernando, 2026-08-18) ────────────────
          Había un héroe con «Soluciones» y una frase debajo. Lo quitó, y la página entra
          directa al explorador.

          ⚠️ Con él se iba el único `<h1>`. No se ha dejado a la página sin encabezado: lo
          hereda **el nombre del talento abierto**, dentro del explorador, que además
          describe mejor lo que se está mirando. Un documento sin `<h1>` es un documento sin
          título para un buscador y para un lector de pantalla. */}
      {/* `flex-1`: la sección ocupa TODO el alto que sobre. Con poco contenido, su fondo
          blanco terminaba donde terminaba el contenido y debajo asomaba el papel `#f6f5f9`
          de la página — un cambio de color a media pantalla. Un solo color, como pidió
          Fernando (2026-08-18). Sin `border-b`: no hay nada después de ella. */}
      <section className="flex-1 bg-[var(--tarjeta)] py-10 sm:py-14">
        <Contenedor>
          {soluciones.length === 0 ? (
            // Ni recuadro gris ni «próximamente»: la misma regla del resto del sitio.
            <p className="text-[15px] text-[var(--tenue)]">
              Todavía no hay soluciones publicados.
            </p>
          ) : (
            <SolucionesExplorador soluciones={soluciones} />
          )}
        </Contenedor>
      </section>

      {/* Datos estructurados: le dicen al buscador que esto es una lista de los servicios
          que presta la organización, no un texto suelto. Solo se declara si hay algo. */}
      {totalTrabajos > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: 'Soluciones de Grupo Corazones Cruzados',
              itemListElement: soluciones.map((a, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: a.nombre,
                url: `${SITIO.url}/soluciones#${a.slug}`,
              })),
            }),
          }}
        />
      )}
    </>
  );
}
