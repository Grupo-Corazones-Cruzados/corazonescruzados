'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, MoreVertical } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface ActionItem {
  label: string;
  /** Marca la opción vigente (✓ a la derecha), para usar el menú como SELECTOR. */
  activo?: boolean;
  icon?: any;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Por qué está deshabilitada (sale al pasar el ratón). Una opción bloqueada sin motivo confunde. */
  hint?: string;
}

/**
 * Botón de acciones (solo icono ⋮) que abre un menú desplegable de opciones.
 * Reusable para el panel de detalle (candidatos, miembros…) y las filas de requerimientos.
 *
 * `lado`:
 *   · `'abajo'` (por defecto) — el menú cae bajo el botón, alineado a su derecha.
 *   · `'izquierda'` (2026-09-28) — el menú flota A LA IZQUIERDA del botón, a su altura. Va
 *     con `position: fixed` calculada al abrir: dentro de una lista con desplazamiento
 *     propio (los requerimientos de un proyecto), un menú `absolute` queda RECORTADO por el
 *     `overflow` en la última fila. Por eso se cierra al desplazar o redimensionar — fijo,
 *     se quedaría flotando lejos de su fila.
 *
 * `disparador` (2026-09-30): sustituye el ⋮ por otro contenido —el selector de estado del
 * ticket enseña su insignia con un chevron—. El menú y su comportamiento son los mismos.
 */
export default function ActionsMenu({ items, label = 'Acciones', lado = 'abajo', disparador }: {
  items: ActionItem[]; label?: string; lado?: 'abajo' | 'izquierda'; disparador?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    if (lado !== 'izquierda') return () => document.removeEventListener('mousedown', onDoc);
    const cerrar = () => setOpen(false);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [open, lado]);

  const alternar = () => {
    if (!open && lado === 'izquierda' && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.top, right: window.innerWidth - r.left + 4 });
    }
    setOpen((o) => !o);
  };

  if (!items.length) return null;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={alternar}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={disparador
          ? 'inline-flex items-center gap-1 rounded-md hover:bg-black/[0.05] transition-colors'
          : 'w-8 h-8 flex items-center justify-center rounded-md text-digi-muted hover:text-accent hover:bg-black/[0.05] transition-colors'}
      >
        {disparador ?? <MoreVertical className="w-4 h-4" />}
      </button>
      {open && (
        <div role="menu"
          className={`${lado === 'izquierda' ? 'fixed z-[60]' : disparador ? 'absolute left-0 top-full mt-1 z-30' : 'absolute right-0 top-9 z-30'} min-w-[190px] bg-digi-card border border-digi-border rounded-lg shadow-lg py-1`}
          style={lado === 'izquierda' && pos ? { top: pos.top, right: pos.right } : undefined}>
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={it.disabled}
              title={it.hint}
              onClick={() => { setOpen(false); it.onClick(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[12.5px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                it.danger ? 'text-red-600 hover:bg-red-50' : 'text-digi-text hover:bg-black/[0.04]'
              }`}
              style={mf}
            >
              {it.icon && <it.icon className="w-4 h-4 shrink-0" />}
              <span className="truncate flex-1">{it.label}</span>
              {it.activo && <Check className="w-3.5 h-3.5 shrink-0 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
