'use client';

/**
 * LA LISTA DE TICKETS — dentro del tema «Tickets» de Clientes (Fernando, 2026-10-31: «pon debajo del
 * título todos los tickets que se han creado… paginación, filtros y el buscador»).
 *
 * Solo los terminados, y sin filtro de estado (el mismo día: «quita los filtros por estado… solo
 * completados»). Filtros: **solución, año, mes, talento y miembro**, más el buscador redondo de la casa.
 *
 * ── LAS MEZCLAS DE FILTROS ──────────────────────────────────────────────────────────
 * Se combinan todos (Y). Cada desplegable ofrece solo lo que, con los DEMÁS filtros puestos, todavía
 * deja algún ticket, y dice cuántos: así ninguna combinación lleva a una lista vacía por sorpresa. Lo
 * ya elegido se conserva en su lista aunque los otros filtros lo dejen a cero, para poder quitarlo.
 * La fecha es la que enseña la tarjeta (`creado`, en UTC como `comoFecha`).
 *
 * Tarjetas `TarjetaTrabajo` de 12 en 12 con paginación; cualquier filtro vuelve a la página 1.
 */

import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import type { Trabajo } from '@/lib/soluciones';
import TarjetaTrabajo from './TarjetaTrabajo';

const POR_PAGINA = 12;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Clave = 'solucion' | 'anio' | 'mes' | 'talento' | 'miembro';
type Filtros = Record<Clave, string>;
const VACIOS: Filtros = { solucion: '', anio: '', mes: '', talento: '', miembro: '' };

/** Los valores de un ticket para cada filtro (un ticket puede tener varios talentos o personas). */
function valores(t: Trabajo, solucionDe: Record<string, string>): Record<Clave, string[]> {
  const f = t.creado ? new Date(t.creado) : null;
  return {
    solucion: [...new Set(t.etiquetas.map((x) => solucionDe[x]).filter(Boolean))],
    anio: f ? [String(f.getUTCFullYear())] : [],
    mes: f ? [String(f.getUTCMonth() + 1)] : [],
    talento: t.etiquetas,
    miembro: t.personas.map((p) => p.nombre),
  };
}

export default function ListaTickets({
  tickets, solucionDe,
}: {
  tickets: Trabajo[];
  /** Talento → nombre de su solución (un talento pertenece a una sola, migración 042). */
  solucionDe: Record<string, string>;
}) {
  const [filtros, setFiltros] = useState<Filtros>(VACIOS);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const arriba = useRef<HTMLElement>(null);

  const q = sinTildes(busca.trim());
  const filas = useMemo(() => tickets.map((t) => ({
    t,
    v: valores(t, solucionDe),
    texto: sinTildes(`${t.titulo} ${t.descripcion ?? ''} ${t.etiquetas.join(' ')} ${t.personas.map((p) => p.nombre).join(' ')}`),
  })), [tickets, solucionDe]);

  /** ¿Pasa la fila todos los filtros menos `salvo`? */
  const pasa = (f: (typeof filas)[number], salvo?: Clave) =>
    (!q || f.texto.includes(q)) &&
    (Object.keys(filtros) as Clave[]).every((k) => k === salvo || !filtros[k] || f.v[k].includes(filtros[k]));

  const vistos = filas.filter((f) => pasa(f)).map((f) => f.t);

  /** Las opciones de un filtro con su cuenta, según los demás filtros. */
  const opciones = (k: Clave) => {
    const cuenta = new Map<string, number>();
    for (const f of filas) if (pasa(f, k)) for (const v of f.v[k]) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
    if (filtros[k] && !cuenta.has(filtros[k])) cuenta.set(filtros[k], 0);
    const lista = [...cuenta.entries()];
    if (k === 'anio') lista.sort((a, b) => Number(b[0]) - Number(a[0]));
    else if (k === 'mes') lista.sort((a, b) => Number(a[0]) - Number(b[0]));
    else lista.sort((a, b) => a[0].localeCompare(b[0], 'es'));
    return lista;
  };

  const FILTROS: { k: Clave; todos: string; nombre: (v: string) => string }[] = [
    { k: 'solucion', todos: 'Todas las soluciones', nombre: (v) => v },
    { k: 'anio', todos: 'Todos los años', nombre: (v) => v },
    { k: 'mes', todos: 'Todos los meses', nombre: (v) => MESES[Number(v) - 1] },
    { k: 'talento', todos: 'Todos los talentos', nombre: (v) => v },
    { k: 'miembro', todos: 'Todos los miembros', nombre: (v) => v },
  ];

  const paginas = Math.max(1, Math.ceil(vistos.length / POR_PAGINA));
  const p = Math.min(pagina, paginas - 1);
  const enPagina = vistos.slice(p * POR_PAGINA, (p + 1) * POR_PAGINA);
  const hayFiltro = !!q || Object.values(filtros).some(Boolean);

  const poner = (k: Clave, v: string) => { setFiltros((f) => ({ ...f, [k]: v })); setPagina(0); };
  const limpiar = () => { setFiltros(VACIOS); setBusca(''); setPagina(0); };
  const irA = (n: number) => {
    setPagina(n);
    arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (tickets.length === 0) return null;

  return (
    <section aria-label="Tickets" ref={arriba} className="scroll-mt-24">
      <div className="filtros-tickets">
        {FILTROS.map(({ k, todos, nombre }) => (
          <label key={k} className="filtro-sitio">
            <span className="sr-only">{todos}</span>
            <select value={filtros[k]} onChange={(e) => poner(k, e.target.value)} data-activo={filtros[k] ? '' : undefined}>
              <option value="">{todos}</option>
              {opciones(k).map(([v, n]) => <option key={v} value={v}>{nombre(v)} · {n}</option>)}
            </select>
          </label>
        ))}
        <div className="relative filtros-tickets-busca">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--apagado)] pointer-events-none" />
          <input
            type="search"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(0); }}
            placeholder="Buscar tickets…"
            aria-label="Buscar tickets"
            className="w-full h-11 pl-10 pr-4 rounded-full border border-[var(--linea-fuerte)] bg-white/85
                       text-[14.5px] text-[var(--texto)] placeholder:text-[var(--apagado)]
                       focus:border-[#7b5fbf]/60 focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="filtros-tickets-resumen">
        <span><b>{vistos.length.toLocaleString('es-ES')}</b> {vistos.length === 1 ? 'ticket' : 'tickets'}</span>
        {hayFiltro && (
          <button type="button" onClick={limpiar}><X aria-hidden /> Quitar filtros</button>
        )}
      </div>

      <div className="mt-5">
        {enPagina.length === 0 ? (
          <p className="text-[14px] text-[var(--tenue)] py-6">Ningún ticket coincide con los filtros.</p>
        ) : (
          <div className="rejilla-trabajos">{enPagina.map((t) => <TarjetaTrabajo key={t.id} trabajo={t} />)}</div>
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
