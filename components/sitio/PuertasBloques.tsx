/**
 * LAS PUERTAS EN BLOQUES — una definición para Clientes, Desarrollo Humano y Soluciones (2026-10-30).
 *
 * Eran filas de tarjetas (`.puertas-seccion`) y se encogían al crecer: con seis secciones, ~200 px
 * por tarjeta, títulos partidos y la frase con «…». Fernando: *«todas las tarjetas se ven muy
 * encogidas»*, y de Soluciones: *«a futuro se va a llegar a crear más soluciones»*.
 *
 * Cada puerta es una FILA ancha (icono · nombre y frase enteros · flecha) dentro de la tarjeta de
 * su bloque. Los bloques salen del campo `grupo` en el orden en que aparecen, con su rótulo
 * numerado («01 Conoce el modelo»), y se reparten en columnas de 380 px como mínimo (`auto-fit`):
 * dos bloques ocupan media página cada uno y, si mañana hay cinco soluciones, caben tres por
 * fila y el resto baja. Nada se encoge. Sin grupos, un solo bloque de dos columnas.
 * En el teléfono, bloques apilados y filas con icono y nombre. La abierta, rellena de violeta.
 */

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export interface Puerta {
  id: string;
  href: string;
  titulo: string;
  texto: string;
  icono: ReactNode;
  grupo?: string;
}

export default function PuertasBloques({
  puertas, activa, etiquetaNav,
}: {
  puertas: Puerta[];
  /** El `id` de la puerta abierta. */
  activa?: string | null;
  etiquetaNav: string;
}) {
  const grupos: { nombre?: string; puertas: Puerta[] }[] = [];
  for (const p of puertas) {
    const g = grupos.find((x) => x.nombre === p.grupo);
    if (g) g.puertas.push(p);
    else grupos.push({ nombre: p.grupo, puertas: [p] });
  }

  return (
    <nav aria-label={etiquetaNav} className="puertas-bloques" data-grupos={grupos.length > 1 ? 'varios' : 'uno'}>
      {grupos.map((g, i) => (
        <div key={g.nombre ?? i} className="min-w-0">
          {g.nombre && (
            <p className="puertas-grupo-rotulo">
              <span className="puertas-grupo-num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
              {g.nombre}
            </p>
          )}
          <ul className="puertas-lista" data-n={g.puertas.length}>
            {g.puertas.map((p) => {
              const abierta = p.id === activa;
              return (
                <li key={p.id} className="min-w-0">
                  <Link
                    href={p.href}
                    aria-current={abierta ? 'page' : undefined}
                    className={`puerta-fila ${abierta ? 'es-abierta' : ''}`}
                  >
                    <span className="puerta-icono" aria-hidden>{p.icono}</span>
                    <span className="min-w-0">
                      <span className="puerta-fila-titulo">{p.titulo}</span>
                      <span className="puerta-fila-texto">{p.texto}</span>
                    </span>
                    <ChevronRight className="puerta-fila-flecha" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
