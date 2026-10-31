'use client';

/**
 * LA GALERÍA CON FILTROS DEL SITIO — una sola definición para toda lista de tarjetas con filtros
 * (2026-10-31). La usan Clientes ▸ Tickets, Clientes ▸ Soluciones y las cuatro pestañas de la página
 * de cada talento (Proyectos · Tickets · Soluciones · Talentos). Nació en `ListaTickets` y se extrajo
 * cuando Fernando pidió «los filtros, buscadores requeridos» en las pestañas del talento.
 *
 * Arriba: los desplegables redondos (`.filtro-sitio`) y el buscador a todo el ancho; «× Quitar
 * filtros» si hay alguno puesto. Debajo, las tarjetas de `porPagina` en `porPagina`. Al pie, la
 * paginación y el recuento en su cápsula (regla de `/diseno`: el recuento cierra la galería).
 *
 * ── LAS MEZCLAS DE FILTROS ──────────────────────────────────────────────────────────
 * Se combinan todos (Y). Cada desplegable ofrece solo lo que, con los DEMÁS filtros puestos, todavía
 * deja algo, y dice cuántos. Lo elegido se conserva en su lista aunque los demás lo dejen a cero, para
 * poder quitarlo. Un filtro sin ninguna opción en toda la lista no se pinta.
 *
 * ── EL ORDEN SE LEE DE IZQUIERDA A DERECHA ──────────────────────────────────────────
 * El mosaico `.rejilla-trabajos` son columnas CSS, que se llenan de ARRIBA ABAJO: la 2.ª tarjeta caía
 * debajo de la 1.ª y la lista ordenada por fecha parecía desordenada (Fernando, 2026-10-31). Ya
 * montado, se reparte en turnos (1.ª a la columna 1, 2.ª a la 2, 3.ª a la 3, 4.ª otra vez a la 1…):
 * cada fila se lee en orden y cada tarjeta sigue midiendo lo suyo. Antes de montar (HTML del
 * servidor) queda el mosaico de columnas, que es el mismo contenido.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import type { Trabajo } from '@/lib/soluciones';

export interface FiltroGaleria<T> {
  clave: string;
  /** El texto de «todos» del desplegable: «Todos los años». */
  todos: string;
  valores: (x: T) => string[];
  nombre?: (v: string) => string;
  orden?: 'alfabetico' | 'numero-desc' | 'numero-asc';
}

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/* ── Filtros de uso común para proyectos y tickets (`Trabajo`). La fecha es la que enseña la
   tarjeta (`creado`), en UTC como `comoFecha`. ─────────────────────────────────────────── */
export const FILTRO_ANIO: FiltroGaleria<Trabajo> = {
  clave: 'anio', todos: 'Todos los años', orden: 'numero-desc',
  valores: (t) => (t.creado ? [String(new Date(t.creado).getUTCFullYear())] : []),
};
export const FILTRO_MES: FiltroGaleria<Trabajo> = {
  clave: 'mes', todos: 'Todos los meses', orden: 'numero-asc', nombre: (v) => MESES[Number(v) - 1],
  valores: (t) => (t.creado ? [String(new Date(t.creado).getUTCMonth() + 1)] : []),
};
export const FILTRO_MIEMBRO: FiltroGaleria<Trabajo> = {
  clave: 'miembro', todos: 'Todos los miembros', valores: (t) => t.personas.map((p) => p.nombre),
};
export const textoDeTrabajo = (t: Trabajo) =>
  `${t.titulo} ${t.descripcion ?? ''} ${t.etiquetas.join(' ')} ${t.personas.map((p) => p.nombre).join(' ')}`;

/** Las columnas del mosaico según el ancho, las mismas que `.rejilla-trabajos` (1 · 2 desde 720 · 3 desde 1100). */
function useColumnas(): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    const m2 = window.matchMedia('(min-width: 720px)');
    const m3 = window.matchMedia('(min-width: 1100px)');
    const medir = () => setN(m3.matches ? 3 : m2.matches ? 2 : 1);
    medir();
    m2.addEventListener('change', medir);
    m3.addEventListener('change', medir);
    return () => { m2.removeEventListener('change', medir); m3.removeEventListener('change', medir); };
  }, []);
  return n;
}

