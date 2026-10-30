'use client';

/**
 * EL CIELO DE PENSAMIENTOS (Fernando, 2026-10-30: *«que se puedan publicar hasta 10
 * pensamientos… presentarse de una forma que tú propongas… tu propuesta más genial»*).
 *
 * Cada pensamiento publicado (Admin → Pensamientos, hasta 10) es una ESTRELLA en el cielo de la
 * portada, en los dos espacios libres a los lados del titular: blancas en la noche de la
 * Aventura, violetas en el día de la Plataforma. Titilan. De una en una SE ENCIENDEN: su
 * pensamiento aparece junto a ella palabra a palabra, flota unos segundos y se disuelve; luego
 * se enciende otra, al otro lado. Al pasar el ratón por una estrella (o enfocarla con el
 * teclado) su pensamiento aparece en el acto.
 *
 * Tres formas, según el sitio:
 *  · `constelacion` — escritorio ancho (≥ 1100 × 680) con `lugar="cielo"`: lo de arriba. Las
 *    zonas y las estrellas se MIDEN (header, corazón, Tierra y paneles cambian con la ventana).
 *  · `cielo` — ventanas menores: sin estrellas; los pensamientos se turnan a la izquierda del
 *    corazón (la posición del pensamiento fugaz).
 *  · `pie` — teléfono, en el hueco de abajo (mundo Progreso): se turnan ahí. El hueco tiene alto
 *    FIJO: si cambiara, la onda entre los mundos se descuadra (ver Diseño.md).
 *
 * Nada de esto ocupa sitio en el flujo. Con un mundo elegido, el cielo se apaga.
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

interface Pensamiento { content: string; createdAt: string }
type Fase = 'oculta' | 'visible' | 'saliendo';

/** Huecos de las estrellas en cada zona (0–1): cinco por lado, repartidos sin alinearse. */
const HUECOS: [number, number][] = [[0.16, 0.28], [0.58, 0.1], [0.3, 0.74], [0.84, 0.5], [0.66, 0.9]];
const SALIDA_MS = 1400;

const fechaDe = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

interface Zona { x: number; y: number; ancho: number; alto: number }
interface Geometria { izquierda: Zona; derecha: Zona; corazonX: number; corazonY: number; fugazAncho: number }

