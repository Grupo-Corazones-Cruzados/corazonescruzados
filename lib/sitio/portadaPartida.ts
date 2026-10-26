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
 * ── LOS TEXTOS QUE CRUZAN LA RAYA ──────────────────────────────────────────────
 * Titular, subtítulo, pensamiento y el nombre de la cabecera: `.texto-partido` los pinta
 * con un degradado de corte duro, `--tp-a` a la izquierda de la raya y `--tp-b` a la
 * derecha, así que se leen sobre el cielo y sobre el claro y, como la raya sigue al
 * puntero, se recolorean en vivo. Necesita `--x0`, el borde izquierdo del elemento, que
 * pone `refBordeIzquierdo`. ⚠️ Cada trozo, bloque o `inline-block` (en un `inline` partido
 * en dos líneas el fondo se coloca como si fuera una sola), y sin `transform` animado.
 * (Probados y descartados el 2026-10-26: un cristal redondeado y una placa pixel detrás.)
 */

import { useEffect, useRef, type RefObject } from 'react';

export type ModoPortada = 'partido' | 'aventura' | 'progreso';

/** Qué fracción del ancho queda a la izquierda de la raya en cada modo. */
function fraccionDe(modo: ModoPortada): number {
  if (modo === 'progreso') return 0;
  if (modo === 'aventura') return 1;
  return 0.5;
}

// Con la pantalla partida, la raya sigue al puntero (Fernando, 2026-10-26: «animarlo según
// el puntero donde se pone»), pero sin salirse de esta franja alrededor del centro: es un
// guiño, no una persiana. 0.4 → entre el 30 % y el 70 %.
const SEGUIMIENTO = 0.4;
// Constante de tiempo del suavizado: cuanto mayor, más perezosa. ~160 ms se nota viva sin
// ir pegada al ratón; llenar la pantalla con un botón tarda así ~0,6 s.
const TAU_MS = 160;

/**
 * Lleva `--corte` hacia su objetivo cuadro a cuadro (en px). El objetivo es el del modo y,
 * en `partido`, se desplaza hacia el puntero. Persigue el objetivo con un suavizado
 * exponencial en vez de una transición fija: así un cambio a mitad (otro botón, el ratón
 * que se mueve) sale desde donde iba, sin saltos. Con «reducir movimiento» no sigue al
 * puntero y salta. Solo hay bucle mientras falta camino.
 */
export function useCorteAnimado(ref: RefObject<HTMLElement | null>, modo: ModoPortada) {
  const actual = useRef<number | null>(null);
  const puntero = useRef(0.5);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const objetivo = () => {
      const base = fraccionDe(modo);
      return modo === 'partido' && !reducir ? base + (puntero.current - 0.5) * SEGUIMIENTO : base;
    };
    const pintar = (f: number) => {
      actual.current = f;
      el.style.setProperty('--corte', `${f * document.documentElement.clientWidth}px`);
    };

    let raf = 0;
    let antes = 0;
    const paso = (t: number) => {
      const dt = antes ? Math.min(64, t - antes) : 16;
      antes = t;
      const meta = objetivo();
      const desde = actual.current ?? meta;
      const siguiente = reducir ? meta : desde + (meta - desde) * (1 - Math.exp(-dt / TAU_MS));
      if (Math.abs(meta - siguiente) < 0.0005) {
        pintar(meta);
        raf = 0;
        antes = 0;
        return;
      }
      pintar(siguiente);
      raf = requestAnimationFrame(paso);
    };
    const arrancar = () => { if (!raf) raf = requestAnimationFrame(paso); };

    pintar(actual.current ?? objetivo());
    arrancar();

    const alMover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      puntero.current = e.clientX / document.documentElement.clientWidth;
      if (modo === 'partido') arrancar();
    };
    const alRedimensionar = () => pintar(actual.current ?? objetivo());
    window.addEventListener('pointermove', alMover, { passive: true });
    window.addEventListener('resize', alRedimensionar);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', alMover);
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
