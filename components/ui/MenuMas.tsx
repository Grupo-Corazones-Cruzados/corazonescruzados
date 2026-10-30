'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { useAparicion } from '@/lib/hooks/useAparicion';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface AccionMenu {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  /** Destructiva: en rojo y, por convención, la última. */
  danger?: boolean;
  disabled?: boolean;
  /** Por qué está deshabilitada (sale al pasar el ratón). */
  hint?: string;
}

const ANCHO = 240;
const MARGEN = 16;

/**
 * EL MENÚ «⋯» DE LAS ACCIONES SECUNDARIAS — definición ÚNICA (2026-10-23).
 *
 * Nació dentro de `DetailHeader` como un `absolute right-0`: en el teléfono el botón queda a
 * la IZQUIERDA (la fila de acciones se parte debajo del título) y el menú se abría hacia la
 * izquierda, fuera de la pantalla — se leía «minar ticket». Ahora es `fixed`, se mide al
 * abrir y se encaja a 16 px de los bordes; se abre hacia abajo y, si no cabe, hacia arriba.
 *
 * Entra y sale con movimiento (`scale-95 → 100`, ~200 ms), se cierra con Escape, al tocar
 * fuera, al desplazar y al elegir. Cada opción lleva icono + texto; la destructiva en rojo.
 * Regla en `/diseno` §4-quater.
 */
export default function MenuMas({
  items, label = 'Más acciones', className = '', boton,
}: {
  items: AccionMenu[];
  label?: string;
  className?: string;
  /**
   * Un botón con texto en vez del «⋯», cuando el menú ES la acción (p. ej. «Reporte global»
   * con sus variantes). Lleva icono, texto y un chevron; `className` es su estilo de botón.
   */
  boton?: { texto: string; icon: LucideIcon; className: string };
}) {
  const [abierto, setAbierto] = useState(false);
  const { montado, visible } = useAparicion(abierto);
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arriba: boolean } | null>(null);
  const cerrar = useCallback(() => setAbierto(false), []);

  useLayoutEffect(() => {
    if (!montado || !botonRef.current) return;
    const r = botonRef.current.getBoundingClientRect();
    const ancho = Math.min(ANCHO, window.innerWidth - MARGEN * 2);
    const left = Math.max(MARGEN, Math.min(r.right - ancho, window.innerWidth - ancho - MARGEN));
    const alto = menuRef.current?.offsetHeight ?? 0;
    const arriba = r.bottom + 6 + alto > window.innerHeight - MARGEN && r.top - 6 - alto > MARGEN;
    setPos({ top: arriba ? r.top - 6 - alto : r.bottom + 6, left, arriba });
  }, [montado, items.length]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || botonRef.current?.contains(t)) return;
      cerrar();
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('touchstart', fuera);
    document.addEventListener('keydown', tecla);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('touchstart', fuera);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [abierto, cerrar]);

  if (!items.length) return null;

  // Como `Burbuja`: dentro de un diálogo abierto se cuelga de él (top layer); si no, del
  // envoltorio del tema, para heredar los colores de `.corp`.
  const contenedor = typeof document === 'undefined' ? null
    : botonRef.current?.closest('dialog') ?? document.querySelector('.corp') ?? document.body;

  return (
    <>
      {boton ? (
        <button
          ref={botonRef}
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={abierto}
          className={`${boton.className} ${className}`}
          style={mf}
        >
          <boton.icon className="w-4 h-4" /> {boton.texto}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </button>
      ) : (
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title={label}
        className={`shrink-0 w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center border rounded transition-colors ${
          abierto ? 'border-accent/40 bg-accent-light text-accent' : 'border-digi-border text-digi-muted hover:bg-accent/10 hover:text-accent hover:border-accent/40'
        } ${className}`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      )}

      {montado && contenedor && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          className={`superficie-flotante fixed z-[80] bg-digi-card border border-digi-border shadow-lg rounded-lg p-1 transition-[opacity,scale] duration-200 ease-out ${
            pos?.arriba ? 'origin-bottom-right' : 'origin-top-right'
          } ${visible && pos ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: Math.min(ANCHO, (typeof window !== 'undefined' ? window.innerWidth : ANCHO + 32) - MARGEN * 2) }}
        >
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              title={it.disabled ? it.hint : undefined}
              onClick={() => { cerrar(); it.onClick(); }}
              className={`w-full text-left flex items-center gap-2.5 min-h-11 sm:min-h-9 px-2.5 py-1.5 text-[13px] rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                it.danger ? 'text-red-600 hover:bg-red-500/10' : 'text-digi-text hover:bg-accent/10'
              }`}
              style={mf}
            >
              {it.icon && <it.icon className={`w-4 h-4 shrink-0 ${it.danger ? '' : 'text-digi-muted'}`} />}
              <span className="min-w-0 truncate">{it.label}</span>
            </button>
          ))}
        </div>,
        contenedor,
      )}
    </>
  );
}
