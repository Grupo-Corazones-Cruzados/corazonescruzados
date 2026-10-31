'use client';

/**
 * LA LISTA DE TICKETS — dentro del tema «Tickets» de Clientes (Fernando, 2026-10-31: «pon debajo del
 * título todos los tickets que se han creado… paginación, filtros y el buscador»).
 *
 * Solo los terminados y sin filtro de estado (el mismo día: «quita los filtros por estado… solo
 * completados»). Filtros que se combinan: **solución, año, mes, talento y miembro**. La galería, los
 * filtros, la paginación y el recuento al pie son los de `GaleriaFiltrable`.
 */

import { useMemo } from 'react';
import type { Trabajo } from '@/lib/soluciones';
import TarjetaTrabajo from './TarjetaTrabajo';
import GaleriaFiltrable, {
  FILTRO_ANIO, FILTRO_MES, FILTRO_MIEMBRO, textoDeTrabajo, type FiltroGaleria,
} from './GaleriaFiltrable';

export default function ListaTickets({
  tickets, solucionDe,
}: {
  tickets: Trabajo[];
  /** Talento → nombre de su solución (un talento pertenece a una sola, migración 042). */
  solucionDe: Record<string, string>;
}) {
  const filtros = useMemo<FiltroGaleria<Trabajo>[]>(() => [
    { clave: 'solucion', todos: 'Todas las soluciones',
      valores: (t) => [...new Set(t.etiquetas.map((x) => solucionDe[x]).filter(Boolean))] },
    FILTRO_ANIO,
    FILTRO_MES,
    { clave: 'talento', todos: 'Todos los talentos', valores: (t) => t.etiquetas },
    FILTRO_MIEMBRO,
  ], [solucionDe]);

  if (tickets.length === 0) return null;
  return (
    <GaleriaFiltrable
      items={tickets}
      clave={(t) => t.id}
      texto={textoDeTrabajo}
      filtros={filtros}
      render={(t) => <TarjetaTrabajo trabajo={t} />}
      unidad={['ticket', 'tickets']}
      buscar="Buscar tickets…"
      vacio="Todavía no hay tickets terminados."
    />
  );
}
