'use client';

import { useEffect, useState } from 'react';

/** Lo que dura entrar o salir. La misma en todo el panel. */
export const DURACION_APARICION = 200;

/**
 * LO QUE APARECE AL NAVEGAR ENTRA Y SALE CON MOVIMIENTO (Fernando, 2026-10-22).
 *
 * `montado` dice si el elemento tiene que existir; `visible`, si ya está en su sitio. Para
 * que haya transición de ENTRADA se monta en la posición «fuera» y se marca visible un
 * cuadro después (doble `requestAnimationFrame`: con uno solo el navegador no llega a ver el
 * «antes»). Al cerrar, `visible` cae primero y el elemento sigue montado hasta que termina
 * la salida; después se desmonta, porque escondido no debe existir.
 *
 * El mismo hook de los productos (`productos/catering/src/componentes/ui.tsx`).
 */
export function useAparicion(abierto: boolean) {
  const [montado, setMontado] = useState(abierto);
  const [visible, setVisible] = useState(abierto);

  useEffect(() => {
    if (abierto) {
      setMontado(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setVisible(true)); });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    setVisible(false);
    const t = window.setTimeout(() => setMontado(false), DURACION_APARICION);
    return () => window.clearTimeout(t);
  }, [abierto]);

  return { montado, visible };
}
