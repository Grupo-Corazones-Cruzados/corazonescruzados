'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Search, type LucideIcon } from 'lucide-react';
import MenuMas from '@/components/ui/MenuMas';
import { EnBarraAcciones } from '@/components/dashboard/BarraAcciones';
import {
  BTN_PRIMARY, BTN_SECONDARY, BTN_ACCENT,
  BTN_ICONO_PRIMARIO, BTN_ICONO_SECUNDARIO, BTN_ICONO_ACENTO,
} from '@/components/ui/Button';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface AccionLista {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** `primaria` (relleno, una sola y la última), `acento` (borde de color) o `secundaria`. */
  tipo?: 'primaria' | 'acento' | 'secundaria';
  disabled?: boolean;
  /** Lo que sale al pasar el ratón; si no hay, el `label` cuando el botón es solo icono. */
  hint?: string;
}

const COMPLETO = { primaria: BTN_PRIMARY, acento: BTN_ACCENT, secundaria: BTN_SECONDARY } as const;
const ICONO = { primaria: BTN_ICONO_PRIMARIO, acento: BTN_ICONO_ACENTO, secundaria: BTN_ICONO_SECUNDARIO } as const;

/** Lo mínimo que se le deja al buscador antes de empezar a encoger los botones. */
const MIN_BUSCADOR = 260;
const HUECO = 8;
const ANCHO_MAS = 36;

/**
 * LA BARRA DE UNA LISTA — definición ÚNICA (Fernando, 2026-10-29).
 *
 * Textual: *«el buscador siempre a la izquierda y a la derecha […] poner los botones que
 * existan de la manera que sea aunque sea reduciendo el texto del botón o poniendo solo el
 * icono […] o colocando un botón de más que sea de tres puntitos […] los filtros […] siempre
 * debajo del buscador tratando de ocupar todo el espacio disponible de su línea, sin llegar a
 * agregar filas»*.
 *
 *   Fila 1: [ buscador ················ ] [ acciones → ]
 *   Fila 2: [ filtro ][ filtro ][ filtro ]   ← reparten el ancho, nunca se parten en dos filas
 *
 * Las acciones se miden y se encogen por pasos hasta que el buscador conserve 260 px:
 *   1. todas con texto · 2. las secundarias solo con icono · 3. todas solo con icono ·
 *   4. las secundarias, una a una desde la izquierda, al «⋯» (la primaria nunca se esconde).
 * En el teléfono (< lg) la primaria baja a la barra de abajo y las demás van al «⋯».
 *
 * Los `filtros` son hijos sueltos (un `MultiSelectSearch`, un `Segmentado`…): cada uno toma
 * `flex-1`. Los de estado/alcance siguen en el raíl izquierdo, no aquí.
 */