export default function GaleriaFiltrable<T>({
  items, clave, texto, filtros = [], render, unidad, buscar, vacio, porPagina = 12,
  rejilla = 'rejilla-trabajos', lista = false,
}: {
  items: T[];
  clave: (x: T) => string | number;
  /** Todo lo que encuentra el buscador. */
  texto: (x: T) => string;
  filtros?: FiltroGaleria<T>[];
  render: (x: T) => ReactNode;
  /** [singular, plural]: «ticket», «tickets». */
  unidad: [string, string];
  /** El texto del buscador: «Buscar tickets…». */
  buscar: string;
  /** Lo que se dice si no hay NADA (sin filtros). */
  vacio: string;
  porPagina?: number;
  rejilla?: string;
  /** `true`: la rejilla es un `<ol>` y cada tarjeta trae su `<li>`. */
  lista?: boolean;
}) {
  const [elegidos, setElegidos] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const arriba = useRef<HTMLElement>(null);
  const columnas = useColumnas();

  const q = sinTildes(busca.trim());
  const filas = useMemo(() => items.map((x) => ({
    x,
    v: Object.fromEntries(filtros.map((f) => [f.clave, f.valores(x)])) as Record<string, string[]>,
    t: sinTildes(texto(x)),
  })), [items, filtros, texto]);
  // Un filtro que no tiene ningún valor en toda la lista no se pinta.
  const visibles = filtros.filter((f) => filas.some((r) => r.v[f.clave].length > 0));

  const pasa = (r: (typeof filas)[number], salvo?: string) =>
    (!q || r.t.includes(q)) &&
    visibles.every((f) => f.clave === salvo || !elegidos[f.clave] || r.v[f.clave].includes(elegidos[f.clave]));

  const vistos = filas.filter((r) => pasa(r)).map((r) => r.x);

  const opciones = (f: FiltroGaleria<T>) => {
    const cuenta = new Map<string, number>();
    for (const r of filas) if (pasa(r, f.clave)) for (const v of r.v[f.clave]) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
    const elegido = elegidos[f.clave];
    if (elegido && !cuenta.has(elegido)) cuenta.set(elegido, 0);
    const l = [...cuenta.entries()];
    if (f.orden === 'numero-desc') l.sort((a, b) => Number(b[0]) - Number(a[0]));
    else if (f.orden === 'numero-asc') l.sort((a, b) => Number(a[0]) - Number(b[0]));
    else l.sort((a, b) => a[0].localeCompare(b[0], 'es'));
    return l;
  };

  const paginas = Math.max(1, Math.ceil(vistos.length / porPagina));
  const p = Math.min(pagina, paginas - 1);
  const enPagina = vistos.slice(p * porPagina, (p + 1) * porPagina);
  const hayFiltro = !!q || Object.values(elegidos).some(Boolean);
  const n = (k: number) => k.toLocaleString('es-ES');

  const poner = (k: string, v: string) => { setElegidos((e) => ({ ...e, [k]: v })); setPagina(0); };
  const limpiar = () => { setElegidos({}); setBusca(''); setPagina(0); };
  const irA = (k: number) => {
    setPagina(k);
    arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (items.length === 0) return <p className="text-[14px] text-[var(--tenue)] py-6">{vacio}</p>;

  const tarjetas = enPagina.map((x) => <FragmentoConClave key={clave(x)}>{render(x)}</FragmentoConClave>);
  const enTurnos = rejilla === 'rejilla-trabajos' && !lista && columnas !== null;

  return (
    <section ref={arriba} className="scroll-mt-24">
      <div className="filtros-galeria">
        {visibles.map((f) => (
          <label key={f.clave} className="filtro-sitio">
            <span className="sr-only">{f.todos}</span>
            <select value={elegidos[f.clave] ?? ''} onChange={(e) => poner(f.clave, e.target.value)}
              data-activo={elegidos[f.clave] ? '' : undefined}>
              <option value="">{f.todos}</option>
              {opciones(f).map(([v, k]) => <option key={v} value={v}>{f.nombre ? f.nombre(v) : v} · {k}</option>)}
            </select>
          </label>
        ))}
        <div className="relative filtros-galeria-busca">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--apagado)] pointer-events-none" />
          <input
            type="search"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(0); }}
            placeholder={buscar}
            aria-label={buscar.replace(/…$/, '')}
            className="w-full h-11 pl-11 pr-4 rounded-full border border-[var(--linea-fuerte)] bg-white/85
                       text-[14.5px] text-[var(--texto)] placeholder:text-[var(--apagado)]
                       focus:border-[#7b5fbf]/60 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {hayFiltro && (
        <div className="filtros-galeria-quitar">
          <button type="button" onClick={limpiar}><X aria-hidden /> Quitar filtros</button>
        </div>
      )}

      <div className="mt-5">
        {enPagina.length === 0
          ? <p className="text-[14px] text-[var(--tenue)] py-6">Nada coincide con los filtros.</p>
          : lista ? <ol className={rejilla}>{tarjetas}</ol>
          : enTurnos ? (
            <div className="rejilla-turnos" style={{ '--columnas': columnas } as CSSProperties}>
              {Array.from({ length: columnas! }, (_, c) => (
                <div key={c} className="rejilla-turnos-columna">{tarjetas.filter((_, k) => k % columnas! === c)}</div>
              ))}
            </div>
          )
          : <div className={rejilla}>{tarjetas}</div>}
      </div>

      <div className="pie-galeria">
        {paginas > 1 && (
          <nav aria-label="Páginas" className="paginacion-sitio">
            <button type="button" onClick={() => irA(p - 1)} disabled={p === 0} aria-label="Página anterior">
              <ChevronLeft aria-hidden />
            </button>
            {Array.from({ length: paginas }, (_, k) => (
              <button key={k} type="button" onClick={() => irA(k)} aria-current={k === p ? 'page' : undefined}>
                {k + 1}
              </button>
            ))}
            <button type="button" onClick={() => irA(p + 1)} disabled={p === paginas - 1} aria-label="Página siguiente">
              <ChevronRight aria-hidden />
            </button>
          </nav>
        )}
        <p className="pie-galeria-recuento" aria-live="polite">
          {paginas > 1 && <>Mostrando <b>{n(p * porPagina + 1)}–{n(p * porPagina + enPagina.length)}</b> de </>}
          <b>{n(vistos.length)}</b> {vistos.length === 1 ? unidad[0] : unidad[1]}
        </p>
      </div>
    </section>
  );
}

function FragmentoConClave({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
