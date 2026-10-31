'use client';

/**
 * LA LISTA DE SOLUCIONES — dentro del tema «Soluciones» de Clientes (Fernando, 2026-10-31: «incluir
 * todas las soluciones creadas como lista… descripción y los productos y servicios asociados»).
 *
 * Una tarjeta ancha por solución: número, nombre (SIN descripción: la que hay es del talento y va en
 * su página — Fernando, 2026-10-31), **sus talentos**
 * con su icono (Fernando, 2026-10-31: «reemplazando los productos y servicios para incluir los
 * talentos») y al pie cuánto hay detrás, sumando todos sus talentos. Lo que está a cero no se dice.
 *
 * · La tarjeta NO es un enlace (Fernando, 2026-10-31: «quita que al seleccionar la solución se vaya
 *   a otra pantalla»): lo que se elige es el TALENTO, y cada uno lleva a su página.
 *   `/clientes/soluciones/<solución>` ya no existe como página: redirige aquí.
 * · Encima, un buscador: por nombre, descripción, talento o producto/servicio, sin tildes.
 * Los datos salen de Admin → Soluciones; aquí no hay ningún texto escrito a mano.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search } from 'lucide-react';
import { ICONOS } from './piezas';

export interface FilaSolucion {
  id: number;
  slug: string;
  nombre: string;
  talentos: { talento: string; slug: string; icono: string | null }[];
  cifras: { valor: number; uno: string; varios: string }[];
  /** Todo lo que se puede buscar, ya en minúsculas y sin tildes. */
  busqueda: string;
}

const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function ListaSoluciones({ soluciones }: { soluciones: FilaSolucion[] }) {
  const [busca, setBusca] = useState('');
  const q = sinTildes(busca.trim());
  const vistas = useMemo(() => (q ? soluciones.filter((s) => s.busqueda.includes(q)) : soluciones), [q, soluciones]);
  if (soluciones.length === 0) return null;

  return (
    <>
      <div className="relative w-full sm:w-[320px] mb-4">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--apagado)] pointer-events-none" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar soluciones…"
          aria-label="Buscar soluciones"
          className="w-full h-11 pl-10 pr-4 rounded-full border border-[var(--linea-fuerte)] bg-white/85
                     text-[14.5px] text-[var(--texto)] placeholder:text-[var(--apagado)]
                     focus:border-[#7b5fbf]/60 focus:outline-none transition-colors"
        />
      </div>

      {vistas.length === 0 && (
        <p className="text-[14px] text-[var(--tenue)] py-6">Ninguna solución coincide con la búsqueda.</p>
      )}

      <ol className="lista-soluciones" aria-label="Soluciones">
        {vistas.map((s) => {
          const n = soluciones.indexOf(s);
          return (
            <li key={s.id} className="solucion-fila">
              <span className="solucion-fila-num">{String(n + 1).padStart(2, '0')}</span>
              <span className="solucion-fila-cuerpo">
                <h2 className="solucion-fila-nombre">{s.nombre}</h2>
                {s.talentos.length > 0 && (
                  <>
                    <span className="solucion-fila-rotulo">Talentos</span>
                    <ul className="solucion-conceptos">
                      {s.talentos.map((t) => {
                        const Icono = (t.icono && ICONOS[t.icono]) || ICONOS.destello;
                        return (
                          <li key={t.slug}>
                            <Link href={`/clientes/soluciones/${s.slug}/${t.slug}`} className="solucion-talento">
                              <Icono aria-hidden />
                              {t.talento}
                              <ArrowUpRight className="solucion-talento-ir" aria-hidden />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
                {s.cifras.length > 0 && (
                  <span className="solucion-fila-cifras">
                    {s.cifras.map((c) => (
                      <span key={c.uno}><b>{c.valor.toLocaleString('es-ES')}</b> {c.valor === 1 ? c.uno : c.varios}</span>
                    ))}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
