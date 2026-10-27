'use client';

/**
 * EL LICUADO — la frontera líquida entre la Aventura y la Progreso (Fernando, 2026-10-26:
 * «hacer un licuado entre la pantalla de aventura y la de progreso… y animaciones para que
 * vaya cambiando»).
 *
 * La raya recta pasa a ser una ONDA VIVA, y los dos mundos se mezclan como dos líquidos:
 * · **La frontera**: dos senos superpuestos cuya fase, frecuencia y amplitud derivan
 *   lentamente con el tiempo, así que la forma nunca se repite igual.
 * · (Hubo gotas subiendo por la frontera, mitad luz y mitad noche; Fernando no las quiso:
 *   «los círculos en la curva no sé si me gustan». Se quitaron.)
 * · **Tinta y bruma** (Fernando: «licuar esa parte izquierda y derecha… daba a parecer que
 *   la parte izquierda se mezclaba con la derecha»): tres capas onduladas del negro del cielo
 *   que se DERRAMAN sobre la Plataforma, cada vez más difusas y transparentes, y dos de la luz
 *   lila de la Plataforma que se cuelan en el cielo. Cada capa respira con su propio grosor,
 *   así que la mezcla parece tinta disolviéndose en agua.
 * · **La onda rosa**: una franja lila difuminada y la línea brillante encima.
 *
 * ── CÓMO SE ENGANCHA ───────────────────────────────────────────────────────────
 * La posición media sigue siendo `--corte` (la mueve `useCorteAnimado`); aquí solo se lee.
 * El recorte es un `<clipPath>` en coordenadas de la escena (que empieza en el borde
 * izquierdo de la ventana, así que px de ventana = px de escena). Mientras no hay un primer
 * camino calculado, `.escena-progreso` usa su recorte recto de siempre; al pintarlo se le
 * pone el recorte líquido EN LÍNEA. Si algo falla, queda la raya recta.
 * ⚠️ Relleno y grosores van como ATRIBUTOS del SVG, no solo en CSS: sin la regla, un
 * `<path>` se rellena de negro y la onda salía como una astilla negra.
 *
 * ⚡ RENDIMIENTO (Fernando, 2026-10-26: «en teléfono se ve un poco ralentizado»):
 * · Con la pantalla llena de un mundo (onda plana) NO se recalcula nada: el bucle solo mira si
 *   `--corte` se movió.
 * · `ligero` (pantallas táctiles): la mitad de puntos, ~30 cuadros/s, una banda de tinta por
 *   lado (no tres + dos) y desenfoques más cortos. Cada desenfoque se vuelve a pintar entero en
 *   cada cuadro porque la curva cambia, y en un móvil eso es lo que más pesa.
 * ⚠️ La onda NO puede alcanzar los textos de los lados: su amplitud es menor que el hueco que
 * dejan (`--hueco-raya`).
 * ⚠️ Al llenar la pantalla (raya en un borde) la onda y la tinta se aplanan; si no,
 * quedarían jirones del otro mundo en el borde.
 */

import { useEffect, useRef } from 'react';
import type { ModoPortada } from '@/lib/sitio/portadaPartida';

export const ID_LICUADO = 'licuado-portada';

const PUNTOS = 56;

// Las capas del licuado: hacia dónde se derraman (+1 Plataforma, −1 cielo), cuánto (px a
// 1200 px de ancho), color, opacidad y difuminado. Las de tinta, dentro del hueco de los
// textos salvo la más tenue.
const CAPAS = [
  { lado: 1, largo: 18, color: '#05040b', opacidad: 0.75, difumina: 4 },
  { lado: 1, largo: 42, color: '#0b0817', opacidad: 0.42, difumina: 10 },
  { lado: 1, largo: 74, color: '#120c26', opacidad: 0.2, difumina: 20 },
  { lado: -1, largo: 16, color: '#efe9fc', opacidad: 0.4, difumina: 6 },
  { lado: -1, largo: 38, color: '#d9cdf7', opacidad: 0.18, difumina: 14 },
] as const;

