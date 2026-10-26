/**
 * LA PORTADA PARTIDA EN DOS — lo que comparten la portada y su cabecera (Fernando, 2026-10-26).
 *
 * La portada se divide con una raya: a la izquierda el cielo estrellado de la Aventura, a la
 * derecha la Plataforma en claro. Pasar el puntero por «Aventura» o «Progreso» hace que ese
 * lado llene la pantalla.
 *
 * ── UNA SOLA VARIABLE MUEVE TODO ───────────────────────────────────────────────
 * `--corte` (px desde el borde izquierdo de la ventana) vive en `.landing-page`. La leen el
 * recorte de la escena clara, la raya y el nombre de la cabecera.
 *
 * ⛔ **NO se anima con CSS (`@property` + `transition`).** Así se hizo primero y en Chrome
 * iba bien, pero en el navegador de Fernando la raya se quedaba A MEDIAS —en reposo hacia
 * el 37 %, con «Aventura» en el 75 %— (2026-10-26): los hijos que leen una variable
 * heredada que se está animando no se repintaban cada cuadro. `useCorteAnimado` escribe el
 * valor en px cuadro a cuadro: para el navegador es un cambio de estilo normal.
 *
 * ── EL TEXTO CENTRAL VA EN CRISTAL ─────────────────────────────────────────────
 * Titular, botones y pensamiento cruzan la raya. Partirles el color en ella dejaba letras
 * mitad blancas y mitad oscuras; ahora van sobre `.cristal-portada` (cristal oscuro, el
 * lenguaje de la cápsula de las pestañas) y conservan sus colores de siempre.
 *
 * ── LO QUE SIGUE PARTIDO ───────────────────────────────────────────────────────
 * El nombre de la cabecera, sin cristal: `.texto-partido` lo pinta con un degradado de
 * corte duro, `--tp-a` a la izquierda de la raya y `--tp-b` a la derecha. Necesita `--x0`,
 * su borde izquierdo, que pone `refBordeIzquierdo`.
 */

import { useEffect, useRef, type RefObject } from 'react';

export type ModoPortada = 'partido' | 'aventura' | 'progreso';

/** Qué fracción del ancho queda a la izquierda de la raya en cada modo. */
function fraccionDe(modo: ModoPortada): number {
  if (modo === 'progreso') return 0;
  if (modo === 'aventura') return 1;
  return 0.5;
}

const DURACION_MS = 900;
// La misma curva que tenía la transición CSS, `cubic-bezier(.65, 0, .35, 1)`, aproximada.
const suavizar = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/**
 * Lleva `--corte` de donde esté al valor del modo, en ~900 ms, escribiéndolo en px en el
 * elemento cada cuadro. Si el modo cambia a mitad, sale desde donde iba. Con «reducir
 * movimiento», salta. Al cambiar el tamaño de la ventana se recoloca sin animar.
 */
export function useCorteAnimado(ref: RefObject<HTMLElement | null>, modo: ModoPortada) {
  const actual = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const destino = fraccionDe(modo);
    const desde = actual.current ?? destino;
    const pintar = (f: number) => {
      actual.current = f;
      el.style.setProperty('--corte', `${f * document.documentElement.clientWidth}px`);
    };
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    let raf = 0;
    const paso = (t: number) => {
      // La marca del cuadro puede ser anterior a `t0`: sin el `max`, arrancaría hacia atrás.
      const k = reducir ? 1 : Math.min(1, Math.max(0, (t - t0) / DURACION_MS));
      pintar(desde + (destino - desde) * suavizar(k));
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    pintar(desde);
    raf = requestAnimationFrame(paso);
    const alRedimensionar = () => pintar(actual.current ?? destino);
    window.addEventListener('resize', alRedimensionar);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', alRedimensionar);
    };
  }, [ref, modo]);
}

/**
 * Ref de callback (React 19, con limpieza): escribe en el elemento `--x0`, su borde
 * izquierdo en la ventana, y lo vuelve a medir al cambiar de tamaño él o la ventana.
 */
export function refBordeIzquierdo(el: HTMLElement | null) {
  if (!el) return;
  const medir = () => el.style.setProperty('--x0', `${el.getBoundingClientRect().left}px`);
  medir();
  const ro = new ResizeObserver(medir);
  ro.observe(el);
  window.addEventListener('resize', medir);
  // Lo que entra con una animación de desplazamiento se vuelve a medir al acabar.
  const t = window.setTimeout(medir, 1300);
  return () => {
    ro.disconnect();
    window.removeEventListener('resize', medir);
    window.clearTimeout(t);
  };
}
