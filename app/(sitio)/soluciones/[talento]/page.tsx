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
 * ── SE PRERRENDERIZAN TODAS ───────────────────────────────────────────────────
 * `generateStaticParams` las deja como HTML estático. Y `dynamicParams = false`: un tramo
 * inventado responde **404 de verdad**, no una página vacía — la misma regla que
 * `/soluciones/<id>`.
 *
 * ⚠️ **`dynamicParams = false` tiene un precio que hay que saber:** un talento asociado
 * DESPUÉS del último despliegue no tendrá página hasta el siguiente. Es el mismo trato que
 * ya acepta `/soluciones`, y a cambio ningún tramo inventado devuelve una página en blanco.
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

export const dynamicParams = false;

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
      <Contenedor>
        <SolucionesExplorador soluciones={soluciones} slugActivo={slug} />
      </Contenedor>
    </section>
  );
}
