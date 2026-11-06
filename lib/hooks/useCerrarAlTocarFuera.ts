'use client';

import { useRef, type MouseEvent, type PointerEvent } from 'react';
import { appDeTelefono } from '@/lib/sitio/appDeTelefono';

const SALIDA_MS = 200;

/**
 * Cerrar una ventana de acceso: con su X o tocando el velo que la rodea. El toque debe EMPEZAR en el
 * velo: al seleccionar texto en un campo y soltar fuera, el navegador manda el clic al velo. En las apps
 * la hoja baja antes de irse (`[data-saliendo]` en `globals.css`), como en una app móvil; en la web se
 * cierra al momento. `bloqueado`: mientras se envía el formulario el velo no cierra.
 */
export function useCerrarAlTocarFuera(onClose: () => void, bloqueado = false) {
  const empezoEnVelo = useRef(false);
  const velo = useRef<HTMLDivElement>(null);
  const yendose = useRef(false);

  const cerrar = () => {
    if (yendose.current) return;
    const el = velo.current;
    if (!el || !appDeTelefono() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return; }
    yendose.current = true;
    el.dataset.saliendo = '1';
    window.setTimeout(onClose, SALIDA_MS);
  };

  return {
    cerrar,
    velo: {
      ref: velo,
      onPointerDown: (e: PointerEvent<HTMLElement>) => { empezoEnVelo.current = e.target === e.currentTarget; },
      onClick: (e: MouseEvent<HTMLElement>) => {
        if (!bloqueado && empezoEnVelo.current && e.target === e.currentTarget) cerrar();
      },
    },
  };
}
