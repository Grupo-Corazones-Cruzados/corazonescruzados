/**
 * LA PÁGINA DE UNA SOLUCIÓN — `/clientes/soluciones/<slug>` (Fernando, 2026-10-31: «que según
 * seleccione cada solución exista una página dedicada con el detalle… y el acceso a ver los
 * proyectos, tickets, productos —que se llaman Soluciones— y talentos»).
 *
 * La dibuja `FichaSolucion`: cabecera con las cifras de TODOS sus talentos sumados; debajo, sus
 * talentos con su icono, cada uno un enlace a su página (Fernando, 2026-10-31: «si escojo el talento…
 * debe llevarme a la página donde están los productos y servicios y todo lo demás»); y al final lo
 * hecho con ella. Los datos, de Admin → Soluciones y del trabajo terminado.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITIO, OG_IMAGEN } from '@/lib/sitio/contenido';
import { cargarSolucionesCacheadas, resumenSolucion } from '../../../soluciones/datos';
import FichaSolucion from '@/components/sitio/FichaSolucion';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ solucion: string }> };

async function buscar(slug: string) {
  const soluciones = await cargarSolucionesCacheadas();
  return soluciones.find((s) => s.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await buscar((await params).solucion);
  if (!s) return {};
  const descripcion = resumenSolucion(s).descripciones[0];
  return {
    title: s.nombre,
    description: descripcion,
    alternates: { canonical: `/clientes/soluciones/${s.slug}` },
    openGraph: {
      title: `${s.nombre} — ${SITIO.nombre}`,
      description: descripcion,
      url: `${SITIO.url}/clientes/soluciones/${s.slug}`,
      type: 'website',
      locale: 'es_EC',
      images: [OG_IMAGEN],
    },
  };
}

export default async function SolucionPage({ params }: Props) {
  const s = await buscar((await params).solucion);
  if (!s) notFound();
  const r = resumenSolucion(s);
  return (
    <FichaSolucion
      volver={{ href: '/clientes/soluciones', texto: 'Soluciones' }}
      etiqueta="Solución"
      titulo={s.nombre}
      descripciones={r.descripciones}
      rotulo="Talentos"
      iconoPorDefecto="destello"
      celdas={s.talentos.map((t) => ({
        clave: t.slug,
        icono: t.icono,
        titulo: t.talento,
        texto: t.descripcion,
        href: `/clientes/soluciones/${s.slug}/${t.slug}`,
      }))}
      hecho={r}
    />
  );
}
