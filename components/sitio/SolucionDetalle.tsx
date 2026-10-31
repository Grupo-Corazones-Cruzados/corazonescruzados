'use client';

/**
 * LO HECHO CON UNA SOLUCIÓN — pestañas numeradas Proyectos · Tickets · Soluciones · Talentos, con
 * la cuenta de cada una (el mismo dibujo que los temas de Clientes, `.tema-pestana`).
 *
 * «Productos» se llama aquí **Soluciones** (Fernando, 2026-10-31). Las cuatro pestañas están
 * siempre, también vacías: son la navegación de la página (misma regla que `SolucionesExplorador`).
 * Los cuatro paneles se pintan en el HTML y los no elegidos van con `hidden`: lo que solo viaja como
 * prop a un componente de cliente no lo ve el buscador.
 */

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { MiembroConTalento, Producto, Trabajo } from '@/lib/soluciones';
import TarjetaTrabajo from './TarjetaTrabajo';
import { TarjetaMiembro, TarjetaProducto } from './SolucionesExplorador';

export default function SolucionDetalle({
  proyectos, tickets, productos, miembros,
}: {
  proyectos: Trabajo[];
  tickets: Trabajo[];
  productos: Producto[];
  miembros: MiembroConTalento[];
}) {
  const vacio = (texto: string) => <p className="text-[14px] text-[var(--tenue)] py-6">{texto}</p>;
  const pestanas: { id: string; titulo: string; cuenta: number; cuerpo: ReactNode }[] = [
    {
      id: 'proyectos', titulo: 'Proyectos', cuenta: proyectos.length,
      cuerpo: proyectos.length ? <div className="rejilla-trabajos">{proyectos.map((t) => <TarjetaTrabajo key={t.id} trabajo={t} />)}</div>
        : vacio('Todavía no hay proyectos terminados con esta solución.'),
    },
    {
      id: 'tickets', titulo: 'Tickets', cuenta: tickets.length,
      cuerpo: tickets.length ? <div className="rejilla-trabajos">{tickets.map((t) => <TarjetaTrabajo key={t.id} trabajo={t} />)}</div>
        : vacio('Todavía no hay tickets terminados con esta solución.'),
    },
    {
      id: 'soluciones', titulo: 'Soluciones', cuenta: productos.length,
      cuerpo: productos.length ? <div className="rejilla-trabajos">{productos.map((p) => <TarjetaProducto key={p.id} producto={p} etiqueta="Solución" />)}</div>
        : vacio('Todavía no hay soluciones publicadas en esta solución.'),
    },
    {
      id: 'talentos', titulo: 'Talentos', cuenta: miembros.length,
      cuerpo: miembros.length ? <div className="rejilla-trabajos">{miembros.map((m) => <TarjetaMiembro key={m.memberId} miembro={m} />)}</div>
        : vacio('Todavía no hay talentos en esta solución.'),
    },
  ];

  const [activa, setActiva] = useState(0);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const teclas = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (activa + d + pestanas.length) % pestanas.length;
    setActiva(j);
    botones.current[j]?.focus();
  };

  return (
    <section className="mt-16" aria-label="Lo hecho con esta solución">
      <div className="temas-pestanas temas-pestanas-4" role="tablist" onKeyDown={teclas}
        style={{ gridTemplateColumns: `repeat(${pestanas.length}, minmax(0, 1fr))` }}>
        {pestanas.map((p, j) => (
          <button
            key={p.id}
            ref={(el) => { botones.current[j] = el; }}
            type="button"
            role="tab"
            id={`hecho-${p.id}`}
            aria-selected={j === activa}
            aria-controls={`hecho-panel-${p.id}`}
            tabIndex={j === activa ? 0 : -1}
            className="tema-pestana"
            onClick={() => setActiva(j)}
          >
            <span className="tema-pestana-raya" aria-hidden />
            <span className="tema-pestana-num">{String(j + 1).padStart(2, '0')}</span>
            <span className="tema-pestana-titulo">
              {p.titulo}
              <span className="tema-pestana-cuenta">{p.cuenta.toLocaleString('es-ES')}</span>
            </span>
          </button>
        ))}
      </div>
      {pestanas.map((p, j) => (
        <div
          key={p.id}
          id={`hecho-panel-${p.id}`}
          role="tabpanel"
          aria-labelledby={`hecho-${p.id}`}
          hidden={j !== activa}
          className="hecho-panel"
        >
          {p.cuerpo}
        </div>
      ))}
    </section>
  );
}
