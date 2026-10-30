'use client';

/**
 * EL CIELO DE PENSAMIENTOS (Fernando, 2026-10-30: *«que se puedan publicar hasta 10
 * pensamientos… tu propuesta más genial»*; el mismo día, *«me ha encantado la idea… hasta 30
 * pensamientos… la nube en todo el mapa… y un sonidito»*).
 *
 * Cada pensamiento publicado (Admin → Pensamientos, hasta 30) es una ESTRELLA repartida por TODO
 * el mapa de la portada: blancas en la noche de la Aventura, violetas en el día de la Plataforma.
 * Titilan. De una en una SE ENCIENDEN: su pensamiento aparece junto a ella palabra a palabra, flota
 * unos segundos y se disuelve; luego otra. Al pasar el puntero por una estrella (o enfocarla con el
 * teclado) su pensamiento aparece en el acto. Suena un tintineo al aparecer y un destello al pasar
 * por la que ya brilla (`sonarPensamiento`/`sonarEstrella`).
 *
 * EL REPARTO SE MIDE, no se dibuja a mano: se toman los rectángulos de lo que YA ocupa la pantalla
 * (insignia, corazón, Tierra, cada línea de los dos paneles) y una franja a cada lado de la onda
 * entre los mundos; las estrellas se colocan en lo libre, lo más separadas posible entre sí
 * (muestreo del punto más lejano, con una semilla fija: siempre el mismo cielo para el mismo
 * tamaño). El texto de cada una se pone debajo, encima o a un lado, donde no tape nada ni cruce la
 * onda; así su color (claro de noche, tinta de día) siempre se lee.
 *
 * Tres formas, según el sitio:
 *  · `constelacion` — ventanas de al menos 900 × 600 con `lugar="cielo"`: lo de arriba.
 *  · `cielo` — ventanas menores: sin estrellas; se turnan a la izquierda del corazón.
 *  · `pie` — teléfono, en el hueco de abajo (mundo Progreso): se turnan ahí. El hueco tiene alto
 *    FIJO: si cambiara, la onda entre los mundos se descuadra (ver Diseño.md).
 *
 * Nada de esto ocupa sitio en el flujo. Con un mundo elegido, el cielo se apaga.
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { despertarAudio, sonarEstrella, sonarPensamiento } from '@/lib/sitio/sonidoSeleccion';

interface Pensamiento { content: string; createdAt: string }
type Fase = 'oculta' | 'visible' | 'saliendo';
interface Caja { x: number; y: number; w: number; h: number }
interface Estrella { x: number; y: number; noche: boolean }
interface Texto { x: number; y: number; w: number; noche: boolean }

const SALIDA_MS = 1400;
const ANCHO_TEXTO = 340;

const fechaDe = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

const choca = (a: Caja, b: Caja) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const solape = (a: Caja, b: Caja) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const crecer = (c: Caja, m: number): Caja => ({ x: c.x - m, y: c.y - m, w: c.w + 2 * m, h: c.h + 2 * m });

/** Pseudoaleatorio con semilla: el mismo cielo cada vez que se mide el mismo tamaño. */
function semilla(n: number) {
  let s = n >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Lo que ocupa la portada, en coordenadas de la ventana. */
function medirMapa() {
  const cabecera = document.querySelector('.landing-page header')?.getBoundingClientRect();
  const pie = document.querySelector('footer.fixed')?.getBoundingClientRect();
  const lp = document.querySelector('.landing-page') as HTMLElement | null;
  const corte = parseFloat(lp ? getComputedStyle(lp).getPropertyValue('--corte') : '') || window.innerWidth / 2;
  const limites: Caja = {
    x: 28, y: (cabecera?.bottom ?? 64) + 16,
    w: window.innerWidth - 56, h: (pie?.top ?? window.innerHeight) - 16 - ((cabecera?.bottom ?? 64) + 16),
  };
  const selectores = [
    '.inicio-insignia', '.grafico-corazon', '.grafico-mundo',
    '.panel-mundo-aventura > *', '.panel-mundo-progreso > *',
  ];
  const ocupado: Caja[] = [];
  document.querySelectorAll(selectores.join(',')).forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width && r.height) ocupado.push({ x: r.left, y: r.top, w: r.width, h: r.height });
  });
  // La onda entre los mundos ondula ±40 px: ni estrellas ni textos sobre ella.
  const onda: Caja = { x: corte - 70, y: limites.y - 100, w: 140, h: limites.h + 200 };
  return { limites, ocupado, onda, corte };
}

