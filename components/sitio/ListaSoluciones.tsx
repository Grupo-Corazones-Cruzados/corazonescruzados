/**
 * LA LISTA DE SOLUCIONES — dentro del tema «Soluciones» de Clientes (Fernando, 2026-10-31: «incluir
 * todas las soluciones creadas como lista… descripción y los productos y servicios asociados»).
 *
 * Una tarjeta ancha por solución, entera un enlace a su página (`/clientes/soluciones/<slug>`): número,
 * nombre, la descripción de sus talentos, sus Productos y Servicios asociados con su icono, y al pie
 * cuánto hay detrás (proyectos, tickets, soluciones y talentos). Lo que está a cero no se dice.
 * Los datos salen de Admin → Soluciones; aquí no hay ningún texto escrito a mano.
 */

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ICONOS } from './piezas';
import type { SolucionConContenido } from './SolucionesExplorador';
import { resumenSolucion } from '@/app/(sitio)/soluciones/datos';

export function cifrasSolucion(r: ReturnType<typeof resumenSolucion>) {
  return [
    { valor: r.proyectos.length, uno: 'proyecto', varios: 'proyectos' },
    { valor: r.tickets.length, uno: 'ticket', varios: 'tickets' },
    { valor: r.productos.length, uno: 'solución', varios: 'soluciones' },
    { valor: r.miembros.length, uno: 'talento', varios: 'talentos' },
  ].filter((c) => c.valor > 0);
}

export default function ListaSoluciones({ soluciones }: { soluciones: SolucionConContenido[] }) {
  if (soluciones.length === 0) return null;
  return (
    <ol className="lista-soluciones" aria-label="Soluciones">
      {soluciones.map((s, n) => {
        const r = resumenSolucion(s);
        const cifras = cifrasSolucion(r);
        return (
          <li key={s.id}>
            <Link href={`/clientes/soluciones/${s.slug}`} className="solucion-fila">
              <span className="solucion-fila-num">{String(n + 1).padStart(2, '0')}</span>
              <span className="solucion-fila-cuerpo">
                <span className="solucion-fila-cabeza">
                  <h2 className="solucion-fila-nombre">{s.nombre}</h2>
                  <span className="solucion-fila-ir" aria-hidden><ArrowUpRight /></span>
                </span>
                {r.descripciones.map((d, k) => <p key={k} className="solucion-fila-texto">{d}</p>)}
                {r.conceptos.length > 0 && (
                  <>
                    <span className="solucion-fila-rotulo">Productos y Servicios asociados</span>
                    <ul className="solucion-conceptos">
                      {r.conceptos.map((c) => {
                        const Icono = ICONOS[c.icono] ?? ICONOS.capas;
                        return (
                          <li key={c.id}>
                            <Icono aria-hidden />
                            {c.titulo}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
                {cifras.length > 0 && (
                  <span className="solucion-fila-cifras">
                    {cifras.map((c) => (
                      <span key={c.uno}><b>{c.valor.toLocaleString('es-ES')}</b> {c.valor === 1 ? c.uno : c.varios}</span>
                    ))}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
