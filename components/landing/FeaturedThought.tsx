'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Featured { content: string; createdAt: string }

/**
 * Pensamiento destacado en la portada, colgando POR DEBAJO del bloque central.
 *
 * El administrador elige uno de sus pensamientos desde el módulo Pensamientos y aparece
 * aquí para cualquier visitante (`GET /api/pensamientos/destacado` es público y solo
 * devuelve el texto y la fecha).
 *
 * SIN SALTOS: va **absoluto** bajo el bloque central (`top: calc(100% + 28px)`), así que
 * NO ocupa sitio en el flujo. El distintivo, el título, el subtítulo y los botones se
 * quedan centrados y quietos, aparezca el pensamiento cuando aparezca. Mientras llega la
 * respuesta se muestra un cargador, para que su aparición se sienta esperada y no un
 * parpadeo. Si no hay ninguno publicado, no se pinta nada.
 */
export default function FeaturedThought({
  windAway = false,
  tema = 'aventura',
  compacto = false,
  nube = false,
  visible = true,
  lugar = 'cielo',
}: {
  windAway?: boolean;
  tema?: 'aventura' | 'progreso';
  /** La barra de consejo de la pantalla de inicio (2026-10-26): una cápsula de cristal sobre
   *  la raya, «PENSAMIENTO · “…” · fecha», como los consejos de una pantalla de carga. */
  compacto?: boolean;
  /** «EL CORAZÓN PIENSA» (2026-10-30): la nube de pensamiento que sale del corazón del titular.
   *  Sustituye a `compacto` en la portada. Ver la explicación en `NubePensamiento`, abajo. */
  nube?: boolean;
  /** Solo con `nube`: no aparece mientras hay un mundo elegido. */
  visible?: boolean;
  /** Solo con `nube`: `cielo` junto al corazón (desde 640 px) o `pie`, en el hueco de abajo (teléfono). */
  lugar?: 'cielo' | 'pie';
}) {
  const [data, setData] = useState<Featured | null>(null);
  const [loading, setLoading] = useState(true);
  const [shown, setShown] = useState(0);   // caracteres ya "escritos"

  useEffect(() => {
    let alive = true;
    fetch('/api/pensamientos/destacado')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.data?.content) setData(j.data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Máquina de escribir: ~20 ms por carácter, y se salta si el usuario prefiere menos
  // movimiento. Al terminar deja el texto completo, nunca a medias.
  useEffect(() => {
    if (!data) return;
    const full = data.content.length;
    const sinMovimiento = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (sinMovimiento) { setShown(full); return; }
    setShown(0);
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= full) { clearInterval(id); return full; }
        return n + 1;
      });
    }, 20);
    return () => clearInterval(id);
  }, [data]);

  const fecha = data
    ? new Date(data.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';
  const escribiendo = !!data && shown < data.content.length;

  if (nube) {
    return (
      <NubePensamiento
        data={data}
        loading={loading}
        visible={visible}
        lugar={lugar}
        texto={data ? data.content.slice(0, shown) : ''}
        escribiendo={escribiendo}
        fecha={fecha}
      />
    );
  }

  if (compacto) {
    // ALTO FIJO (Fernando, 2026-10-27): la cápsula ocupa SIEMPRE lo mismo —etiqueta y dos
    // líneas de texto— antes, durante y después de cargar, así no se mueve nada al llegar el
    // pensamiento ni mientras se escribe. Si no hay ninguno publicado, el hueco queda vacío
    // (invisible) para que la pantalla no cambie de forma.
    if (!loading && !data) return <div className="pensamiento-barra pensamiento-barra-vacia" aria-hidden="true" />;
    return (
      <div className={`pensamiento-barra ${tema === 'progreso' ? 'pensamiento-barra-progreso' : 'cristal-portada'} pointer-events-none`}>
        <span className="pensamiento-barra-etiqueta">
          <span className="pensamiento-barra-punto" aria-hidden="true" />
          Pensamiento
        </span>
        {loading ? (
          <span className="flex items-center gap-1.5" role="status" aria-label="Cargando pensamiento">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{ width: 5, height: 5, display: 'inline-block', background: 'var(--color-accent-glow)', animation: `thoughtDot 1.1s ease-in-out ${i * 0.16}s infinite` }}
              />
            ))}
          </span>
        ) : data ? (
          <>
            <span className="pensamiento-barra-texto">
              <span className="comilla-pensamiento" aria-hidden="true">“</span>
              {data.content.slice(0, shown)}
              {escribiendo && <span style={{ color: 'var(--color-accent-glow)', animation: 'thoughtCaret 0.9s steps(1) infinite' }}>▌</span>}
              {!escribiendo && <span className="comilla-pensamiento" aria-hidden="true">”</span>}
            </span>
            <span className="pensamiento-barra-fecha">{fecha}</span>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="featured-thought-slot relative mx-auto w-[min(92vw,620px)] pointer-events-none"
      style={{
        marginTop: 'clamp(24px, 6vh, 60px)',
        animation: windAway
          ? 'windBlowAway 1.2s ease-in 0.34s forwards'
          : 'featuredThoughtIn 0.9s ease-out 0.2s both',
        willChange: 'transform, opacity, filter',
      }}
    >
      {/* Adaptado al mundo elegido (2026-10-26): cristal oscuro en la Aventura, tarjeta clara
          en la Progreso. Los colores salen de `.pensamiento-aventura|progreso` (globals.css). */}
      <div className={`pensamiento-${tema} ${tema === 'aventura' ? 'cristal-portada' : ''} relative rounded-2xl px-7 py-4`}>
        <p
          className="mb-2"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '0.66rem',
            fontWeight: 600,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            // Antes era el morado de marca al 85 %: sobre el fondo negro quedaba apagado y
            // la etiqueta se perdía. Este lila claro ya se usa en el resto de la portada
            // para texto secundario, así que sube el contraste sin salirse de la paleta.
            color: 'var(--pens-etiqueta)',
            opacity: 1,
          }}
        >
          Pensamiento
        </p>

        {loading ? (
          // Cargador: tres bloques pixel latiendo. Ocupa el sitio del texto, así que al
          // llegar el pensamiento no hay ningún reajuste.
          <span className="flex items-center gap-1.5" role="status" aria-label="Cargando pensamiento">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 6, height: 6, display: 'inline-block',
                  background: 'var(--color-accent-glow)',
                  animation: `thoughtDot 1.1s ease-in-out ${i * 0.16}s infinite`,
                }}
              />
            ))}
          </span>
        ) : data ? (
          <>
            <p
              className="featured-thought-text whitespace-pre-wrap"
              style={{
                // Iteración 2 (2026-10-26): la serif cursiva del titular, no la monoespaciada.
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 'clamp(1.15rem, 2.4vh, 1.45rem)',
                lineHeight: 1.45,
                color: 'var(--pens-texto)',
                // Sin recorte de líneas: se ve ENTERO (Fernando, 2026-10-26).
              }}
            >
              <span className="comilla-pensamiento" aria-hidden="true">“</span>
              {data.content.slice(0, shown)}
              {escribiendo && (
                <span style={{ color: 'var(--color-accent-glow)', animation: 'thoughtCaret 0.9s steps(1) infinite' }}>▌</span>
              )}
              {!escribiendo && <span className="comilla-pensamiento" aria-hidden="true">”</span>}
            </p>

            <p
              className="mt-1.5"
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '0.68rem',
                fontWeight: 500,
                letterSpacing: '0.12em',
                color: 'var(--pens-fecha)',
              }}
            >
              {fecha}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * EL PENSAMIENTO FUGAZ (Fernando, 2026-10-30: *«que el pensamiento aparezca y flote… y que
 * automáticamente después desaparezca solito»*).
 *
 * Sin caja: la frase aparece en el cielo palabra a palabra (sube desde el desenfoque, como el
 * eslogan), flota despacio unos segundos con un halo violeta detrás y se disuelve hacia arriba. Al
 * medio minuto vuelve. Es una presencia, no un panel: nunca ocupa sitio en el flujo.
 *
 * · Desde 640 px: en el cielo de la Aventura, a la IZQUIERDA del corazón y alineada hacia él. Su
 *   posición y su ancho se MIDEN (el corazón cambia de sitio y tamaño con la ventana).
 * · Teléfono (`lugar="pie"`): en el hueco de abajo, en el mundo Progreso, donde estaba la
 *   cápsula; el hueco se conserva, así Aventura y Progreso NO se mueven (la primera versión, la
 *   nube bajo el titular, los empujaba: Fernando, *«en la versión móvil no muevas las posiciones»*).
 * · Mientras hay un mundo elegido no aparece. Sin pensamiento publicado, nada.
 */
