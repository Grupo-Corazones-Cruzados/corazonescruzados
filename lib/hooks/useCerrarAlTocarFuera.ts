'use client';

import { useRef, type MouseEvent, type PointerEvent } from 'react';

/**
 * Cierra una ventana al tocar el velo que la rodea. Exige que el toque también EMPIECE en el velo:
 * al seleccionar texto en un campo y soltar fuera, el navegador manda el clic al velo y se cerraba.
 * `bloqueado`: mientras se envía el formulario no se cierra.
 */
export function useCerrarAlTocarFuera(onClose: () => void, bloqueado = false) {
  const empezoEnVelo = useRef(false);
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => { empezoEnVelo.current = e.target === e.currentTarget; },
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (!bloqueado && empezoEnVelo.current && e.target === e.currentTarget) onClose();
    },
  };
}
