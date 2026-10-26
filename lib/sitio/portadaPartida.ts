/**
 * LA PORTADA PARTIDA EN DOS — lo que comparten la portada y su cabecera (Fernando, 2026-10-26).
 *
 * La portada se divide con una raya: a la izquierda el cielo estrellado de la Aventura, a la
 * derecha la Plataforma en claro. Pasar el puntero por «Aventura» o «Progreso» hace que ese
 * lado llene la pantalla.
 *
 * ── UNA SOLA VARIABLE MUEVE TODO ───────────────────────────────────────────────
 * `--corte` (px desde el borde izquierdo de la ventana) vive en `.landing-page` y está
 * registrada con `@property` en `globals.css`, así que se ANIMA. La leen el recorte de la
 * escena clara, la raya y cada texto que cruza la raya. Nada se sincroniza a mano.
 *
 * ── LOS TEXTOS QUE CRUZAN LA RAYA ──────────────────────────────────────────────
 * Un texto blanco sobre el lado claro no se lee. `.texto-partido` pinta el texto con un
 * degradado de corte duro: `--tp-a` (su color de siempre) a la izquierda de la raya y
 * `--tp-b` (uno oscuro) a la derecha. El degradado se calcula en el sistema del propio
 * elemento, así que necesita saber dónde empieza: `--x0`, que pone `refBordeIzquierdo`.
 *
 * ⚠️ `--x0` se mide en un elemento SIN animación de transform: el titular «respira»
 * (`scale`), así que se mide su contenedor y el valor se hereda.
 * ⚠️ El texto partido tiene que ser BLOQUE: en un `inline` partido en dos líneas el fondo
 * se coloca como si fuera una sola línea y el corte cae donde no es.
 * ⚠️ `text-shadow` se pinta ENCIMA de un texto con `background-clip: text`; la sombra va
 * como `filter: drop-shadow(...)`.
 */

export type ModoPortada = 'partido' | 'aventura' | 'progreso';

/** El valor de `--corte` para cada modo. */
export function corteDe(modo: ModoPortada): string {
  if (modo === 'progreso') return '0px';
  if (modo === 'aventura') return '100vw';
  return '50vw';
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
