'use client';

/**
 * LA LISTA DE SOLUCIONES — dentro del tema «Soluciones» de Clientes (Fernando, 2026-10-31: «incluir
 * todas las soluciones creadas como lista… descripción y los productos y servicios asociados»).
 *
 * Una tarjeta ancha por solución: número, nombre (SIN descripción: la que hay es del talento y va en
 * su página — Fernando, 2026-10-31), **sus talentos**
 * con su icono (Fernando, 2026-10-31: «reemplazando los productos y servicios para incluir los
 * talentos») y cuánto hay detrás, sumando todos sus talentos, con un icono por cifra: a la derecha en
 * la computadora, al pie en el teléfono. Lo que está a cero no se dice.
 *
 * · La tarjeta NO es un enlace (Fernando, 2026-10-31: «quita que al seleccionar la solución se vaya
 *   a otra pantalla»): lo que se elige es el TALENTO, y cada uno lleva a su página.
 *   `/clientes/soluciones/<solución>` ya no existe como página: redirige aquí.
 * · Filtro por talento y buscador a todo el ancho (nombre, descripción, talento o producto/servicio,
 *   sin tildes), de 10 en 10 con el recuento al pie: la galería de `GaleriaFiltrable`.
 * Los datos salen de Admin → Soluciones; aquí no hay ningún texto escrito a mano.
 */

import Link from 'next/link';
import { ArrowUpRight, FolderOpen, Package, Ticket, Users, type LucideIcon } from 'lucide-react';
import { ICONOS } from './piezas';
import GaleriaFiltrable, { type FiltroGaleria } from './GaleriaFiltrable';

export interface FilaSolucion {
  id: number;
  slug: string;
  nombre: string;
  talentos: { talento: string; slug: string; icono: string | null }[];
  cifras: { valor: number; etiqueta: string; uno: string; varios: string }[];
  /** Todo lo que encuentra el buscador. */
  busqueda: string;
}

/** El icono de cada cifra (Fernando, 2026-10-31: «usando iconos representativos a cada concepto»). */
const ICONO_CIFRA: Record<string, LucideIcon> = {
  Proyectos: FolderOpen, Tickets: Ticket, Soluciones: Package, Talentos: Users,
};

const FILTROS: FiltroGaleria<FilaSolucion>[] = [
  { clave: 'talento', todos: 'Todos los talentos', valores: (s) => s.talentos.map((t) => t.talento) },
];

export default function ListaSoluciones({ soluciones }: { soluciones: FilaSolucion[] }) {
  if (soluciones.length === 0) return null;
  return (
    <GaleriaFiltrable
      items={soluciones}
      clave={(s) => s.id}
      texto={(s) => s.busqueda}
      filtros={FILTROS}
      render={(s) => <FilaDeSolucion s={s} n={soluciones.indexOf(s)} />}
      unidad={['solución', 'soluciones']}
      buscar="Buscar soluciones…"
      vacio="Todavía no hay soluciones."
      porPagina={10}
      rejilla="lista-soluciones"
      lista
    />
  );
}

function FilaDeSolucion({ s, n }: { s: FilaSolucion; n: number }) {
  return (
    <li className="solucion-fila">
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
      </span>
      {/* En la computadora, columna propia a la derecha de la tarjeta; en el teléfono, al pie. */}
      {s.cifras.length > 0 && (
        <ul className="solucion-fila-cifras" aria-label="Recuento">
          {s.cifras.map((c) => {
            const Icono = ICONO_CIFRA[c.etiqueta];
            return (
              <li key={c.etiqueta}>
                <span className="solucion-cifra-icono" aria-hidden><Icono /></span>
                <b>{c.valor.toLocaleString('es-ES')}</b> {c.valor === 1 ? c.uno : c.varios}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
