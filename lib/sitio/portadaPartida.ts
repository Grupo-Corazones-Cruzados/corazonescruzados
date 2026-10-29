/**
 * LA PORTADA PARTIDA EN DOS — lo que comparten la portada y su cabecera (Fernando, 2026-10-26).
 *
 * La portada se divide con una raya: a la izquierda el cielo estrellado de la Aventura, a la
 * derecha la Plataforma en claro. Pasar el puntero por «Aventura» o «Progreso» hace que ese
 * lado llene la pantalla.
 *
 * ── UNA SOLA VARIABLE MUEVE TODO ───────────────────────────────────────────────
 * `--corte` (px desde el borde izquierdo de la ventana) vive en `.landing-page`. La leen el
 * recorte de la escena clara y la frontera líquida (`LicuadoPortada`).
 *
 * ⛔ **NO se anima con CSS (`@property` + `transition`).** Así se hizo primero y en Chrome
 * iba bien, pero en el navegador de Fernando la raya se quedaba A MEDIAS —en reposo hacia
 * el 37 %, con «Aventura» en el 75 %— (2026-10-26): los hijos que leen una variable
 * heredada que se está animando no se repintaban cada cuadro. `useCorteAnimado` escribe el
 * valor en px cuadro a cuadro: para el navegador es un cambio de estilo normal.
 *
 * (El color partido en la raya —`.texto-partido`/`refBordeIzquierdo`— se retiró el 2026-10-26:
 * ya ningún texto cruza la raya con un color en cada lado.)
 */

import { useEffect, useRef, type RefObject } from 'react';

export type ModoPortada = 'partido' | 'aventura' | 'progreso';

/** Qué fracción del ancho queda a la izquierda de la raya en cada modo. */
function fraccionDe(modo: ModoPortada): number {
  if (modo === 'progreso') return 0;
  if (modo === 'aventura') return 1;
  return 0.5;
}

// Constante de tiempo del suavizado: llenar la pantalla con un botón tarda ~0,6 s.
const TAU_MS = 160;

/**
 * Lleva `--corte` hacia el valor del modo cuadro a cuadro (en px), con un suavizado
 * exponencial: un cambio a mitad (de un botón al otro) sale desde donde iba, sin saltos.
 * Con «reducir movimiento», salta. Solo hay bucle mientras falta camino.
 *
 * ⛔ La raya NO sigue al puntero. Se probó (entre el 30 % y el 70 %) y Fernando lo vio como
 * un error: «sigue el puntero la pantalla de fondo» (2026-10-26). En reposo, al centro.
 */
/** En el teléfono la frontera es HORIZONTAL: Aventura arriba, Progreso abajo (2026-10-27). */
export const CONSULTA_VERTICAL = '(max-width: 639.98px)';

/**
 * UN CUADRO DE ANIMACIÓN QUE LLEGA SIEMPRE (2026-10-29).
 *
 * En el iPhone de Fernando (app instalada) la frontera se quedó A MEDIAS al elegir Progreso: el
 * corazón cruzó y el eslogan salió (animaciones CSS), pero `--corte` no llegó a 0. Al cerrar y
 * reabrir la app, iba bien. iOS puede PAUSAR o retrasar `requestAnimationFrame` (al volver del
 * segundo plano, con ahorro de batería): si el siguiente cuadro no llega, el bucle se queda donde
 * iba. Esto pide el cuadro y, por si no llega, un `setTimeout` de respaldo; el primero que llegue
 * gana y el otro se anula. Devuelve con qué cancelarlo.
 */
export function pedirCuadro(cb: (t: number) => void, respaldoMs = 100): () => void {
  let hecho = false;
  const raf = requestAnimationFrame((t) => { if (!hecho) { hecho = true; clearTimeout(tm); cb(t); } });
  // Con la página oculta NO hay respaldo: el bucle espera (no gasta batería en segundo plano) y
  // quien lo usa lo reanuda al volver (`visibilitychange`/`pageshow`).
  const tm = document.hidden
    ? undefined
    : setTimeout(() => { if (!hecho) { hecho = true; cancelAnimationFrame(raf); cb(performance.now()); } }, respaldoMs);
  return () => { hecho = true; cancelAnimationFrame(raf); clearTimeout(tm); };
}

export function useCorteAnimado(ref: RefObject<HTMLElement | null>, modo: ModoPortada) {
  // Se guarda en PX (no en fracción): en vertical la meta del modo partido se MIDE.
  const actual = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mqVertical = window.matchMedia(CONSULTA_VERTICAL);
    const escena = () => el.querySelector<HTMLElement>('.escena-progreso');
    /**
     * La meta en px. Horizontal: fracción del ancho. Vertical: 0 / alto, y en `partido`, el
     * punto medio entre la tarjeta de Aventura y la de Progreso (se mide: las tarjetas entran
     * con movimiento, por eso se sigue midiendo un rato).
     */
    const meta = () => {
      const e = escena();
      if (!mqVertical.matches || !e) return fraccionDe(modo) * document.documentElement.clientWidth;
      const H = e.clientHeight;
      if (modo === 'progreso') return 0;
      if (modo === 'aventura') return H;
      const arriba = el.querySelector('.panel-mundo-aventura')?.getBoundingClientRect();
      const abajo = el.querySelector('.panel-mundo-progreso')?.getBoundingClientRect();
      const top = e.getBoundingClientRect().top;
      if (arriba && abajo && abajo.top > arriba.bottom) return (arriba.bottom + abajo.top) / 2 - top;
      return H * 0.5;
    };
    el.dataset.orientacion = mqVertical.matches ? 'vertical' : 'horizontal';
    const pintar = (px: number) => {
      actual.current = px;
      el.style.setProperty('--corte', `${px}px`);
    };

    let cancelar: () => void = () => undefined;
    let antes = 0;
    const t0 = performance.now();
    const paso = (t: number) => {
      const dt = antes ? Math.min(64, t - antes) : 16;
      antes = t;
      const m = meta();
      const desde = actual.current ?? m;
      const siguiente = reducir ? m : desde + (m - desde) * (1 - Math.exp(-dt / TAU_MS));
      const midiendo = mqVertical.matches && modo === 'partido' && t - t0 < 2500;
      if (Math.abs(m - siguiente) < 0.5 && !midiendo) {
        pintar(m);
        return;
      }
      pintar(siguiente);
      cancelar = pedirCuadro(paso);
    };

    pintar(actual.current ?? meta());
    cancelar = pedirCuadro(paso);
    // Red de seguridad: pase lo que pase con los cuadros, a los 1,8 s (tras la deriva de medir,
    // en `partido` vertical, a los 2,8 s) la frontera está en su sitio.
    const garantia = window.setTimeout(() => {
      cancelar();
      pintar(meta());
    }, mqVertical.matches && modo === 'partido' ? 2800 : 1800);
    const alRedimensionar = () => {
      el.dataset.orientacion = mqVertical.matches ? 'vertical' : 'horizontal';
      pintar(meta());
    };
    // Al volver a la app (segundo plano, o la página restaurada de la caché del navegador), la
    // frontera salta a donde debe estar: no se fía de un bucle que pudo quedarse a medias.
    const alVolver = () => { if (!document.hidden) alRedimensionar(); };
    window.addEventListener('resize', alRedimensionar);
    mqVertical.addEventListener('change', alRedimensionar);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('pageshow', alVolver);
    return () => {
      cancelar();
      window.clearTimeout(garantia);
      window.removeEventListener('resize', alRedimensionar);
      mqVertical.removeEventListener('change', alRedimensionar);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('pageshow', alVolver);
    };
  }, [ref, modo]);
}
