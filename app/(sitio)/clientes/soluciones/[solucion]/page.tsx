/**
 * LA PÁGINA DE UNA SOLUCIÓN — `/clientes/soluciones/<slug>` (Fernando, 2026-10-31: «que según
 * seleccione cada solución exista una página dedicada con el detalle… y el acceso a ver los
 * proyectos, tickets, productos —que se llaman Soluciones— y talentos»).
 *
 * Arriba, el camino de vuelta y la cabecera de la solución (nombre, descripción de sus talentos y
 * sus cifras); debajo, sus Productos y Servicios asociados; y al final lo hecho con ella en
 * pestañas numeradas (`SolucionDetalle`). Los datos, de Admin → Soluciones y del trabajo terminado.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { SITIO, OG_IMAGEN } from '@/lib/sitio/contenido';
import { Contenedor, ICONOS } from '@/components/sitio/piezas';
import { cargarSolucionesCacheadas, resumenSolucion } from '../../../soluciones/datos';
import SolucionDetalle from '@/components/sitio/SolucionDetalle';

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
  const cifras = [
    { valor: r.proyectos.length, etiqueta: 'Proyectos' },
    { valor: r.tickets.length, etiqueta: 'Tickets' },
    { valor: r.productos.length, etiqueta: 'Soluciones' },
    { valor: r.miembros.length, etiqueta: 'Talentos' },
  ];

  return (
    <section className="flex-1 overflow-x-clip pt-6 sm:pt-10 pb-24">
      <Contenedor ancho="sitio">
        <nav aria-label="Ruta" className="solucion-ruta">
          <Link href="/clientes/soluciones"><ChevronLeft aria-hidden /> Soluciones</Link>
        </nav>

        <header className="solucion-cabeza">
          <div className="min-w-0">
            <p className="presentacion-etiqueta">Solución</p>
            <h1 className="solucion-cabeza-titulo">{s.nombre}</h1>
            {r.descripciones.map((d, k) => <p key={k} className="solucion-cabeza-texto">{d}</p>)}
          </div>
          <dl className="solucion-cifras">
            {cifras.map((c) => (
              <div key={c.etiqueta}>
                <dt>{c.etiqueta}</dt>
                <dd>{c.valor.toLocaleString('es-ES')}</dd>
              </div>
            ))}
          </dl>
        </header>

        {r.conceptos.length > 0 && (
          <section aria-label="Productos y Servicios asociados" className="mt-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--violeta-txt)]">
              Productos y Servicios asociados
            </p>
            <ul className="conceptos-rejilla mt-4">
              {r.conceptos.map((c) => {
                const Icono = ICONOS[c.icono] ?? ICONOS.capas;
                return (
                  <li key={c.id} className="concepto-celda">
                    <span className="puerta-icono" aria-hidden><Icono /></span>
                    <span className="min-w-0">
                      <span className="concepto-titulo">{c.titulo}</span>
                      {c.descripcion && <span className="concepto-texto">{c.descripcion}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <SolucionDetalle
          proyectos={r.proyectos}
          tickets={r.tickets}
          productos={r.productos}
          miembros={r.miembros}
        />
      </Contenedor>
    </section>
  );
}
