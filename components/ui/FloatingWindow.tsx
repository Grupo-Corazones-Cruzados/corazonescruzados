'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, GripHorizontal } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

type Mode = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * Ventana FLOTANTE arrastrable (por la cabecera) y REDIMENSIONABLE desde bordes/esquinas.
 * Sin overlay: deja interactuar con lo que hay detrás. Cierra con la X.
 */
export default function FloatingWindow({
  open, onClose, title, children,
  initialWidth = 560, initialHeight = 620, minWidth = 360, minHeight = 320,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  initialWidth?: number; initialHeight?: number; minWidth?: number; minHeight?: number;
}) {
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // Portal: se monta en el contenedor `.corp` (conserva el tema Fluent/oscuro) para NO quedar atrapado
  // por ancestros con overflow/backdrop-filter (que crean bloque contenedor para position:fixed).
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  useEffect(() => { setPortalEl((document.querySelector('.corp') as HTMLElement) || document.body); }, []);

  useEffect(() => {
    if (open && !rect && typeof window !== 'undefined') {
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = Math.min(initialWidth, vw - 24), h = Math.min(initialHeight, vh - 24);
      setRect({ x: Math.max(12, (vw - w) / 2), y: Math.max(12, (vh - h) / 2), w, h });
    }
    if (!open) setRect(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const start = (mode: Mode) => (e: React.PointerEvent) => {
    if (!rect) return;
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, r0 = { ...rect };
    const vw = window.innerWidth, vh = window.innerHeight;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let { x, y, w, h } = r0;
      if (mode === 'move') { x = r0.x + dx; y = r0.y + dy; }
      else {
        if (mode.includes('e')) w = r0.w + dx;
        if (mode.includes('s')) h = r0.h + dy;
        if (mode.includes('w')) { w = r0.w - dx; x = r0.x + dx; }
        if (mode.includes('n')) { h = r0.h - dy; y = r0.y + dy; }
        if (w < minWidth) { if (mode.includes('w')) x = r0.x + (r0.w - minWidth); w = minWidth; }
        if (h < minHeight) { if (mode.includes('n')) y = r0.y + (r0.h - minHeight); h = minHeight; }
      }
      w = Math.min(w, vw - 16); h = Math.min(h, vh - 16);
      x = Math.min(Math.max(x, -w + 120), vw - 120);
      y = Math.min(Math.max(y, 8), vh - 48);
      setRect({ x, y, w, h });
    };
    const onUp = () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  if (!open || !rect || !portalEl) return null;

  return createPortal(
    <div className="fixed z-[70] bg-digi-card border border-digi-border rounded-xl shadow-2xl flex flex-col overflow-hidden" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
      {/* Cabecera (arrastrar) */}
      <div onPointerDown={start('move')} className="flex items-center gap-2 px-3.5 py-2.5 border-b border-digi-border bg-digi-dark cursor-move select-none shrink-0">
        <GripHorizontal className="w-4 h-4 text-digi-muted shrink-0" />
        <span className="text-[13px] font-semibold text-digi-text flex-1 min-w-0 truncate" style={mf}>{title}</span>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Cerrar" className="w-7 h-7 flex items-center justify-center rounded-md text-digi-muted hover:text-digi-text hover:bg-black/[0.05] transition-colors shrink-0"><X className="w-4 h-4" /></button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto p-4">{children}</div>

      {/* Manijas de redimensionado */}
      <div onPointerDown={start('n')} className="absolute top-0 left-2 right-2 h-1.5 cursor-ns-resize" />
      <div onPointerDown={start('s')} className="absolute bottom-0 left-2 right-2 h-1.5 cursor-ns-resize" />
      <div onPointerDown={start('w')} className="absolute left-0 top-2 bottom-2 w-1.5 cursor-ew-resize" />
      <div onPointerDown={start('e')} className="absolute right-0 top-2 bottom-2 w-1.5 cursor-ew-resize" />
      <div onPointerDown={start('nw')} className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize" />
      <div onPointerDown={start('ne')} className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize" />
      <div onPointerDown={start('sw')} className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize" />
      <div onPointerDown={start('se')} className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize" />
    </div>,
    portalEl,
  );
}
