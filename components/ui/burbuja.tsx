'use client';

/**
 * BURBUJA FLOTANTE — la mecánica de posicionar una ventanita junto a un botón.
 *
 * Definición ÚNICA, compartida por `BotonAvisos` y `BotonAyuda`. Nació dentro del primero;
 * al aparecer el segundo se extrajo, porque copiar cien líneas de medidas y de listeners
 * garantiza que las dos versiones se separen en la primera corrección.
 *
 * Lo que resuelve, y que a ojo no se ve:
 *
 * ⚠️ **Centrar la burbuja en el botón NO vale.** Se descubrió midiendo en un navegador de
 * verdad: estos botones viven en cabeceras y barras, cerca del borde superior, y con
 * cuatro o cinco líneas la burbuja es más alta que el hueco que queda encima. Centrada,
 * se salía por arriba de la pantalla (`top: -41`) y las primeras líneas quedaban fuera.
 * Por eso se acota al viewport, y la PUNTA se mueve dentro de la burbuja para seguir
 * señalando al botón aunque el cuerpo ya no esté centrado.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** A qué lado del botón sale la burbuja. */
export type LadoBurbuja = 'izquierda' | 'derecha';

interface Caja {
  top: number;
  /** Distancia al borde correspondiente. Cuál, lo dice `lado`. */
  offset: number;
  /** Altura de la punta DENTRO de la burbuja, en px desde su borde superior. */
  flechaY: number;
  /** La primera pasada mide sin pintar; hasta que no está lista, va invisible. */
  listo: boolean;
}

const MARGEN = 8;
const SEPARACION = 8;

/**
 * Calcula la posición en dos pasadas y engancha el cierre por clic fuera, Escape,
 * scroll y resize.
 */
export function usarBurbuja(
  abierto: boolean,
  cerrar: () => void,
  botonRef: RefObject<HTMLElement | null>,
  lado: LadoBurbuja,
  dependencia?: unknown,
) {
  const burbujaRef = useRef<HTMLDivElement | null>(null);
  const [caja, setCaja] = useState<Caja | null>(null);

  useLayoutEffect(() => {
    if (!abierto) { setCaja(null); return; }
    if (!botonRef.current) return;
    const r = botonRef.current.getBoundingClientRect();
    const centro = r.top + r.height / 2;
    const offset = lado === 'izquierda'
      ? window.innerWidth - r.left + SEPARACION   // se ancla por la derecha
      : r.right + SEPARACION;                     // se ancla por la izquierda

    const alto = burbujaRef.current?.offsetHeight;
    if (!alto) {
      // Primera pasada: el nodo aún no existe. Se coloca provisional e invisible para que
      // la segunda pasada no produzca un salto visible.
      setCaja({ top: centro, offset, flechaY: 0, listo: false });
      return;
    }

    const tope = Math.max(MARGEN, Math.min(centro - alto / 2, window.innerHeight - alto - MARGEN));
    const flechaY = Math.max(12, Math.min(centro - tope, alto - 12));

    // Y lo mismo en horizontal, por el mismo motivo: un botón cerca del borde derecho con
    // la burbuja a la derecha la manda fuera de la pantalla. `max-width` no basta — solo
    // encoge, no reposiciona. Se acota el ancla al ancho disponible.
    const ancho = burbujaRef.current?.offsetWidth ?? 0;
    const tope2 = Math.max(MARGEN, Math.min(offset, window.innerWidth - ancho - MARGEN));

    setCaja({ top: tope, offset: tope2, flechaY, listo: true });
    // `caja?.listo` está en las dependencias a propósito: es lo que dispara la 2ª pasada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, lado, dependencia, caja?.listo]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (burbujaRef.current?.contains(t) || botonRef.current?.contains(t)) return;
      cerrar();
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    // Al desplazar o redimensionar se CIERRA en vez de recolocarse: perseguir el botón
    // mientras la página se mueve se ve peor que cerrar y volver a abrir.
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [abierto, cerrar, botonRef]);

  return { burbujaRef, caja };
}

/** El contenedor flotante ya posicionado. Se pinta en un portal sobre `document.body`. */
export function Burbuja({
  caja, burbujaRef, lado, etiqueta, ancho = 340, contenedor, children,
}: {
  caja: Caja;
  burbujaRef: RefObject<HTMLDivElement | null>;
  lado: LadoBurbuja;
  etiqueta: string;
  ancho?: number;
  /**
   * Dónde se cuelga la burbuja. Por defecto `document.body`, pero **dentro de un
   * `PixelModal` hay que pasar su `<dialog>`**: un diálogo abierto con `showModal()`
   * vive en la *top layer* del navegador, que está por encima de CUALQUIER z-index.
   * Colgada del body, la burbuja se dibujaba detrás del panel y el (?) parecía roto.
   */
  contenedor?: Element | null;
  children: ReactNode;
}) {
  return createPortal(
    <div
      ref={burbujaRef}
      role="dialog"
      aria-label={etiqueta}
      // z-[80] para quedar por encima del banner de Comandos Violeta (z-[60]) y de los
      // paneles deslizantes (z-[70]).
      className="fixed z-[80] max-w-[calc(100vw-32px)] rounded-lg border border-digi-border bg-digi-card shadow-xl"
      style={{
        top: caja.top,
        width: ancho,
        ...(lado === 'izquierda' ? { right: caja.offset } : { left: caja.offset }),
        // Invisible en la primera pasada, pero ocupando sitio para poder medirla.
        visibility: caja.listo ? 'visible' : 'hidden',
      }}
    >
      {children}
      {/* La punta, a la altura del botón — no siempre en el centro de la burbuja. */}
      <span
        className={`absolute w-3 h-3 rotate-45 bg-digi-card border-digi-border ${
          lado === 'izquierda' ? '-right-[6px] border-r border-t' : '-left-[6px] border-l border-b'
        }`}
        style={{ top: caja.flechaY, marginTop: -6 }}
      />
    </div>,
    contenedor ?? document.body,
  );
}
