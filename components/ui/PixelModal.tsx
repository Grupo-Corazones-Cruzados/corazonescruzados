'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccionesFijas } from '@/components/ui/acciones-fijas';
import BotonCerrar from '@/components/ui/BotonCerrar';

interface PixelModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** `sm` = ventanita centrada · `md`/`lg`/`xl` = panel lateral derecho, los tres del MISMO ancho
   *  (`--ancho-panel-derecho` en globals.css, 2026-10-04). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Cuando está ocupado (p. ej. guardando), bloquea el cierre por overlay/Escape/X. */
  busy?: boolean;
  /**
   * Las acciones del formulario (Cancelar / Guardar…). Van FUERA de lo que se desplaza, pegadas
   * abajo: así «Guardar» se ve siempre sin bajar al final (Fernando, 2026-10-29: en el teléfono
   * había que recorrer todo el formulario para encontrarlo). En el teléfono los botones se
   * reparten el ancho.
   */
  pie?: React.ReactNode;
  children: React.ReactNode;
}

/** Lo que dura la salida; el mismo valor que la animación `modalSale` de globals.css. */
const DURACION_SALIDA = 200;

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

export default function PixelModal({ open, onClose, title, size = 'md', busy = false, pie, children }: PixelModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // Dónde empezó la pulsación. Arrastrar desde dentro del formulario (al seleccionar texto)
  // y soltar fuera dispara el `click` en el velo; eso no debe cerrar nada.
  const pulsadoEnVelo = useRef(false);
  const esVelo = (t: EventTarget | null) => t === dialogRef.current || t === overlayRef.current;
  const cuerpoRef = useRef<HTMLDivElement>(null);
  // Los botones que el formulario lleva DENTRO del cuerpo se fijan abajo en el panel, como
  // si fueran `pie`. Ver `acciones-fijas.ts`.
  useAccionesFijas(cuerpoRef, open && size !== 'sm' && !pie);

  /**
   * ⭐ LA SALIDA TAMBIÉN SE ANIMA (Fernando, 2026-10-23: lo que aparece al navegar entra y
   * sale con movimiento). Al pasar `open` a false el diálogo NO se cierra de golpe: se marca
   * `data-saliendo`, el CSS lo desliza fuera (panel) o lo funde (ventanita) en
   * `DURACION_SALIDA` y entonces se llama a `close()`. Mientras sale pinta su ÚLTIMO
   * contenido —el padre ya pudo poner su estado a `null`— y no recibe clics.
   */
  const [saliendo, setSaliendo] = useState(false);
  const ultimo = useRef({ title, children, pie });
  if (open) ultimo.current = { title, children, pie };

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      setSaliendo(false);
      if (!el.open && sePinta(el)) el.showModal();
      return;
    }
    if (!el.open) return;
    setSaliendo(true);
    const t = window.setTimeout(() => { el.close(); setSaliendo(false); }, DURACION_SALIDA);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      // ⚠️ Solo los eventos de ESTE diálogo (2026-10-30). Una ventanita abierta dentro de un
      // panel es su hija en React, y React hace subir `close`/`cancel` por el árbol aunque el
      // navegador no los haga subir: cerrar la ventanita («Ingreso» en el estado financiero)
      // cerraba también el mes entero.
      onClose={(e) => { if (e.target !== e.currentTarget) return; if (open) onClose(); }}
      // Escape: en vez de dejar que el navegador cierre de golpe, se pide el cierre al padre
      // y la salida se anima como cualquier otra.
      onCancel={(e) => { if (e.target !== e.currentTarget) return; e.preventDefault(); if (!busy) onClose(); }}
      data-saliendo={saliendo || undefined}
      // Pulsar el VELO cierra (Fernando, 2026-10-04). Antes solo se miraba el `<dialog>`, pero
      // lo tapa entero `.modal-overlay`, que era quien recibía el clic: no cerraba nunca.
      onMouseDown={(e) => { pulsadoEnVelo.current = esVelo(e.target); }}
      onClick={(e) => { if (!busy && pulsadoEnVelo.current && esVelo(e.target)) onClose(); pulsadoEnVelo.current = false; }}
      className="fixed inset-0 z-50 m-0 w-full h-full bg-transparent backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div ref={overlayRef} className="modal-overlay flex items-center justify-center min-h-full p-4">
        <div
          data-size={size}
          className={`modal-surface pixel-card w-full ${SIZES[size]} animate-[pixelFadeIn_0.2s_ease-out] ${saliendo ? 'pointer-events-none' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="modal-header flex items-center justify-between mb-4 pb-3 border-b-2 border-digi-border">
            {/* `min-w-0 truncate`: sin esto un título largo se mete DEBAJO del botón de
                cerrar —se vio con un recordatorio en teléfono— en vez de recortarse. */}
            <h2
              className="modal-title pixel-heading text-sm text-digi-text min-w-0 truncate"
              title={ultimo.current.title}
            >
              {ultimo.current.title}
            </h2>
            {/* La X de todas las ventanas: `BotonCerrar` (2026-09-29). Antes era la letra «X»
                con la tipografía pixel dentro de un borde. */}
            <BotonCerrar onClick={onClose} disabled={busy} className="modal-close" />
          </div>

          {/* Body */}
          <div ref={cuerpoRef} className="modal-body max-h-[70vh] overflow-y-auto">
            {ultimo.current.children}
          </div>

          {ultimo.current.pie && (
            <div className="modal-pie shrink-0 flex flex-wrap items-center justify-end gap-2 border-t border-digi-border max-sm:[&>button]:flex-1">
              {ultimo.current.pie}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