/** Reparte `n` estrellas por lo libre, lo más separadas posible. */
function repartir(n: number, mapa: ReturnType<typeof medirMapa>): Estrella[] {
  const { limites, ocupado, onda, corte } = mapa;
  const azar = semilla(Math.round(limites.w) * 31 + Math.round(limites.h));
  const prohibido = [...ocupado.map((c) => crecer(c, 22)), onda];
  const candidatos: { x: number; y: number }[] = [];
  for (let k = 0; k < 900 && candidatos.length < 500; k++) {
    const p = { x: limites.x + azar() * limites.w, y: limites.y + azar() * limites.h };
    if (!prohibido.some((c) => choca({ x: p.x - 6, y: p.y - 6, w: 12, h: 12 }, c))) candidatos.push(p);
  }
  const elegidas: { x: number; y: number }[] = [];
  if (candidatos.length) elegidas.push(candidatos[Math.floor(azar() * candidatos.length)]);
  while (elegidas.length < n && elegidas.length < candidatos.length) {
    let mejor = candidatos[0];
    let lejos = -1;
    for (const c of candidatos) {
      const d = Math.min(...elegidas.map((e) => (e.x - c.x) ** 2 + (e.y - c.y) ** 2));
      if (d > lejos) { lejos = d; mejor = c; }
    }
    elegidas.push(mejor);
  }
  return elegidas.map((p) => ({ ...p, noche: p.x < corte }));
}

