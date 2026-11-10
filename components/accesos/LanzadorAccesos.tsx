'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Search, Star, X } from 'lucide-react';
import { useAparicion } from '@/lib/hooks/useAparicion';
import type { Herramienta } from '@/lib/herramientas/catalogo';
import type { AccesoProducto } from '@/lib/productos/tipos';
import { iconoDeProducto } from './useAccesos';

const mf = { fontFamily: 'var(--font-body)' } as const;

const CATEGORIA: Record<Herramienta['category'], string> = { edicion: 'Edición', gestion: 'Gestión', app: 'Apps' };

export const claveProducto = (p: AccesoProducto) => `p:${p.producto}/${p.slug}`;
export const claveHerramienta = (h: Herramienta) => `h:${h.id}`;

/**
 * EL LANZADOR DEL MENÚ 1 (Fernando, 2026-11-10: herramientas y productos se acumulaban en el menú).
 * El menú enseña solo los FAVORITOS; aquí están TODOS, con buscador, agrupados (productos; herramientas
 * por categoría) y una estrella para fijar o quitar cada uno del menú. Sale a la derecha del raíl con
 * su velo; en el teléfono ocupa la pantalla. Se cierra con el velo, la X, Escape o al abrir algo.
 */
export default function LanzadorAccesos({
  abierto, alCerrar, productos, herramientas, rutaHerramienta, abrirProducto, fijados, alternar, activo,
}: {
  abierto: boolean;
  alCerrar: () => void;
  productos: AccesoProducto[];
  herramientas: Herramienta[];
  rutaHerramienta: (h: Herramienta) => string;
  abrirProducto: (p: AccesoProducto) => void;
  fijados: Set<string>;
  alternar: (clave: string) => void;
  activo?: string;
}) {
  const { montado, visible } = useAparicion(abierto);
  const [busqueda, setBusqueda] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  const [destino, setDestino] = useState<Element | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setBusqueda('');
    setDestino(document.querySelector('.corp') ?? document.body);
    const t = setTimeout(() => campo.current?.focus(), 60);
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => { clearTimeout(t); document.removeEventListener('keydown', tecla); };
  }, [abierto, alCerrar]);

  const q = busqueda.trim().toLowerCase();
  const prods = useMemo(() => productos.filter((p) => !q || p.productoNombre.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q)), [productos, q]);
  const grupos = useMemo(() => {
    const out: { titulo: string; items: Herramienta[] }[] = [];
    for (const cat of Object.keys(CATEGORIA) as Herramienta['category'][]) {
      const items = herramientas.filter((h) => h.category === cat && (!q || h.name.toLowerCase().includes(q) || h.description.toLowerCase().includes(q)));
      if (items.length) out.push({ titulo: CATEGORIA[cat], items });
    }
    return out;
  }, [herramientas, q]);

  if (!montado || !destino) return null;

  const estrella = (clave: string, nombre: string) => {
    const fijo = fijados.has(clave);
    return (
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); alternar(clave); }}
        aria-pressed={fijo} aria-label={fijo ? `Quitar ${nombre} del menú` : `Fijar ${nombre} en el menú`}
        title={fijo ? 'Quitar del menú' : 'Fijar en el menú'}
        className={`w-9 h-9 shrink-0 grid place-items-center rounded-md transition-colors ${fijo ? 'text-amber-400' : 'text-digi-muted/60 hover:text-digi-text'}`}>
        <Star className="w-4 h-4" fill={fijo ? 'currentColor' : 'none'} strokeWidth={2} />
      </button>
    );
  };
  const fila = (clave: string, activa: boolean) =>
    `flex-1 min-w-0 flex items-center gap-2.5 h-10 px-2 rounded-md text-[13px] font-medium transition-colors ${activa ? 'bg-accent-light text-accent' : 'text-digi-text hover:bg-white/[0.06]'}`;
  const titulo = (t: string) => <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-digi-muted/70">{t}</p>;
  const nada = !prods.length && !grupos.length;

  return createPortal(
    <>
      <div aria-hidden onClick={alCerrar}
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ease-out ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <div role="dialog" aria-modal="true" aria-label="Todos los productos y herramientas" style={mf}
        className={`fixed z-[61] inset-0 lg:inset-auto lg:top-0 lg:bottom-0 lg:left-16 lg:w-[22rem] pt-[var(--seguro-arriba)] pb-[var(--seguro-abajo)] bg-digi-card lg:border-r border-digi-border shadow-2xl flex flex-col transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
          visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
        <div className="h-14 shrink-0 flex items-center gap-2 px-3 border-b border-digi-border">
          <div className="flex-1 min-w-0 flex items-center gap-2 h-9 px-2.5 rounded-md border border-digi-border bg-digi-darker/40">
            <Search className="w-4 h-4 text-digi-muted shrink-0" />
            <input ref={campo} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…"
              className="flex-1 min-w-0 !bg-transparent !border-0 !shadow-none !p-0 !h-auto outline-none focus:!ring-0 text-[13px] text-digi-text placeholder:text-digi-muted" />
          </div>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="w-9 h-9 shrink-0 grid place-items-center rounded-md text-digi-muted hover:text-digi-text">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
          {nada && <p className="text-[13px] text-digi-muted text-center py-10">Nada coincide con «{busqueda}».</p>}

          {prods.length > 0 && <>
            {titulo('Productos')}
            {prods.map((p) => (
              <div key={p.url} className="flex items-center gap-1">
                <button type="button" onClick={() => { alCerrar(); abrirProducto(p); }} className={fila(claveProducto(p), activo === `${p.producto}/${p.slug}`)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={iconoDeProducto(p.producto)} alt="" width={24} height={24} className="w-6 h-6 shrink-0 rounded-md" />
                  <span className="min-w-0 text-left">
                    <span className="block truncate">{p.productoNombre}</span>
                    {p.nombre && p.nombre !== p.productoNombre && <span className="block truncate text-[11px] font-normal text-digi-muted">{p.nombre}</span>}
                  </span>
                </button>
                {estrella(claveProducto(p), p.productoNombre)}
              </div>
            ))}
          </>}

          {grupos.map((g) => (
            <div key={g.titulo}>
              {titulo(`Herramientas · ${g.titulo}`)}
              {g.items.map((h) => (
                <div key={h.id} className="flex items-center gap-1">
                  <Link href={rutaHerramienta(h)} onClick={alCerrar} className={fila(claveHerramienta(h), activo === h.id)}>
                    <span className="w-6 h-6 shrink-0 grid place-items-center"><h.Icon className="w-[18px] h-[18px]" strokeWidth={2} /></span>
                    <span className="truncate">{h.name}</span>
                  </Link>
                  {estrella(claveHerramienta(h), h.name)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>,
    destino,
  );
}
