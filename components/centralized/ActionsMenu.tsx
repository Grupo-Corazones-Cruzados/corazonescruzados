'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface ActionItem {
  label: string;
  icon?: any;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Botón de acciones (solo icono ⋮) que abre un menú desplegable de opciones.
 * Reusable para el panel de detalle (candidatos, miembros…).
 */
export default function ActionsMenu({ items, label = 'Acciones' }: { items: ActionItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!items.length) return null;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 flex items-center justify-center rounded-md text-digi-muted hover:text-accent hover:bg-black/[0.05] transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-30 min-w-[190px] bg-digi-card border border-digi-border rounded-lg shadow-lg py-1">
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { setOpen(false); it.onClick(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[12.5px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                it.danger ? 'text-red-600 hover:bg-red-50' : 'text-digi-text hover:bg-black/[0.04]'
              }`}
              style={mf}
            >
              {it.icon && <it.icon className="w-4 h-4 shrink-0" />}
              <span className="truncate">{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
