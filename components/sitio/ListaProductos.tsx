'use client';

/**
 * LAS SOLUCIONES PUBLICADAS — bajo la lista del tema «Soluciones» de Clientes (Fernando, 2026-11-01:
 * «hagamos lo mismo de poner las soluciones o productos existentes, pero con el nombre de
 * soluciones, y poner los filtros que se puedan también»).
 *
 * Son los productos del catálogo (los de las pestañas «Soluciones» de cada talento), todos juntos,
 * del más reciente al más antiguo. Filtros que se combinan: **solución, talento, año, miembro y
 * precio**. La galería, la paginación y el recuento al pie son los de `GaleriaFiltrable`; la
 * tarjeta, `TarjetaProducto` con el contacto de quien la publicó.
 */

import { useMemo } from 'react';
import type { Producto } from '@/lib/soluciones';
import GaleriaFiltrable, { type FiltroGaleria } from './GaleriaFiltrable';
import { TarjetaProducto } from './SolucionesExplorador';

const precio = (v: number) => `${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

export default function ListaProductos({
  productos, solucionDe,
}: {
  productos: Producto[];
  /** Talento → nombre de su solución. */
  solucionDe: Record<string, string>;
}) {
  const filtros = useMemo<FiltroGaleria<Producto>[]>(() => [
    { clave: 'solucion', todos: 'Todas las soluciones',
      valores: (p) => (p.talento && solucionDe[p.talento] ? [solucionDe[p.talento]] : []) },
    { clave: 'talento', todos: 'Todos los talentos', valores: (p) => (p.talento ? [p.talento] : []) },
    { clave: 'anio', todos: 'Todos los años', orden: 'numero-desc',
      valores: (p) => (p.creado ? [String(new Date(p.creado).getUTCFullYear())] : []) },
    { clave: 'miembro', todos: 'Todos los miembros', valores: (p) => p.personas.map((x) => x.nombre) },
    { clave: 'precio', todos: 'Todos los precios', orden: 'numero-asc', nombre: (v) => precio(Number(v)),
      valores: (p) => (p.precio !== null ? [String(p.precio)] : []) },
  ], [solucionDe]);

  if (productos.length === 0) return null;
  return (
    <GaleriaFiltrable
      items={productos}
      clave={(p) => p.id}
      texto={(p) => `${p.nombre} ${p.descripcion ?? ''} ${p.talento ?? ''} ${p.personas.map((x) => x.nombre).join(' ')}`}
      filtros={filtros}
      render={(p) => <TarjetaProducto producto={p} etiqueta="Solución" />}
      unidad={['solución', 'soluciones']}
      buscar="Buscar soluciones…"
      vacio="Todavía no hay soluciones publicadas."
    />
  );
}
