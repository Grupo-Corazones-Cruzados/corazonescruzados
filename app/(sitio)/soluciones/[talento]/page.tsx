/**
 * UN TALENTO — `/soluciones/<slug>`.
 *
 * `/soluciones/automatizacion-de-procesos`. Es la misma pantalla que `/soluciones`, con el panel
 * izquierdo y las cuatro pestañas; lo único que cambia es **qué talento llega abierto**.
 *
 * ── POR QUÉ UNA RUTA POR TALENTO, Y NO UN CLIC ────────────────────────────────
 * Pedido por Fernando (2026-08-18). Lo que gana:
 *  · el enlace se comparte por WhatsApp y se guarda en marcadores;
 *  · **Google indexa una página por talento** con su propio título, su descripción y su
 *    trabajo, en vez de una sola con todo lo demás detrás de un panel. Esto es lo que más
 *    pesa: pasa de una URL con treinta trabajos a una URL por especialidad.
 *
 * ── SE PRERRENDERIZAN LAS CONOCIDAS, Y LAS DEMÁS SE SIRVEN AL VUELO ───────────
 * `generateStaticParams` las deja como HTML estático **cuando el build puede leer la base**.
 *
 * ⚠️⚠️ **`dynamicParams` ESTUVO EN `false` Y ROMPIÓ LA PÁGINA EN PRODUCCIÓN (2026-08-18).**
 * La idea era buena —un tramo inventado responde 404 de verdad— pero **se apoyaba en que el
 * build supiera la lista de talentos**, y en Railway el build **no llega a la base**: la
 * consulta falla, el `catch` devuelve `[]` y, con `dynamicParams = false`, esa lista vacía
 * significa *«no existe ninguna»*. Resultado medido en producción: **todas las páginas de
 * talento daban 404**, y ni el `revalidate` las salvaba — revalidar refresca páginas que
 * existen, no añade parámetros nuevos.
 *
 * Con `true` el comportamiento correcto se mantiene sin depender del build: un slug que no
 * esté en la base sigue dando **404 de verdad**, porque la página llama a `notFound()` al no
 * encontrarlo. La diferencia es que ahora el 404 lo decide **el dato**, no una lista que
 * puede venir vacía por un problema de red.
 *
 * 👉 **La lección general: un `catch` que devuelve una lista vacía es seguro solo si algo
 * distingue “vacío” de “no pude leer”.** Aquí no lo había, y el silencio se publicó como un
 * 404.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Contenedor } from '@/components/sitio/piezas';
import SolucionesExplorador from '@/components/sitio/SolucionesExplorador';
import { SITIO, OG_IMAGEN } from '@/lib/sitio/contenido';
import { listarSoluciones, talentoPorSlug } from '@/lib/soluciones';
import { cargarSolucionesConContenido } from '../datos';

export const revalidate = 300;

type Props = { params: Promise<{ talento: string }> };

export async function generateStaticParams() {
  try {
    const soluciones = await listarSoluciones();
    return soluciones.flatMap((a) => a.talentos.map((t) => ({ talento: t.slug })));
  } catch {
    // Durante el build, si la base no contesta no se cae el despliegue: la rama queda sin
    // prerenderizar y la primera revalidación la levanta. Ya costó 20 despliegues fallidos.
    return [];
  }
}

/**
 * `true` a propósito. Ver el aviso de arriba: con `false`, un build que no puede leer la base
 * deja TODAS las páginas de talento en 404 permanente.
 */
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { talento: slug } = await params;
  const t = await talentoPorSlug(slug).catch(() => null);
  if (!t) return {};

  return {
    // Solo el nombre del talento: la plantilla de `app/layout.tsx` añade el del grupo.
    title: t.talento,
    // La descripción de la solución, si la hay, es exactamente lo que describe esta página.
    description: t.descripcion ?? `Trabajo terminado de ${SITIO.nombre} en ${t.talento}.`,
    alternates: { canonical: `/soluciones/${slug}` },
    openGraph: {
      title: `${t.talento} — ${SITIO.nombre}`,
      description: t.descripcion ?? `Trabajo terminado en ${t.talento}.`,
      url: `${SITIO.url}/soluciones/${slug}`,
      type: 'website',
      locale: 'es_EC',
      images: [OG_IMAGEN],
    },
  };
}

export default async function TalentoPage({ params }: Props) {
  const { talento: slug } = await params;
  const soluciones = await cargarSolucionesConContenido();

  // Se comprueba contra lo cargado y no con otra consulta: si el talento no está aquí,
  // tampoco habría nada que enseñar.
  const existe = soluciones.some((a) => a.talentos.some((t) => t.slug === slug));
  if (!existe) notFound();

  return (
    <section className="flex-1 bg-[var(--tarjeta)] py-10 sm:py-14">
      <Contenedor ancho="amplio">
        <SolucionesExplorador soluciones={soluciones} slugActivo={slug} />
      </Contenedor>
    </section>
  );
}