export default function PensamientosCielo({
  lugar, visible,
}: {
  lugar: 'cielo' | 'pie';
  /** Falso con un mundo elegido: no aparece nada. */
  visible: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [lista, setLista] = useState<Pensamiento[]>([]);
  const [actual, setActual] = useState(0);
  const [vuelta, setVuelta] = useState(0); // cambia en cada aparición: reinicia la animación
  const [fase, setFase] = useState<Fase>('oculta');
  const [ancho, setAncho] = useState(false); // ¿escritorio ancho? → constelación
  const [geo, setGeo] = useState<Geometria | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch('/api/pensamientos/destacado')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (vivo && Array.isArray(j?.lista)) setLista(j.lista); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (lugar !== 'cielo') return;
    const mq = window.matchMedia('(min-width: 1100px) and (min-height: 680px)');
    const leer = () => setAncho(mq.matches);
    leer();
    mq.addEventListener('change', leer);
    return () => mq.removeEventListener('change', leer);
  }, [lugar]);
  const modo = lugar === 'pie' ? 'pie' : ancho ? 'constelacion' : 'cielo';

  // ── El turno: aparece, se queda (más cuanto más larga), se va, pausa, el siguiente ──
  const limpiar = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  const mostrar = (i: number, espera: number) => {
    limpiar();
    const n = lista.length;
    if (!n) return;
    const palabras = lista[i].content.split(/\s+/).length;
    const quieta = Math.max(7000, palabras * 380 + 4500);
    const pausa = n > 1 ? 2600 : 30000;
    timers.current.push(window.setTimeout(() => {
      setActual(i); setVuelta((v) => v + 1); setFase('visible');
      timers.current.push(window.setTimeout(() => {
        setFase('saliendo');
        timers.current.push(window.setTimeout(() => {
          setFase('oculta');
          mostrar((i + 1) % n, pausa);
        }, SALIDA_MS));
      }, quieta));
    }, espera));
  };
  useEffect(() => {
    if (!lista.length || !visible) { limpiar(); setFase('oculta'); return; }
    mostrar(0, 1400);
    return limpiar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, visible]);

  /** Pasar por una estrella: su pensamiento, ya. */
  const encender = (i: number) => {
    if (!visible || (i === actual && fase === 'visible')) return;
    mostrar(i, 0);
  };

  // ── La geometría: zonas libres a cada lado del titular, medidas respecto a la cabeza ──
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || lugar !== 'cielo') return;
    const cabeza = el.closest('.portada-cabeza') as HTMLElement | null;
    const medir = () => {
      if (!cabeza) return;
      const c = cabeza.getBoundingClientRect();
      const corazon = cabeza.querySelector('.grafico-corazon')?.getBoundingClientRect();
      const mundo = cabeza.querySelector('.grafico-mundo')?.getBoundingClientRect();
      const cabecera = document.querySelector('.landing-page header')?.getBoundingClientRect();
      const panel = document.querySelector('.panel-mundo-aventura')?.getBoundingClientRect();
      if (!corazon || !mundo) return;
      const arriba = (cabecera?.bottom ?? c.top) + 18 - c.top;
      const abajo = (panel?.top ?? corazon.bottom + 200) - 30 - c.top;
      const izqX = 40 - c.left;
      const izqFin = corazon.left - 48 - c.left;
      const derX = mundo.right + 48 - c.left;
      const derFin = window.innerWidth - 40 - c.left;
      setGeo({
        izquierda: { x: izqX, y: arriba, ancho: Math.max(0, izqFin - izqX), alto: Math.max(0, abajo - arriba) },
        derecha: { x: derX, y: arriba, ancho: Math.max(0, derFin - derX), alto: Math.max(0, abajo - arriba) },
        corazonX: corazon.left - c.left,
        corazonY: corazon.top - c.top,
        fugazAncho: Math.max(160, Math.min(400, corazon.left - 64)),
      });
    };
    medir();
    const ro = new ResizeObserver(medir);
    if (cabeza) ro.observe(cabeza);
    window.addEventListener('resize', medir);
    return () => { ro.disconnect(); window.removeEventListener('resize', medir); };
  }, [lugar, lista.length]);

  if (!lista.length) return <div ref={ref} hidden />;
  const p = lista[Math.min(actual, lista.length - 1)];

  const texto = (
    <>
      <p className="fugaz-etiqueta"><span className="pensamiento-barra-punto" aria-hidden="true" />Pensamiento<span className="fugaz-fecha"> · {fechaDe(p.createdAt)}</span></p>
      <p className="sr-only">{p.content}</p>
      <p className="fugaz-texto" aria-hidden="true">
        {p.content.split(/\s+/).filter(Boolean).map((w, i) => (
          <span key={i} style={{ ['--i' as string]: i }}>{w}</span>
        ))}
      </p>
    </>
  );

  // ── Teléfono y ventanas menores: se turnan en un sitio fijo ──
  if (modo !== 'constelacion' || !geo) {
    const estilo = modo === 'cielo' && geo
      ? ({ ['--corazon-x' as string]: `${geo.corazonX}px`, ['--corazon-y' as string]: `${geo.corazonY}px`, ['--fugaz-ancho' as string]: `${geo.fugazAncho}px` } as CSSProperties)
      : undefined;
    return (
      <div ref={ref} key={vuelta} className={`pensamiento-fugaz pensamiento-fugaz-${lugar}`} data-fase={fase} style={estilo} role="note" aria-label="Pensamiento">
        {fase !== 'oculta' && texto}
      </div>
    );
  }

  // ── La constelación ──
  const estrellas = lista.map((_, i) => {
    const lado = i % 2 === 0 ? 'izquierda' : 'derecha';
    const z = geo[lado];
    const [hx, hy] = HUECOS[Math.floor(i / 2) % HUECOS.length];
    // En la derecha, en espejo: la primera estrella de cada lado queda cerca del titular.
    const fx = lado === 'izquierda' ? 1 - hx : hx;
    return { lado, x: z.x + fx * z.ancho, y: z.y + hy * z.alto, z };
  });
  const e = estrellas[actual] ?? estrellas[0];
  const anchoTexto = Math.min(380, Math.max(220, e.z.ancho - 16));
  const izquierdaTexto = Math.min(Math.max(e.x - anchoTexto / 2, e.z.x), e.z.x + e.z.ancho - anchoTexto);
  const arribaDeLaEstrella = e.y > e.z.y + e.z.alto * 0.5;

  return (
    <div ref={ref} className={`cielo-pensamientos ${visible ? '' : 'cielo-apagado'}`}>
      {estrellas.map((s, i) => (
        <button
          key={i}
          type="button"
          className={`cielo-estrella cielo-estrella-${s.lado} ${i === actual && fase !== 'oculta' ? 'es-encendida' : ''}`}
          style={{ left: s.x, top: s.y, ['--n' as string]: i }}
          onMouseEnter={() => encender(i)}
          onFocus={() => encender(i)}
          onClick={() => encender(i)}
          aria-label={`Pensamiento ${i + 1} de ${lista.length}`}
          tabIndex={visible ? 0 : -1}
        >
          <span aria-hidden="true" />
        </button>
      ))}
      <div
        key={vuelta}
        className={`pensamiento-fugaz pensamiento-fugaz-estrella tono-${e.lado === 'izquierda' ? 'noche' : 'dia'}`}
        data-fase={fase}
        style={{ left: izquierdaTexto, top: arribaDeLaEstrella ? e.y - 16 : e.y + 18, width: anchoTexto }}
        role="note"
        aria-label="Pensamiento"
      >
        <div className={arribaDeLaEstrella ? 'cielo-sobre' : ''}>{fase !== 'oculta' && texto}</div>
      </div>
    </div>
  );
}
