'use client';

/**
 * «Estírate hasta el pie de la página, y ni un píxel más.»
 *
 * ── EL FALLO QUE EVITA ─────────────────────────────────────────────────────────
 * El pie del panel (`DashboardBreadcrumb`, la barra con la ruta) es `fixed bottom-0`:
 * flota por encima del contenido. Un bloque que se estire a `100vh` **termina por debajo
 * de él** y su última franja queda tapada. Pasó con las tablas (arreglado el 2026-08-01) y
 * volvió a pasar con los paneles del Estudio del agente, que además llevaban un
 * `calc(100vh - 250px)` a ojo: un número que no sabía nada del pie y que había que volver
 * a ajustar cada vez que cambiaba algo encima.
 *
 * ── POR QUÉ MIDE EN VEZ DE RESTAR UNA CONSTANTE ────────────────────────────────
 * Se mide **el hueco real**: desde donde arranca el elemento hasta el borde de la ventana,
 * menos el pie —buscado por `[data-app-footer]`, no por sus 36 px— y un respiro. Así:
 *   · si el pie cambia de alto, el cálculo sigue saliendo bien;
 *   · si la página **no tiene** pie (fuera del panel), no sobra un hueco muerto;
 *   · y si cambia lo que hay ENCIMA —una barra de filtros que pasa a dos líneas, un aviso
 *     que aparece— se recalcula solo, cosa que una constante nunca hará.
 *
 * ⚠️ Se remide en `resize` y cuando algo de la página cambia de tamaño, **no al
 * desplazar**: el objetivo es justo que la página no se desplace. Atarlo al `scroll`
 * crearía un bucle —cambia el alto, cambia el desplazamiento, cambia el alto—.
 */

import { useEffect, useRef, useState } from 'react';

/** Alto del pie fijo de la app. Cero si esta página no lo tiene. */
function altoDelPie(): number {
  if (typeof document === 'undefined') return 0;
  const el = document.querySelector('[data-app-footer]');
  return el ? Math.round(el.getBoundingClientRect().height) : 0;
}

export function useAltoHastaElPie<T extends HTMLElement = HTMLDivElement>(
  { minimo = 420, respiro = 16 }: { minimo?: number; respiro?: number } = {},
) {
  const ref = useRef<T | null>(null);
  const [alto, setAlto] = useState<number>();

  useEffect(() => {
    const medir = () => {
      const el = ref.current;
      if (!el) return;
      const arriba = el.getBoundingClientRect().top;
      const h = Math.max(window.innerHeight - arriba - respiro - altoDelPie(), minimo);
      // Solo se guarda si cambia de verdad: un `setState` por cada aviso del observador
      // sería un renderizado continuo.
      setAlto((previo) => (previo === undefined || Math.abs(previo - h) > 1 ? h : previo));
    };

    // Tras el primer trazado: lo de arriba puede seguir montándose.
    const cuadro = requestAnimationFrame(medir);
    window.addEventListener('resize', medir);
    const observador = new ResizeObserver(() => requestAnimationFrame(medir));
    observador.observe(document.body);
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('resize', medir);
      observador.disconnect();
    };
  }, [minimo, respiro]);

  // Antes de la primera medida no se impone alto: el bloque mide por su contenido y no
  // pega un salto visible al ajustarse.
  return { ref, style: alto ? { height: alto } : undefined };
}