export default function BarraLista({
  busqueda, onBusqueda, placeholder = 'Buscar…', sinBuscador = false,
  acciones = [], filtros, className = '',
}: {
  busqueda?: string;
  onBusqueda?: (v: string) => void;
  placeholder?: string;
  /** Oculta el buscador conservando su sitio (p. ej. una pestaña que no busca). */
  sinBuscador?: boolean;
  acciones?: AccionLista[];
  filtros?: ReactNode;
  className?: string;
}) {
  const filaRef = useRef<HTMLDivElement>(null);
  const medidaRef = useRef<HTMLDivElement>(null);
  // nivel 0-2: ver arriba; ≥ 3: cuántas secundarias van al «⋯» es `nivel - 2`.
  const [nivel, setNivel] = useState(0);

  const primaria = acciones.find((a) => a.tipo === 'primaria');
  const resto = acciones.filter((a) => a !== primaria);
  const firma = acciones.map((a) => `${a.label}|${a.tipo}`).join('·');

  useLayoutEffect(() => {
    const fila = filaRef.current, medida = medidaRef.current;
    if (!fila || !medida) return;
    const calcular = () => {
      const anchos = [...medida.children].map((c) => (c as HTMLElement).offsetWidth);
      const n = acciones.length;
      const completo = anchos.slice(0, n);       // con texto, en el orden de `acciones`
      const icono = anchos.slice(n, 2 * n);      // solo icono
      const iPrim = acciones.findIndex((a) => a.tipo === 'primaria');
      const suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0) + Math.max(0, xs.length - 1) * HUECO;
      const disponible = fila.clientWidth - MIN_BUSCADOR - HUECO;
      const medidas: number[] = [
        suma(completo),
        suma(acciones.map((_, i) => (i === iPrim ? completo[i] : icono[i]))),
        suma(icono),
      ];
      const secundarias = acciones.map((_, i) => i).filter((i) => i !== iPrim);
      for (let k = 1; k <= secundarias.length; k++) {
        const quedan = acciones.map((_, i) => i).filter((i) => !secundarias.slice(0, k).includes(i));
        medidas.push(suma(quedan.map((i) => icono[i])) + HUECO + ANCHO_MAS);
      }
      const elegido = medidas.findIndex((m) => m <= disponible);
      setNivel(elegido === -1 ? medidas.length - 1 : elegido);
    };
    calcular();
    const ro = new ResizeObserver(calcular);
    ro.observe(fila);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  const ocultas = Math.max(0, nivel - 2);
  const enMenu = resto.slice(0, ocultas);
  const visibles = acciones.filter((a) => !enMenu.includes(a));
  const conTexto = (a: AccionLista) => nivel === 0 || (nivel === 1 && a === primaria);

  const boton = (a: AccionLista, texto: boolean, key: string | number) => {
    const tipo = a.tipo ?? 'secundaria';
    return (
      <button
        key={key}
        type="button"
        onClick={a.onClick}
        disabled={a.disabled}
        title={a.hint ?? (texto ? undefined : a.label)}
        aria-label={texto ? undefined : a.label}
        className={`${texto ? COMPLETO[tipo] : ICONO[tipo]} shrink-0 whitespace-nowrap`}
        style={mf}
      >
        <a.icon className="w-4 h-4" />
        {texto && a.label}
      </button>
    );
  };

  return (
    <div className={`flex flex-col gap-2 mb-3 ${className}`}>
      <div ref={filaRef} className="relative flex items-center gap-2 min-w-0">
        <div className={`relative flex-1 min-w-0 ${sinBuscador ? 'invisible' : ''}`}>
          {onBusqueda && (
            <>
              <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={busqueda ?? ''}
                onChange={(e) => onBusqueda(e.target.value)}
                placeholder={placeholder}
                className="field-control w-full min-h-11 lg:min-h-0 pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
                style={mf}
              />
            </>
          )}
        </div>

        {/* Escritorio: las acciones según el ancho que haya. */}
        {acciones.length > 0 && (
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {enMenu.length > 0 && (
              <MenuMas items={enMenu.map((a) => ({ label: a.label, icon: a.icon, onClick: a.onClick, disabled: a.disabled, hint: a.hint }))} />
            )}
            {visibles.map((a, i) => boton(a, conTexto(a), i))}
          </div>
        )}

        {/* Teléfono: lo que no es la primaria, en el «⋯»; la primaria, abajo. */}
        {(primaria ? resto : acciones).length > 0 && (
          <span className="lg:hidden flex shrink-0">
            <MenuMas items={(primaria ? resto : acciones).map((a) => ({ label: a.label, icon: a.icon, onClick: a.onClick, disabled: a.disabled }))} />
          </span>
        )}

        {/* La regla de medir: las acciones con texto y solo con icono, invisibles. */}
        <div ref={medidaRef} aria-hidden className="absolute left-0 top-0 invisible pointer-events-none flex gap-2 h-0 overflow-hidden">
          {acciones.map((a, i) => boton(a, true, `c${i}`))}
          {acciones.map((a, i) => boton(a, false, `i${i}`))}
        </div>
      </div>

      {primaria && <EnBarraAcciones>{boton(primaria, true, 'tel')}</EnBarraAcciones>}

      {/* `empty:hidden`: un fragmento con todos sus filtros en `false` no deja una fila vacía. */}
      {filtros && (
        <div className="flex items-center gap-2 min-w-0 empty:hidden [&>*]:flex-1 [&>*]:min-w-0">
          {filtros}
        </div>
      )}
    </div>
  );
}
