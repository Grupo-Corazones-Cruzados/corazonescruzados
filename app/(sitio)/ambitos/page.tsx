/**
 * ÁMBITOS — los tipos de proyecto que el grupo es capaz de manejar.
 *
 * Panel izquierdo con las carpetas —un ámbito, y dentro sus talentos— y, al elegir un
 * talento, a la derecha los proyectos y tickets **terminados** que se hicieron con él.
 * Al estilo de `/legal`, como pidió Fernando.
 *
 * ── DE DÓNDE SALE CADA COSA ────────────────────────────────────────────────────
 * · Los **ámbitos** y sus talentos: `gcc_world.ambitos`, que se editan en Admin → Ámbitos.
 * · El **trabajo** de cada talento: NO está guardado en ninguna parte. Un proyecto es de un
 *   talento si alguno de sus requerimientos lo pide, y un ticket lo declara en
 *   `required_talents`. Se consulta al vuelo (`lib/ambitos.ts`), así que no puede quedar
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
 * cuando se cierra un proyecto o se toca un ámbito en el admin. Cinco minutos, el mismo
 * criterio que las preguntas frecuentes de `/soluciones`.
 */

import type { Metadata } from 'next';
import { Contenedor, FondoHeroe } from '@/components/sitio/piezas';
import AmbitosExplorador, { type AmbitoConTrabajo } from '@/components/sitio/AmbitosExplorador';
import { SITIO, OG_IMAGEN } from '@/lib/sitio/contenido';
import { listarAmbitos, trabajoDeTalento } from '@/lib/ambitos';

export const revalidate = 300;

export const metadata: Metadata = {
  /** Solo el nombre: la plantilla de `app/layout.tsx` añade « · Grupo Corazones Cruzados». */
  title: 'Ámbitos',
  description:
    'Los tipos de proyecto que Grupo Corazones Cruzados es capaz de manejar, con el trabajo terminado en cada uno: automatización de procesos, desarrollo y más.',
  alternates: { canonical: '/ambitos' },
  openGraph: {
    title: `Ámbitos — ${SITIO.nombre}`,
    description: 'Los tipos de proyecto que manejamos y el trabajo terminado en cada uno.',
    url: `${SITIO.url}/ambitos`,
    type: 'website',
    locale: 'es_EC',
    images: [OG_IMAGEN],
  },
};

/**
 * Igual que en `/soluciones/<id>`: durante el BUILD se tolera que la base no conteste, para
 * que un despliegue no dependa de que Postgres esté en pie. En ejecución el error sube.
 * Ya costó 20 despliegues fallidos una vez (ver MEMORIA.md → Lecciones).
 */
async function ambitosTolerantesAlBuild(): Promise<AmbitoConTrabajo[]> {
  const cargar = async (): Promise<AmbitoConTrabajo[]> => {
    const ambitos = await listarAmbitos();

    // El trabajo se consulta UNA vez por talento, aunque el talento esté en dos ámbitos.
    const cache = new Map<string, Awaited<ReturnType<typeof trabajoDeTalento>>>();
    for (const t of new Set(ambitos.flatMap((a) => a.talentos))) {
      cache.set(t, await trabajoDeTalento(t));
    }
    return ambitos.map((a) => ({
      ...a,
      trabajoPorTalento: Object.fromEntries(a.talentos.map((t) => [t, cache.get(t) ?? []])),
    }));
  };

  if (process.env.NEXT_PHASE !== 'phase-production-build') return cargar();
  try {
    return await cargar();
  } catch (e) {
    console.warn(
      `⚠ Los ámbitos no se pudieron leer durante el build: ${(e as Error).message}\n` +
        '  La página se prerenderiza vacía; la primera revalidación (5 min) la llenará.',
    );
    return [];
  }
}

export default async function AmbitosPage() {
  const ambitos = await ambitosTolerantesAlBuild();
  const totalTrabajos = ambitos.reduce(
    (n, a) => n + Object.values(a.trabajoPorTalento).reduce((m, l) => m + l.length, 0), 0,
  );

  return (
    <>
      <section className="relative overflow-hidden">
        <FondoHeroe />
        <Contenedor className="relative pt-20 pb-12 sm:pt-24 sm:pb-14 text-center">
          <h1 className="text-[38px] sm:text-[56px] leading-[1.08] font-semibold text-[var(--texto)] tracking-tight">
            Ámbitos
          </h1>
          <p className="mt-5 text-[17px] sm:text-[18.5px] leading-relaxed text-[var(--suave)] max-w-2xl mx-auto">
            Los tipos de proyecto que somos capaces de manejar, y el trabajo terminado en cada uno.
          </p>
        </Contenedor>
      </section>

      <section className="border-t border-[var(--linea)] bg-[var(--tarjeta)] py-12 sm:py-16">
        <Contenedor>
          {ambitos.length === 0 ? (
            // Ni recuadro gris ni «próximamente»: la misma regla del resto del sitio.
            <p className="text-[15px] text-[var(--tenue)]">
              Todavía no hay ámbitos publicados.
            </p>
          ) : (
            <AmbitosExplorador ambitos={ambitos} />
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
              name: 'Ámbitos de Grupo Corazones Cruzados',
              itemListElement: ambitos.map((a, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: a.nombre,
                url: `${SITIO.url}/ambitos#${a.slug}`,
              })),
            }),
          }}
        />
      )}
    </>
  );
}