const PENSAMIENTO_ESPERA_MS = 1400;   // tras cargar la portada
const PENSAMIENTO_PAUSA_MS = 30000;   // entre una aparición y la siguiente
const PENSAMIENTO_SALIDA_MS = 1400;

function NubePensamiento({
  data, visible, fecha, lugar,
}: {
  data: Featured | null; loading: boolean; visible: boolean; lugar: 'cielo' | 'pie';
  texto: string; escribiendo: boolean; fecha: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fase, setFase] = useState<'oculta' | 'visible' | 'saliendo'>('oculta');
  const palabras = data ? data.content.split(/\s+/).filter(Boolean) : [];

  // El ciclo: aparece, se queda (más cuanto más larga es la frase), se va, pausa… y otra vez.
  useEffect(() => {
    if (!data || !visible) { setFase('oculta'); return; }
    const quieta = Math.max(7000, palabras.length * 380 + 4500);
    const timers: number[] = [];
    const ciclo = (espera: number) => {
      timers.push(window.setTimeout(() => {
        setFase('visible');
        timers.push(window.setTimeout(() => {
          setFase('saliendo');
          timers.push(window.setTimeout(() => { setFase('oculta'); ciclo(PENSAMIENTO_PAUSA_MS); }, PENSAMIENTO_SALIDA_MS));
        }, quieta));
      }, espera));
    };
    ciclo(PENSAMIENTO_ESPERA_MS);
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, visible]);

  // Dónde está el corazón respecto a la cabeza de la portada.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || fase === 'oculta' || lugar !== 'cielo') return;
    const cabeza = el.closest('.portada-cabeza') as HTMLElement | null;
    const medir = () => {
      const corazon = cabeza?.querySelector('.grafico-corazon')?.getBoundingClientRect();
      if (!cabeza || !corazon) return;
      const c = cabeza.getBoundingClientRect();
      const x = corazon.left - c.left;
      el.style.setProperty('--corazon-x', `${x}px`);
      el.style.setProperty('--corazon-y', `${corazon.top - c.top}px`);
      // A la izquierda del corazón caben `x` px menos el aire de los dos lados.
      el.style.setProperty('--fugaz-ancho', `${Math.max(160, Math.min(400, x + c.left - 64))}px`);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [fase, lugar]);

  if (!data) return null;
  return (
    <div ref={ref} className={`pensamiento-fugaz pensamiento-fugaz-${lugar}`} data-fase={fase} role="note" aria-label="Pensamiento">
      {fase !== 'oculta' && (
        <>
          <p className="fugaz-etiqueta"><span className="pensamiento-barra-punto" aria-hidden="true" />Pensamiento<span className="fugaz-fecha"> · {fecha}</span></p>
          <p className="sr-only">{data.content}</p>
          <p className="fugaz-texto" aria-hidden="true">
            {palabras.map((p, i) => (
              <span key={i} style={{ ['--i' as string]: i }}>{p}</span>
            ))}
          </p>
        </>
      )}
    </div>
  );
}