// En modo ligero solo la banda más marcada de cada lado.
const CAPAS_LIGERO = [0, 3];

export default function LicuadoPortada({ modo, juegoEnCurso, ligero = false }: { modo: ModoPortada; juegoEnCurso: boolean; ligero?: boolean }) {
  const recorteRef = useRef<SVGPathElement | null>(null);
  const brumaRef = useRef<SVGPathElement | null>(null);
  const brilloRef = useRef<SVGPathElement | null>(null);
  const lineaRef = useRef<SVGPathElement | null>(null);
  const capaRef = useRef<SVGSVGElement | null>(null);
  const capasRef = useRef<Array<SVGPathElement | null>>([]);

  useEffect(() => {
    const capa = capaRef.current;
    const escena = capa?.parentElement?.querySelector<HTMLElement>('.escena-progreso');
    const raiz = capa?.closest<HTMLElement>('.landing-page');
    if (!capa || !escena || !raiz) return;

    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    const puntos = ligero ? 28 : PUNTOS;
    const intervalo = ligero ? 32 : 0;
    let raf = 0;
    let activo = false;
    let ultimo = 0;
    let plano = false;
    let corteAnterior = NaN;
    const paso = (ahora: number) => {
      raf = requestAnimationFrame(paso);
      if (juegoEnCurso) return;
      if (intervalo && ahora - ultimo < intervalo) return;
      ultimo = ahora;
      const t = (ahora - t0) / 1000;
      const W = escena.clientWidth;
      const H = escena.clientHeight;
      // ⚠️ No `|| W / 2`: con «Progreso» el corte vale 0, que es falso, y la escena clara
      // se quedaba a media pantalla.
      const leido = parseFloat(raiz.style.getPropertyValue('--corte'));
      const corte = Number.isFinite(leido) ? leido : W / 2;
      // Onda plana y quieta (un mundo llena la pantalla): ya está pintada, no hay nada que hacer.
      if (plano && Math.abs(corte - corteAnterior) < 0.5) return;
      corteAnterior = corte;
      // Menor que el hueco que dejan los textos (`--hueco-raya`: 18 → 56 px).
      const ampBase = Math.min(34, W * 0.022);
      const alBorde = Math.min(corte, W - corte);
      const k = reducir ? 0 : Math.max(0, Math.min(1, alBorde / (ampBase * 4)));
      const A = ampBase * k;
      plano = activo && (k < 0.02 || reducir);

      // Dos ondas que derivan: la forma cambia sin repetirse.
      const f1 = 1.2 + 0.35 * Math.sin(t * 0.11);
      const f2 = 2.6 + 0.6 * Math.sin(t * 0.07 + 1.3);
      const m2 = 0.35 + 0.15 * Math.sin(t * 0.23);
      const x = (y: number) => {
        const u = (y / H) * Math.PI * 2;
        return corte + A * ((1 - m2) * Math.sin(u * f1 + t * 0.8) + m2 * Math.sin(u * f2 - t * 1.25 + Math.sin(t * 0.31) * 2));
      };

      let frontera = '';
      for (let i = 0; i <= puntos; i++) {
        const y = (i / puntos) * H;
        frontera += `${i === 0 ? 'M' : 'L'}${x(y).toFixed(1)} ${y.toFixed(1)} `;
      }

      const d = `M${x(0).toFixed(1)} -2 ` + frontera.slice(frontera.indexOf('L')) + `L${x(H).toFixed(1)} ${H + 2} L${W + 2} ${H + 2} L${W + 2} -2 Z `;
      // Las bandas del licuado: de la frontera hacia su lado, con un grosor que respira.
      const escalaCapa = Math.min(1, W / 1200) * k;
      CAPAS.forEach((c, n) => {
        const el = capasRef.current[n];
        if (!el) return;
        if (escalaCapa < 0.02 || (ligero && !CAPAS_LIGERO.includes(n))) { el.setAttribute('d', ''); return; }
        let ida = '';
        let vuelta = '';
        for (let i = 0; i <= puntos; i++) {
          const y = (i / puntos) * H;
          const u = (y / H) * Math.PI * 2;
          const base = x(y);
          const grosor = c.largo * escalaCapa * (0.6 + 0.4 * Math.sin(u * (1.7 + n * 0.45) + t * (0.6 + n * 0.17) + n * 1.9));
          ida += `${i === 0 ? 'M' : 'L'}${(base - c.lado * 2).toFixed(1)} ${y.toFixed(1)} `;
          vuelta = `L${(base + c.lado * grosor).toFixed(1)} ${y.toFixed(1)} ` + vuelta;
        }
        el.setAttribute('d', ida + vuelta + 'Z');
      });

      recorteRef.current?.setAttribute('d', d);
      brumaRef.current?.setAttribute('d', frontera);
      brilloRef.current?.setAttribute('d', frontera);
      lineaRef.current?.setAttribute('d', frontera);
      if (!activo) {
        activo = true;
        // En línea y no por una clase de `globals.css`: con un CSS viejo en caché la escena
        // se quedaba con el corte recto bajo la onda (lo vio Fernando, 2026-10-26).
        escena.style.setProperty('-webkit-clip-path', `url(#${ID_LICUADO})`);
        escena.style.setProperty('clip-path', `url(#${ID_LICUADO})`);
      }
    };
    raf = requestAnimationFrame(paso);
    return () => {
      cancelAnimationFrame(raf);
      escena.style.removeProperty('-webkit-clip-path');
      escena.style.removeProperty('clip-path');
    };
  }, [ligero, juegoEnCurso]);

  const visible = modo === 'partido' && !juegoEnCurso;

  return (
    <>
      {/* El recorte. `width/height 0`: solo aporta la definición. */}
      <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id={ID_LICUADO} clipPathUnits="userSpaceOnUse">
            <path ref={recorteRef} clipRule="evenodd" />
          </clipPath>
        </defs>
      </svg>

      {/* Bruma, brillo y línea, siguiendo la onda. */}
      <svg
        ref={capaRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full pointer-events-none"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 450ms ease', overflow: 'visible' }}
      >
        <defs>
          {/* En coordenadas de la escena, no de la caja del trazo: con la onda plana esa caja
              mide 0 de ancho y el degradado y el filtro no se pintarían. */}
          <linearGradient id="licuado-tinta" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0" />
            <stop offset="18%" stopColor="#a78bfa" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#e879f9" stopOpacity="0.95" />
            <stop offset="82%" stopColor="#a78bfa" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
          <filter id="licuado-difuso" filterUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
            <feGaussianBlur stdDeviation={ligero ? 9 : 18} />
          </filter>
          <filter id="licuado-brillo" filterUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        {CAPAS.map((c, n) => (
          <filter key={`f${n}`} id={`licuado-capa-${n}`} x="-2" y="-0.1" width="5" height="1.2">
            <feGaussianBlur stdDeviation={ligero ? Math.min(c.difumina, 5) : c.difumina} />
          </filter>
        ))}
        {CAPAS.map((c, n) => (
          <path
            key={n}
            ref={(el) => { capasRef.current[n] = el; }}
            fill={c.color}
            opacity={c.opacidad}
            filter={`url(#licuado-capa-${n})`}
          />
        ))}
        <path ref={brumaRef} fill="none" strokeWidth={ligero ? 40 : 70} opacity={0.32} stroke="url(#licuado-tinta)" filter="url(#licuado-difuso)" />
        <path ref={brilloRef} fill="none" strokeWidth={10} opacity={0.6} stroke="url(#licuado-tinta)" filter="url(#licuado-brillo)" />
        <path ref={lineaRef} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="url(#licuado-tinta)" />
      </svg>
    </>
  );
}