/** Dónde poner el texto de una estrella: donde no tape nada ni cruce la onda. */
function colocarTexto(e: Estrella, largo: number, mapa: ReturnType<typeof medirMapa>): Texto {
  const { limites, ocupado, onda } = mapa;
  const w = Math.min(ANCHO_TEXTO, limites.w * 0.4);
  const lineas = Math.ceil((largo * 8.6) / w);
  const h = 22 + lineas * 27;
  const dentro = (c: Caja): Caja => ({
    ...c,
    x: Math.min(Math.max(c.x, limites.x), limites.x + limites.w - c.w),
    y: Math.min(Math.max(c.y, limites.y), limites.y + limites.h - c.h),
  });
  const opciones: Caja[] = [
    { x: e.x - w / 2, y: e.y + 16, w, h },
    { x: e.x - w / 2, y: e.y - 16 - h, w, h },
    { x: e.x + 18, y: e.y - h / 2, w, h },
    { x: e.x - 18 - w, y: e.y - h / 2, w, h },
    { x: e.x + 14, y: e.y + 14, w, h },
    { x: e.x - 14 - w, y: e.y + 14, w, h },
    { x: e.x + 14, y: e.y - 14 - h, w, h },
    { x: e.x - 14 - w, y: e.y - 14 - h, w, h },
  ].map(dentro);
  const estorbos = [...ocupado.map((c) => crecer(c, 8)), onda];
  let mejor = opciones[0];
  let menos = Infinity;
  for (const o of opciones) {
    const tapa = estorbos.reduce((a, c) => a + solape(o, c), 0);
    if (tapa < menos) { menos = tapa; mejor = o; }
    if (tapa === 0) break;
  }
  return { x: mejor.x, y: mejor.y, w, noche: mejor.x + w / 2 < mapa.corte };
}

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
  const [amplio, setAmplio] = useState(false);
  const [estrellas, setEstrellas] = useState<Estrella[]>([]);
  const [origen, setOrigen] = useState({ x: 0, y: 0 }); // la cabeza, en coordenadas de ventana
  const [geoFugaz, setGeoFugaz] = useState<CSSProperties | undefined>(undefined);
  const mapaRef = useRef<ReturnType<typeof medirMapa> | null>(null);
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
    const mq = window.matchMedia('(min-width: 900px) and (min-height: 600px)');
    const leer = () => setAmplio(mq.matches);
    leer();
    mq.addEventListener('change', leer);
    // El sonido solo puede nacer de un gesto: el primero del visitante lo despierta.
    const despertar = () => despertarAudio();
    window.addEventListener('pointerdown', despertar, { capture: true, once: true });
    window.addEventListener('keydown', despertar, { capture: true, once: true });
    return () => {
      mq.removeEventListener('change', leer);
      window.removeEventListener('pointerdown', despertar, true);
      window.removeEventListener('keydown', despertar, true);
    };
  }, [lugar]);
  const modo = lugar === 'pie' ? 'pie' : amplio ? 'constelacion' : 'cielo';

  // ── El turno: aparece, se queda (más cuanto más larga), se va, pausa, el siguiente ──
  const limpiar = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  const mostrar = (i: number, espera: number) => {
    limpiar();
    const n = lista.length;
    if (!n) return;
    const palabras = lista[i].content.split(/\s+/).length;
    const quieta = Math.max(7000, palabras * 380 + 4500);
    const pausa = n > 1 ? 2200 : 30000;
    timers.current.push(window.setTimeout(() => {
      setActual(i); setVuelta((v) => v + 1); setFase('visible');
      if (lugar === 'cielo') sonarPensamiento();
      timers.current.push(window.setTimeout(() => {
        setFase('saliendo');
        timers.current.push(window.setTimeout(() => {
          setFase('oculta');
          // Con muchas, el orden salta por el mapa: el siguiente es uno lejano, no el vecino.
          mostrar(n > 3 ? (i + Math.ceil(n / 2) + (n % 2 === 0 ? 1 : 0)) % n : (i + 1) % n, pausa);
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

  /** El puntero sobre una estrella: si ya brilla, un destello; si no, su pensamiento, ya. */
  const encender = (i: number) => {
    if (!visible) return;
    if (i === actual && fase === 'visible') { sonarEstrella(); return; }
    mostrar(i, 0);
  };

  // ── La geometría: estrellas por todo el mapa (constelación) o junto al corazón (cielo) ──
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || lugar !== 'cielo') return;
    const cabeza = el.closest('.portada-cabeza') as HTMLElement | null;
    const medir = () => {
      if (!cabeza) return;
      const c = cabeza.getBoundingClientRect();
      setOrigen({ x: c.left, y: c.top });
      const corazon = cabeza.querySelector('.grafico-corazon')?.getBoundingClientRect();
      if (corazon) {
        setGeoFugaz({
          ['--corazon-x' as string]: `${corazon.left - c.left}px`,
          ['--corazon-y' as string]: `${corazon.top - c.top}px`,
          ['--fugaz-ancho' as string]: `${Math.max(160, Math.min(400, corazon.left - 64))}px`,
        } as CSSProperties);
      }
      if (lista.length) {
        const mapa = medirMapa();
        mapaRef.current = mapa;
        setEstrellas(repartir(lista.length, mapa));
      }
    };
    medir();
    // Los paneles entran con una animación que los desplaza: se vuelve a medir al terminar.
    const tarde = window.setTimeout(medir, 1300);
    const ro = new ResizeObserver(medir);
    if (cabeza) ro.observe(cabeza);
    window.addEventListener('resize', medir);
    return () => { window.clearTimeout(tarde); ro.disconnect(); window.removeEventListener('resize', medir); };
  }, [lugar, lista.length, amplio]);

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
  if (modo !== 'constelacion' || !estrellas.length || !mapaRef.current) {
    return (
      <div ref={ref} key={vuelta} className={`pensamiento-fugaz pensamiento-fugaz-${lugar}`} data-fase={fase}
        style={modo === 'cielo' ? geoFugaz : undefined} role="note" aria-label="Pensamiento">
        {fase !== 'oculta' && texto}
      </div>
    );
  }

  // ── La constelación ──
  const e = estrellas[Math.min(actual, estrellas.length - 1)];
  const t = colocarTexto(e, p.content.length, mapaRef.current);

  return (
    <div ref={ref} className={`cielo-pensamientos ${visible ? '' : 'cielo-apagado'}`}>
      {estrellas.map((s, i) => (
        <button
          key={i}
          type="button"
          className={`cielo-estrella cielo-estrella-${s.noche ? 'izquierda' : 'derecha'} ${i === actual && fase !== 'oculta' ? 'es-encendida' : ''}`}
          style={{ left: s.x - origen.x, top: s.y - origen.y, ['--n' as string]: i }}
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
        className={`pensamiento-fugaz pensamiento-fugaz-estrella tono-${t.noche ? 'noche' : 'dia'}`}
        data-fase={fase}
        style={{ left: t.x - origen.x, top: t.y - origen.y, width: t.w }}
        role="note"
        aria-label="Pensamiento"
      >
        {fase !== 'oculta' && texto}
      </div>
    </div>
  );
}
