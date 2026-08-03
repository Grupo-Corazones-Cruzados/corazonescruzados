'use client';

/**
 * «Estírate hasta el fondo de la pantalla, y ni un píxel más.»
 *
 * ── EL FALLO QUE EVITA ─────────────────────────────────────────────────────────
 * El pie del panel (`DashboardBreadcrumb`, la barra con la ruta) es `fixed bottom-0`:
 * flota por encima del contenido. Un bloque que se estire a `100vh` **termina por debajo
 * de él** y su última franja queda tapada. Pasó con las tablas (2026-08-01) y con los
 * paneles del Estudio del agente (2026-08-03).
 *
 * Y al revés: un `max-h-[70vh]` **no llena** — es un techo. Con poco contenido el bloque
 * mide lo que su contenido y deja media pantalla muerta debajo.
 *
 * ── POR QUÉ MIDE EN VEZ DE RESTAR UNA CONSTANTE ────────────────────────────────
 * Un `calc(100vh - 250px)` es un número a ojo que no sabe nada del pie, se queda viejo en
 * cuanto cambia algo encima, y hay que reajustarlo en cada vista. Aquí se mide el hueco de
 * verdad y se para en el primero de dos topes:
 *   · el borde de la ventana menos el **pie** —buscado por `[data-app-footer]`, no por sus
 *     36 px, para que siga saliendo bien si cambia de alto o si la página no lo tiene—;
 *   · el fondo del **contenedor con desplazamiento**, descontando su relleno inferior. Sin
 *     esto el bloque llega hasta el pie, el relleno del contenedor se suma por debajo y
 *     aparece una barra de desplazamiento con espacio muerto.
 *
 * ── ⚠️ LO QUE COSTÓ DOS INTENTOS: CUÁNDO MEDIR ────────────────────────────────
 * La primera versión medía en un `useEffect` con un `ResizeObserver` sobre `document.body`,
 * y **no funcionaba**, por dos motivos que se tapaban entre sí:
 *
 *  1. El efecto corre al montar, cuando la pantalla todavía enseña el cargador y el bloque
 *     **no existe**: `ref.current` es `null`, no mide, y el efecto no vuelve a ejecutarse
 *     al llegar los datos.
 *  2. `<main>` es `overflow-auto min-h-screen`, así que **el `body` nunca cambia de
 *     tamaño**: el contenido crece dentro de `main`, que se desplaza por dentro. El
 *     observador no se disparaba jamás y el bloque se quedaba sin alto para siempre.
 *
 * Por eso la referencia es una **función**: React la llama en cuanto el nodo entra en el
 * documento, y ese es el momento exacto en que se puede medir. Y el observador vigila **el
 * padre**, que sí cambia de alto cuando aparece lo de arriba.
 *
 * Se remide en `resize`, no al desplazar: el objetivo es justo que no haya desplazamiento,
 * y atarlo al `scroll` haría un bucle —cambia el alto, cambia el desplazamiento, cambia el
 * alto—.
 */

import { useCallback, useEffect, useState } from 'react';

/** Alto del pie fijo de la app. Cero si esta página no lo tiene. */
function altoDelPie(): number {
  const el = document.querySelector('[data-app-footer]');
  return el ? Math.round(el.getBoundingClientRect().height) : 0;
}

/** El ancestro que se desplaza, para no invadir su relleno inferior. */
function contenedorDesplazable(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const desborde = getComputedStyle(p).overflowY;
    if (desborde === 'auto' || desborde === 'scroll') return p;
  }
  return null;
}

export function useAltoHastaElPie<T extends HTMLElement = HTMLDivElement>(
  { minimo = 420, respiro = 12 }: { minimo?: number; respiro?: number } = {},
) {
  const [nodo, setNodo] = useState<T | null>(null);
  const [alto, setAlto] = useState<number>();

  // Referencia como FUNCIÓN: React la llama con el nodo en cuanto entra en el documento y
  // con `null` al salir. Es lo que arregla el caso «el bloque aún no existía al montar».
  const ref = useCallback((n: T | null) => setNodo(n), []);

  useEffect(() => {
    if (!nodo) return;

    const medir = () => {
      const arriba = nodo.getBoundingClientRect().top;

      let fondo = window.innerHeight - altoDelPie() - respiro;

      const cont = contenedorDesplazable(nodo);
      if (cont) {
        const relleno = parseFloat(getComputedStyle(cont).paddingBottom) || 0;
        fondo = Math.min(fondo, cont.getBoundingClientRect().bottom - relleno);
      }

      const h = Math.max(Math.round(fondo - arriba), minimo);
      // Solo se guarda si cambia de verdad: un `setState` por cada aviso del observador
      // sería un renderizado continuo.
      setAlto((previo) => (previo === undefined || Math.abs(previo - h) > 1 ? h : previo));
    };

    // Tras el primer trazado: lo de arriba puede seguir montándose.
    const cuadro = requestAnimationFrame(medir);
    window.addEventListener('resize', medir);

    // El PADRE, no el `body`: dentro de un contenedor con desplazamiento propio el `body`
    // no cambia de tamaño nunca. Vigilar el propio nodo haría un bucle: le cambiamos el alto.
    const observador = new ResizeObserver(() => requestAnimationFrame(medir));
    if (nodo.parentElement) observador.observe(nodo.parentElement);

    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('resize', medir);
      observador.disconnect();
    };
  }, [nodo, minimo, respiro]);

  // Antes de la primera medida no se impone alto: el bloque mide por su contenido y no pega
  // un salto visible al ajustarse.
  return { ref, style: alto ? { height: alto } : undefined };
}
