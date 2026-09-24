'use client';

import { useEffect, useRef } from 'react';

interface PixelModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** `sm` = ventanita centrada · `md`/`lg`/`xl` = panel lateral derecho (ver `.corp` en globals.css). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Cuando está ocupado (p. ej. guardando), bloquea el cierre por overlay/Escape/X. */
  busy?: boolean;
  children: React.ReactNode;
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-5xl' };

/**
 * ⚠️ ¿ESTE MODAL LLEGARÍA A VERSE? — LA RED DE SEGURIDAD DE `showModal()`.
 *
 * `showModal()` **deja inerte todo lo que quede fuera del diálogo**, y eso NO depende de
 * que el diálogo se vea. Si un ancestro lo tiene escondido con CSS (`xl:hidden`, por
 * ejemplo), el navegador abre un diálogo de 0×0 sin fondo y, a cambio, **el resto de la
 * página deja de responder al ratón**. Medido con un navegador de verdad el 2026-09-23:
 * el mismo botón registra el clic antes de `showModal()`, no lo registra con el diálogo
 * invisible abierto, y vuelve a registrarlo tras `close()`.
 *
 * Es el fallo más desagradable que puede tener un control compartido: no se ve, no da
 * error, y quien lo sufre solo sabe que «los botones ya no funcionan».
 *
 * Quien monta el modal debe decidir con JavaScript si toca montarlo (ver
 * `useConsultaMedia`); esto es solo el seguro para que, si alguien vuelve a esconderlo
 * con una clase, el resultado sea un modal que no se abre y no que la página se cuelgue.
 *
 * Un `<dialog>` cerrado siempre es `display:none`, así que se mira al PADRE: sin cajas
 * (`getClientRects()`) significa que algún ancestro está en `display:none`.
 */
function sePinta(el: HTMLDialogElement): boolean {
  const padre = el.parentElement;
  if (!padre) return false;
  if (typeof padre.checkVisibility === 'function') return padre.checkVisibility();
  return padre.getClientRects().length > 0;
}

export default function PixelModal({ open, onClose, title, size = 'md', busy = false, children }: PixelModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) { if (sePinta(el)) el.showModal(); }
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(e) => { if (busy) e.preventDefault(); }}
      onClick={(e) => { if (!busy && e.target === dialogRef.current) onClose(); }}
      className="fixed inset-0 z-50 m-0 w-full h-full bg-transparent backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="modal-overlay flex items-center justify-center min-h-full p-4">
        <div
          data-size={size}
          className={`modal-surface pixel-card w-full ${SIZES[size]} animate-[pixelFadeIn_0.2s_ease-out]`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="modal-header flex items-center justify-between mb-4 pb-3 border-b-2 border-digi-border">
            {/* `min-w-0 truncate`: sin esto un título largo se mete DEBAJO del botón de
                cerrar —se vio con un recordatorio en teléfono— en vez de recortarse. */}
            <h2
              className="modal-title pixel-heading text-sm text-digi-text min-w-0 truncate"
              title={title}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              disabled={busy}
              aria-label="Cerrar"
              className="modal-close shrink-0 w-8 h-8 flex items-center justify-center text-digi-muted hover:text-digi-text border-2 border-digi-border hover:border-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              X
            </button>
          </div>

          {/* Body */}
          <div className="modal-body max-h-[70vh] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </dialog>
  );
}
