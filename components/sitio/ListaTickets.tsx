'use client';

/**
 * LA LISTA DE TICKETS — dentro del tema «Tickets» de Clientes (Fernando, 2026-10-31: «pon debajo del
 * título todos los tickets que se han creado, aunque puedes poner paginación, filtros y el buscador;
 * la idea es que el usuario pueda ver los tickets que se pueden resolver»).
 *
 * Barra: estado en el selector segmentado (Por resolver · Resueltos · Todos, con su cuenta), talento
 * si hay más de uno, y el buscador redondo de la casa. Debajo, las tarjetas de siempre
 * (`TarjetaTrabajo`, con «Por resolver» / «Resuelto» junto a «Ticket») de 12 en 12 con paginación.
 * Arranca en «Por resolver» si hay alguno: es lo que se viene a ver.
 */

import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { Trabajo } from '@/lib/soluciones';
import TarjetaTrabajo from './TarjetaTrabajo';
import SelectorSegmentado from './SelectorSegmentado';

type Estado = 'por-resolver' | 'resuelto' | 'todos';
const POR_PAGINA = 12;
const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function ListaTickets({ tickets }: { tickets: Trabajo[] }) {
  const pendientes = tickets.filter((t) => t.estado === 'por-resolver').length;
  const [estado, setEstado] = useState<Estado>(pendientes > 0 ? 'por-resolver' : 'todos');
  const [talento, setTalento] = useState('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const arriba = useRef<HTMLDivElement>(null);

  const talentos = useMemo(
    () => [...new Set(tickets.flatMap((t) => t.etiquetas))].sort((a, b) => a.localeCompare(b, 'es')),
    [tickets],
  );
  const q = sinTildes(busca.trim());
  // La cuenta de cada estado respeta el talento y la búsqueda: dice cuántos verías al pulsarlo.
  const filtrados = useMemo(() => tickets.filter((t) =>
    (!talento || t.etiquetas.includes(talento)) &&
    (!q || sinTildes(`${t.titulo} ${t.descripcion ?? ''} ${t.etiquetas.join(' ')}`).includes(q)),
  ), [tickets, talento, q]);
  const cuenta = (e: Estado) => (e === 'todos' ? filtrados.length : filtrados.filter((t) => t.estado === e).length);
  const vistos = estado === 'todos' ? filtrados : filtrados.filter((t) => t.estado === estado);
  const paginas = Math.max(1, Math.ceil(vistos.length / POR_PAGINA));
  const p = Math.min(pagina, paginas - 1);
  const pagina0 = vistos.slice(p * POR_PAGINA, (p + 1) * POR_PAGINA);

  // Cualquier filtro nuevo vuelve a la primera página.
  const filtrar = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPagina(0); };
  const irA = (n: number) => {
    setPagina(n);
    arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (tickets.length === 0) return null;

  return (
    <section aria-label="Tickets" ref={arriba} className="scroll-mt-24">
      <div className="barra-trabajos">
        <SelectorSegmentado<Estado>
          etiqueta="Estado"
          valor={estado}
          onCambiar={filtrar(setEstado)}
          opciones={[
            { id: 'por-resolver', label: 'Por resolver', cuenta: cuenta('por-resolver') },
            { id: 'resuelto', label: 'Resueltos', cuenta: cuenta('resuelto') },
            { id: 'todos', label: 'Todos', cuenta: cuenta('todos') },
          ]}
        />
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {talentos.length > 1 && (
            <label className="segmentado-movil tickets-talento">
              <span className="sr-only">Talento</span>
              <select value={talento} onChange={(e) => filtrar(setTalento)(e.target.value)}>
                <option value="">Todos los talentos</option>
                {talentos.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          )}
          <div className="relative w-full sm:w-[320px] sm:shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--apagado)] pointer-events-none" />
            <input
              type="search"
              value={busca}
              onChange={(e) => filtrar(setBusca)(e.target.value)}
              placeholder="Buscar tickets…"
              aria-label="Buscar tickets"
              className="w-full h-11 pl-10 pr-4 rounded-full border border-[var(--linea-fuerte)] bg-white/85
                         text-[14.5px] text-[var(--texto)] placeholder:text-[var(--apagado)]
                         focus:border-[#7b5fbf]/60 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="mt-6">
        {pagina0.length === 0 ? (
          <p className="text-[14px] text-[var(--tenue)] py-6">
            {q || talento ? 'Ningún ticket coincide con la búsqueda.' : estado === 'por-resolver' ? 'No hay tickets por resolver ahora mismo.' : 'Todavía no hay tickets.'}
          </p>
        ) : (
          <div className="rejilla-trabajos">{pagina0.map((t) => <TarjetaTrabajo key={t.id} trabajo={t} />)}</div>
        )}
      </div>

      {paginas > 1 && (
        <nav aria-label="Páginas" className="paginacion-sitio">
          <button type="button" onClick={() => irA(p - 1)} disabled={p === 0} aria-label="Página anterior">
            <ChevronLeft aria-hidden />
          </button>
          {Array.from({ length: paginas }, (_, n) => (
            <button key={n} type="button" onClick={() => irA(n)} aria-current={n === p ? 'page' : undefined}>
              {n + 1}
            </button>
          ))}
          <button type="button" onClick={() => irA(p + 1)} disabled={p === paginas - 1} aria-label="Página siguiente">
            <ChevronRight aria-hidden />
          </button>
        </nav>
      )}
    </section>
  );
}
