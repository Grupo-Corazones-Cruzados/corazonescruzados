'use client';

/**
 * LA LISTA DE TICKETS O DE PROYECTOS — bajo los temas «Tickets» y «Proyectos» de Clientes (Fernando,
 * 2026-10-31: «pon debajo del título todos los tickets que se han creado… paginación, filtros y el
 * buscador»; y luego «algo parecido a lo que hicimos en tickets debemos hacer en proyectos»).
 *
 * Solo los terminados, del más reciente al más antiguo por fecha de FINALIZACIÓN. Filtros que se
 * combinan: **solución, año, mes, talento y miembro** (y en proyectos, **etiqueta**). La galería, los
 * filtros, la paginación y el recuento al pie son los de `GaleriaFiltrable`.
 */

import { useMemo } from 'react';
import type { Trabajo } from '@/lib/soluciones';
import TarjetaTrabajo from './TarjetaTrabajo';
import GaleriaFiltrable, {
  FILTRO_ANIO, FILTRO_MES, FILTRO_MIEMBRO, textoDeTrabajo, type FiltroGaleria,
} from './GaleriaFiltrable';

const TEXTOS = {
  ticket: { unidad: ['ticket', 'tickets'] as [string, string], buscar: 'Buscar tickets…', vacio: 'Todavía no hay tickets terminados.' },
  proyecto: { unidad: ['proyecto', 'proyectos'] as [string, string], buscar: 'Buscar proyectos…', vacio: 'Todavía no hay proyectos terminados.' },
};

export default function ListaTrabajos({
  trabajos, tipo, solucionDe,
}: {
  trabajos: Trabajo[];
  tipo: 'ticket' | 'proyecto';
  /** Talento → nombre de su solución (un talento pertenece a una sola, migración 042). */
  solucionDe: Record<string, string>;
}) {
  const filtros = useMemo<FiltroGaleria<Trabajo>[]>(() => [
    { clave: 'solucion', todos: 'Todas las soluciones',
      valores: (t) => [...new Set((t.talentos ?? []).map((x) => solucionDe[x]).filter(Boolean))] },
    FILTRO_ANIO,
    FILTRO_MES,
    { clave: 'talento', todos: 'Todos los talentos', valores: (t) => t.talentos ?? [] },
    FILTRO_MIEMBRO,
    // En un ticket las etiquetas SON sus talentos; solo el proyecto tiene etiquetas propias.
    ...(tipo === 'proyecto' ? [{ clave: 'etiqueta', todos: 'Todas las etiquetas', valores: (t: Trabajo) => t.etiquetas }] : []),
  ], [solucionDe, tipo]);

  if (trabajos.length === 0) return null;
  const x = TEXTOS[tipo];
  return (
    <GaleriaFiltrable
      items={trabajos}
      clave={(t) => t.id}
      texto={textoDeTrabajo}
      filtros={filtros}
      render={(t) => <TarjetaTrabajo trabajo={t} />}
      unidad={x.unidad}
      buscar={x.buscar}
      vacio={x.vacio}
    />
  );
}
