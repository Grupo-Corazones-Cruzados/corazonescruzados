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
import GaleriaFiltrable, {
  FILTRO_ANIO, FILTRO_MES, FILTRO_MIEMBRO, textoDeTrabajo, type FiltroGaleria,
} from './GaleriaFiltrable';
import { TarjetaMiembro, TarjetaProducto } from './SolucionesExplorador';

export default function SolucionDetalle({
  proyectos, tickets, productos, miembros,
}: {
  proyectos: Trabajo[];
  tickets: Trabajo[];
  productos: Producto[];
  miembros: MiembroConTalento[];
}) {
  // Cada pestaña es una `GaleriaFiltrable` (Fernando, 2026-10-31: «los filtros, buscadores requeridos
  // para los tipos que existen»): proyectos por año, mes, miembro y etiqueta; tickets por año, mes y
  // miembro; soluciones y talentos, con el buscador. El talento no se filtra: la página ya es de uno.
  const pestanas: { id: string; titulo: string; cuenta: number; cuerpo: ReactNode }[] = [
    {
      id: 'proyectos', titulo: 'Proyectos', cuenta: proyectos.length,
      cuerpo: <GaleriaFiltrable items={proyectos} clave={(t) => t.id} texto={textoDeTrabajo}
        filtros={FILTROS_PROYECTO} render={(t) => <TarjetaTrabajo trabajo={t} />}
        unidad={['proyecto', 'proyectos']} buscar="Buscar proyectos…"
        vacio="Todavía no hay proyectos terminados con esta solución." />,
    },
    {
      id: 'tickets', titulo: 'Tickets', cuenta: tickets.length,
      cuerpo: <GaleriaFiltrable items={tickets} clave={(t) => t.id} texto={textoDeTrabajo}
        filtros={FILTROS_TICKET} render={(t) => <TarjetaTrabajo trabajo={t} />}
        unidad={['ticket', 'tickets']} buscar="Buscar tickets…"
        vacio="Todavía no hay tickets terminados con esta solución." />,
    },
    {
      id: 'soluciones', titulo: 'Soluciones', cuenta: productos.length,
      cuerpo: <GaleriaFiltrable items={productos} clave={(p) => p.id} texto={(p) => `${p.nombre} ${p.descripcion ?? ''}`}
        render={(p) => <TarjetaProducto producto={p} etiqueta="Solución" />}
        unidad={['solución', 'soluciones']} buscar="Buscar soluciones…"
        vacio="Todavía no hay soluciones publicadas en esta solución." />,
    },
    {
      id: 'talentos', titulo: 'Talentos', cuenta: miembros.length,
      cuerpo: <GaleriaFiltrable items={miembros} clave={(m) => m.memberId} texto={(m) => `${m.nombre} ${m.correo ?? ''}`}
        render={(m) => <TarjetaMiembro miembro={m} />}
        unidad={['talento', 'talentos']} buscar="Buscar talentos…"
        vacio="Todavía no hay talentos en esta solución." />,
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

const FILTROS_PROYECTO: FiltroGaleria<Trabajo>[] = [
  FILTRO_ANIO, FILTRO_MES, FILTRO_MIEMBRO,
  { clave: 'etiqueta', todos: 'Todas las etiquetas', valores: (t) => t.etiquetas },
];
const FILTROS_TICKET: FiltroGaleria<Trabajo>[] = [FILTRO_ANIO, FILTRO_MES, FILTRO_MIEMBRO];
