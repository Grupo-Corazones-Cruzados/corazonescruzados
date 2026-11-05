/**
 * LA FICHA DE UNA SOLUCIÓN O DE UNO DE SUS TALENTOS — el mismo dibujo para las dos páginas de
 * Clientes (2026-10-31): `/clientes/soluciones/<solución>` y `/clientes/soluciones/<solución>/<talento>`.
 *
 * Arriba, el camino de vuelta y la cabecera (etiqueta, nombre, descripción y las cuatro cifras);
 * debajo, una rejilla con rótulo —los talentos en la de la solución, cada uno un enlace a su página;
 * los Productos y Servicios asociados en la del talento—; y al final lo hecho, en pestañas
 * numeradas (`SolucionDetalle`).
 */

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Contenedor, ICONOS } from './piezas';
import SolucionDetalle from './SolucionDetalle';
import { cifrasDe } from '@/app/(sitio)/soluciones/datos';
import type { MiembroConTalento, Producto, Trabajo } from '@/lib/soluciones';

export interface CeldaFicha {
  clave: string | number;
  icono: string | null;
  titulo: string;
  texto: string | null;
  href?: string;
}

export default function FichaSolucion({
  volver, etiqueta, titulo, descripciones, rotulo, celdas, iconoPorDefecto, hecho,
}: {
  volver: { href: string; texto: string };
  etiqueta: string;
  titulo: string;
  descripciones: string[];
  rotulo: string;
  celdas: CeldaFicha[];
  iconoPorDefecto: string;
  hecho: { proyectos: Trabajo[]; tickets: Trabajo[]; productos: Producto[]; miembros: MiembroConTalento[] };
}) {
  return (
    <section className="flex-1 overflow-x-clip pt-6 sm:pt-10 pb-24">
      <Contenedor ancho="sitio">
        <nav aria-label="Ruta" className="solucion-ruta">
          <Link href={volver.href}><ChevronLeft aria-hidden /> {volver.texto}</Link>
        </nav>

        <header className="solucion-cabeza">
          <div className="min-w-0">
            <p className="presentacion-etiqueta">{etiqueta}</p>
            <h1 className="solucion-cabeza-titulo">{titulo}</h1>
            {descripciones.map((d, k) => <p key={k} className="solucion-cabeza-texto">{d}</p>)}
          </div>
          <dl className="solucion-cifras">
            {cifrasDe(hecho).map((c) => (
              <div key={c.etiqueta}>
                <dt>{c.etiqueta}</dt>
                <dd>{c.valor.toLocaleString('es-ES')}</dd>
              </div>
            ))}
          </dl>
        </header>

        {celdas.length > 0 && (
          <section aria-label={rotulo} className="mt-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--violeta-txt)]">{rotulo}</p>
            <ul className="conceptos-rejilla mt-4">
              {celdas.map((c) => {
                const Icono = (c.icono && ICONOS[c.icono]) || ICONOS[iconoPorDefecto];
                const cuerpo = (
                  <>
                    <span className="puerta-icono" aria-hidden><Icono /></span>
                    <span className="min-w-0">
                      <span className="concepto-titulo">{c.titulo}</span>
                      {c.texto && <span className="concepto-texto">{c.texto}</span>}
                    </span>
                  </>
                );
                return (
                  <li key={c.clave} className="flex">
                    {c.href
                      ? <Link href={c.href} className="concepto-celda concepto-celda-enlace flex-1">{cuerpo}</Link>
                      : <span className="concepto-celda flex-1">{cuerpo}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <SolucionDetalle {...hecho} />
      </Contenedor>
    </section>
  );
}
