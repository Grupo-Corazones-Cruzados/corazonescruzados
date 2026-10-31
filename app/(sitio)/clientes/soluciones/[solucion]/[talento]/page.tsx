/**
 * LA PÁGINA DE UN TALENTO DE UNA SOLUCIÓN — `/clientes/soluciones/<solución>/<talento>` (Fernando,
 * 2026-10-31: «si escojo el talento por ejemplo de automatización de procesos debe llevarme a la
 * página donde están los productos y servicios y todo lo demás»).
 *
 * El mismo dibujo que la página de la solución (`FichaSolucion`), con lo de ESTE talento: su
 * descripción, sus Productos y Servicios asociados y sus proyectos, tickets, soluciones y talentos.
 * Un talento que no es de esa solución da 404.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITIO, OG_IMAGEN } from '@/lib/sitio/contenido';
import { cargarSolucionesCacheadas, resumenTalento } from '../../../../soluciones/datos';
import FichaSolucion from '@/components/sitio/FichaSolucion';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ solucion: string; talento: string }> };

async function buscar(solucion: string, talento: string) {
  const s = (await cargarSolucionesCacheadas()).find((x) => x.slug === solucion);
  const t = s ? resumenTalento(s, talento) : null;
  return s && t ? { s, t } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const h = await buscar(p.solucion, p.talento);
  if (!h) return {};
  const ruta = `/clientes/soluciones/${h.s.slug}/${h.t.slug}`;
  const descripcion = h.t.descripcion ?? undefined;
  return {
    title: `${h.t.talento} · ${h.s.nombre}`,
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: {
      title: `${h.t.talento} — ${SITIO.nombre}`,
      description: descripcion,
      url: `${SITIO.url}${ruta}`,
      type: 'website',
      locale: 'es_EC',
      images: [OG_IMAGEN],
    },
  };
}

export default async function TalentoDeSolucionPage({ params }: Props) {
  const p = await params;
  const h = await buscar(p.solucion, p.talento);
  if (!h) notFound();
  const { s, t } = h;
  return (
    <FichaSolucion
      volver={{ href: `/clientes/soluciones/${s.slug}`, texto: s.nombre }}
      etiqueta={`Talento · ${s.nombre}`}
      titulo={t.talento}
      descripciones={t.descripcion ? [t.descripcion] : []}
      rotulo="Productos y Servicios asociados"
      iconoPorDefecto="capas"
      celdas={t.conceptos.map((c) => ({ clave: c.id, icono: c.icono, titulo: c.titulo, texto: c.descripcion }))}
      hecho={t}
    />
  );
}
