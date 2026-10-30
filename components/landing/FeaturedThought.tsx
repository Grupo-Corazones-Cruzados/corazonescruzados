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
}: {
  windAway?: boolean;
  tema?: 'aventura' | 'progreso';
  /** La barra de consejo de la pantalla de inicio (2026-10-26): una cápsula de cristal sobre
   *  la raya, «PENSAMIENTO · “…” · fecha», como los consejos de una pantalla de carga. */
  compacto?: boolean;
  /** «EL CORAZÓN PIENSA» (2026-10-30): la nube de pensamiento que sale del corazón del titular.
   *  Sustituye a `compacto` en la portada. Ver la explicación en `NubePensamiento`, abajo. */
  nube?: boolean;
  /** Solo con `nube`: se esconde (vuelve al corazón) mientras hay un mundo elegido. */
  visible?: boolean;
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
 * «EL CORAZÓN PIENSA» — el pensamiento como NUBE DE PENSAMIENTO del corazón (Fernando, 2026-10-30:
 * *«reformula la presentación del pensamiento… más adaptada a nuestro diseño actual»*).
 *
 * Antes era una cápsula oscura al pie de la portada, encima de la frontera entre los dos mundos:
 * una caja ajena al resto, pegada al pie, que se comía 130 px de alto. Ahora lo piensa el corazón
 * del titular, como en un cómic: tres burbujas que crecen desde él y la nube de cristal (la misma
 * familia que la insignia «Proyecto de Desarrollo Humano»), con la etiqueta, la fecha y la frase
 * escribiéndose.
 *
 * · Escritorio ancho (≥ 1100 × 680): flota en el cielo, a la IZQUIERDA del corazón, sin ocupar
 *   sitio en el flujo. Su posición se MIDE (el corazón cambia de tamaño con la ventana).
 * · Más estrecho y teléfono: bajo el corazón y la Tierra (donde luego sale el eslogan), con las
 *   burbujas subiendo hasta el corazón. Su hueco se reserva mientras carga: nada salta.
 * · Al elegir un mundo vuelve al corazón (se encoge hacia él) ANTES de que el corazón salte, y
 *   deja el sitio al eslogan; al volver, reaparece. Sin pensamiento publicado, no hay nube.
 */
function NubePensamiento({
  data, loading, visible, texto, escribiendo, fecha,
}: {
  data: Featured | null; loading: boolean; visible: boolean;
  texto: string; escribiendo: boolean; fecha: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Tras esconderse, deja de ocupar sitio (en el flujo del teléfono), cuando termina la salida.
  const [montada, setMontada] = useState(visible);
  useEffect(() => {
    if (visible) { setMontada(true); return; }
    const id = window.setTimeout(() => setMontada(false), 320);
    return () => window.clearTimeout(id);
  }, [visible]);

  // Dónde está el corazón respecto a la cabeza de la portada (y respecto a la propia nube, para
  // que las burbujas suban justo hasta él en el teléfono).
  useLayoutEffect(() => {
    const nubeEl = ref.current;
    if (!nubeEl || !montada) return;
    const cabeza = nubeEl.closest('.portada-cabeza') as HTMLElement | null;
    const medir = () => {
      const corazon = cabeza?.querySelector('.grafico-corazon')?.getBoundingClientRect();
      if (!cabeza || !corazon) return;
      const c = cabeza.getBoundingClientRect();
      nubeEl.style.setProperty('--corazon-x', `${corazon.left - c.left}px`);
      nubeEl.style.setProperty('--corazon-y', `${corazon.top - c.top}px`);
      nubeEl.style.setProperty('--corazon-alto', `${corazon.height}px`);
      const n = nubeEl.getBoundingClientRect();
      nubeEl.style.setProperty('--cola-x', `${corazon.left + corazon.width / 2 - n.left}px`);
    };
    medir();
    const ro = new ResizeObserver(medir);
    if (cabeza) ro.observe(cabeza);
    window.addEventListener('resize', medir);
    return () => { ro.disconnect(); window.removeEventListener('resize', medir); };
  }, [montada, data]);

  if (!loading && !data) return null;
  if (!montada) return null;

  const lista = !!data && visible;
  return (
    <div
      ref={ref}
      className={`pensamiento-nube ${lista ? 'es-visible' : ''}`}
      role="note"
      aria-label="Pensamiento"
    >
      <span className="nube-burbuja nube-burbuja-1" aria-hidden="true" />
      <span className="nube-burbuja nube-burbuja-2" aria-hidden="true" />
      <span className="nube-burbuja nube-burbuja-3" aria-hidden="true" />
      <div className="nube-cuerpo cristal-portada">
        <p className="nube-etiqueta">
          <span className="pensamiento-barra-punto" aria-hidden="true" />
          Pensamiento
          {fecha && <span className="nube-fecha">· {fecha}</span>}
        </p>
        {data && (
          <>
            <p className="sr-only">{data.content}</p>
            <p className="nube-texto" aria-hidden="true">
              <span className="comilla-pensamiento">“</span>
              {texto}
              {escribiendo && <span style={{ color: 'var(--color-accent-glow)', animation: 'thoughtCaret 0.9s steps(1) infinite' }}>▌</span>}
              {!escribiendo && <span className="comilla-pensamiento">”</span>}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
